import pytest

from periorder.config import calibrate_costs
from periorder.simulator import simulate_inventory

COSTS = calibrate_costs(0.50)


def test_demand_is_served_and_lost_sales_are_recorded():
    result = simulate_inventory(
        [3],
        0,
        lead_time=0,
        shelf_life=2,
        costs=COSTS,
        initial_inventory=2,
    )

    day = result.records[0]
    assert day.sales == 2
    assert day.lost_sales == 1
    assert result.total_demand == 3
    assert result.total_sales == 2


def test_order_arrives_after_lead_time_plus_one_days():
    result = simulate_inventory(
        [0, 0, 2],
        [2, 2, 2],
        lead_time=1,
        shelf_life=5,
        costs=COSTS,
    )

    assert result.records[0].order_quantity == 2
    assert result.records[1].arrivals == 0
    assert result.records[2].arrivals == 2
    assert result.records[2].sales == 2


def test_unsold_stock_expires_after_its_shelf_life():
    result = simulate_inventory(
        [0, 0, 0],
        2,
        lead_time=0,
        shelf_life=2,
        costs=COSTS,
    )

    assert result.records[1].ending_inventory == 2
    assert result.records[2].expired == 2
    assert result.total_expired == 2
    assert result.total_expiry_cost == pytest.approx(2 * COSTS.expiry_cost)


def test_holding_cost_uses_end_of_day_surviving_inventory():
    result = simulate_inventory(
        [0, 0],
        2,
        lead_time=0,
        shelf_life=3,
        costs=COSTS,
    )

    assert result.records[1].ending_inventory == 2
    assert result.records[1].holding_cost == pytest.approx(
        2 * COSTS.holding_cost
    )


def test_order_quantity_respects_inventory_position():
    result = simulate_inventory(
        [0, 0, 0],
        [3, 3, 3],
        lead_time=1,
        shelf_life=5,
        costs=COSTS,
    )

    assert result.records[0].order_quantity == 3
    assert result.records[1].order_quantity == 0
    assert result.records[1].pipeline_inventory == 3


def test_ceiling_rounding_is_used_for_fractional_targets():
    result = simulate_inventory(
        [0],
        2.1,
        lead_time=0,
        shelf_life=3,
        costs=COSTS,
    )

    assert result.records[0].order_quantity == 3


def test_negative_demand_is_rejected():
    with pytest.raises(ValueError):
        simulate_inventory(
            [-1],
            0,
            lead_time=0,
            shelf_life=2,
            costs=COSTS,
        )


def test_invalid_shelf_life_is_rejected():
    with pytest.raises(ValueError):
        simulate_inventory(
            [0],
            0,
            lead_time=0,
            shelf_life=0,
            costs=COSTS,
        )


def test_total_cost_equals_sum_of_cost_components():
    result = simulate_inventory(
        [2, 4, 0, 3],
        2,
        lead_time=0,
        shelf_life=2,
        costs=COSTS,
    )

    assert result.total_cost == pytest.approx(
        result.total_holding_cost
        + result.total_stockout_cost
        + result.total_expiry_cost
    )
