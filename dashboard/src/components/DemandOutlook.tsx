import React, { useEffect, useState } from 'react';
import { DemandOutlookResponse } from '../types';
import { fetchDemandOutlook } from '../services/api';
import {
  TrendingUp,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Info,
  Clock,
  RefreshCw,
  AlertCircle,
  PackageCheck,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const DemandOutlook: React.FC = () => {
  const [data, setData] = useState<DemandOutlookResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    fetchDemandOutlook()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError('We could not load the demand outlook. Check that the PeriOrder API is running, then try again.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center space-y-3" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#2563EB]" />
        <span className="text-sm font-medium text-slate-600">Loading demand forecast…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error || 'No demand forecast data available.'}</span>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const peakDay = data.peak_day ?? { day: 'Saturday', expected_units: 74, surge_pct: '+62%' };
  const tomorrow = data.tomorrow_forecast ?? { day: 'Tomorrow', expected_units: 41, range_low: 35, range_high: 48 };
  const totalUnits = data.weekly_total_units ?? data.weekly_outlook.reduce((s, d) => s + d.expected_demand, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Demand Outlook
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Expected customer purchasing patterns, peak shopping periods, and fast-moving grocery lines
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm sm:self-auto">
          <Calendar className="h-4 w-4 text-[#2563EB]" />
          <span>Rolling 7-Day Window · Updated Today</span>
        </div>
      </div>

      {/* Honest Data Origin Warning */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <strong>Demonstration Demand Forecasts:</strong> Sales velocities and demand ranges are estimated using Quantile Regression and Seasonal Naive models calibrated on historical M5 grocery patterns. Values are illustrative tools for delivery scheduling and shelf stocking.
        </div>
      </div>

      {/* Top 3 Quick Highlight Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Tomorrow */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Tomorrow&apos;s Demand</span>
            <Clock className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{tomorrow.expected_units}</span>
            <span className="text-sm font-medium text-slate-500">units expected</span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Expected range: <strong className="text-slate-800">{tomorrow.range_low} – {tomorrow.range_high} units</strong>
          </div>
        </div>

        {/* Card 2: Peak Shopping Day */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-700">
            <span className="font-semibold uppercase tracking-wider">Peak Shopping Day</span>
            <Flame className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#2563EB]">{peakDay.day}</span>
            <span className="text-xs font-semibold text-amber-700">({peakDay.surge_pct} vs Monday)</span>
          </div>
          <div className="mt-2 border-t border-blue-100 pt-2 text-xs text-blue-900">
            Projected peak: <strong className="text-slate-900">~{peakDay.expected_units} units</strong> across key aisles
          </div>
        </div>

        {/* Card 3: Weekly Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">7-Day Projected Total</span>
            <TrendingUp className="h-4 w-4 text-[#0F766E]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalUnits}</span>
            <span className="text-sm font-medium text-slate-500">units monitored</span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Busiest period: <strong className="text-[#0F766E]">Friday afternoon &amp; Saturday</strong>
          </div>
        </div>
      </div>

      {/* Main 7-Day Chart Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Customer Demand Trend Across the Week
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              The solid line is the expected sales level; the shaded band is the safety range to prevent running out
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
              <span className="font-medium text-slate-700">Expected Sales</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-6 rounded-sm bg-blue-200" />
              <span>Expected Range (Low – High)</span>
            </div>
          </div>
        </div>

        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.weekly_outlook} margin={{ top: 10, right: 15, bottom: 10, left: 0 }}>
              <defs>
                <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.20} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" unit=" u" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const row = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg space-y-1">
                        <p className="font-bold text-slate-900">{label}</p>
                        <p className="text-[#2563EB] font-bold">Expected Demand: {row.expected_demand} units</p>
                        <p className="text-slate-600">Expected Range: {row.range_low} – {row.range_high} units</p>
                        <div className="mt-1 pt-1 border-t border-slate-100 flex items-center gap-1 text-[11px] font-semibold text-[#0F766E]">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{row.status}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="range_high"
                stroke="#93C5FD"
                strokeWidth={1}
                strokeDasharray="2 2"
                fill="url(#rangeGradient)"
                name="High Range"
              />
              <Area
                type="monotone"
                dataKey="expected_demand"
                stroke="#2563EB"
                strokeWidth={3}
                fill="#2563EB"
                fillOpacity={0.08}
                name="Expected Sales"
              />
              <Area
                type="monotone"
                dataKey="range_low"
                stroke="#93C5FD"
                strokeWidth={1}
                strokeDasharray="2 2"
                fill="none"
                name="Low Range"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed border border-slate-100">
          <strong>How to read this chart:</strong> Customer shopping foot traffic stays relatively level from Monday to Wednesday, starts climbing Thursday evening, and hits peak levels on Saturday. Stock shelves fully before Friday afternoon to capture peak weekend volume without emergency rush orders.
        </div>
      </div>

      {/* Day by Day Cards Grid */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">
          Day-by-Day Forecast Breakdown
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {data.weekly_outlook.map((dayItem, idx) => {
            const isPeak = dayItem.status.toLowerCase().includes('peak');
            const isHeavy = dayItem.status.toLowerCase().includes('heavy') || dayItem.status.toLowerCase().includes('surge');
            return (
              <div
                key={idx}
                className={`flex flex-col justify-between rounded-xl border p-3.5 shadow-sm transition-all ${
                  isPeak
                    ? 'border-amber-300 bg-amber-50/50 ring-1 ring-amber-200'
                    : isHeavy
                    ? 'border-blue-200 bg-blue-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{dayItem.day}</span>
                    {isPeak && <Flame className="h-3.5 w-3.5 text-amber-600" />}
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-extrabold text-slate-900">{dayItem.expected_demand}</span>
                    <span className="ml-1 text-[11px] text-slate-500">units</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Range: <span className="font-semibold text-slate-700">{dayItem.range_low} – {dayItem.range_high}</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <span
                    className={`block truncate rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                      isPeak
                        ? 'bg-amber-100 text-amber-800'
                        : isHeavy
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {dayItem.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fast-Moving Products Section */}
      {data.fast_moving_products && data.fast_moving_products.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Products Likely to Sell Faster This Week
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Top high-velocity products that drive grocery volume and require attentive shelf replenishment
              </p>
            </div>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#2563EB]">
              {data.fast_moving_products.length} Fast Movers
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.fast_moving_products.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                      {p.category}
                    </span>
                    <h3 className="mt-1.5 font-bold text-slate-900 text-sm leading-snug">
                      {p.name}
                    </h3>
                  </div>
                  <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {p.momentum}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-lg font-extrabold text-[#2563EB]">{p.weekly_expected_units}</span>
                  <span className="text-xs text-slate-500">weekly units expected</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed border-t border-slate-200 pt-2">
                  {p.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operator Action Guidance Box */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#0F766E]" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-teal-950">
              Recommended Operator Action
            </h3>
            <p className="text-xs text-teal-900 leading-relaxed">
              {data.recommended_focus} Place purchase orders for 2-day lead time items (such as eggs and beef) on Wednesday morning to guarantee delivery by Friday midday before the weekend rush begins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
