"""
Image preprocessing interface for satellite imagery analysis.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import numpy as np

from app.services.analysis.schemas import PreprocessedData


class ImagePreprocessor(ABC):
    """
    Abstract interface for satellite image preprocessing.

    Handles radiometric calibration, atmospheric reflectance normalization,
    resizing, and tensor reshaping for downstream neural network models.
    """

    @abstractmethod
    def preprocess(
        self,
        image: np.ndarray,
        target_size: tuple[int, int] = (256, 256),
    ) -> PreprocessedData:
        """
        Preprocess raw imagery into normalized model input tensors.

        Args:
            image: numpy array of shape (H, W, C).
            target_size: Spatial target dimension (H, W).

        Returns:
            PreprocessedData with normalized tensor and normalization bounds.

        Raises:
            NotImplementedError: Implementation is pending.
        """
        raise NotImplementedError(
            "ImagePreprocessor.preprocess() is pending implementation. "
            "No mock transforms or synthetic preprocessing allowed."
        )

