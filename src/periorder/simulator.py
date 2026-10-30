"""FIFO simulation engine for perishable inventory."""

from collections.abc import Sequence
from dataclasses import dataclass
from math import ceil, floor, isfinite
from typing import Literal

from periorder.config import CostParameters


@dataclass
class Batch:
    """An inventory batch, ordered from oldest to newest by days remaining."""

    quantity: int
    days_remaining: int


@dataclass(frozen=True)
class DailyRecord:
    """Inventory outcomes recorded for one simulated day."""

    day: int
    demand: int
    arrivals: int
    sales: int
    lost_sales: int
    ending_inventory: int
    expired: int
    pipeline_inventory: int
    inventory_position: int
    order_quantity: int
    holding_cost: float
    stockout_cost: float
    expiry_cost: float

    @property
    def total_cost(self) -> float:
        return self.holding_cost + self.stockout_cost + self.expiry_cost


@dataclass(frozen=True)
class SimulationResult:
    """Aggregated results and daily records from one simulation."""

    records: tuple[DailyRecord, ...]
    burn_in_days: int = 0

    @property
    def scored_records(self) -> tuple[DailyRecord, ...]:
        return self.records[self.burn_in_days :]

    @property
    def total_demand(self) -> int:
        return sum(record.demand for record in self.scored_records)

    @property
    def total_sales(self) -> int:
        return sum(record.sales for record in self.scored_records)

    @property
    def total_lost_sales(self) -> int:
        return sum(record.lost_sales for record in self.scored_records)

    @property
    def total_expired(self) -> int:
        return sum(record.expired for record in self.scored_records)

    @property
    def total_holding_cost(self) -> float:
        return sum(record.holding_cost for record in self.scored_records)

    @property
    def total_stockout_cost(self) -> float:
        return sum(record.stockout_cost for record in self.scored_records)

    @property
    def total_expiry_cost(self) -> float:
        return sum(record.expiry_cost for record in self.scored_records)

    @property
    def total_cost(self) -> float:
        return sum(record.total_cost for record in self.scored_records)


def _round_target(
    target: float,
    rounding: Literal["ceil", "nearest", "floor"],
) -> int:
    if rounding == "ceil":
        return ceil(target)
    if rounding == "nearest":
        return floor(target + 0.5)
    if rounding == "floor":
        return floor(target)
    raise ValueError("rounding must be 'ceil', 'nearest', or 'floor'.")


def simulate_inventory(
    demand: Sequence[int],
    order_up_to: Sequence[float] | float,
    *,
    lead_time: int,
    shelf_life: int,
    costs: CostParameters,
    initial_inventory: int = 0,
    rounding: Literal["ceil", "nearest", "floor"] = "ceil",
    burn_in_days: int = 0,
) -> SimulationResult:
    """Simulate daily lost-sales inventory with FIFO and finite shelf life.

    Orders placed at the end of day t arrive at the start of day
    t + lead_time + 1. Initial inventory is treated as fresh stock.

    Holding cost is charged on stock remaining after sales and expiry.
    Expired units incur expiry cost. Unmet demand incurs stockout cost.

    Orders arriving beyond the simulation horizon are not included in
    daily costs. No terminal pipeline penalty is applied.

    If burn_in_days > 0, simulation begins with warm-up for the specified
    days, and inventory/pipeline state is preserved into scored days while
    burn-in costs are excluded from reported aggregate totals.
    """
    if isinstance(lead_time, bool) or not isinstance(lead_time, int) or lead_time < 0:
        raise ValueError("lead_time must be a non-negative integer.")
    if isinstance(shelf_life, bool) or not isinstance(shelf_life, int) or shelf_life < 1:
        raise ValueError("shelf_life must be a positive integer.")
    if (
        isinstance(initial_inventory, bool)
        or not isinstance(initial_inventory, int)
        or initial_inventory < 0
    ):
        raise ValueError("initial_inventory must be a non-negative integer.")
    if (
        isinstance(burn_in_days, bool)
        or not isinstance(burn_in_days, int)
        or burn_in_days < 0
    ):
        raise ValueError("burn_in_days must be a non-negative integer.")
    if len(demand) == 0:
        raise ValueError("demand cannot be empty.")
    if burn_in_days >= len(demand):
        raise ValueError("burn_in_days must be shorter than simulation duration.")

    if any(
        isinstance(value, bool) or not isinstance(value, int) or value < 0
        for value in demand
    ):
        raise ValueError("Demand values must be non-negative integers.")

    if isinstance(order_up_to, bool):
        raise TypeError("order_up_to cannot be boolean.")

    if isinstance(order_up_to, (int, float)):
        targets = [float(order_up_to)] * len(demand)
    else:
        targets = [float(value) for value in order_up_to]

    if len(targets) != len(demand):
        raise ValueError("order_up_to must be a scalar or match demand length.")
    if any(not isfinite(value) or value < 0 for value in targets):
        raise ValueError("Order-up-to targets must be finite and non-negative.")

    if rounding not in ("ceil", "nearest", "floor"):
        raise ValueError("Invalid rounding method.")

    batches: list[Batch] = []
    if initial_inventory:
        batches.append(Batch(initial_inventory, shelf_life))

    arrivals_by_day: dict[int, int] = {}
    records: list[DailyRecord] = []

    for day, (daily_demand, target) in enumerate(zip(demand, targets)):
        # 1. Receive orders scheduled to arrive today.
        arrivals = arrivals_by_day.pop(day, 0)
        if arrivals:
            batches.append(Batch(arrivals, shelf_life))

        # 2. Serve demand using oldest stock first.
        batches.sort(key=lambda batch: batch.days_remaining)
        remaining_demand = daily_demand
        updated_batches: list[Batch] = []

        for batch in batches:
            sold = min(batch.quantity, remaining_demand)
            batch.quantity -= sold
            remaining_demand -= sold

            if batch.quantity:
                updated_batches.append(batch)

        batches = updated_batches
        sales = daily_demand - remaining_demand
        lost_sales = remaining_demand

        # 3. Age remaining stock and remove expired units.
        expired = 0
        unexpired_batches: list[Batch] = []

        for batch in batches:
            batch.days_remaining -= 1
            if batch.days_remaining == 0:
                expired += batch.quantity
            else:
                unexpired_batches.append(batch)

        batches = unexpired_batches

        # 4. Charge holding cost on surviving end-of-day inventory.
        ending_inventory = sum(batch.quantity for batch in batches)
        holding_cost = ending_inventory * costs.holding_cost
        stockout_cost = lost_sales * costs.stockout_cost
        expiry_cost = expired * costs.expiry_cost

        # 5. Determine inventory position and place a replenishment order.
        pipeline_inventory = sum(arrivals_by_day.values())
        inventory_position = ending_inventory + pipeline_inventory
        target_integer = _round_target(target, rounding)
        order_quantity = max(0, target_integer - inventory_position)

        # An order placed today arrives at the start of day t + L + 1.
        arrival_day = day + lead_time + 1
        if order_quantity:
            arrivals_by_day[arrival_day] = (
                arrivals_by_day.get(arrival_day, 0) + order_quantity
            )

        records.append(
            DailyRecord(
                day=day,
                demand=daily_demand,
                arrivals=arrivals,
                sales=sales,
                lost_sales=lost_sales,
                ending_inventory=ending_inventory,
                expired=expired,
                pipeline_inventory=pipeline_inventory,
                inventory_position=inventory_position,
                order_quantity=order_quantity,
                holding_cost=holding_cost,
                stockout_cost=stockout_cost,
                expiry_cost=expiry_cost,
            )
        )

    return SimulationResult(
        records=tuple(records),
        burn_in_days=burn_in_days,
    )
