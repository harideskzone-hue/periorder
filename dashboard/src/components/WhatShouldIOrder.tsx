import React, { useEffect, useState } from 'react';
import { SuggestedOrder } from '../types';
import { fetchSuggestedOrders, approveOrders } from '../services/api';
import { 
  ShoppingCart, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Truck, 
  DollarSign, 
  ArrowRight,
  Plus,
  Minus,
  Check,
  Package
} from 'lucide-react';

export const WhatShouldIOrder: React.FC = () => {
  const [orders, setOrders] = useState<SuggestedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [confirmation, setConfirmation] = useState<{ code: string; count: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSuggestedOrders()
      .then((res) => {
        setOrders(res.orders);
        const qMap: Record<string, number> = {};
        res.orders.forEach((o) => {
          qMap[o.id] = o.suggested_order_qty;
        });
        setQuantities(qMap);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleAdjustQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(1, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleApproveSingle = async (id: string) => {
    setApprovedIds((prev) => new Set([...prev, id]));
  };

  const handleApproveAll = async () => {
    setSubmitting(true);
    const allIds = orders.map((o) => o.id);
    try {
      const res = await approveOrders(allIds);
      setApprovedIds(new Set(allIds));
      setConfirmation({ code: res.confirmation_code, count: res.approved_count });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const totalCost = orders.reduce((acc, o) => {
    const qty = quantities[o.id] || o.suggested_order_qty;
    return acc + qty * o.unit_cost;
  }, 0);

  const totalUnits = Object.values(quantities).reduce((acc, q) => acc + q, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0071e3]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e8e8ed] gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            What Should I Order?
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Suggested replenishment orders based on expected customer demand and product shelf life
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center space-x-3 text-xs bg-[#ffffff] px-4 py-2.5 rounded-xl border border-[#e8e8ed] shadow-subtle">
          <div>
            <span className="text-[#86868b] block text-[10px]">Estimated Order Total</span>
            <span className="font-bold text-base text-[#1d1d1f]">${totalCost.toFixed(2)}</span>
          </div>
          <div className="h-6 w-px bg-[#e8e8ed]"></div>
          <div>
            <span className="text-[#86868b] block text-[10px]">Total Units</span>
            <span className="font-bold text-base text-[#0071e3]">{totalUnits} units</span>
          </div>
        </div>
      </div>

      {/* Confirmation Alert */}
      {confirmation && (
        <div className="p-4 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] text-xs text-[#166534] flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
            <div>
              <span className="font-bold text-sm block">Purchase Order Confirmed! ({confirmation.code})</span>
              <span>All {confirmation.count} suggested orders have been approved and transmitted to suppliers.</span>
            </div>
          </div>
          <span className="px-3 py-1 bg-[#16a34a] text-white rounded-lg font-semibold text-[11px]">
            Transmitted
          </span>
        </div>
      )}

      {/* Approve All Primary Callout */}
      <div className="card-apple p-5 bg-gradient-to-r from-[#0071e3]/5 to-[#42a5f5]/10 border-[#0071e3]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#0071e3] text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#1d1d1f]">
              {orders.length} Replenishment Orders Ready
            </h3>
            <p className="text-xs text-[#6e6e73]">
              Review quantities and reasons below, or approve all recommendations at once.
            </p>
          </div>
        </div>

        <button
          onClick={handleApproveAll}
          disabled={submitting || approvedIds.size === orders.length}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {approvedIds.size === orders.length ? (
            <>
              <Check className="w-4 h-4" />
              <span>All Orders Approved</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              <span>Approve All {orders.length} Orders (${totalCost.toFixed(2)})</span>
            </>
          )}
        </button>
      </div>

      {/* Suggested Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.map((o) => {
          const qty = quantities[o.id] || o.suggested_order_qty;
          const isApproved = approvedIds.has(o.id);

          return (
            <div
              key={o.id}
              className={`card-apple p-5 space-y-3 transition-all border ${
                isApproved
                  ? 'border-[#10b981] bg-[#f0fdf4]/20'
                  : 'hover:border-[#d2d2d7]'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-[#1d1d1f]">
                      {o.product_name}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#86868b]">
                    Category: {o.category} · {o.product_code}
                  </span>
                </div>

                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isApproved
                      ? 'bg-[#dcfce7] text-[#166534]'
                      : 'bg-[#f0f7ff] text-[#0071e3]'
                  }`}
                >
                  {isApproved ? 'Approved' : 'Recommended'}
                </span>
              </div>

              {/* Inventory Comparison Stats */}
              <div className="grid grid-cols-3 gap-2 bg-[#f5f5f7] p-2.5 rounded-xl text-center text-xs">
                <div>
                  <span className="text-[10px] text-[#86868b] block">On-Hand Stock</span>
                  <span className="font-bold text-[#1d1d1f]">{o.current_stock} units</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868b] block">Expected 3d Demand</span>
                  <span className="font-bold text-[#0071e3]">{o.expected_demand_3d} units</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868b] block">Supplier Delivery</span>
                  <span className="font-bold text-[#1d1d1f]">{o.supplier_lead_time}</span>
                </div>
              </div>

              {/* Plain-English Reason */}
              <div className="p-2.5 rounded-lg bg-[#ffffff] border border-[#e8e8ed] text-xs space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73] block">
                  Why this quantity?
                </span>
                <p className="text-xs text-[#1d1d1f] leading-relaxed">
                  {o.reason}
                </p>
              </div>

              {/* Action Controls */}
              <div className="pt-2 flex items-center justify-between border-t border-[#f0f0f4]">
                {/* Quantity Stepper */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#86868b]">Qty:</span>
                  <div className="flex items-center rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]">
                    <button
                      onClick={() => handleAdjustQty(o.id, -1)}
                      disabled={isApproved}
                      className="p-1 text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2.5 py-0.5 text-xs font-bold text-[#1d1d1f] min-w-[28px] text-center">
                      {qty}
                    </span>
                    <button
                      onClick={() => handleAdjustQty(o.id, 1)}
                      disabled={isApproved}
                      className="p-1 text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-[#6e6e73] font-medium">
                    = ${(qty * o.unit_cost).toFixed(2)}
                  </span>
                </div>

                {/* Approve Button */}
                <button
                  onClick={() => handleApproveSingle(o.id)}
                  disabled={isApproved}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                    isApproved
                      ? 'bg-[#10b981] text-white cursor-default'
                      : 'bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-sm'
                  }`}
                >
                  {isApproved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Approved</span>
                    </>
                  ) : (
                    <span>Approve</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
