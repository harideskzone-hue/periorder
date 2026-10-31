import React, { useEffect, useState } from 'react';
import { PolicyComparisonResponse, ScenarioComparison } from '../types';
import { fetchPolicyComparison } from '../services/api';
import { 
  GitCompare, 
  ArrowDownRight, 
  ArrowUpRight, 
  Filter, 
  Percent, 
  ShieldCheck, 
  TrendingDown,
  Layers,
  Award
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const PolicyComparison: React.FC = () => {
  const [holdingShare, setHoldingShare] = useState<number>(0.20);
  const [data, setData] = useState<PolicyComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPolicyComparison(holdingShare)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [holdingShare]);

  const scenarios: ScenarioComparison[] = data?.scenarios || [];

  // Group by m/l ratio for chart
  const ratioGrouped = [
    { ratioGroup: 'm/ℓ ≤ 1.0 (Tight Shelf Life)', tuAvgCost: 0, crAvgCost: 0, count: 0 },
    { ratioGroup: '1.0 < m/ℓ < 1.5 (Moderate)', tuAvgCost: 0, crAvgCost: 0, count: 0 },
    { ratioGroup: 'm/ℓ ≥ 1.5 (Ample Shelf Life)', tuAvgCost: 0, crAvgCost: 0, count: 0 },
  ];

  scenarios.forEach((s) => {
    const tuCost = s.methods['QR-TU']?.mean_cost || 0;
    const crCost = s.methods['QR-CR']?.mean_cost || 0;
    if (s.m_over_l <= 1.0) {
      ratioGrouped[0].tuAvgCost += tuCost;
      ratioGrouped[0].crAvgCost += crCost;
      ratioGrouped[0].count += 1;
    } else if (s.m_over_l < 1.5) {
      ratioGrouped[1].tuAvgCost += tuCost;
      ratioGrouped[1].crAvgCost += crCost;
      ratioGrouped[1].count += 1;
    } else {
      ratioGrouped[2].tuAvgCost += tuCost;
      ratioGrouped[2].crAvgCost += crCost;
      ratioGrouped[2].count += 1;
    }
  });

  const chartData = ratioGrouped.map((g) => ({
    group: g.ratioGroup,
    'QR-TU (Tuned)': g.count > 0 ? Number((g.tuAvgCost / g.count).toFixed(2)) : 0,
    'QR-CR (Static)': g.count > 0 ? Number((g.crAvgCost / g.count).toFixed(2)) : 0,
    gainPct: g.crAvgCost > 0 ? Number((((g.crAvgCost - g.tuAvgCost) / g.crAvgCost) * 100).toFixed(2)) : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#e8e8ed] gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
            Policy Comparison: TU vs. Static CR
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Validation-based quantile tuning (TU) versus nominal critical ratio order-up-to fractiles (CR)
          </p>
        </div>

        {/* Holding Share Selector */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[#86868b] font-medium">Holding Share (η):</span>
          <div className="flex rounded-lg bg-[#f5f5f7] p-1 border border-[#e8e8ed]">
            {[0.20, 0.50, 1.00].map((hs) => (
              <button
                key={hs}
                onClick={() => setHoldingShare(hs)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  holdingShare === hs
                    ? 'bg-[#ffffff] text-[#0071e3] shadow-subtle'
                    : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }`}
              >
                η = {hs.toFixed(2)} {hs === 0.20 ? '(Primary)' : '(Sensitivity)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Highlight Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-apple p-5 bg-gradient-to-br from-[#ffffff] to-[#f0f7ff]/40">
          <span className="text-xs font-semibold text-[#0071e3] uppercase tracking-wider">
            Why TU Beats Static CR
          </span>
          <h3 className="text-lg font-bold text-[#1d1d1f] mt-1">
            Dynamic Multi-Period Adaptation
          </h3>
          <p className="text-xs text-[#6e6e73] mt-2 leading-relaxed">
            The single-period critical ratio fractile τ* = c_u / (c_u + c_o) completely ignores multi-period holding accumulation and aging dynamics. TU empirically selects the optimal target quantile on validation observations, reducing holding and expiry without sacrificing service.
          </p>
        </div>

        <div className="card-apple p-5">
          <span className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider">
            Economic Inelasticity of CR
          </span>
          <h3 className="text-lg font-bold text-[#1d1d1f] mt-1">
            Flat Orders Across η ∈ &#123;0.20, 0.50, 1.00&#125;
          </h3>
          <p className="text-xs text-[#6e6e73] mt-2 leading-relaxed">
            Because static CR depends solely on total overage cost c_o, CR generates <strong>identical order quantities</strong> regardless of whether overage is holding (η) or spoilage (1−η). TU cuts order targets as η increases, expanding savings from 2.54% up to 10.76%.
          </p>
        </div>

        <div className="card-apple p-5">
          <span className="text-xs font-semibold text-[#a855f7] uppercase tracking-wider">
            Shelf-Life Interaction (H4)
          </span>
          <h3 className="text-lg font-bold text-[#1d1d1f] mt-1">
            Higher Gain at Ample m/ℓ Ratios
          </h3>
          <p className="text-xs text-[#6e6e73] mt-2 leading-relaxed">
            Tuning yields larger relative cost savings when the protection period is covered by shelf life (m/ℓ ≥ 1.5, mean gain 3.30%) compared to tight shelf-life conditions (m/ℓ ≤ 1.0, mean gain 2.08%), confirming hypothesis H4 (p = 0.007813).
          </p>
        </div>
      </div>

      {/* Chart: QR-TU vs QR-CR by Shelf-Life-to-Lead-Time Ratio */}
      <div className="card-apple p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Mean Series Cost Comparison across Shelf-Life-to-Lead-Time Ratios (m/ℓ)
            </h2>
            <p className="text-xs text-[#6e6e73]">
              QR-TU versus QR-CR across tight, moderate, and ample shelf-life regimes (η = {holdingShare.toFixed(2)})
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-[#f0fdf4] text-[#16a34a] rounded-full font-medium border border-[#bbf7d0]">
            H4 Statistical Verification
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
              <XAxis dataKey="group" tick={{ fontSize: 11, fill: '#6e6e73' }} />
              <YAxis unit="$" tick={{ fontSize: 11, fill: '#6e6e73' }} domain={[300, 500]} />
              <Tooltip 
                formatter={(val: any, name: any) => [`$${val}`, name]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e8e8ed', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="QR-TU (Tuned)" fill="#0071e3" radius={[4, 4, 0, 0]} />
              <Bar dataKey="QR-CR (Static)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 18-Scenario Grid Table */}
      <div className="card-apple overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8e8ed]">
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            Scenario-by-Scenario Evaluation Matrix (18 Parameter Combinations)
          </h2>
          <p className="text-xs text-[#6e6e73]">
            Comparing QR-TU and QR-CR across shelf life (m), lead time (L), critical ratio (CR), and m/ℓ ratio
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1d1d1f]">
            <thead className="bg-[#f5f5f7] text-[#6e6e73] font-medium border-b border-[#e8e8ed]">
              <tr>
                <th className="py-2.5 px-3">Horizon (ℓ)</th>
                <th className="py-2.5 px-3">Lead Time (L)</th>
                <th className="py-2.5 px-3">Shelf Life (m)</th>
                <th className="py-2.5 px-3">m/ℓ Ratio</th>
                <th className="py-2.5 px-3">Critical Ratio</th>
                <th className="py-2.5 px-3 text-right">QR-TU Cost</th>
                <th className="py-2.5 px-3 text-right">QR-CR Cost</th>
                <th className="py-2.5 px-3 text-right">TU Gain (%)</th>
                <th className="py-2.5 px-3 text-right">QR-TU CSL</th>
                <th className="py-2.5 px-3 text-right">QR-CR CSL</th>
                <th className="py-2.5 px-3 text-right">QR-TU Waste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f4]">
              {scenarios.map((s, idx) => {
                const tu = s.methods['QR-TU'];
                const cr = s.methods['QR-CR'];
                const gain = s.tu_gain_pct || 0;
                return (
                  <tr key={idx} className="hover:bg-[#fafafc] transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#0071e3]">
                      ℓ = {s.horizon} ({s.horizon === 2 ? '356d' : '355d'})
                    </td>
                    <td className="py-2.5 px-3 text-[#6e6e73]">L = {s.lead_time}</td>
                    <td className="py-2.5 px-3 text-[#6e6e73]">m = {s.shelf_life}</td>
                    <td className="py-2.5 px-3 font-medium">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        s.m_over_l >= 1.5 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {s.m_over_l.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#6e6e73]">{s.critical_ratio.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#1d1d1f]">
                      ${tu?.mean_cost.toFixed(2) || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#6e6e73]">
                      ${cr?.mean_cost.toFixed(2) || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#16a34a]">
                      +{gain.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right">{tu?.csl.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right text-[#6e6e73]">{cr?.csl.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-right text-[#d97706]">{tu?.waste_rate.toFixed(1)}%</td>
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
