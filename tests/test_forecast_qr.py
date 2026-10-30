"""Tests for direct quantile-regression forecast utilities."""

import numpy as np
import pandas as pd
import pytest

from periorder.forecast_qr import (
    quantile_crossing_rate,
    quantile_crossing_row_rate,
    quantile_frame,
    sort_quantile_predictions,
)


def test_sort_quantile_predictions_removes_crossings():
    raw = np.array([
        [2.0, 1.0, 3.0],
        [1.0, 2.0, 2.5],
    ])

    sorted_values = sort_quantile_predictions(raw)

    np.testing.assert_allclose(
        sorted_values,
        [[1.0, 2.0, 3.0], [1.0, 2.0, 2.5]],
    )
    assert np.all(np.diff(sorted_values, axis=1) >= 0)


def test_crossing_rates():
    raw = np.array([
        [1.0, 3.0, 2.0],
        [1.0, 2.0, 3.0],
    ])

    assert quantile_crossing_rate(raw) == pytest.approx(0.25)
    assert quantile_crossing_row_rate(raw) == pytest.approx(0.5)


def test_no_crossings_returns_zero():
    raw = np.array([[1.0, 2.0, 3.0], [0.0, 0.0, 1.0]])

    assert quantile_crossing_rate(raw) == 0.0
    assert quantile_crossing_row_rate(raw) == 0.0


def test_invalid_prediction_shapes_and_values_are_rejected():
    with pytest.raises(ValueError, match="2D"):
        sort_quantile_predictions(np.array([1.0, 2.0]))

    with pytest.raises(ValueError, match="finite"):
        sort_quantile_predictions(np.array([[1.0, np.nan]]))


def test_quantile_frame_uses_sorted_values_and_quantile_names():
    raw = np.array([[3.0, 1.0, 2.0]])

    result = quantile_frame(
        raw,
        quantiles=(0.25, 0.50, 0.75),
        index=pd.Index(["series_1"]),
    )

    assert list(result.columns) == ["q_0.25", "q_0.50", "q_0.75"]
    assert result.loc["series_1"].tolist() == [1.0, 2.0, 3.0]


def test_quantile_frame_rejects_mismatched_quantiles():
    with pytest.raises(ValueError, match="match"):
        quantile_frame(np.array([[1.0, 2.0]]), (0.25, 0.50, 0.75))

    with pytest.raises(ValueError, match="increasing"):
        quantile_frame(np.array([[1.0, 2.0]]), (0.75, 0.25))
