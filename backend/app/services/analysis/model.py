"""
Disaster detection model interface for AI/CV inference.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.analysis.schemas import DetectionOutput, PreprocessedData


class DisasterDetectionModel(ABC):
    """
    Abstract interface for AI disaster detection, segmentation, and classification.
    """

    @abstractmethod
    def load_model(self, model_path: str) -> None:
        """
        Load model weights into memory/GPU.

        Args:
            model_path: Path to serialized model weights (e.g. .h5, SavedModel, ONNX).

        Raises:
            NotImplementedError: Implementation is pending.
        """
        raise NotImplementedError(
            "DisasterDetectionModel.load_model() is pending implementation. "
            "Model training and weight checkpoint required."
        )

    @abstractmethod
    def predict(self, preprocessed: PreprocessedData) -> DetectionOutput:
        """
        Run inference on preprocessed imagery.

        Args:
            preprocessed: Standardized PreprocessedData container.

        Returns:
            DetectionOutput containing classification label and confidence.

        Raises:
            NotImplementedError: Implementation is pending.
        """
        raise NotImplementedError(
            "DisasterDetectionModel.predict() is pending implementation. "
            "Never invent fake detections or synthetic predictions."
        )

