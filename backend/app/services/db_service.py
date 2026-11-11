"""
Database service for ORVIX (Earth Intelligence Systems).

Responsibilities
----------------
- Manage asynchronous MongoDB connections via Motor (motor.motor_asyncio).
- Provide persistence operations for:
  * disaster_events (deduplicated by EONET event_id)
  * image_metadata (metadata + disk file path; binary images stay on disk)
  * acquisition_history (log of imagery requests)
  * monitoring_sessions (records of periodic monitoring executions)
  * alerts (severity / disaster alert notifications)
  * detection_results (future AI/CV analysis records)
- Support graceful degradation: if MONGODB_URI is unconfigured or unreachable,
  all operations log a diagnostic warning and return safely without crashing the API.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import UpdateOne
from pymongo.errors import ConnectionFailure, PyMongoError, ServerSelectionTimeoutError

from app.config import settings

logger = logging.getLogger(__name__)


class _DatabaseService:
    """Central async MongoDB manager using Motor."""

    def __init__(self) -> None:
        self._client: Optional[AsyncIOMotorClient] = None
        self._db: Optional[AsyncIOMotorDatabase] = None
        self._indexes_initialized: bool = False

    @property
    def is_configured(self) -> bool:
        """Check if MONGODB_URI is provided in settings."""
        return bool(settings.mongodb_uri.strip())

    def get_database(self) -> Optional[AsyncIOMotorDatabase]:
        """
        Return the cached Motor database instance, or initialize one if configured.
        Returns None if MONGODB_URI is not set.
        """
        if not self.is_configured:
            return None

        if self._db is None:
            try:
                self._client = AsyncIOMotorClient(
                    settings.mongodb_uri,
                    serverSelectionTimeoutMS=2000,
                    connectTimeoutMS=2000,
                )
                self._db = self._client[settings.mongodb_db_name]
                logger.info("Motor client initialized for database '%s'", settings.mongodb_db_name)
            except Exception as exc:
                logger.warning("Failed to initialize Motor client: %s", exc)
                return None

        return self._db

    async def init_indexes(self) -> None:
        """Create indexes on collections if connected (idempotent)."""
        db = self.get_database()
        if db is None or self._indexes_initialized:
            return

        try:
            # Unique index on EONET event_id for automatic deduplication
            await db.disaster_events.create_index("event_id", unique=True)
            await db.disaster_events.create_index("category_id")
            await db.disaster_events.create_index("date")

            # Indexes on image metadata
            await db.image_metadata.create_index("filename", unique=True)
            await db.image_metadata.create_index("captured_at")
            await db.image_metadata.create_index([("latitude", 1), ("longitude", 1)])

            # Indexes on acquisition history & monitoring
            await db.acquisition_history.create_index("timestamp")
            await db.monitoring_sessions.create_index("timestamp")
            await db.alerts.create_index("created_at")
            await db.detection_results.create_index("image_id")

            self._indexes_initialized = True
            logger.info("MongoDB indexes successfully created/verified.")
        except Exception as exc:
            logger.warning("Could not initialize MongoDB indexes (DB may be offline): %s", exc)

    async def check_connection_async(self) -> dict[str, Any]:
        """
        Verify connection reachability.
        Returns structured health info safe for public status endpoints.
        """
        if not self.is_configured:
            return {
                "configured": False,
                "reachable": False,
                "database": None,
                "message": "MongoDB is not configured (MONGODB_URI not set). App running with memory/disk persistence only.",
            }

        db = self.get_database()
        if db is None:
            return {
                "configured": True,
                "reachable": False,
                "database": settings.mongodb_db_name,
                "message": "Failed to create MongoDB client.",
            }

        try:
            # Ping admin command with short timeout
            await db.client.admin.command("ping")
            await self.init_indexes()
            return {
                "configured": True,
                "reachable": True,
                "database": settings.mongodb_db_name,
                "message": f"Connected to MongoDB database '{settings.mongodb_db_name}'.",
            }
        except (ServerSelectionTimeoutError, ConnectionFailure) as exc:
            return {
                "configured": True,
                "reachable": False,
                "database": settings.mongodb_db_name,
                "message": f"MongoDB server unreachable: {exc}",
            }
        except Exception as exc:
            return {
                "configured": True,
                "reachable": False,
                "database": settings.mongodb_db_name,
                "message": f"MongoDB error: {exc}",
            }

    # ── 1. Disaster Events (Deduplicated by EONET id) ─────────────────────────

    async def upsert_disaster_event(self, event_dict: dict[str, Any]) -> bool:
        """
        Upsert a single disaster event, deduplicating on event_id.
        Returns True on success, False if skipped/failed.
        """
        db = self.get_database()
        if db is None:
            return False

        event_id = event_dict.get("event_id")
        if not event_id:
            logger.warning("Cannot persist event without event_id: %s", event_dict)
            return False

        now = datetime.now(timezone.utc).isoformat()
        doc = dict(event_dict)
        doc["updated_at"] = now

        try:
            await db.disaster_events.update_one(
                {"event_id": event_id},
                {
                    "$set": doc,
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )
            return True
        except PyMongoError as exc:
            logger.warning("Failed to upsert event '%s' to MongoDB: %s", event_id, exc)
            return False

    async def bulk_upsert_disaster_events(self, events: list[dict[str, Any]]) -> int:
        """
        Bulk upsert multiple disaster events, deduplicated by event_id.
        Returns the count of successfully upserted/modified records.
        """
        db = self.get_database()
        if db is None or not events:
            return 0

        now = datetime.now(timezone.utc).isoformat()
        operations = []
        for ev in events:
            eid = ev.get("event_id")
            if not eid:
                continue
            doc = dict(ev)
            doc["updated_at"] = now
            operations.append(
                UpdateOne(
                    {"event_id": eid},
                    {
                        "$set": doc,
                        "$setOnInsert": {"created_at": now},
                    },
                    upsert=True,
                )
            )

        if not operations:
            return 0

        try:
            result = await db.disaster_events.bulk_write(operations, ordered=False)
            count = result.upserted_count + result.modified_count
            logger.debug("Bulk upserted %d disaster event(s) to MongoDB.", count)
            return count
        except PyMongoError as exc:
            logger.warning("Bulk upsert of disaster events failed: %s", exc)
            return 0

    async def get_disaster_events(
        self,
        category_id: Optional[str] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Query stored disaster events."""
        db = self.get_database()
        if db is None:
            return []

        query: dict[str, Any] = {}
        if category_id:
            query["category_id"] = category_id

        try:
            cursor = db.disaster_events.find(query, {"_id": 0}).sort("date", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except PyMongoError as exc:
            logger.warning("Failed to query disaster events from MongoDB: %s", exc)
            return []

    # ── 2. Image Metadata ─────────────────────────────────────────────────────

    async def save_image_metadata(self, meta_dict: dict[str, Any]) -> bool:
        """
        Store image metadata in the database (binary file is stored on disk).
        Deduplicates/upserts by filename.
        """
        db = self.get_database()
        if db is None:
            return False

        filename = meta_dict.get("filename")
        if not filename:
            logger.warning("Cannot save image metadata without filename.")
            return False

        now = datetime.now(timezone.utc).isoformat()
        doc = dict(meta_dict)
        doc["updated_at"] = now

        try:
            await db.image_metadata.update_one(
                {"filename": filename},
                {
                    "$set": doc,
                    "$setOnInsert": {"created_at": now},
                },
                upsert=True,
            )
            logger.debug("Saved metadata for image '%s' to MongoDB.", filename)
            return True
        except PyMongoError as exc:
            logger.warning("Failed to save image metadata for '%s': %s", filename, exc)
            return False

    async def list_image_metadata(self, limit: int = 100) -> list[dict[str, Any]]:
        """Retrieve stored image metadata records, newest first."""
        db = self.get_database()
        if db is None:
            return []

        try:
            cursor = db.image_metadata.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except PyMongoError as exc:
            logger.warning("Failed to list image metadata from MongoDB: %s", exc)
            return []

    # ── 3. Acquisition History ────────────────────────────────────────────────

    async def log_acquisition(
        self,
        request_params: dict[str, Any],
        status: str,
        result_summary: Optional[dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> bool:
        """Log a satellite imagery acquisition attempt."""
        db = self.get_database()
        if db is None:
            return False

        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "request": request_params,
            "result": result_summary,
            "error": error_message,
        }

        try:
            await db.acquisition_history.insert_one(record)
            return True
        except PyMongoError as exc:
            logger.warning("Failed to log acquisition history: %s", exc)
            return False

    # ── 4. Monitoring Sessions ────────────────────────────────────────────────

    async def save_monitoring_session(self, session_data: dict[str, Any]) -> bool:
        """Record the summary and outcomes of a monitoring run."""
        db = self.get_database()
        if db is None:
            return False

        record = dict(session_data)
        record["timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            await db.monitoring_sessions.insert_one(record)
            return True
        except PyMongoError as exc:
            logger.warning("Failed to save monitoring session: %s", exc)
            return False

    # ── 5. Alerts ─────────────────────────────────────────────────────────────

    async def create_alert(
        self,
        event_id: str,
        category: str,
        severity: str,
        message: str,
        location: Optional[dict[str, float]] = None,
    ) -> bool:
        """Store an alert record for a critical disaster occurrence."""
        db = self.get_database()
        if db is None:
            return False

        alert = {
            "event_id": event_id,
            "category": category,
            "severity": severity,
            "message": message,
            "location": location,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active",
        }

        try:
            await db.alerts.insert_one(alert)
            return True
        except PyMongoError as exc:
            logger.warning("Failed to persist alert for event '%s': %s", event_id, exc)
            return False

    async def insert_alert(self, alert_dict: dict[str, Any]) -> bool:
        """Store an alert dictionary in the database."""
        db = self.get_database()
        if db is None:
            return False
        try:
            await db.alerts.insert_one(alert_dict)
            return True
        except PyMongoError as exc:
            logger.warning("Failed to insert alert: %s", exc)
            return False

    # ── 6. Detection Results (Future AI/CV) ────────────────────────────────────

    async def save_detection_result(self, result_dict: dict[str, Any]) -> bool:
        """Persist structured analysis/detection results."""
        db = self.get_database()
        if db is None:
            return False

        doc = dict(result_dict)
        doc["recorded_at"] = datetime.now(timezone.utc).isoformat()

        try:
            await db.detection_results.insert_one(doc)
            return True
        except PyMongoError as exc:
            logger.warning("Failed to save detection result: %s", exc)
            return False


#: Module-level database service singleton
db_service = _DatabaseService()

