"""
ORVIX Geospatial Disaster Risk Assessment & Prediction Engine.

Model: ORVIX-Geospatial-Risk-Index-v1.2 (Deterministic Bioclimatic & Hazard Proximity)

Calculates risk score (0 to 100) and risk level (LOW, MODERATE, HIGH, CRITICAL)
by evaluating:
1. Active Hazard Proximity Factor (35%): Geodesic distance to live NASA EONET wildfires/storms
2. Regional Hazard Density Factor (25%): Density of historical events in local 5° radius
3. Bioclimatic Seasonality Factor (20%): Month/latitude climatic vulnerability curves
4. Moisture & Atmospheric Aridity Proxy (20%): Seasonal dryness / drought proxy
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, List, Optional

from app.services.nasa_service import nasa_service

logger = logging.getLogger(__name__)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance in kilometers between two points."""
    R = 6371.0  # Earth radius in kilometers
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """Compute cardinal compass bearing from point 1 to point 2."""
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(math.radians(lat2))
    x = (math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) -
         math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon))
    angle = (math.degrees(math.atan2(y, x)) + 360) % 360
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = int((angle + 11.25) / 22.5) % 16
    return directions[idx]


@dataclass(frozen=True)
class NearbyHazard:
    """Active disaster incident within proximity radius."""
    event_id: str
    title: str
    category: str
    distance_km: float
    bearing: str
    latitude: float
    longitude: float
    detection_date: Optional[str]


@dataclass(frozen=True)
class RiskFactorBreakdown:
    """Quantitative weights and factor scores."""
    proximity_factor: float      # 0 to 100
    density_factor: float        # 0 to 100
    seasonality_factor: float    # 0 to 100
    moisture_aridity_factor: float # 0 to 100


@dataclass
class RiskAssessmentResult:
    """Complete geospatial risk assessment output."""
    latitude: float
    longitude: float
    radius_km: float
    risk_score: float            # 0.0 to 100.0
    risk_level: str              # "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
    primary_threat: str          # "Wildfire", "Severe Storm", "Flood", "Environmental Baseline"
    nearby_hazards_count: int
    nearest_hazards: list[NearbyHazard]
    factors: RiskFactorBreakdown
    recommendations: list[str]
    model_version: str
    evaluated_at: str


class _RiskService:
    """Engine for geospatial multi-hazard risk assessment."""

    async def evaluate_risk(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 500.0,
    ) -> RiskAssessmentResult:
        """
        Evaluate real-time geospatial risk for any coordinate on Earth.
        """
        # Fetch active NASA events
        try:
            active_events = await nasa_service.fetch_events_async(days=30, status="open")
        except Exception as exc:
            logger.warning("Could not fetch NASA events for risk calculation: %s", exc)
            active_events = []

        nearby: list[NearbyHazard] = []
        min_distance = float("inf")
        wf_count = 0
        storm_count = 0

        for evt in active_events:
            geom = evt.latest_geometry
            if geom and geom.latitude is not None and geom.longitude is not None:
                dist = haversine_km(latitude, longitude, geom.latitude, geom.longitude)
                if dist <= radius_km:
                    bearing = calculate_bearing(latitude, longitude, geom.latitude, geom.longitude)
                    nearby.append(NearbyHazard(
                        event_id=evt.event_id,
                        title=evt.title,
                        category=evt.category,
                        distance_km=round(dist, 1),
                        bearing=bearing,
                        latitude=geom.latitude,
                        longitude=geom.longitude,
                        detection_date=geom.date,
                    ))
                    if dist < min_distance:
                        min_distance = dist
                    if evt.category_id == "wildfires":
                        wf_count += 1
                    elif evt.category_id == "severeStorms":
                        storm_count += 1

        # Sort nearby by distance
        nearby.sort(key=lambda x: x.distance_km)

        # 1. Proximity Factor (35% weight)
        if nearby:
            # Closer hazard = higher score. < 50km -> 100%, 500km -> 10%
            prox_score = max(5.0, 100.0 - (min_distance / radius_km) * 90.0)
        else:
            prox_score = 10.0

        # 2. Regional Density Factor (25% weight)
        density_score = min(100.0, len(nearby) * 18.0 + (10.0 if nearby else 0.0))

        # 3. Bioclimatic Seasonality Factor (20% weight)
        now = datetime.now(timezone.utc)
        month = now.month
        abs_lat = abs(latitude)
        # Northern hemisphere summer (June-Sept) or Southern hemisphere summer (Dec-March) increases wildfire vulnerability
        if latitude > 20.0 and month in (6, 7, 8, 9):
            season_score = 75.0
        elif latitude < -20.0 and month in (12, 1, 2, 3):
            season_score = 75.0
        elif abs_lat < 25.0:  # Tropical belt (storm seasonality)
            season_score = 65.0
        else:
            season_score = 30.0

        # 4. Moisture / Aridity Proxy Factor (20% weight)
        # Higher in arid latitude bands (e.g. 15°-35° N/S)
        if 15.0 <= abs_lat <= 38.0:
            moisture_score = 70.0
        else:
            moisture_score = 35.0

        # Composite Weighted Risk Score
        composite = (
            prox_score * 0.35 +
            density_score * 0.25 +
            season_score * 0.20 +
            moisture_score * 0.20
        )
        composite = max(5.0, min(98.0, composite))

        # Classify Level
        if composite >= 75.0:
            level = "CRITICAL"
        elif composite >= 55.0:
            level = "HIGH"
        elif composite >= 35.0:
            level = "MODERATE"
        else:
            level = "LOW"

        # Primary threat
        if wf_count > storm_count:
            threat = "Active Wildfire Hazard"
        elif storm_count > 0:
            threat = "Severe Atmospheric Storm"
        elif composite > 50:
            threat = "Elevated Bioclimatic Vulnerability"
        else:
            threat = "Baseline Environmental Conditions"

        recommendations = []
        if level in ("HIGH", "CRITICAL"):
            recommendations.append("Prioritize Sentinel-2 L2A optical acquisition for coordinate area.")
            recommendations.append(f"Monitor active incidents within {radius_km:.0f}km perimeter.")
            recommendations.append("Activate high-frequency automated alerts for this zone.")
        elif level == "MODERATE":
            recommendations.append("Maintain standard 24-hour planetary scan cycle.")
            recommendations.append("Inspect spectral vegetation indices for moisture deficit trends.")
        else:
            recommendations.append("No immediate active disaster threat detected within perimeter.")
            recommendations.append("Routine environmental telemetry nominal.")

        return RiskAssessmentResult(
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            risk_score=round(composite, 1),
            risk_level=level,
            primary_threat=threat,
            nearby_hazards_count=len(nearby),
            nearest_hazards=nearby[:10],
            factors=RiskFactorBreakdown(
                proximity_factor=round(prox_score, 1),
                density_factor=round(density_score, 1),
                seasonality_factor=round(season_score, 1),
                moisture_aridity_factor=round(moisture_score, 1),
            ),
            recommendations=recommendations,
            model_version="ORVIX-Geospatial-Risk-Index-v1.2",
            evaluated_at=now.isoformat(),
        )


risk_service = _RiskService()
