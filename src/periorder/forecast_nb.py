"""Negative Binomial (NB) parametric probabilistic forecasting.

This module implements the parametric Negative Binomial baseline specified in
Section IV of the research paper:
    Cost-Aware Ordering Policies for Perishable Grocery Inventory Using
    Probabilistic Demand Forecasts.

Model:
    Conditional mean: mu_hat_{i,t} (from LightGBM Mean Regression).
    Conditional variance: Var(D_{i,t}^{(ell)} | X) = mu_hat_{i,t} + alpha_i * (mu_hat_{i,t})^2.
    Overdispersion parameter: alpha_i >= 1e-3, estimated per-series using a
    method-of-moments estimator on the validation window only.

SciPy Parameterization (scipy.stats.nbinom):
    n_i = 1 / alpha_i
    p_{i,t} = 1 / (1 + alpha_i * mu_hat_{i,t})
    Q_tau = nbinom.ppf(tau, n_i, p_{i,t})
"""

from collections.abc import Sequence

import numpy as np
import pandas as pd
from scipy.stats import nbinom

MIN_DISPERSION: float = 1e-3


def estimate_nb_dispersion(
    actual: np.ndarray | Sequence[float],
    predicted: np.ndarray | Sequence[float],
    min_dispersion: float = MIN_DISPERSION,
) -> float:
    """Estimate Negative Binomial overdispersion alpha using method of moments.

    Formula:
        alpha_hat = max(
            min_dispersion,
            sum((actual - predicted)^2 - predicted) / sum(predicted^2)
        )

    Args:
        actual: Observed cumulative demand values (non-negative).
        predicted: Predicted conditional mean demand values.
        min_dispersion: Lower bound on dispersion (default: 1e-3, near Poisson).

    Returns:
        Estimated overdispersion parameter alpha >= min_dispersion.
    """
    y = np.asarray(actual, dtype=float)
    mu = np.asarray(predicted, dtype=float)

    if y.ndim != 1 or mu.ndim != 1:
        raise ValueError("actual and predicted must be 1D arrays.")
    if len(y) != len(mu):
        raise ValueError(
            f"Length mismatch: len(actual)={len(y)} != len(predicted)={len(mu)}."
        )
    if len(y) == 0:
        raise ValueError("Inputs cannot be empty.")
    if not (np.isfinite(y).all() and np.isfinite(mu).all()):
        raise ValueError("Inputs must contain only finite numbers.")
    if (y < 0).any():
        raise ValueError("Actual demand cannot contain negative values.")

    numerator = np.sum((y - mu) ** 2 - mu)
    denominator = np.sum(mu**2)

    if denominator <= 0 or not np.isfinite(denominator):
        return float(min_dispersion)

    raw_alpha = float(numerator / denominator)
    return float(max(min_dispersion, raw_alpha))


def fit_nb_dispersion_by_series(
    validation_df: pd.DataFrame,
    target_col: str = "target",
    pred_col: str = "mr_mean",
    id_col: str = "id",
    min_dispersion: float = MIN_DISPERSION,
) -> dict[str, float]:
    """Fit a per-series dispersion parameter alpha_i on validation observations.

    Args:
        validation_df: DataFrame of validation observations.
        target_col: Name of column containing cumulative protection-period demand.
        pred_col: Name of column containing MR conditional mean predictions.
        id_col: Name of series identifier column.
        min_dispersion: Minimum dispersion floor.

    Returns:
        Mapping of series_id to estimated alpha_i.
    """
    required = {id_col, target_col, pred_col}
    missing = required - set(validation_df.columns)
    if missing:
        raise ValueError(f"Missing required columns in validation_df: {sorted(missing)}")
    if validation_df.empty:
        raise ValueError("validation_df cannot be empty.")

    dispersions: dict[str, float] = {}
    grouped = validation_df.groupby(id_col, sort=False)

    for series_id, group in grouped:
        y = group[target_col].to_numpy(dtype=float)
        mu = group[pred_col].to_numpy(dtype=float)
        alpha_i = estimate_nb_dispersion(
            actual=y,
            predicted=mu,
            min_dispersion=min_dispersion,
        )
        dispersions[str(series_id)] = alpha_i

    return dispersions


def predict_nb_quantile(
    mean: float | np.ndarray | pd.Series,
    alpha: float | np.ndarray | pd.Series,
    tau: float,
) -> float | np.ndarray | pd.Series:
    """Predict protection-period demand quantile using the fitted Negative Binomial distribution.

    Args:
        mean: Predicted conditional mean demand mu >= 0.
        alpha: Overdispersion parameter alpha >= 1e-6.
        tau: Quantile level strictly in (0, 1).

    Returns:
        Predicted tau-quantile(s). Returns 0.0 for non-positive predicted mean.
    """
    if not 0.0 < tau < 1.0:
        raise ValueError(f"tau must be strictly between 0 and 1, got {tau}.")

    is_series = isinstance(mean, pd.Series)
    index = mean.index if is_series else None
    is_scalar = np.isscalar(mean) and np.isscalar(alpha)

    mu_arr = np.asarray(mean, dtype=float)
    alpha_arr = np.asarray(alpha, dtype=float)

    if (alpha_arr < 1e-6).any():
        raise ValueError("alpha must be at least 1e-6.")

    mu_bcast, alpha_bcast = np.broadcast_arrays(mu_arr, alpha_arr)

    # Output array
    quantiles = np.zeros_like(mu_bcast, dtype=float)
    valid_mask = mu_bcast > 0

    if valid_mask.any():
        valid_mu = mu_bcast[valid_mask]
        valid_alpha = alpha_bcast[valid_mask]

        # SciPy Negative Binomial parameterization:
        # n = 1 / alpha
        # p = 1 / (1 + alpha * mu)
        n = 1.0 / valid_alpha
        p = 1.0 / (1.0 + valid_alpha * valid_mu)

        quantiles[valid_mask] = nbinom.ppf(tau, n, p)

    if is_scalar:
        return float(quantiles.item())
    if is_series:
        return pd.Series(quantiles, index=index, name=f"q_nb_{tau:.2f}")
    return quantiles
