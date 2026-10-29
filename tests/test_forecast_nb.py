"""Unit tests for Negative Binomial (NB) parametric forecasting."""

import numpy as np
import pandas as pd
import pytest

from periorder.forecast_nb import (
    MIN_DISPERSION,
    estimate_nb_dispersion,
    fit_nb_dispersion_by_series,
    predict_nb_quantile,
)


def test_dispersion_floor_when_underdispersed_or_zero_variance():
    """Series with under-dispersed or zero variance should clip at MIN_DISPERSION."""
    # Perfect forecast: error = 0, so numerator = 0 - sum(mu) < 0
    actual = np.array([5.0, 5.0, 5.0, 5.0])
    predicted = np.array([5.0, 5.0, 5.0, 5.0])
    alpha = estimate_nb_dispersion(actual, predicted)
    assert alpha == MIN_DISPERSION


def test_estimate_dispersion_on_synthetic_overdispersion():
    """Verify that the method-of-moments estimator recovers positive alpha."""
    rng = np.random.default_rng(42)
    true_alpha = 0.25
    mu = 10.0
    # Variance = mu + true_alpha * mu^2 = 10 + 25 = 35
    std = np.sqrt(mu + true_alpha * mu**2)
    n_samples = 20_000
    errors = rng.normal(0, std, size=n_samples)
    actual = np.maximum(0.0, mu + errors)
    predicted = np.full(n_samples, mu)

    estimated_alpha = estimate_nb_dispersion(actual, predicted)
    assert estimated_alpha == pytest.approx(true_alpha, rel=0.10)


def test_zero_or_negative_mean_returns_zero_quantile():
    """Zero or negative predicted mean must return zero quantile."""
    assert predict_nb_quantile(0.0, alpha=0.1, tau=0.5) == 0.0
    assert predict_nb_quantile(-2.0, alpha=0.1, tau=0.5) == 0.0

    means = pd.Series([0.0, -1.0, 5.0], index=["s1", "s2", "s3"])
    q = predict_nb_quantile(means, alpha=0.1, tau=0.75)
    assert isinstance(q, pd.Series)
    assert q["s1"] == 0.0
    assert q["s2"] == 0.0
    assert q["s3"] > 0.0


def test_invalid_inputs_rejected():
    """Invalid parameter values must raise ValueError."""
    # Mismatched length
    with pytest.raises(ValueError, match="Length mismatch"):
        estimate_nb_dispersion([1.0, 2.0], [1.0])

    # Negative actual demand
    with pytest.raises(ValueError, match="negative"):
        estimate_nb_dispersion([-1.0, 2.0], [1.0, 2.0])

    # Empty inputs
    with pytest.raises(ValueError, match="empty"):
        estimate_nb_dispersion([], [])

    # Invalid tau
    with pytest.raises(ValueError, match="tau"):
        predict_nb_quantile(5.0, 0.1, tau=0.0)
    with pytest.raises(ValueError, match="tau"):
        predict_nb_quantile(5.0, 0.1, tau=1.0)

    # Invalid alpha
    with pytest.raises(ValueError, match="alpha"):
        predict_nb_quantile(5.0, 0.0, tau=0.5)


def test_quantile_monotonicity_and_dispersion_effect():
    """Higher tau yields higher quantiles; higher alpha yields higher upper quantiles."""
    mu = 8.0
    q_low = predict_nb_quantile(mu, alpha=0.1, tau=0.40)
    q_mid = predict_nb_quantile(mu, alpha=0.1, tau=0.50)
    q_high = predict_nb_quantile(mu, alpha=0.1, tau=0.75)

    assert q_low <= q_mid <= q_high

    # Higher overdispersion increases upper tail quantiles (e.g., tau=0.90)
    q_tight = predict_nb_quantile(mu, alpha=1e-3, tau=0.90)
    q_spread = predict_nb_quantile(mu, alpha=0.50, tau=0.90)
    assert q_spread > q_tight


def test_fit_nb_dispersion_by_series_isolation():
    """Verify that fit_nb_dispersion_by_series estimates separate alpha per series."""
    df = pd.DataFrame({
        "id": ["series_1"] * 10 + ["series_2"] * 10,
        "target": [5.0] * 10 + [2.0, 18.0, 1.0, 19.0, 0.0, 20.0, 1.0, 19.0, 2.0, 18.0],
        "mr_mean": [5.0] * 10 + [10.0] * 10,
    })

    dispersions = fit_nb_dispersion_by_series(df, target_col="target", pred_col="mr_mean")
    assert "series_1" in dispersions
    assert "series_2" in dispersions
    # Series 1 has 0 error -> floor 1e-3
    assert dispersions["series_1"] == MIN_DISPERSION
    # Series 2 has heavy error variance -> positive alpha
    assert dispersions["series_2"] > MIN_DISPERSION
