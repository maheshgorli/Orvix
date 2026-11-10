"""
Image validation interface for satellite imagery analysis.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
import numpy as np

from app.services.analysis.schemas import ValidationResult


class ImageValidator(ABC):
    """
    Abstract interface for satellite image validation.
    
    Verifies dimensional validity, spectral channel availability,
    nodata pixel percentages, and dynamic range before preprocessing.
    """

    @abstractmethod
    def validate(self, image: np.ndarray) -> ValidationResult:
        """
        Validate an optical imagery array.

        Args:
            image: numpy ndarray representing optical bands or true-colour imagery.

        Returns:
            ValidationResult with dimension, dtype, and validity flags.

        Raises:
            NotImplementedError: Implementation is pending.
        """
        raise NotImplementedError(
            "ImageValidator.validate() is pending implementation. "
            "No fake validation or mock heuristics allowed."
        )

