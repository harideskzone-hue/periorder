"""Utilities for direct quantile-regression forecasts."""

import numpy as np
import pandas as pd


def sort_quantile_predictions(
    predictions: np.ndarray,
) -> np.ndarray:
    """Sort each row into nondecreasing quantile order.

    Args:
        predictions: Array shaped (n_observations, n_quantiles).

    Returns:
        A copy with nondecreasing quantiles in every row.
    """
    values = np.asarray(predictions, dtype=float)

    if values.ndim != 2:
        raise ValueError("predictions must be a 2D array.")
    if values.shape[1] == 0:
        raise ValueError("At least one quantile is required.")
    if not np.isfinite(values).all():
        raise ValueError("predictions must contain only finite values.")

    return np.sort(values, axis=1)


def quantile_crossing_rate(predictions: np.ndarray) -> float:
    """Return the fraction of adjacent quantile pairs that cross."""
    values = np.asarray(predictions, dtype=float)

    if values.ndim != 2:
        raise ValueError("predictions must be a 2D array.")
    if not np.isfinite(values).all():
        raise ValueError("predictions must contain only finite values.")
    if values.shape[1] < 2:
        return 0.0

    crossing_pairs = values[:, :-1] > values[:, 1:]
    return float(np.mean(crossing_pairs))


def quantile_crossing_row_rate(predictions: np.ndarray) -> float:
    """Return the fraction of rows containing at least one crossing."""
    values = np.asarray(predictions, dtype=float)

    if values.ndim != 2:
        raise ValueError("predictions must be a 2D array.")
    if not np.isfinite(values).all():
        raise ValueError("predictions must contain only finite values.")
    if values.shape[1] < 2:
        return 0.0

    return float(np.mean(np.any(values[:, :-1] > values[:, 1:], axis=1)))


def quantile_frame(
    predictions: np.ndarray,
    quantiles: tuple[float, ...],
    index: pd.Index | None = None,
) -> pd.DataFrame:
    """Create a DataFrame of sorted quantile predictions."""
    values = sort_quantile_predictions(predictions)

    if values.shape[1] != len(quantiles):
        raise ValueError(
            "Number of prediction columns must match the quantile count."
        )
    if any(not 0.0 < tau < 1.0 for tau in quantiles):
        raise ValueError("Every quantile must be strictly between 0 and 1.")
    if tuple(sorted(quantiles)) != quantiles:
        raise ValueError("Quantiles must be in increasing order.")

    return pd.DataFrame(
        values,
        index=index,
        columns=[f"q_{tau:.2f}" for tau in quantiles],
    )
