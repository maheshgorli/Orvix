"""
Earth Search STAC service for ORVIX (Earth Intelligence Systems).

Connects to Element 84 Earth Search STAC API:
  https://earth-search.aws.element84.com/v1

Provides provider-independent search, metadata inspection, Cloud-Optimized GeoTIFF (COG)
asset access, multi-band downloads, true-colour / false-colour compositing, and spectral
analysis (NDVI, NDWI, NBR) without requiring proprietary OAuth credentials.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
import numpy as np
import rasterio
from matplotlib import cm
from PIL import Image

from app.services.db_service import db_service
from app.services.image_service import image_service

logger = logging.getLogger(__name__)

STAC_API_URL = "https://earth-search.aws.element84.com/v1"

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_IMAGES_DIR = _BACKEND_DIR / "images"
_SATELLITE_DIR = _IMAGES_DIR / "satellite"
_THUMBNAILS_DIR = _IMAGES_DIR / "thumbnails"
_PROCESSED_DIR = _IMAGES_DIR / "processed"

# Ensure all target storage folders exist
for d in [_SATELLITE_DIR, _THUMBNAILS_DIR, _PROCESSED_DIR]:
    d.mkdir(parents=True, exist_ok=True)


class EarthSearchService:
    """Service for searching, downloading, and compositing satellite data from Earth Search STAC."""

    def __init__(self, api_url: str = STAC_API_URL) -> None:
        self.api_url = api_url

    async def check_connection_async(self) -> dict[str, Any]:
        """Verify reachability of the Earth Search STAC catalogue."""
        t0 = asyncio.get_event_loop().time()
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(f"{self.api_url}/collections")
                latency_ms = round((asyncio.get_event_loop().time() - t0) * 1000)
                if res.status_code == 200:
                    collections = [c.get("id") for c in res.json().get("collections", [])]
                    return {
                        "reachable": True,
                        "status_code": 200,
                        "latency_ms": latency_ms,
                        "collections": collections,
                        "message": f"Earth Search STAC online ({len(collections)} collections, {latency_ms}ms).",
                    }
                return {
                    "reachable": False,
                    "status_code": res.status_code,
                    "latency_ms": latency_ms,
                    "message": f"Earth Search returned HTTP {res.status_code}",
                }
        except Exception as exc:
            return {
                "reachable": False,
                "status_code": None,
                "message": f"Earth Search connection failed: {exc}",
            }

    async def get_available_collections(self) -> list[dict[str, Any]]:
        """Return list of supported collections in Earth Search."""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(f"{self.api_url}/collections")
                if res.status_code == 200:
                    return res.json().get("collections", [])
        except Exception as exc:
            logger.warning("Failed to fetch collections from Earth Search: %s", exc)
        return []

    async def search_scenes(
        self,
        latitude: float,
        longitude: float,
        bbox: Optional[list[float]] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        max_cloud: float = 100.0,
        collection: str = "sentinel-2-l2a",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Search the STAC catalogue for scenes matching spatial and temporal criteria.
        Returns parsed scene metadata records.
        """
        if bbox is None or len(bbox) != 4:
            extent = 0.05
            bbox = [
                round(longitude - extent, 6),
                round(latitude - extent, 6),
                round(longitude + extent, 6),
                round(latitude + extent, 6),
            ]

        # Datetime format: YYYY-MM-DDTHH:MM:SSZ/YYYY-MM-DDTHH:MM:SSZ
        datetime_str = None
        if date_from and date_to:
            datetime_str = f"{date_from}T00:00:00Z/{date_to}T23:59:59Z"

        payload: dict[str, Any] = {
            "collections": [collection],
            "bbox": bbox,
            "limit": limit,
        }
        if datetime_str:
            payload["datetime"] = datetime_str

        # Add cloud cover query filter
        if max_cloud < 100.0:
            payload["query"] = {"eo:cloud_cover": {"lte": max_cloud}}

        logger.info("Searching Earth Search STAC: collection=%s bbox=%s dt=%s", collection, bbox, datetime_str)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(f"{self.api_url}/search", json=payload)
                res.raise_for_status()
                data = res.json()
        except httpx.HTTPError as exc:
            logger.error("Earth Search search request failed: %s", exc)
            raise RuntimeError(f"STAC search request failed: {exc}") from exc

        features = data.get("features", [])
        results: list[dict[str, Any]] = []

        for feat in features:
            props = feat.get("properties", {})
            assets = feat.get("assets", {})
            cloud_cov = props.get("eo:cloud_cover", 0.0)

            # Extract available bands
            available_bands = [
                k for k in ["red", "green", "blue", "nir", "nir08", "swir16", "swir22", "visual"]
                if k in assets
            ]

            # Find thumbnail URL
            thumb_url = None
            if "thumbnail" in assets:
                thumb_url = assets["thumbnail"].get("href")
            elif "rendered_preview" in assets:
                thumb_url = assets["rendered_preview"].get("href")

            visual_url = assets.get("visual", {}).get("href")

            results.append({
                "scene_id": feat.get("id"),
                "collection": feat.get("collection", collection),
                "datetime": props.get("datetime"),
                "date": props.get("datetime", "")[:10],
                "cloud_cover": round(float(cloud_cov), 2),
                "bbox": feat.get("bbox", bbox),
                "platform": props.get("platform", "Sentinel-2"),
                "thumbnail_url": thumb_url,
                "visual_url": visual_url,
                "available_bands": available_bands,
                "assets": {
                    k: v.get("href") for k, v in assets.items() if v.get("href", "").startswith("https://")
                },
            })

        # Sort by cloud cover ascending, then datetime descending
        results.sort(key=lambda s: (s["cloud_cover"], -(datetime.fromisoformat(s["datetime"].replace("Z", "+00:00")).timestamp() if s.get("datetime") else 0)))
        return results

    async def get_scene_metadata(self, scene_id: str, collection: str = "sentinel-2-l2a") -> Optional[dict[str, Any]]:
        """Fetch raw STAC item metadata for a specific scene."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(f"{self.api_url}/collections/{collection}/items/{scene_id}")
                if res.status_code == 200:
                    feat = res.json()
                    props = feat.get("properties", {})
                    assets = feat.get("assets", {})
                    return {
                        "scene_id": feat.get("id"),
                        "collection": feat.get("collection", collection),
                        "datetime": props.get("datetime"),
                        "date": props.get("datetime", "")[:10],
                        "cloud_cover": round(float(props.get("eo:cloud_cover", 0.0)), 2),
                        "bbox": feat.get("bbox", []),
                        "platform": props.get("platform", "Sentinel-2"),
                        "thumbnail_url": assets.get("thumbnail", {}).get("href"),
                        "visual_url": assets.get("visual", {}).get("href"),
                        "assets": {
                            k: v.get("href") for k, v in assets.items() if v.get("href", "").startswith("https://")
                        },
                    }
        except Exception as exc:
            logger.warning("Failed to fetch scene metadata for %s: %s", scene_id, exc)
        return None

    def _generate_rgb_from_cogs(
        self,
        red_url: str,
        green_url: str,
        blue_url: str,
        out_shape: tuple[int, int] = (1024, 1024),
    ) -> np.ndarray:
        """
        Read red, green, and blue COGs, normalize, and apply 2%-98% percentile contrast stretch.
        Returns uint8 array of shape (H, W, 3).
        """
        bands = []
        for url in [red_url, green_url, blue_url]:
            with rasterio.open(url) as src:
                arr = src.read(1, out_shape=out_shape).astype(np.float32)
                bands.append(arr)

        rgb = np.stack(bands, axis=-1)
        result = np.zeros(rgb.shape, dtype=np.uint8)
        valid = np.all(np.isfinite(rgb) & (rgb > 0), axis=2)

        for c in range(3):
            vals = rgb[:, :, c][valid]
            if len(vals) > 0:
                low, high = np.percentile(vals, [2, 98])
                if high > low:
                    stretched = np.clip((rgb[:, :, c] - low) / (high - low), 0.0, 1.0)
                    result[:, :, c] = (stretched * 255).astype(np.uint8)
                else:
                    result[:, :, c] = np.clip(rgb[:, :, c], 0, 255).astype(np.uint8)

        return result

    def _read_visual_tci(
        self,
        visual_url: str,
        out_shape: tuple[int, int] = (1024, 1024),
    ) -> np.ndarray:
        """Read 3-band True Color Image (TCI) GeoTIFF directly via rasterio."""
        with rasterio.open(visual_url) as src:
            arr = src.read(out_shape=(src.count, out_shape[0], out_shape[1]))
            # Transpose (C, H, W) -> (H, W, C)
            rgb = np.transpose(arr, (1, 2, 0))
            if rgb.dtype != np.uint8:
                rgb = np.clip(rgb, 0, 255).astype(np.uint8)
            return rgb

    def _compute_index_array(
        self,
        band1_url: str,
        band2_url: str,
        out_shape: tuple[int, int] = (1024, 1024),
    ) -> np.ndarray:
        """Compute normalized difference index: (Band1 - Band2) / (Band1 + Band2)."""
        with rasterio.open(band1_url) as src1, rasterio.open(band2_url) as src2:
            b1 = src1.read(1, out_shape=out_shape).astype(np.float32)
            b2 = src2.read(1, out_shape=out_shape).astype(np.float32)

        denom = b1 + b2
        index = np.zeros_like(b1)
        valid = np.isfinite(b1) & np.isfinite(b2) & (denom > 0)
        index[valid] = (b1[valid] - b2[valid]) / denom[valid]
        return np.clip(index, -1.0, 1.0)

    def _save_colormap_image(
        self,
        arr: np.ndarray,
        dest_path: Path,
        cmap_name: str = "RdYlGn",
        vmin: float = -0.2,
        vmax: float = 0.8,
    ) -> None:
        """Apply a colormap to a 2D scalar float array and save as PNG."""
        norm_arr = np.clip((arr - vmin) / (vmax - vmin), 0.0, 1.0)
        try:
            import matplotlib
            cmap = matplotlib.colormaps[cmap_name]
        except Exception:
            cmap = cm.get_cmap(cmap_name)
        rgba = cmap(norm_arr)
        rgb_uint8 = (rgba[:, :, :3] * 255).astype(np.uint8)
        img = Image.fromarray(rgb_uint8, mode="RGB")
        img.save(dest_path, "PNG")

    async def acquire_scene(
        self,
        scene_id: Optional[str] = None,
        latitude: float = 44.3187,
        longitude: float = -106.9325,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        collection: str = "sentinel-2-l2a",
        max_cloud: float = 100.0,
        output_type: str = "true_color",
        resolution: int = 10,
        event_type: str = "satellite",
        bbox_size: float = 0.05,
        compute_multispectral: bool = True,
        base_url: str = "http://127.0.0.1:8000",
    ) -> dict[str, Any]:
        """
        Execute full scene acquisition:
        1. Resolve target scene (by ID or search best available).
        2. Download/cache thumbnail preview.
        3. Read/composite True Color RGB image.
        4. If multispectral requested, compute False Color, NDVI, NDWI, NBR.
        5. Persist acquisition metadata to db_service and local JSON.
        """
        logger.info(
            "Acquiring scene: id=%s lat=%.4f lon=%.4f coll=%s type=%s",
            scene_id, latitude, longitude, collection, output_type,
        )

        selected_scene = None

        # 1. If scene_id given, get metadata directly
        if scene_id:
            selected_scene = await self.get_scene_metadata(scene_id, collection)

        # If no scene_id or not found, search STAC for best scene
        if not selected_scene:
            scenes = await self.search_scenes(
                latitude=latitude,
                longitude=longitude,
                date_from=date_from,
                date_to=date_to,
                max_cloud=max_cloud,
                collection=collection,
                limit=5,
            )
            if not scenes:
                raise RuntimeError(
                    f"No satellite scenes found for location ({latitude:.4f}, {longitude:.4f}) "
                    f"in date range {date_from} to {date_to} with cloud cover <= {max_cloud}%."
                )
            selected_scene = scenes[0]

        sid = selected_scene["scene_id"]
        assets = selected_scene.get("assets", {})
        cloud_cov = selected_scene.get("cloud_cover", 0.0)
        dt_str = selected_scene.get("datetime") or datetime.now(timezone.utc).isoformat()
        date_clean = dt_str[:10]

        # 2. Cache thumbnail (instant JPEG preview)
        thumb_filename = f"{sid}_thumb.jpg"
        thumb_path = _THUMBNAILS_DIR / thumb_filename
        thumb_url_api = f"{base_url}/images/thumbnails/{thumb_filename}"

        if not thumb_path.exists() and selected_scene.get("thumbnail_url"):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    t_res = await client.get(selected_scene["thumbnail_url"])
                    if t_res.status_code == 200:
                        thumb_path.write_bytes(t_res.content)
            except Exception as exc:
                logger.warning("Could not download thumbnail for %s: %s", sid, exc)

        # 3. Build True Color RGB composite
        rgb_filename = f"{sid}_rgb.png"
        rgb_path = _SATELLITE_DIR / rgb_filename
        rgb_url_api = f"{base_url}/images/satellite/{rgb_filename}"

        loop = asyncio.get_running_loop()

        def _generate_rgb() -> np.ndarray:
            # Check if official TCI is available
            visual_url = assets.get("visual")
            if visual_url:
                try:
                    return self._read_visual_tci(visual_url, out_shape=(1024, 1024))
                except Exception as exc:
                    logger.warning("Visual TCI read failed, falling back to bands: %s", exc)

            # Fallback to stacking red, green, blue bands
            red_url = assets.get("red")
            green_url = assets.get("green")
            blue_url = assets.get("blue")
            if red_url and green_url and blue_url:
                return self._generate_rgb_from_cogs(red_url, green_url, blue_url, out_shape=(1024, 1024))

            raise RuntimeError(f"Scene {sid} lacks required RGB visual or spectral band assets.")

        if not rgb_path.exists():
            rgb_arr = await loop.run_in_executor(None, _generate_rgb)
            img = Image.fromarray(rgb_arr, mode="RGB")
            img.save(rgb_path, "PNG")

            # Also save into image_service legacy directory so the entire app sees it
            try:
                image_service.save(
                    array=rgb_arr,
                    event_type=event_type,
                    latitude=latitude,
                    longitude=longitude,
                )
            except Exception as exc:
                logger.warning("Could not mirror image to image_service: %s", exc)

        # 4. Multispectral indices (NDVI, NDWI, NBR, False Color)
        indices_urls: dict[str, str] = {}

        if compute_multispectral:
            def _compute_all_indices():
                res_dict = {}
                red_url = assets.get("red")
                green_url = assets.get("green")
                nir_url = assets.get("nir")
                swir22_url = assets.get("swir22") or assets.get("swir16")

                # False Color (NIR, Red, Green)
                if nir_url and red_url and green_url:
                    fc_filename = f"{sid}_false_color.png"
                    fc_path = _SATELLITE_DIR / fc_filename
                    if not fc_path.exists():
                        try:
                            fc_arr = self._generate_rgb_from_cogs(nir_url, red_url, green_url, out_shape=(1024, 1024))
                            Image.fromarray(fc_arr, mode="RGB").save(fc_path, "PNG")
                        except Exception as e:
                            logger.warning("False color generation failed: %s", e)
                    if fc_path.exists():
                        res_dict["false_color"] = f"{base_url}/images/satellite/{fc_filename}"

                # NDVI = (NIR - Red) / (NIR + Red)
                if nir_url and red_url:
                    ndvi_filename = f"{sid}_ndvi.png"
                    ndvi_path = _PROCESSED_DIR / ndvi_filename
                    if not ndvi_path.exists():
                        try:
                            ndvi_arr = self._compute_index_array(nir_url, red_url, out_shape=(1024, 1024))
                            self._save_colormap_image(ndvi_arr, ndvi_path, cmap_name="RdYlGn", vmin=-0.1, vmax=0.7)
                        except Exception as e:
                            logger.warning("NDVI calculation failed: %s", e)
                    if ndvi_path.exists():
                        res_dict["ndvi"] = f"{base_url}/images/processed/{ndvi_filename}"

                # NDWI = (Green - NIR) / (Green + NIR)
                if green_url and nir_url:
                    ndwi_filename = f"{sid}_ndwi.png"
                    ndwi_path = _PROCESSED_DIR / ndwi_filename
                    if not ndwi_path.exists():
                        try:
                            ndwi_arr = self._compute_index_array(green_url, nir_url, out_shape=(1024, 1024))
                            self._save_colormap_image(ndwi_arr, ndwi_path, cmap_name="Blues", vmin=-0.5, vmax=0.5)
                        except Exception as e:
                            logger.warning("NDWI calculation failed: %s", e)
                    if ndwi_path.exists():
                        res_dict["ndwi"] = f"{base_url}/images/processed/{ndwi_filename}"

                # NBR = (NIR - SWIR22) / (NIR + SWIR22)
                if nir_url and swir22_url:
                    nbr_filename = f"{sid}_nbr.png"
                    nbr_path = _PROCESSED_DIR / nbr_filename
                    if not nbr_path.exists():
                        try:
                            nbr_arr = self._compute_index_array(nir_url, swir22_url, out_shape=(1024, 1024))
                            self._save_colormap_image(nbr_arr, nbr_path, cmap_name="hot", vmin=-0.2, vmax=0.8)
                        except Exception as e:
                            logger.warning("NBR calculation failed: %s", e)
                    if nbr_path.exists():
                        res_dict["nbr"] = f"{base_url}/images/processed/{nbr_filename}"

                return res_dict

            indices_urls = await loop.run_in_executor(None, _compute_all_indices)

        # 5. Build acquisition result record
        acquisition_id = f"acq_{sid}_{int(datetime.now(timezone.utc).timestamp())}"
        file_size_bytes = rgb_path.stat().st_size if rgb_path.exists() else 0

        acquisition_doc = {
            "acquisition_id": acquisition_id,
            "scene_id": sid,
            "collection": collection,
            "platform": selected_scene.get("platform", "Sentinel-2"),
            "datetime": dt_str,
            "date": date_clean,
            "latitude": latitude,
            "longitude": longitude,
            "cloud_cover": cloud_cov,
            "resolution": resolution,
            "event_type": event_type,
            "image_url": rgb_url_api,
            "thumbnail_url": thumb_url_api if thumb_path.exists() else (selected_scene.get("thumbnail_url") or rgb_url_api),
            "image_path": f"images/satellite/{rgb_filename}",
            "filename": rgb_filename,
            "file_size_bytes": file_size_bytes,
            "bbox": selected_scene.get("bbox", []),
            "bands_available": list(assets.keys()),
            "indices": indices_urls,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # 6. Persist to MongoDB and local acquisitions.json
        await db_service.save_acquisition(acquisition_doc)

        return acquisition_doc


# Singleton service export
earth_search = EarthSearchService()
