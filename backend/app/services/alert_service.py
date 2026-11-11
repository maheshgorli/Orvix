"""
ORVIX Alert Management & Notification Service.

Features:
- Configurable hazard thresholds (proximity distance, severity level)
- Automated alert generation from active NASA EONET events and high-risk assessments
- Alert status tracking (active -> acknowledged -> resolved)
- Alert history queries with filtering
- Pluggable notification dispatch architecture
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Optional
import uuid

from app.services.db_service import db_service

logger = logging.getLogger(__name__)

_ALERTS_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "alerts.json"
_ALERTS_FILE.parent.mkdir(parents=True, exist_ok=True)


@dataclass
class AlertRecord:
    """Individual system alert entity."""
    alert_id: str
    title: str
    category: str              # "Wildfire", "Severe Storm", "High Risk Zone", "System"
    severity: str              # "CRITICAL", "HIGH", "MEDIUM", "INFO"
    latitude: Optional[float]
    longitude: Optional[float]
    description: str
    source_event_id: Optional[str]
    status: str                # "active", "acknowledged", "resolved"
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AlertRulesConfig:
    """Configurable alert rules and thresholds."""
    wildfire_radius_km: float = 150.0
    storm_radius_km: float = 250.0
    risk_score_threshold: float = 65.0
    auto_generate_alerts: bool = True
    notification_email_enabled: bool = False
    recipient_email: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class _AlertService:
    """Manages system alerts, thresholds, and notifications."""

    def __init__(self) -> None:
        self._rules = AlertRulesConfig()
        self._in_memory_alerts: dict[str, AlertRecord] = {}
        self._load_local_alerts()

    def _load_local_alerts(self) -> None:
        if _ALERTS_FILE.exists():
            try:
                with open(_ALERTS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        rec = AlertRecord(**item)
                        self._in_memory_alerts[rec.alert_id] = rec
            except Exception as exc:
                logger.warning("Could not read local alerts file: %s", exc)

    def _save_local_alerts(self) -> None:
        try:
            _ALERTS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(_ALERTS_FILE, "w", encoding="utf-8") as f:
                json.dump([rec.to_dict() for rec in self._in_memory_alerts.values()], f, indent=2)
        except Exception as exc:
            logger.warning("Could not persist local alerts: %s", exc)

    def get_rules(self) -> AlertRulesConfig:
        return self._rules

    def update_rules(self, updates: dict[str, Any]) -> AlertRulesConfig:
        if "wildfire_radius_km" in updates:
            self._rules.wildfire_radius_km = float(updates["wildfire_radius_km"])
        if "storm_radius_km" in updates:
            self._rules.storm_radius_km = float(updates["storm_radius_km"])
        if "risk_score_threshold" in updates:
            self._rules.risk_score_threshold = float(updates["risk_score_threshold"])
        if "auto_generate_alerts" in updates:
            self._rules.auto_generate_alerts = bool(updates["auto_generate_alerts"])
        if "notification_email_enabled" in updates:
            self._rules.notification_email_enabled = bool(updates["notification_email_enabled"])
        if "recipient_email" in updates:
            self._rules.recipient_email = str(updates["recipient_email"])
        return self._rules

    async def create_alert(
        self,
        title: str,
        category: str,
        severity: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        description: str = "",
        source_event_id: Optional[str] = None,
    ) -> AlertRecord:
        now_str = datetime.now(timezone.utc).isoformat()
        alert_id = f"ALT_{uuid.uuid4().hex[:8].upper()}"

        rec = AlertRecord(
            alert_id=alert_id,
            title=title,
            category=category,
            severity=severity.upper(),
            latitude=latitude,
            longitude=longitude,
            description=description,
            source_event_id=source_event_id,
            status="active",
            created_at=now_str,
            updated_at=now_str,
        )

        self._in_memory_alerts[alert_id] = rec
        self._save_local_alerts()

        # Persist to MongoDB if available
        try:
            await db_service.insert_alert(rec.to_dict())
        except Exception as exc:
            logger.debug("MongoDB alert insert skipped: %s", exc)

        logger.info("Created alert [%s] %s (%s)", rec.severity, rec.title, rec.alert_id)
        return rec

    async def generate_alerts_from_events(self, events: list[dict[str, Any]]) -> list[AlertRecord]:
        """Examine disaster events and generate alerts based on rules."""
        if not self._rules.auto_generate_alerts:
            return []

        generated: list[AlertRecord] = []
        for evt in events:
            eid = evt.get("event_id") or ""
            # Avoid duplicate alert for same event
            if any(a.source_event_id == eid for a in self._in_memory_alerts.values()):
                continue

            cat = evt.get("category_id") or ""
            title = evt.get("title") or "Unnamed Hazard"
            lat = evt.get("latitude")
            lon = evt.get("longitude")

            if cat == "wildfires":
                severity = "HIGH"
                desc = f"Active wildfire incident detected by NASA EONET. Geolocation: {lat}, {lon}."
                rec = await self.create_alert(
                    title=f"Wildfire Threat: {title[:40]}",
                    category="Wildfire",
                    severity=severity,
                    latitude=lat,
                    longitude=lon,
                    description=desc,
                    source_event_id=eid,
                )
                generated.append(rec)
            elif cat == "severeStorms":
                severity = "CRITICAL"
                desc = f"Severe storm system observed in tropical/maritime basin. Geolocation: {lat}, {lon}."
                rec = await self.create_alert(
                    title=f"Severe Storm Warning: {title[:40]}",
                    category="Severe Storm",
                    severity=severity,
                    latitude=lat,
                    longitude=lon,
                    description=desc,
                    source_event_id=eid,
                )
                generated.append(rec)

        return generated

    def list_alerts(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100,
    ) -> list[AlertRecord]:
        alerts = list(self._in_memory_alerts.values())
        # Sort newest first
        alerts.sort(key=lambda a: a.created_at, reverse=True)

        if status and status.lower() != "all":
            alerts = [a for a in alerts if a.status.lower() == status.lower()]
        if severity and severity.lower() != "all":
            alerts = [a for a in alerts if a.severity.lower() == severity.lower()]

        return alerts[:limit]

    def update_alert_status(self, alert_id: str, new_status: str) -> Optional[AlertRecord]:
        rec = self._in_memory_alerts.get(alert_id)
        if not rec:
            return None
        rec.status = new_status.lower()
        rec.updated_at = datetime.now(timezone.utc).isoformat()
        self._save_local_alerts()
        return rec


alert_service = _AlertService()
