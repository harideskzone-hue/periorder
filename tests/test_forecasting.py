"""Unit tests for leakage-safe feature engineering and Seasonal Naive forecasting."""

import numpy as np
import pandas as pd
import pytest

from periorder.config import TRAIN_END
from periorder.features import build_forecast_frame
from periorder.forecast import (
    fit_sn_residuals,
    predict_sn_quantile,
)


def test_seasonal_naive_horizon_two():
    panel = pd.DataFrame({
        "id": ["A"] * 20,
        "day": list(range(1, 21)),
        "sales": list(range(1, 21)),
    })
    frame = build_forecast_frame(panel, horizon=2)
    row = frame.loc[frame["day"] == 10].iloc[0]
    assert row["target"] == 11 + 12
    assert row["sn_mean"] == 4 + 5


def test_seasonal_naive_horizon_three():
    panel = pd.DataFrame({
        "id": ["A"] * 20,
        "day": list(range(1, 21)),
        "sales": list(range(1, 21)),
    })
    frame = build_forecast_frame(panel, horizon=3)
    row = frame.loc[frame["day"] == 10].iloc[0]
    assert row["target"] == 11 + 12 + 13
    assert row["sn_mean"] == 4 + 5 + 6


def test_invalid_horizon_rejected():
    panel = pd.DataFrame({
        "id": ["A"] * 10,
        "day": list(range(1, 11)),
        "sales": [1] * 10,
    })
    with pytest.raises(ValueError, match="horizon must be 2 or 3"):
        build_forecast_frame(panel, horizon=1)
    with pytest.raises(ValueError, match="horizon must be 2 or 3"):
        build_forecast_frame(panel, horizon=4)


def test_fit_sn_residuals():
    # Construct a frame with validation split observations
    frame = pd.DataFrame({
        "id": ["A"] * 6,
        "day": list(range(1212, 1218)),
        "sales": [5, 6, 7, 8, 9, 10],
        "target": [15.0, 17.0, 19.0, 21.0, 23.0, 25.0],
        "sn_mean": [10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
        "split": ["validation"] * 6,
    })
    residuals = fit_sn_residuals(frame)
    expected = np.array([5.0, 7.0, 9.0, 11.0, 13.0, 15.0])
    np.testing.assert_array_equal(residuals, expected)

    # Missing validation split raises ValueError
    frame_no_val = frame.copy()
    frame_no_val["split"] = "train"
    with pytest.raises(ValueError, match="No validation observations"):
        fit_sn_residuals(frame_no_val)


def test_predict_sn_quantile_clipping_and_calibration():
    residuals = np.array([-10.0, -5.0, 0.0, 5.0, 10.0])
    frame = pd.DataFrame({
        "id": ["A", "A"],
        "day": [1580, 1581],
        "sn_mean": [2.0, 20.0],
    })

    # tau = 0.50 -> median residual is 0.0
    q50 = predict_sn_quantile(frame, residuals, tau=0.50)
    assert q50.iloc[0] == pytest.approx(2.0 + 0.0)
    assert q50.iloc[1] == pytest.approx(20.0 + 0.0)

    # tau = 0.10 -> quantile is negative enough that sn_mean=2.0 clips to 0.0
    q10 = predict_sn_quantile(frame, residuals, tau=0.10)
    assert q10.iloc[0] >= 0.0
    assert (q10 >= 0.0).all()

    # Rejection of invalid tau
    with pytest.raises(ValueError, match="tau must be strictly between 0 and 1"):
        predict_sn_quantile(frame, residuals, tau=0.0)
    with pytest.raises(ValueError, match="tau must be strictly between 0 and 1"):
        predict_sn_quantile(frame, residuals, tau=1.0)


def test_split_boundary_leakage_guard():
    # Days right around the boundary of train (1211) with horizon=2
    days = list(range(TRAIN_END - 5, TRAIN_END + 5))
    panel = pd.DataFrame({
        "id": ["A"] * len(days),
        "day": days,
        "sales": [5] * len(days),
    })
    frame = build_forecast_frame(panel, horizon=2)

    # Origin t = 1209 has target spanning [1210, 1211] <= TRAIN_END -> valid train
    row_1209 = frame.loc[frame["day"] == TRAIN_END - 2].iloc[0]
    assert row_1209["split"] == "train"

    # Origin t = 1210 has target spanning [1211, 1212] -> crosses into validation!
    # Must NOT be marked as train or validation
    row_1210 = frame.loc[frame["day"] == TRAIN_END - 1].iloc[0]
    assert row_1210["split"] is None

    # Origin t = 1211 has target spanning [1212, 1213] -> crosses into validation!
    row_1211 = frame.loc[frame["day"] == TRAIN_END].iloc[0]
    assert row_1211["split"] is None
