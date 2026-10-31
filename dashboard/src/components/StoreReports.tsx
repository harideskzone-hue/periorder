import React from 'react';
import { 
  FileText, 
  TrendingUp, 
  ShieldCheck, 
  Trash2, 
  DollarSign, 
  Percent,
  CheckCircle2,
  Calendar,
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
  Legend 
} from 'recharts';

export const StoreReports: React.FC = () => {
  const comparisonData = [
    { category: 'Dairy & Eggs', smartOrderingCost: 840, traditionalRuleCost: 960, savings: 120 },
    { category: 'Fresh Produce', smartOrderingCost: 1120, traditionalRuleCost: 1290, savings: 170 },
    { category: 'Bakery', smartOrderingCost: 650, traditionalRuleCost: 740, savings: 90 },
    { category: 'Meat & Poultry', smartOrderingCost: 1380, traditionalRuleCost: 1540, savings: 160 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e8e8ed] gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            Store Performance &amp; Reports
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Evaluate customer availability, waste reduction, and operating cost savings
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs bg-[#ffffff] px-3.5 py-1.5 rounded-xl border border-[#e8e8ed] shadow-subtle text-[#6e6e73]">
          <Calendar className="w-3.5 h-3.5 text-[#0071e3]" />
          <span>Evaluation Horizon: Full Year (356/355 Operational Days)</span>
        </div>
      </div>

      {/* 4 Performance Metric Cards with In-Line Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="card-apple p-5 space-y-2">
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium uppercase tracking-wider">Days Without Stockouts</span>
            <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
          </div>
          <div className="text-3xl font-bold text-[#1d1d1f]">
            81.1%
          </div>
          <div className="pt-2 border-t border-[#f0f0f4] text-xs text-[#6e6e73]">
            <strong>What it means:</strong> On 81 out of every 100 days, your shelves have sufficient stock to completely meet customer demand without stockouts.
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card-apple p-5 space-y-2">
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium uppercase tracking-wider">Customer Demand Fulfilled</span>
            <Percent className="w-4 h-4 text-[#0071e3]" />
          </div>
          <div className="text-3xl font-bold text-[#1d1d1f]">
            78.1%
          </div>
          <div className="pt-2 border-t border-[#f0f0f4] text-xs text-[#6e6e73]">
            <strong>What it means:</strong> 78.1% of all customer units demanded are fulfilled immediately from inventory without lost sales.
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card-apple p-5 space-y-2">
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium uppercase tracking-wider">Products Expired (Waste)</span>
            <Trash2 className="w-4 h-4 text-[#d97706]" />
          </div>
          <div className="text-3xl font-bold text-[#1d1d1f]">
            11.0%
          </div>
          <div className="pt-2 border-t border-[#f0f0f4] text-xs text-[#6e6e73]">
            <strong>What it means:</strong> Only 11% of supplier deliveries spoil, significantly lower than the grocery industry average of 14–18%.
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card-apple p-5 space-y-2">
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium uppercase tracking-wider">Estimated Monthly Savings</span>
            <DollarSign className="w-4 h-4 text-[#16a34a]" />
          </div>
          <div className="text-3xl font-bold text-[#16a34a]">
            +$1,030
          </div>
          <div className="pt-2 border-t border-[#f0f0f4] text-xs text-[#6e6e73]">
            <strong>What it means:</strong> Total money saved by ordering based on tuned demand forecasts compared to static reorder rules.
          </div>
        </div>
      </div>

      {/* Category Cost Savings Breakdown Chart */}
      <div className="card-apple p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            Operating Costs: Smart Ordering vs. Traditional Rules
          </h2>
          <p className="text-xs text-[#6e6e73]">
            Comparison across grocery departments showing lower spoilage and fewer stockout penalties
          </p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#6e6e73' }} />
              <YAxis unit="$" tick={{ fontSize: 11, fill: '#6e6e73' }} />
              <Tooltip 
                formatter={(val: any, name: any) => [`$${val}`, name]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e8e8ed', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="smartOrderingCost" name="Smart Ordering (PeriOrder)" fill="#0071e3" radius={[4, 4, 0, 0]} />
              <Bar dataKey="traditionalRuleCost" name="Traditional Fixed Rules" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-3 border-t border-[#f0f0f4] text-xs text-[#6e6e73] leading-relaxed">
          <strong>Key takeaway for operators:</strong> Traditional fixed reorder rules order too much perishable inventory when sales slow down and not enough when demand peaks. PeriOrder's validation tuning dynamically adapts to product shelf life, cutting both stockouts and garbage disposals.
        </div>
      </div>
    </div>
  );
};
