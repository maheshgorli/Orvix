"""
Spectral index calculation interface for satellite imagery.

Mathematical Definitions
------------------------
- NDVI (Normalized Difference Vegetation Index):
    NDVI = (NIR - Red) / (NIR + Red)
    Sentinel-2: (B08 - B04) / (B08 + B04)
    Range: [-1.0, 1.0]. Used to gauge live green vegetation density and drought stress.

- NBR (Normalized Burn Ratio):
    NBR = (NIR - SWIR2) / (NIR + SWIR2)
    Sentinel-2: (B08 - B12) / (B08 + B12)
    Range: [-1.0, 1.0]. Highlights burned areas and fire severity.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import numpy as np

from app.services.analysis.schemas import SpectralIndicesResult


class SpectralIndexCalculator(ABC):
    """
    Abstract interface for computing physical multispectral indices.
    """

    @abstractmethod
    def compute_ndvi(self, nir: np.ndarray, red: np.ndarray) -> np.ndarray:
        """
        Compute Normalized Difference Vegetation Index (NDVI).

        Args:
            nir: Near-infrared band array (Sentinel-2 B08).
            red: Red band array (Sentinel-2 B04).

        Returns:
            Normalized index array with values in [-1.0, 1.0].

        Raises:
            NotImplementedError: Implementation is pending.
        """
        raise NotImplementedError(
            "SpectralIndexCalculator.compute_ndvi() is pending implementation. "
            "NDVI requires calibrated Sentinel-2 B08 and B04 reflectance bands."
        )

    @abstractmethod
    def compute_nbr(self, nir: np.ndarray, swir: np.ndarray) -> np.ndarray:
        """
        Compute Normalized Burn Ratio (NBR).

        Args:
            nir: Near-infrared band array (Sentinel-2 B08).
            swir: Short-wave infrared band array (Sentinel-2 B12).

        Returns:
            Normalized index array with values in [-1.0, 1.0].

        Raises:
            NotImplementedError: Implementation is pending.
        """
        raise NotImplementedError(
            "SpectralIndexCalculator.compute_nbr() is pending implementation. "
            "NBR requires calibrated Sentinel-2 B08 and B12 reflectance bands."
        )

    @abstractmethod
    def compute_indices(
        self,
        bands: dict[str, np.ndarray],
    ) -> SpectralIndicesResult:
        """
        Compute all standard spectral indices from a multiband dictionary.

        Args:
            bands: Mapping of band names (e.g. 'B04', 'B08', 'B12') to 2D numpy arrays.

        Returns:
            SpectralIndicesResult containing derived index grids.

        Raises:
            NotImplementedError: Implementation is pending.
        """
        raise NotImplementedError(
            "SpectralIndexCalculator.compute_indices() is pending implementation. "
            "Requires multiband Sentinel-2 L2A/L1C acquisition."
        )

