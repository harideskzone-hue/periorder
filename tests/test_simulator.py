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


def test_zero_burn_in_reproduces_default_results():
    demand = [2, 1, 3, 0, 2]
    result_default = simulate_inventory(
        demand,
        3,
        lead_time=1,
        shelf_life=3,
        costs=COSTS,
    )
    result_zero = simulate_inventory(
        demand,
        3,
        lead_time=1,
        shelf_life=3,
        costs=COSTS,
        burn_in_days=0,
    )

    assert result_zero.scored_records == result_zero.records
    assert result_zero.total_cost == result_default.total_cost
    assert result_zero.total_demand == result_default.total_demand
    assert result_zero.total_sales == result_default.total_sales
    assert result_zero.total_lost_sales == result_default.total_lost_sales
    assert result_zero.total_expired == result_default.total_expired


def test_burn_in_excludes_early_costs_from_totals():
    # 10 days, 7 days burn-in
    demand = [2] * 10
    result = simulate_inventory(
        demand,
        2,
        lead_time=0,
        shelf_life=2,
        costs=COSTS,
        burn_in_days=7,
    )

    assert len(result.records) == 10
    assert len(result.scored_records) == 3
    # Check scored records match day indices 7, 8, 9
    assert [r.day for r in result.scored_records] == [7, 8, 9]

    # Verify totals reflect only scored days (days 7, 8, 9)
    scored_cost = sum(r.total_cost for r in result.records[7:])
    unscored_cost = sum(r.total_cost for r in result.records[:7])
    assert unscored_cost > 0.0
    assert result.total_cost == pytest.approx(scored_cost)
    assert result.total_demand == 6
    assert result.total_sales == sum(r.sales for r in result.records[7:])


def test_burn_in_preserves_pipeline_arrivals_across_boundary():
    # Lead time = 1 (arrival at t + 2)
    # Day 5 (during burn-in): order quantity = 3
    # Day 7 (first scored day): order arrives and satisfies demand of 3
    demand = [0, 0, 0, 0, 0, 0, 0, 3, 0]
    targets = [0, 0, 0, 0, 0, 3, 0, 0, 0]  # Order placed at end of day 5
    result = simulate_inventory(
        demand,
        targets,
        lead_time=1,
        shelf_life=3,
        costs=COSTS,
        burn_in_days=7,
    )

    assert result.records[5].order_quantity == 3
    assert result.records[6].pipeline_inventory == 3
    # Scored day 7 receives the arrival from day 5
    day7 = result.records[7]
    assert day7.arrivals == 3
    assert day7.sales == 3
    assert day7.lost_sales == 0
    assert result.total_lost_sales == 0
    assert result.total_sales == 3


def test_burn_in_preserves_inventory_batches_and_ageing_across_boundary():
    # Shelf life = 3 days
    # Initial inventory at day 0 = 1 (shelf life 3)
    # Day 0: unsold, days_remaining -> 2
    # Day 1: unsold, days_remaining -> 1
    # Day 2: expires at end of day 2
    # If burn_in_days = 2, day 2 is the first scored day and records the expiry!
    demand = [0, 0, 0]
    result = simulate_inventory(
        demand,
        0,
        lead_time=0,
        shelf_life=3,
        costs=COSTS,
        initial_inventory=1,
        burn_in_days=2,
    )

    assert len(result.scored_records) == 1
    assert result.records[2].expired == 1
    assert result.total_expired == 1
    assert result.total_expiry_cost == pytest.approx(COSTS.expiry_cost)


def test_invalid_burn_in_rejected():
    with pytest.raises(ValueError, match="burn_in_days"):
        simulate_inventory([1, 2], 1, lead_time=0, shelf_life=2, costs=COSTS, burn_in_days=-1)

    with pytest.raises(ValueError, match="burn_in_days"):
        simulate_inventory([1, 2], 1, lead_time=0, shelf_life=2, costs=COSTS, burn_in_days=True)

    with pytest.raises(ValueError, match="shorter than simulation duration"):
        simulate_inventory([1, 2], 1, lead_time=0, shelf_life=2, costs=COSTS, burn_in_days=2)

    with pytest.raises(ValueError, match="shorter than simulation duration"):
        simulate_inventory([1, 2], 1, lead_time=0, shelf_life=2, costs=COSTS, burn_in_days=5)


def test_empty_demand_rejected():
    with pytest.raises(ValueError, match="demand cannot be empty"):
        simulate_inventory([], 1, lead_time=0, shelf_life=2, costs=COSTS)


def test_invalid_types_for_lead_time_shelf_life_and_targets():
    with pytest.raises(ValueError, match="lead_time"):
        simulate_inventory([1], 1, lead_time=True, shelf_life=2, costs=COSTS)

    with pytest.raises(ValueError, match="shelf_life"):
        simulate_inventory([1], 1, lead_time=0, shelf_life=True, costs=COSTS)

    with pytest.raises(ValueError, match="initial_inventory"):
        simulate_inventory([1], 1, lead_time=0, shelf_life=2, costs=COSTS, initial_inventory=True)

    with pytest.raises((ValueError, TypeError), match="order_up_to"):
        simulate_inventory([1], True, lead_time=0, shelf_life=2, costs=COSTS)

    with pytest.raises(ValueError, match="finite"):
        simulate_inventory([1], float("nan"), lead_time=0, shelf_life=2, costs=COSTS)

    with pytest.raises(ValueError, match="finite"):
        simulate_inventory([1], float("inf"), lead_time=0, shelf_life=2, costs=COSTS)
