"""
Data schemas for the image analysis and disaster detection pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional
import numpy as np


@dataclass(frozen=True)
class ValidationResult:
    """Outcome of raw satellite imagery validation."""
    is_valid: bool
    shape: tuple[int, ...]
    dtype: str
    channels: int
    errors: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class PreprocessedData:
    """Container for radiometric-calibrated, normalized imagery data."""
    tensor: np.ndarray
    original_shape: tuple[int, ...]
    target_shape: tuple[int, int]
    normalization_min: float
    normalization_max: float


@dataclass(frozen=True)
class SpectralIndicesResult:
    """
    Mathematical spectral indices derived from Sentinel-2 bands.
    
    Formulae:
      - NDVI = (NIR - Red) / (NIR + Red)     [B08, B04]
      - NBR  = (NIR - SWIR2) / (NIR + SWIR2) [B08, B12]
    """
    ndvi: Optional[np.ndarray] = None
    nbr: Optional[np.ndarray] = None
    mean_ndvi: Optional[float] = None
    mean_nbr: Optional[float] = None
    burn_severity: str = "pending"


@dataclass(frozen=True)
class DetectionOutput:
    """Result of AI disaster detection and classification."""
    disaster_type: str = "pending"
    confidence: float = 0.0
    status: str = "pending"
    bounding_boxes: list[dict[str, Any]] = field(default_factory=list)
    spectral_summary: Optional[dict[str, float]] = None
    model_version: str = "pending"


@dataclass(frozen=True)
class PipelineStatus:
    """Current development status of the analysis pipeline stages."""
    pipeline: str = "Sentinel-2 Earth Intelligence Analysis"
    status: str = "pending"
    validation: str = "pending"
    preprocessing: str = "pending"
    spectral_indices: dict[str, str] = field(
        default_factory=lambda: {
            "ndvi": "pending",
            "nbr": "pending",
        }
    )
    model: str = "pending"
    detection_results: str = "pending"
    note: str = (
        "Typed interfaces and mathematical specifications defined. "
        "Model training, weights, and inference execution pending milestone."
    )

