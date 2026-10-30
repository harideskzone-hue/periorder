"""Tests for inventory ordering policies."""

import numpy as np
import pandas as pd
import pytest

from periorder.policies import critical_ratio_target


@pytest.fixture
def quantile_predictions():
    return pd.DataFrame({
        "q_0.25": [2.0, 3.0, 4.0],
        "q_0.40": [3.0, 4.0, 5.0],
        "q_0.50": [4.0, 5.0, 6.0],
        "q_0.75": [6.0, 7.0, 8.0],
        "q_0.95": [9.0, 10.0, 11.0],
    })


@pytest.mark.parametrize(
    ("critical_ratio", "expected"),
    [
        (0.40, [3.0, 4.0, 5.0]),
        (0.50, [4.0, 5.0, 6.0]),
        (0.75, [6.0, 7.0, 8.0]),
    ],
)
def test_critical_ratio_selects_correct_quantile(
    quantile_predictions,
    critical_ratio,
    expected,
):
    result = critical_ratio_target(
        quantile_predictions,
        critical_ratio,
    )

    np.testing.assert_array_equal(result, expected)


def test_invalid_critical_ratio_is_rejected(quantile_predictions):
    with pytest.raises(ValueError, match="critical_ratio"):
        critical_ratio_target(quantile_predictions, 0.0)


def test_missing_quantile_is_rejected(quantile_predictions):
    with pytest.raises(ValueError, match="missing"):
        critical_ratio_target(quantile_predictions, 0.60)


def test_negative_predictions_are_rejected():
    predictions = pd.DataFrame({"q_0.50": [2.0, -1.0]})

    with pytest.raises(ValueError, match="negative"):
        critical_ratio_target(predictions, 0.50)


def test_non_finite_predictions_are_rejected():
    predictions = pd.DataFrame({"q_0.50": [2.0, np.nan]})

    with pytest.raises(ValueError, match="finite"):
        critical_ratio_target(predictions, 0.50)


def test_empty_predictions_are_rejected():
    predictions = pd.DataFrame({"q_0.50": []})

    with pytest.raises(ValueError, match="empty"):
        critical_ratio_target(predictions, 0.50)
