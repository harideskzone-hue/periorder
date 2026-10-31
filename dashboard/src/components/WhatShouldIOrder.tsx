import React, { useEffect, useMemo, useState } from 'react';
import { SuggestedOrder } from '../types';
import { fetchSuggestedOrders, approveOrders } from '../services/api';
import { AlertCircle, CheckCircle2, Info, Minus, Plus, RefreshCw, ShoppingCart } from 'lucide-react';

interface WhatShouldIOrderProps {
  storeId?: string;
  storeName?: string;
}

export const WhatShouldIOrder: React.FC<WhatShouldIOrderProps> = ({
  storeId = 'CA_1',
  storeName,
}) => {
  const [orders, setOrders] = useState<SuggestedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<{ code: string; count: number } | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchSuggestedOrders('tenant_default', storeId);
      setOrders(res.orders);
      setQuantities(Object.fromEntries(res.orders.map((order) => [order.id, order.suggested_order_qty])));
      setApprovedIds(new Set());
      setConfirmation(null);
    } catch (err) {
      console.error(err);
      setError('We could not load order suggestions. Check that the PeriOrder API is running, then try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOrders(); }, [storeId]);

  const totalUnits = useMemo(
    () => orders.reduce((sum, order) => sum + (quantities[order.id] ?? order.suggested_order_qty), 0),
    [orders, quantities]
  );
  const totalCost = useMemo(
    () => orders.reduce((sum, order) => sum + (quantities[order.id] ?? order.suggested_order_qty) * order.unit_cost, 0),
    [orders, quantities]
  );

  const adjustQuantity = (id: string, delta: number) => {
    setQuantities((previous) => ({
      ...previous,
      [id]: Math.max(1, Math.min(9999, (previous[id] ?? 1) + delta)),
    }));
    setConfirmation(null);
  };

  const approve = async (ids: string[]) => {
    const selected = orders.filter((order) => ids.includes(order.id) && !approvedIds.has(order.id));
    if (!selected.length) return;
    const total = selected.reduce((sum, order) => sum + (quantities[order.id] ?? order.suggested_order_qty) * order.unit_cost, 0);
    const units = selected.reduce((sum, order) => sum + (quantities[order.id] ?? order.suggested_order_qty), 0);
    const confirmed = window.confirm(
      `Review demo approval\n\nBranch: ${displayTitle}\n${selected.length} recommendation(s)\n${units} units\nIllustrative value: $${total.toFixed(2)}\n\nThis records an internal demonstration approval only. It will NOT send an order to a supplier. Continue?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError('');
    try {
      const quantityMap = Object.fromEntries(selected.map((order) => [order.id, quantities[order.id] ?? order.suggested_order_qty]));
      const result = await approveOrders(selected.map((order) => order.id), quantityMap, 'tenant_default', storeId);
      setApprovedIds((previous) => new Set([...previous, ...selected.map((order) => order.id)]));
      setConfirmation({ code: result.confirmation_code, count: result.approved_count });
    } catch (err) {
      console.error(err);
      setError('Approval could not be recorded. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayTitle = storeName ? `${storeName} (${storeId})` : `Store ${storeId}`;

  if (loading) return (
    <div className="flex min-h-[360px] items-center justify-center" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#2563EB]" />
      <span className="ml-3 text-sm text-slate-600">Loading order suggestions for {displayTitle}…</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              {displayTitle}
            </span>
            <span className="text-xs text-[#64748B]">Replenishment Queue</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">Order Suggestions</h1>
          <p className="mt-1 text-sm text-slate-600">Review suggested replenishment quantities and reasoning tailored for {displayTitle}.</p>
        </div>
        <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div><p className="text-xs text-slate-500">Total suggested units</p><p className="text-xl font-bold text-slate-900">{totalUnits}</p></div>
          <div className="h-9 w-px bg-slate-200" />
          <div><p className="text-xs text-slate-500">Illustrative order value</p><p className="text-xl font-bold text-slate-900">${totalCost.toFixed(2)}</p></div>
        </div>
      </header>

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div><strong>Demonstration recommendations.</strong> Product quantities, unit costs, demand estimates and supplier lead times shown here are illustrative. Approval records an internal demo action only; no supplier integration is connected and no purchase order is transmitted.</div>
      </div>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</span><button onClick={() => void loadOrders()} className="inline-flex shrink-0 items-center gap-1 font-semibold"><RefreshCw className="h-4 w-4"/> Retry</button></div>}

      {confirmation && <div role="status" className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/><div><strong>Demo approval recorded — {confirmation.code}</strong><p className="mt-1">{confirmation.count} recommendation(s) marked as internally approved. Nothing was sent to a supplier.</p></div></div>}

      <section className="flex flex-col justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
        <div><h2 className="font-semibold text-slate-900">{orders.length} recommendations available</h2><p className="mt-1 text-xs text-slate-600">Check each quantity before recording an approval.</p></div>
        <button onClick={() => void approve(orders.map((order) => order.id))} disabled={submitting || orders.length === 0 || approvedIds.size === orders.length} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><ShoppingCart className="h-4 w-4"/>{submitting ? 'Recording…' : 'Review and approve all'}</button>
      </section>

      {orders.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center"><ShoppingCart className="mx-auto h-8 w-8 text-slate-400"/><p className="mt-3 font-semibold text-slate-800">No order suggestions available</p><p className="mt-1 text-sm text-slate-500">There are no recommendations to review right now.</p></div> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {orders.map((order) => {
            const qty = quantities[order.id] ?? order.suggested_order_qty;
            const approved = approvedIds.has(order.id);
            return <article key={order.id} className={`rounded-xl border bg-white p-5 shadow-sm ${approved ? 'border-green-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold text-slate-900">{order.product_name}</h3><p className="mt-1 text-xs text-slate-500">{order.category} · {order.product_code}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${approved ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-700'}`}>{approved ? 'Demo approved' : 'Recommended'}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
                <div><p className="text-[11px] text-slate-500">Illustrative stock</p><p className="mt-1 font-bold text-slate-900">{order.current_stock}</p></div>
                <div><p className="text-[11px] text-slate-500">Expected 3-day demand</p><p className="mt-1 font-bold text-slate-900">{order.expected_demand_3d}</p></div>
                <div><p className="text-[11px] text-slate-500">Lead time</p><p className="mt-1 font-bold text-slate-900">{order.supplier_lead_time}</p></div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Why is this suggested?</p><p className="mt-1 text-sm leading-relaxed text-slate-700">{order.reason}</p></div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div><p className="text-xs text-slate-500">Suggested quantity</p><div className="mt-1 flex items-center gap-3"><div className="flex items-center rounded-lg border border-slate-200"><button aria-label={`Decrease ${order.product_name} quantity`} onClick={() => adjustQuantity(order.id, -1)} disabled={approved || submitting} className="p-2 hover:bg-slate-50 disabled:opacity-40"><Minus className="h-4 w-4"/></button><span className="min-w-10 text-center text-sm font-bold">{qty}</span><button aria-label={`Increase ${order.product_name} quantity`} onClick={() => adjustQuantity(order.id, 1)} disabled={approved || submitting} className="p-2 hover:bg-slate-50 disabled:opacity-40"><Plus className="h-4 w-4"/></button></div><span className="text-sm font-semibold text-slate-800">${(qty * order.unit_cost).toFixed(2)}</span></div></div>
                <button onClick={() => void approve([order.id])} disabled={approved || submitting} className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-green-600">{approved ? 'Demo approved' : 'Review approval'}</button>
              </div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
};
