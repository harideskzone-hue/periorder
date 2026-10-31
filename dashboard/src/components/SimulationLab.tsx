import React, { useState } from 'react';
import { SimulationParams, SimulationResponse } from '../types';
import { runSimulation } from '../services/api';
import { 
  FlaskConical, 
  Play, 
  RotateCcw, 
  Sliders, 
  DollarSign, 
  ShieldCheck, 
  Percent, 
  Trash2, 
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const SimulationLab: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>({
    method: 'QR',
    policy: 'TU',
    lead_time: 1,
    shelf_life: 3,
    critical_ratio: 0.50,
    holding_share: 0.20,
    series_id: 'FOODS_1_012_TX_1_evaluation',
  });

  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setSimulating(true);
    setError(null);
    try {
      const res = await runSimulation(params);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  // Run initial simulation on load if none
  React.useEffect(() => {
    handleRun();
  }, []);

  const summary = result?.summary;
  const dailySample = result?.daily_sample || [];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#e8e8ed] gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
            Interactive Simulation Laboratory
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Test custom cost regimes, lead times, shelf lives, and policies directly against the Python FIFO engine
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs bg-[#ffffff] px-3.5 py-2 rounded-xl border border-[#e8e8ed] shadow-subtle">
          <FlaskConical className="w-3.5 h-3.5 text-[#0071e3]" />
          <span className="font-semibold text-[#1d1d1f]">Live Python Engine:</span>
          <span className="text-[#0071e3]">periorder.simulator</span>
        </div>
      </div>

      {/* Interactive Controls & Parameters Card */}
      <div className="card-apple p-5 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f4]">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-[#0071e3]" />
            <h2 className="text-sm font-semibold text-[#1d1d1f]">Simulation Parameter Configuration</h2>
          </div>
          <span className="text-xs text-[#86868b]">
            Protection Horizon: ℓ = L + 1 = {params.lead_time + 1} ({params.lead_time === 1 ? '356 scored days' : '355 scored days'})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          {/* Method & Policy */}
          <div className="space-y-3">
            <div>
              <label className="block text-[#6e6e73] font-medium mb-1">Forecasting Model</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['QR', 'MR', 'NB', 'SN'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setParams({ ...params, method: m })}
                    className={`py-1.5 px-3 rounded-lg border font-medium transition-all ${
                      params.method === m
                        ? 'bg-[#0071e3] text-white border-[#0071e3]'
                        : 'bg-[#f5f5f7] text-[#6e6e73] border-[#e8e8ed] hover:border-[#d2d2d7]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[#6e6e73] font-medium mb-1">Replenishment Policy</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['TU', 'CR'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setParams({ ...params, policy: p })}
                    className={`py-1.5 px-3 rounded-lg border font-medium transition-all ${
                      params.policy === p
                        ? 'bg-[#0071e3] text-white border-[#0071e3]'
                        : 'bg-[#f5f5f7] text-[#6e6e73] border-[#e8e8ed] hover:border-[#d2d2d7]'
                    }`}
                  >
                    {p === 'TU' ? 'TU (Tuned)' : 'CR (Static)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lead Time & Shelf Life */}
          <div className="space-y-3">
            <div>
              <label className="block text-[#6e6e73] font-medium mb-1">
                Lead Time (L): <span className="text-[#1d1d1f] font-semibold">{params.lead_time} Day</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[1, 2].map((lt) => (
                  <button
                    key={lt}
                    type="button"
                    onClick={() => setParams({ ...params, lead_time: lt })}
                    className={`py-1.5 px-3 rounded-lg border font-medium transition-all ${
                      params.lead_time === lt
                        ? 'bg-[#0071e3] text-white border-[#0071e3]'
                        : 'bg-[#f5f5f7] text-[#6e6e73] border-[#e8e8ed] hover:border-[#d2d2d7]'
                    }`}
                  >
                    L = {lt} Day ({lt === 1 ? 'ℓ=2' : 'ℓ=3'})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[#6e6e73] font-medium mb-1">
                Shelf Life (m): <span className="text-[#1d1d1f] font-semibold">{params.shelf_life} Days</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[2, 3, 5].map((sl) => (
                  <button
                    key={sl}
                    type="button"
                    onClick={() => setParams({ ...params, shelf_life: sl })}
                    className={`py-1.5 px-2 rounded-lg border font-medium transition-all ${
                      params.shelf_life === sl
                        ? 'bg-[#0071e3] text-white border-[#0071e3]'
                        : 'bg-[#f5f5f7] text-[#6e6e73] border-[#e8e8ed] hover:border-[#d2d2d7]'
                    }`}
                  >
                    m = {sl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Continuous Sliders: Critical Ratio & Holding Share */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#6e6e73] font-medium">Critical Ratio (CR):</label>
                <span className="font-semibold text-[#1d1d1f] bg-[#f5f5f7] px-2 py-0.5 rounded border border-[#e8e8ed]">
                  {params.critical_ratio.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.90"
                step="0.05"
                value={params.critical_ratio}
                onChange={(e) => setParams({ ...params, critical_ratio: parseFloat(e.target.value) })}
                className="w-full accent-[#0071e3]"
              />
              <div className="flex justify-between text-[10px] text-[#86868b] mt-0.5">
                <span>0.20 (Underage Cheap)</span>
                <span>0.90 (High Service)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#6e6e73] font-medium">Holding Share (η):</label>
                <span className="font-semibold text-[#1d1d1f] bg-[#f5f5f7] px-2 py-0.5 rounded border border-[#e8e8ed]">
                  {params.holding_share.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.10"
                value={params.holding_share}
                onChange={(e) => setParams({ ...params, holding_share: parseFloat(e.target.value) })}
                className="w-full accent-[#0071e3]"
              />
              <div className="flex justify-between text-[10px] text-[#86868b] mt-0.5">
                <span>0.10 (High Spoilage Cost)</span>
                <span>1.00 (Pure Holding)</span>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex flex-col justify-end space-y-2">
            <button
              onClick={handleRun}
              disabled={simulating}
              className="w-full py-3 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {simulating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Running Simulation...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Execute Simulation</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-[#86868b] text-center">
              Re-executes 356/355 operational days in Python FIFO engine in &lt;5ms
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Simulation Result KPIs */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card-apple p-3.5">
            <span className="text-[11px] font-medium text-[#86868b] block">Total Scored Cost</span>
            <span className="text-xl font-bold text-[#1d1d1f]">${summary.total_cost.toFixed(1)}</span>
            <span className="text-[10px] text-[#86868b] block mt-0.5">
              H: ${summary.holding_cost} | S: ${summary.stockout_cost} | E: ${summary.expiry_cost}
            </span>
          </div>

          <div className="card-apple p-3.5">
            <span className="text-[11px] font-medium text-[#86868b] block">Cycle Service Level</span>
            <span className="text-xl font-bold text-[#16a34a]">{summary.csl.toFixed(1)}%</span>
            <span className="text-[10px] text-[#86868b] block mt-0.5">
              {summary.scored_days - summary.stockout_days} / {summary.scored_days} Days Stockout-Free
            </span>
          </div>

          <div className="card-apple p-3.5">
            <span className="text-[11px] font-medium text-[#86868b] block">Volume Fill Rate</span>
            <span className="text-xl font-bold text-[#0071e3]">{summary.fill_rate.toFixed(1)}%</span>
            <span className="text-[10px] text-[#86868b] block mt-0.5">
              {summary.total_sales} / {summary.total_demand} Units
            </span>
          </div>

          <div className="card-apple p-3.5">
            <span className="text-[11px] font-medium text-[#86868b] block">Physical Waste Rate</span>
            <span className="text-xl font-bold text-[#d97706]">{summary.waste_rate.toFixed(1)}%</span>
            <span className="text-[10px] text-[#86868b] block mt-0.5">
              {summary.total_expired} Expired Units
            </span>
          </div>

          <div className="card-apple p-3.5">
            <span className="text-[11px] font-medium text-[#86868b] block">Lost Sales Units</span>
            <span className="text-xl font-bold text-[#f43f5e]">{summary.total_lost_sales}</span>
            <span className="text-[10px] text-[#86868b] block mt-0.5">
              Unmet Customer Demand
            </span>
          </div>

          <div className="card-apple p-3.5">
            <span className="text-[11px] font-medium text-[#86868b] block">Scored Days Horizon</span>
            <span className="text-xl font-bold text-[#1d1d1f]">{summary.scored_days}</span>
            <span className="text-[10px] text-[#0071e3] font-medium block mt-0.5">
              ℓ = {params.lead_time + 1} (7d Burn-in Excl.)
            </span>
          </div>
        </div>
      )}

      {/* Simulated Time Series Chart */}
      {dailySample.length > 0 && (
        <div className="card-apple p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Simulated Trajectory Sample (First 60 Days Post Burn-in)
              </h2>
              <p className="text-xs text-[#6e6e73]">
                Daily ending inventory, order decisions, arrivals, and customer demand
              </p>
            </div>
            <div className="flex items-center space-x-3 text-xs text-[#6e6e73]">
              <span className="flex items-center space-x-1">
                <span className="w-3 h-0.5 bg-[#0071e3]"></span>
                <span>Ending Stock</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 bg-[#94a3b8] rounded-sm"></span>
                <span>Order Placed</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 bg-[#f43f5e] rounded-sm"></span>
                <span>Expired</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailySample} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6e6e73' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6e6e73' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e8e8ed', fontSize: '12px' }}
                />
                <Bar dataKey="order_quantity" fill="#cbd5e1" name="Order Placed" />
                <Bar dataKey="expired" fill="#f43f5e" name="Expired" />
                <Line type="monotone" dataKey="ending_inventory" stroke="#0071e3" strokeWidth={2} dot={false} name="Ending Inventory" />
                <Line type="stepAfter" dataKey="demand" stroke="#1d1d1f" strokeWidth={1} dot={false} name="Demand" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
