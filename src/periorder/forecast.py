"""Seasonal naive probabilistic forecasting."""

import numpy as np
import pandas as pd


def fit_sn_residuals(
    frame: pd.DataFrame,
) -> np.ndarray:
    """Fit residual distribution on validation observations only."""
    validation = frame.loc[frame["split"] == "validation"]
    if validation.empty:
        raise ValueError("No validation observations.")

    valid_mask = validation["target"].notna() & validation["sn_mean"].notna()
    if not valid_mask.any():
        raise ValueError("No valid target and sn_mean pairs in validation.")

    residuals = (
        validation.loc[valid_mask, "target"].to_numpy(dtype=float)
        - validation.loc[valid_mask, "sn_mean"].to_numpy(dtype=float)
    )
    if not np.isfinite(residuals).all():
        raise ValueError("Non-finite residuals.")
    return residuals


def predict_sn_quantile(
    frame: pd.DataFrame,
    residuals: np.ndarray,
    tau: float,
) -> pd.Series:
    """Predict a non-negative protection-period demand quantile.

    Q_tau(D_t) = max(0, sn_mean + eps_tau)
    where eps_tau is the empirical tau-quantile of validation residuals.
    """
    if not 0.0 < tau < 1.0:
        raise ValueError("tau must be strictly between 0 and 1.")
    if residuals.size == 0 or not np.isfinite(residuals).all():
        raise ValueError("Residuals must be non-empty and finite.")

    eps_tau = float(np.quantile(residuals, tau))
    sn_mean = frame["sn_mean"].to_numpy(dtype=float)
    predictions = np.maximum(0.0, sn_mean + eps_tau)
    return pd.Series(predictions, index=frame.index, name=f"q_{tau:.2f}")
