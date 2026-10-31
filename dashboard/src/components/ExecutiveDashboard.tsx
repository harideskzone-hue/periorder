import React, { useEffect, useState } from 'react';
import { ExecutiveSummaryResponse } from '../types';
import { fetchExecutiveSummary } from '../services/api';
import { 
  DollarSign, 
  Percent, 
  Trash2, 
  Award, 
  Info, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  TrendingUp,
  Layers
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
  ScatterChart, 
  Scatter, 
  ZAxis, 
  Cell 
} from 'recharts';

export const ExecutiveDashboard: React.FC = () => {
  const [data, setData] = useState<ExecutiveSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExecutiveSummary()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0071e3]"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-xl border border-red-200">
        Failed to load executive summary data. Ensure FastAPI server is running on port 8000.
      </div>
    );
  }

  const { kpis, configurations } = data;

  // Format data for Cost vs Service Scatter chart
  const scatterData = configurations.map((c) => ({
    name: `${c.method}-${c.policy}`,
    cost: Number(c.mean_cost.toFixed(2)),
    csl: Number((c.csl * 100).toFixed(2)),
    fillRate: Number((c.fill_rate * 100).toFixed(2)),
    wasteRate: Number((c.waste_rate * 100).toFixed(2)),
    isChampion: c.method === 'QR' && c.policy === 'TU',
  }));

  // Cost component stacked bar data
  const costBreakdownData = configurations.map((c) => ({
    name: `${c.method}-${c.policy}`,
    Holding: Math.round(c.holding_cost / 1000),
    Stockout: Math.round(c.stockout_cost / 1000),
    Expiry: Math.round(c.expiry_cost / 1000),
    Total: Math.round(c.total_cost / 1000),
  }));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-[#e8e8ed] gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
            Executive Inventory Performance
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Empirical benchmark of 8 forecasting and replenishment configurations across 500 grocery series
          </p>
        </div>
        
        {/* Exact Scored Days Callout */}
        <div className="flex items-center space-x-3 bg-[#ffffff] px-4 py-2.5 rounded-xl border border-[#e8e8ed] shadow-subtle text-xs">
          <ShieldCheck className="w-4 h-4 text-[#0071e3]" />
          <div>
            <span className="font-semibold text-[#1d1d1f]">Operational Scored Horizon:</span>{' '}
            <span className="text-[#0071e3] font-medium">356 days (ℓ=2)</span>
            <span className="text-[#86868b] mx-1">·</span>
            <span className="text-[#0071e3] font-medium">355 days (ℓ=3)</span>
            <span className="text-[#86868b] text-[11px] block">363/362 simulated days minus 7-day burn-in</span>
          </div>
        </div>
      </div>

      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Lowest Mean Cost */}
        <div className="card-apple p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#86868b]">
              Champion Cost (QR-TU)
            </span>
            <span className="w-8 h-8 rounded-full bg-[#f0f7ff] text-[#0071e3] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              ${kpis.best_mean_cost.toFixed(2)}
            </div>
            <div className="mt-2 flex items-center text-xs text-[#16a34a] font-medium">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              <span>−{kpis.h2_tu_vs_cr_gain}% vs QR-CR</span>
              <span className="text-[#86868b] mx-1.5">|</span>
              <span>−{kpis.h1_qr_vs_mr_gain}% vs MR-TU</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f0f0f4] text-[11px] text-[#6e6e73]">
            Mean cost per product series over scored horizon
          </div>
        </div>

        {/* KPI 2: Cycle Service Level */}
        <div className="card-apple p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#86868b]">
              Cycle Service Level (CSL)
            </span>
            <span className="w-8 h-8 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              {kpis.best_csl.toFixed(1)}%
            </div>
            <div className="mt-2 flex items-center text-xs text-[#16a34a] font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              <span>+0.35 pp vs static QR-CR</span>
              <span className="text-[#86868b] text-[11px] ml-1">(80.79%)</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f0f0f4] text-[11px] text-[#6e6e73]">
            Fraction of scored days with zero stockouts
          </div>
        </div>

        {/* KPI 3: Volume Fill Rate */}
        <div className="card-apple p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#86868b]">
              Volume Fill Rate
            </span>
            <span className="w-8 h-8 rounded-full bg-[#fdf4ff] text-[#a855f7] flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              {kpis.best_fill_rate.toFixed(1)}%
            </div>
            <div className="mt-2 flex items-center text-xs text-[#16a34a] font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              <span>+1.50 pp vs QR-CR</span>
              <span className="text-[#86868b] text-[11px] ml-1">(76.60%)</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f0f0f4] text-[11px] text-[#6e6e73]">
            Total units sold divided by total customer demand
          </div>
        </div>

        {/* KPI 4: Waste Rate */}
        <div className="card-apple p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#86868b]">
              Physical Waste Rate
            </span>
            <span className="w-8 h-8 rounded-full bg-[#fffbeb] text-[#d97706] flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              {kpis.best_waste_rate.toFixed(2)}%
            </div>
            <div className="mt-2 flex items-center text-xs text-[#16a34a] font-medium">
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
              <span>Reduced waste while lifting availability</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#f0f0f4] text-[11px] text-[#6e6e73]">
            Expired units divided by received units
          </div>
        </div>
      </div>

      {/* Charts Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Cost vs Service Level Tradeoff Frontier */}
        <div className="card-apple p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Cost vs. Service Level Frontier
              </h2>
              <p className="text-xs text-[#6e6e73]">
                Lower cost (left) and higher Cycle Service Level (top) define the Pareto frontier
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-md font-medium border border-[#e8e8ed]">
              Primary: η = 0.20
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
                <XAxis 
                  type="number" 
                  dataKey="cost" 
                  name="Mean Cost" 
                  unit="$" 
                  domain={[380, 480]}
                  label={{ value: 'Mean Series Cost ($)', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#86868b' }}
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="csl" 
                  name="CSL" 
                  unit="%" 
                  domain={[76, 84]}
                  label={{ value: 'Cycle Service Level (%)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 12, fill: '#86868b' }}
                  tick={{ fontSize: 11, fill: '#6e6e73' }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }} 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#ffffff] p-3 rounded-lg shadow-apple-card border border-[#e8e8ed] text-xs space-y-1">
                          <p className="font-semibold text-[#1d1d1f]">{d.name} {d.isChampion && '🏆 (Champion)'}</p>
                          <p className="text-[#0071e3]">Mean Cost: ${d.cost}</p>
                          <p className="text-[#16a34a]">Cycle Service Level: {d.csl}%</p>
                          <p className="text-[#6e6e73]">Volume Fill Rate: {d.fillRate}%</p>
                          <p className="text-[#d97706]">Waste Rate: {d.wasteRate}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter name="Configurations" data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isChampion ? '#0071e3' : entry.name.includes('TU') ? '#10b981' : '#94a3b8'} 
                      stroke={entry.isChampion ? '#005bb5' : '#64748b'}
                      strokeWidth={entry.isChampion ? 2 : 1}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex items-center justify-center space-x-6 text-xs text-[#6e6e73] pt-2 border-t border-[#f0f0f4]">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-[#0071e3]"></span>
              <span className="font-medium text-[#1d1d1f]">QR-TU (Champion)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-[#10b981]"></span>
              <span>Tuning Policy (TU)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-[#94a3b8]"></span>
              <span>Static Critical Ratio (CR)</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Cost Component Breakdown */}
        <div className="card-apple p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Cost Component Breakdown ($k)
              </h2>
              <p className="text-xs text-[#6e6e73]">
                Total portfolio costs split across Holding, Stockout, and Expiry
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-md font-medium border border-[#e8e8ed]">
              All 18 Scenarios Sum
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBreakdownData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6e6e73' }} />
                <YAxis unit="k" tick={{ fontSize: 11, fill: '#6e6e73' }} />
                <Tooltip 
                  formatter={(value: any, name: any) => [`$${value}k`, name]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e8e8ed', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Holding" stackId="a" fill="#0071e3" />
                <Bar dataKey="Stockout" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Expiry" stackId="a" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-center text-[11px] text-[#86868b] pt-2 border-t border-[#f0f0f4]">
            Note: QR-TU substantially reduces stockout penalties while keeping expiry under strict control.
          </div>
        </div>
      </div>

      {/* Comprehensive Benchmark Table */}
      <div className="card-apple overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8e8ed] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Full Configuration Benchmark Matrix
            </h2>
            <p className="text-xs text-[#6e6e73]">
              Primary evaluation (η = 0.20) aggregated across all 18 scenario grid combinations
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1d1d1f]">
            <thead className="bg-[#f5f5f7] text-[#6e6e73] font-medium border-b border-[#e8e8ed]">
              <tr>
                <th className="py-3 px-4">Configuration</th>
                <th className="py-3 px-4">Policy Type</th>
                <th className="py-3 px-4 text-right">Mean Series Cost</th>
                <th className="py-3 px-4 text-right">Fill Rate</th>
                <th className="py-3 px-4 text-right">CSL</th>
                <th className="py-3 px-4 text-right">Waste Rate</th>
                <th className="py-3 px-4 text-right">Total Portfolio Cost</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f4]">
              {configurations
                .slice()
                .sort((a, b) => a.mean_cost - b.mean_cost)
                .map((row) => {
                  const isChampion = row.method === 'QR' && row.policy === 'TU';
                  return (
                    <tr 
                      key={`${row.method}-${row.policy}`} 
                      className={`hover:bg-[#fafafc] transition-colors ${
                        isChampion ? 'bg-[#f0f7ff]/50 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4 flex items-center space-x-2">
                        {isChampion && <Award className="w-4 h-4 text-[#0071e3]" />}
                        <span className="font-semibold">{row.method}-{row.policy}</span>
                      </td>
                      <td className="py-3 px-4 text-[#6e6e73]">
                        {row.policy === 'TU' ? 'Validation-Tuned Quantile' : 'Static Critical Ratio'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        ${row.mean_cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(row.fill_rate * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(row.csl * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(row.waste_rate * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-right text-[#6e6e73]">
                        ${(row.total_cost / 1000).toFixed(1)}k
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isChampion ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#0071e3] text-white">
                            Champion (H1/H2)
                          </span>
                        ) : row.method === 'QR' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#6e6e73]">
                            Static Baseline
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f7] text-[#86868b]">
                            Comparison
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
