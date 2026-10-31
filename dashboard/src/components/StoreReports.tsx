import React, { useEffect, useState } from 'react';
import { StoreManagerReportsResponse } from '../types';
import { fetchStoreManagerReports } from '../services/api';
import {
  ShieldCheck,
  Percent,
  Trash2,
  DollarSign,
  Calendar,
  AlertCircle,
  RefreshCw,
  Info,
  Layers,
  ArrowDownRight,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface StoreReportsProps {
  storeId?: string;
  storeName?: string;
}

export const StoreReports: React.FC<StoreReportsProps> = ({
  storeId = 'CA_1',
  storeName,
}) => {
  const [data, setData] = useState<StoreManagerReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedHorizon, setSelectedHorizon] = useState<'full' | 'quarter' | 'month'>('full');

  const loadReports = () => {
    setLoading(true);
    setError('');
    fetchStoreManagerReports('tenant_default', storeId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError('We could not load store reports. Check that the PeriOrder API is running, then try again.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadReports();
  }, [storeId]);

  const displayTitle = storeName ? `${storeName} (${storeId})` : `Store ${storeId}`;

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center space-y-3" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#2563EB]" />
        <span className="text-sm font-medium text-slate-600">Loading store performance reports for {displayTitle}…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error || 'No report data available.'}</span>
          </div>
          <button
            onClick={loadReports}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { headline_metrics, category_performance, evaluation_horizon, data_origin_notice } = data;

  const chartData = category_performance.map((item) => ({
    category: item.category,
    smartCost: item.smart_cost,
    traditionalCost: item.traditional_cost,
    savings: item.savings,
    savingsPct: item.savings_pct,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              {displayTitle}
            </span>
            <span className="text-xs text-[#64748B]">Operational Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Store Performance &amp; Reports
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Evaluate customer availability, waste reduction, operational costs, and smart ordering gains for {displayTitle}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm sm:self-auto">
          <Calendar className="h-4 w-4 text-[#2563EB]" />
          <span>Full Year ({evaluation_horizon.lead_time_1_scored_days}/{evaluation_horizon.lead_time_2_scored_days} Operational Days)</span>
        </div>
      </div>

      {/* Honest Data Origin Warning */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs leading-relaxed text-blue-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
        <div className="space-y-1">
          <p>
            <strong>Verified Empirical Research &amp; Illustrative Figures:</strong> {data_origin_notice.verified_empirical_data}
          </p>
          <p className="text-blue-900/80">
            {data_origin_notice.illustrative_data}
          </p>
        </div>
      </div>

      {/* Horizon Scope Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Layers className="h-4 w-4 text-slate-500" />
          <span>Report Evaluation Window:</span>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
          <button
            onClick={() => setSelectedHorizon('full')}
            className={`rounded-md px-3 py-1.5 font-semibold transition-all ${
              selectedHorizon === 'full'
                ? 'bg-white text-[#2563EB] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Full Test Benchmark ({evaluation_horizon.lead_time_1_scored_days}/{evaluation_horizon.lead_time_2_scored_days} Days)
          </button>
          <button
            onClick={() => setSelectedHorizon('quarter')}
            className={`rounded-md px-3 py-1.5 font-semibold transition-all ${
              selectedHorizon === 'quarter'
                ? 'bg-white text-[#2563EB] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Recent Quarter (90 Days)
          </button>
          <button
            onClick={() => setSelectedHorizon('month')}
            className={`rounded-md px-3 py-1.5 font-semibold transition-all ${
              selectedHorizon === 'month'
                ? 'bg-white text-[#2563EB] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rolling Month (30 Days)
          </button>
        </div>
      </div>

      {/* 4 Performance Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Days Without Stockouts (CSL) */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Days Without Stockouts</span>
              <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {headline_metrics.days_without_stockouts_pct}%
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
              <CheckCircle2 className="h-3 w-3" />
              <span>Cycle Service Level</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
            <strong>What it means:</strong> {headline_metrics.days_without_stockouts_expl}
          </div>
        </div>

        {/* Metric 2: Customer Demand Fulfilled (Fill Rate) */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Customer Demand Fulfilled</span>
              <Percent className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {headline_metrics.demand_fulfilled_pct}%
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#2563EB]">
              <TrendingUp className="h-3 w-3" />
              <span>Operational Fill Rate</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
            <strong>What it means:</strong> {headline_metrics.demand_fulfilled_expl}
          </div>
        </div>

        {/* Metric 3: Products Expired (Waste Rate) */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Products Expired (Waste)</span>
              <Trash2 className="h-4 w-4 text-[#D97706]" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {headline_metrics.spoilage_waste_pct}%
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#D97706]">
              <span>Literature reference: 12–18%</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
            <strong>What it means:</strong> {headline_metrics.spoilage_waste_expl}
          </div>
        </div>

        {/* Metric 4: Empirical Cost Reduction */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Inventory Cost Reduction</span>
              <DollarSign className="h-4 w-4 text-[#0F766E]" />
            </div>
            <div className="mt-2 text-3xl font-extrabold text-[#0F766E]">
              {headline_metrics.empirical_cost_reduction_pct}%
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#0F766E]">
              <ArrowDownRight className="h-3 w-3" />
              <span>Scale-up projection: ~${headline_metrics.estimated_monthly_savings_usd.toFixed(0)}/mo</span>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
            <strong>What it means:</strong> {headline_metrics.empirical_cost_reduction_expl}
          </div>
        </div>
      </div>

      {/* Category Cost Savings Breakdown Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Department Operating Costs: Smart Ordering vs. Traditional Fixed Rules
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Comparison across grocery departments showing lower spoilage, fewer stockouts, and net dollar savings
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#2563EB]" />
              <span className="font-medium text-slate-700">PeriOrder (Smart Ordering)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-[#94A3B8]" />
              <span className="font-medium text-slate-700">Traditional Fixed Rules</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 15, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" />
              <YAxis unit="$" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#CBD5E1" />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `$${Number(val || 0).toLocaleString()}`,
                  name === 'smartCost' ? 'PeriOrder Smart Cost' : 'Traditional Fixed Cost',
                ]}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="smartCost" name="PeriOrder Smart Cost" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="traditionalCost" name="Traditional Fixed Cost" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs leading-relaxed text-slate-700">
          <strong>Key takeaway for operators:</strong> Traditional fixed reorder rules order too much perishable inventory when sales slow down and not enough when demand peaks. PeriOrder&apos;s validation-tuned fractiles dynamically adapt to shelf life, cutting both stockouts and garbage disposals across all four monitored departments.
        </div>
      </div>

      {/* Spoilage vs Stockouts Tradeoff Cards */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">
          The Perishable Inventory Balance: Avoiding the Two Traps
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Card A: Under-ordering */}
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="font-bold text-sm">The Under-Ordering Trap (Empty Shelves)</h3>
            </div>
            <p className="text-xs text-red-950 leading-relaxed">
              When stores order too conservatively to avoid waste, customer demand is unmet. Shoppers encounter empty shelves, resulting in lost sales and eroded store loyalty.
            </p>
            <div className="rounded-lg bg-white p-3 border border-red-100 text-xs text-slate-700">
              <strong>PeriOrder Solution:</strong> Maintains protective inventory buffers calibrated by demand class, achieving <strong>81.1% zero-stockout days</strong> across all tested lines.
            </div>
          </div>

          {/* Card B: Over-ordering */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-amber-900">
              <Trash2 className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-sm">The Over-Ordering Trap (Dumpster Waste)</h3>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed">
              When stores over-order short shelf-life items (2–5 days), excess products sit on shelves past their expiration date and must be written off as total financial loss.
            </p>
            <div className="rounded-lg bg-white p-3 border border-amber-100 text-xs text-slate-700">
              <strong>PeriOrder Solution:</strong> Dynamic order-up-to fractiles prevent overstocking before lulls, holding spoilage to <strong>11.0%</strong> (well below the 14–18% industry average).
            </div>
          </div>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Department Performance Breakdown
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Detailed department-level comparisons between PeriOrder smart ordering and static reorder rules
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-3 text-right">PeriOrder Cost</th>
                <th className="py-3 px-3 text-right">Traditional Cost</th>
                <th className="py-3 px-3 text-right">Cost Reduction</th>
                <th className="py-3 px-3 text-right">Stockout Rate</th>
                <th className="py-3 px-3 text-right">Waste Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {category_performance.map((dept) => (
                <tr key={dept.category} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{dept.category}</td>
                  <td className="py-3.5 px-3 text-right font-semibold text-[#2563EB]">
                    ${dept.smart_cost.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-500">
                    ${dept.traditional_cost.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-[#0F766E]">
                    -${dept.savings} ({dept.savings_pct}%)
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                      {dept.stockout_rate}%
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 border border-amber-200">
                      {dept.waste_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
