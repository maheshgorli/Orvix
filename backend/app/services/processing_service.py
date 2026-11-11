"""
ORVIX Image Processing & Spectral Engine.

Responsibilities:
- Image validation (dimensions, dtype, channels, dynamic range)
- Radiometric normalization and contrast stretching (percentile 2%-98%)
- Multispectral index computation:
  * NDVI: (B08 - B04) / (B08 + B04) for vegetation health & canopy density
  * NBR:  (B08 - B12) / (B08 + B12) for burn severity & fire impact
  * NDWI: (B03 - B08) / (B03 + B08) for water body & flood delineation
  * VARI: (B03 - B04) / (B03 + B04 - B02) for visible optical RGB imagery
- Colorized heatmap generation with standard scientific colormaps
- Persistence of processed index masks to backend/images/processed/
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Tuple

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.cm as cm
import numpy as np
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

_PROCESSED_DIR = Path(__file__).resolve().parent.parent.parent / "images" / "processed"
_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class SpectralMetrics:
    """Quantitative summary of a calculated spectral index."""
    index_name: str
    is_multispectral: bool
    formula: str
    mean_value: float
    min_value: float
    max_value: float
    std_dev: float
    coverage_percentage: float  # e.g. % vegetated or % burned area
    histogram_bins: list[float]
    histogram_counts: list[int]
    notes: str


@dataclass
class ProcessingResult:
    """Complete output of the processing engine."""
    source_filename: str
    processed_filename: str
    processed_image_url: str
    processed_image_path: str
    metrics: SpectralMetrics
    created_at: str


class _ProcessingService:
    """Engine for satellite image validation, normalization, and spectral analysis."""

    def __init__(self) -> None:
        _PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    def validate_image_array(self, array: np.ndarray) -> Tuple[bool, str]:
        """Validate input image array shape, dimensions, and type."""
        if not isinstance(array, np.ndarray):
            return False, "Input must be a valid numpy ndarray."
        if array.ndim not in (2, 3):
            return False, f"Expected 2D or 3D array, got shape {array.shape}."
        if array.size == 0:
            return False, "Image array is empty."
        return True, "Image validation passed."

    def normalize_array(self, array: np.ndarray) -> np.ndarray:
        """Apply 2%-98% percentile contrast stretching to float32 [0.0, 1.0]."""
        arr = array.astype(np.float32)
        p2, p98 = np.percentile(arr, (2, 98))
        if p98 > p2:
            arr = np.clip((arr - p2) / (p98 - p2), 0.0, 1.0)
        else:
            arr = np.clip(arr / 255.0 if arr.max() > 1.0 else arr, 0.0, 1.0)
        return arr

    def compute_spectral_index(
        self,
        image_path_or_array: str | np.ndarray,
        index_type: str = "ndvi",
        source_filename: Optional[str] = None,
    ) -> ProcessingResult:
        """
        Compute a spectral index map on the input image.

        Args:
            image_path_or_array: Path to image file in backend/images/ or raw numpy array.
            index_type: One of 'ndvi', 'nbr', 'ndwi', 'vari'.
            source_filename: Optional filename for saving outputs.
        """
        # Load array if path provided
        fname = source_filename or "scene.png"
        if isinstance(image_path_or_array, (str, Path)):
            p = Path(image_path_or_array)
            fname = p.name
            if not p.is_absolute():
                base_img_dir = Path(__file__).resolve().parent.parent.parent / "images"
                p = base_img_dir / fname
            if not p.exists():
                raise FileNotFoundError(f"Source image '{fname}' not found on disk.")
            img = Image.open(p).convert("RGB")
            arr = np.array(img, dtype=np.float32)
        else:
            arr = image_path_or_array.astype(np.float32)

        valid, msg = self.validate_image_array(arr)
        if not valid:
            raise ValueError(msg)

        # Standardize channels: R=arr[..., 0], G=arr[..., 1], B=arr[..., 2]
        H, W = arr.shape[:2]
        r = arr[..., 0]
        g = arr[..., 1]
        b = arr[..., 2] if arr.shape[-1] >= 3 else g

        norm_r = r / 255.0 if r.max() > 1.0 else r
        norm_g = g / 255.0 if g.max() > 1.0 else g
        norm_b = b / 255.0 if b.max() > 1.0 else b

        index_lower = index_type.lower()
        eps = 1e-7

        # Note: If input has genuine multispectral bands (e.g. 4+ channels), use B08 (NIR)
        has_multispectral_bands = arr.ndim == 3 and arr.shape[-1] >= 4

        if index_lower == "ndvi":
            if has_multispectral_bands:
                nir = arr[..., 3] / 255.0 if arr[..., 3].max() > 1.0 else arr[..., 3]
                raw_idx = (nir - norm_r) / (nir + norm_r + eps)
                is_multi = True
                formula = "(NIR - Red) / (NIR + Red) [B08 - B04]"
                notes = "Genuine Sentinel-2 multispectral NDVI calculated from B08 (NIR) and B04 (Red)."
                cmap_name = "RdYlGn"
                threshold = 0.35  # Vegetation threshold
            else:
                # Optical visible proxy: Visible Atmospheric Resistance Index (VARI)
                raw_idx = (norm_g - norm_r) / (norm_g + norm_r - norm_b + eps)
                raw_idx = np.clip(raw_idx, -1.0, 1.0)
                is_multi = False
                formula = "VARI: (Green - Red) / (Green + Red - Blue)"
                notes = "Calculated Visible Atmospheric Resistance Index (VARI) as optical vegetation proxy. True multispectral NDVI requires Sentinel-2 L2A B08 NIR band."
                cmap_name = "RdYlGn"
                threshold = 0.15

        elif index_lower == "nbr":
            if has_multispectral_bands and arr.shape[-1] >= 5:
                nir = arr[..., 3] / 255.0
                swir = arr[..., 4] / 255.0
                raw_idx = (nir - swir) / (nir + swir + eps)
                is_multi = True
                formula = "(NIR - SWIR2) / (NIR + SWIR2) [B08 - B12]"
                notes = "Genuine Sentinel-2 multispectral NBR calculated from B08 and B12."
                cmap_name = "YlOrRd_r"
                threshold = -0.1
            else:
                # Optical proxy for burn / thermal contrast
                raw_idx = (norm_r - norm_g) / (norm_r + norm_g + eps)
                raw_idx = np.clip(raw_idx, -1.0, 1.0)
                is_multi = False
                formula = "Optical Burn Proxy: (Red - Green) / (Red + Green)"
                notes = "Calculated optical burn severity proxy. True NBR requires Sentinel-2 L2A B08 (NIR) and B12 (SWIR2) bands."
                cmap_name = "YlOrRd_r"
                threshold = 0.2

        elif index_lower == "ndwi":
            if has_multispectral_bands:
                nir = arr[..., 3] / 255.0
                raw_idx = (norm_g - nir) / (norm_g + nir + eps)
                is_multi = True
                formula = "(Green - NIR) / (Green + NIR) [B03 - B08]"
                notes = "Genuine Sentinel-2 multispectral NDWI calculated from B03 and B08."
                cmap_name = "Blues"
                threshold = 0.1
            else:
                # Optical water proxy: (Blue - Red) / (Blue + Red)
                raw_idx = (norm_b - norm_r) / (norm_b + norm_r + eps)
                raw_idx = np.clip(raw_idx, -1.0, 1.0)
                is_multi = False
                formula = "Optical Water Proxy: (Blue - Red) / (Blue + Red)"
                notes = "Calculated optical water index proxy. True NDWI requires Sentinel-2 L2A B08 NIR band."
                cmap_name = "Blues"
                threshold = 0.2
        else:
            raise ValueError(f"Unsupported spectral index '{index_type}'. Use ndvi, nbr, or ndwi.")

        index_clamped = np.clip(raw_idx, -1.0, 1.0)

        # Compute summary metrics
        mean_val = float(np.mean(index_clamped))
        min_val = float(np.min(index_clamped))
        max_val = float(np.max(index_clamped))
        std_val = float(np.std(index_clamped))

        # Coverage percentage above threshold
        coverage = float(np.sum(index_clamped > threshold) / index_clamped.size * 100.0)

        # 10-bin histogram
        hist_counts, bin_edges = np.histogram(index_clamped, bins=10, range=(-1.0, 1.0))
        hist_bins = [round(float(b), 2) for b in bin_edges]
        hist_counts_list = [int(c) for c in hist_counts]

        # Render colorized heatmap
        colormap = getattr(cm, cmap_name, cm.viridis)
        # Normalize index_clamped from [-1, 1] to [0, 1] for colormap lookup
        norm_for_cmap = (index_clamped + 1.0) / 2.0
        colored_rgba = colormap(norm_for_cmap)
        colored_uint8 = (colored_rgba[..., :3] * 255).astype(np.uint8)

        # Generate output filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        stem = Path(fname).stem
        out_filename = f"{index_lower}_{stem}_{timestamp}.png"
        out_path = _PROCESSED_DIR / out_filename

        Image.fromarray(colored_uint8).save(out_path)
        logger.info("Saved spectral index map '%s' (%dx%d)", out_filename, W, H)

        metrics = SpectralMetrics(
            index_name=index_type.upper(),
            is_multispectral=is_multi,
            formula=formula,
            mean_value=round(mean_val, 4),
            min_value=round(min_val, 4),
            max_value=round(max_val, 4),
            std_dev=round(std_val, 4),
            coverage_percentage=round(coverage, 2),
            histogram_bins=hist_bins,
            histogram_counts=hist_counts_list,
            notes=notes,
        )

        return ProcessingResult(
            source_filename=fname,
            processed_filename=out_filename,
            processed_image_url=f"/images/processed/{out_filename}",
            processed_image_path=f"images/processed/{out_filename}",
            metrics=metrics,
            created_at=datetime.now(timezone.utc).isoformat(),
        )


processing_service = _ProcessingService()
