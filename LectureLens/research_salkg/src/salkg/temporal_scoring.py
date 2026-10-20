"""Temporal scoring functions for multimodal lecture alignment."""

from __future__ import annotations

import math
from typing import Optional


def exponential_temporal_decay(midpoint_a: float, midpoint_b: float, tau: float = 45.0) -> float:
    """Compute exponential temporal proximity compatibility:
    T(i, j) = exp(-|m_i - t_j| / tau)
    tau controls temporal scale in seconds (default 45s).
    """
    if tau <= 0.0:
        raise ValueError("Temporal scale tau must be strictly positive.")
    delta = abs(midpoint_a - midpoint_b)
    return math.exp(-delta / tau)


def gaussian_temporal_decay(midpoint_a: float, midpoint_b: float, sigma: float = 35.0) -> float:
    """Compute Gaussian temporal proximity compatibility:
    T(i, j) = exp(-(m_i - t_j)^2 / (2 * sigma^2))
    """
    if sigma <= 0.0:
        raise ValueError("Temporal sigma must be strictly positive.")
    delta = midpoint_a - midpoint_b
    return math.exp(-(delta * delta) / (2.0 * sigma * sigma))


def temporal_interval_iou(
    start_a: float, end_a: float, start_b: float, end_b: float
) -> float:
    """Compute temporal Intersection-over-Union (IoU) between two time intervals:
    IoU = max(0, min(end_a, end_b) - max(start_a, start_b)) / (max(end_a, end_b) - min(start_a, start_b))
    """
    intersection_start = max(start_a, start_b)
    intersection_end = min(end_a, end_b)
    intersection = max(0.0, intersection_end - intersection_start)

    union_start = min(start_a, start_b)
    union_end = max(end_a, end_b)
    union = max(1e-6, union_end - union_start)

    return intersection / union


def asymmetric_temporal_compatibility(
    speech_midpoint: float,
    visual_midpoint: float,
    tau_lead: float = 25.0,
    tau_lag: float = 65.0,
) -> float:
    """Compute asymmetric temporal compatibility modeling pedagogical delivery:
    Lecturers typically present a slide or equation slightly BEFORE speaking (verbal lag),
    whereas speaking about a slide before it appears is rare (anticipation penalty).

    delta = speech_midpoint - visual_midpoint
    If delta >= 0 (speech lags visual): T = exp(-delta / tau_lag)
    If delta < 0 (speech precedes visual): T = exp(-|delta| / tau_lead)
    """
    delta = speech_midpoint - visual_midpoint
    if delta >= 0:
        return math.exp(-delta / max(1.0, tau_lag))
    else:
        return math.exp(-abs(delta) / max(1.0, tau_lead))


def interval_aware_temporal_compatibility(
    speech_midpoint: float,
    vis_start: float,
    vis_end: float,
    tau_lead: float = 25.0,
    tau_lag: float = 65.0,
) -> float:
    """Compute interval-aware temporal compatibility for visual events with duration:
    - If speech midpoint falls inside [vis_start, vis_end]: T = 1.0
    - If speech occurs after visual event ends (verbal lag): T = exp(-(speech_midpoint - vis_end) / tau_lag)
    - If speech occurs before visual event begins (anticipation): T = exp(-(vis_start - speech_midpoint) / tau_lead)
    """
    if vis_start <= speech_midpoint <= vis_end:
        slide_duration = max(0.0, vis_end - vis_start)
        # Cap interval-overlap score: very long slides linearly decay toward 0.85 to prevent saturation
        saturation_penalty = max(0.85, 1.0 - max(0.0, slide_duration - 30.0) * 0.002)
        return saturation_penalty
    elif speech_midpoint > vis_end:
        return math.exp(-(speech_midpoint - vis_end) / max(1.0, tau_lag))
    else:
        return math.exp(-(vis_start - speech_midpoint) / max(1.0, tau_lead))


def compute_adaptive_taus(visual_events: list) -> tuple[float, float]:
    """Compute adaptive tau_lead and tau_lag based on average slide duration."""
    if not visual_events:
        return 25.0, 65.0
    durations = [
        (getattr(v, "end_time", None) or getattr(v, "timestamp", 0.0) + 5.0) - (getattr(v, "start_time", None) or getattr(v, "timestamp", 0.0))
        for v in visual_events
    ]
    avg_vis_duration = sum(durations) / max(1, len(durations))
    tau_lag = min(90.0, max(25.0, avg_vis_duration * 1.5))
    tau_lead = min(40.0, max(10.0, avg_vis_duration * 0.5))
    return tau_lead, tau_lag

