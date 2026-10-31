import React, { useEffect, useState } from 'react';
import { DemandOutlookResponse } from '../types';
import { fetchDemandOutlook } from '../services/api';
import { 
  TrendingUp, 
  Calendar, 
  Sparkles, 
  ArrowUpRight, 
  ShieldCheck, 
  Info,
  Clock
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const DemandOutlook: React.FC = () => {
  const [data, setData] = useState<DemandOutlookResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDemandOutlook()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
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

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e8e8ed] gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            Expected Product Demand (7-Day Outlook)
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Forecasted customer traffic and product purchasing patterns for your store
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs bg-[#ffffff] px-3.5 py-1.5 rounded-xl border border-[#e8e8ed] shadow-subtle text-[#6e6e73]">
          <Calendar className="w-3.5 h-3.5 text-[#0071e3]" />
          <span>Updated this morning · Rolling 7-day window</span>
        </div>
      </div>

      {/* Summary Highlight Banner */}
      <div className="card-apple p-5 bg-gradient-to-r from-[#0071e3]/5 via-[#60a5fa]/5 to-transparent border-[#0071e3]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#0071e3] uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Store Manager Summary</span>
          </div>
          <p className="text-base font-bold text-[#1d1d1f]">
            {data.summary}
          </p>
          <p className="text-xs text-[#16a34a] font-medium">
            💡 {data.recommended_focus}
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-white border border-[#e8e8ed] shadow-subtle text-xs whitespace-nowrap self-stretch sm:self-auto text-center">
          <span className="text-[#86868b] block text-[10px]">Peak Shopping Day</span>
          <span className="font-bold text-sm text-[#0071e3]">Saturday (~74 units)</span>
        </div>
      </div>

      {/* Daily Outlook Chart */}
      <div className="card-apple p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Expected Customer Demand Across the Week
            </h2>
            <p className="text-xs text-[#6e6e73]">
              Shaded range represents expected confidence band based on historical sales velocity
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs text-[#6e6e73]">
            <div className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-[#0071e3]"></span>
              <span>Expected Sales</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-2 bg-[#0071e3]/20 rounded-sm"></span>
              <span>Expected Range (Low to High)</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.weekly_outlook} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <defs>
                <linearGradient id="outlookGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0071e3" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0071e3" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6e6e73' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6e6e73' }} unit=" units" />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-[#ffffff] p-3 rounded-lg shadow-apple-card border border-[#e8e8ed] text-xs space-y-1">
                        <p className="font-semibold text-[#1d1d1f]">{label}</p>
                        <p className="text-[#0071e3] font-bold">Expected Demand: {d.expected_demand} units</p>
                        <p className="text-[#6e6e73]">Expected Range: {d.range_low} – {d.range_high} units</p>
                        <p className="text-[#16a34a] font-medium pt-1 border-t border-[#f0f0f4]">{d.status}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="range_high" stroke="#93c5fd" strokeWidth={1} fill="url(#outlookGrad)" name="Upper Range" />
              <Area type="monotone" dataKey="expected_demand" stroke="#0071e3" strokeWidth={2.5} fill="#0071e3" fillOpacity={0.05} name="Expected Demand" />
              <Area type="monotone" dataKey="range_low" stroke="#93c5fd" strokeWidth={1} fill="none" name="Lower Range" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day by Day Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {data.weekly_outlook.map((d, idx) => (
          <div key={idx} className="card-apple p-3.5 space-y-2">
            <span className="text-xs font-bold text-[#1d1d1f] block">{d.day}</span>
            <div>
              <span className="text-xl font-bold text-[#0071e3]">{d.expected_demand}</span>
              <span className="text-[10px] text-[#86868b] block">units</span>
            </div>
            <div className="pt-2 border-t border-[#f0f0f4] text-[10px] text-[#6e6e73]">
              <span className="text-[#86868b] block">Range:</span>
              <span className="font-medium text-[#1d1d1f]">{d.range_low} – {d.range_high}</span>
            </div>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#f5f5f7] text-[#6e6e73] block text-center truncate">
              {d.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
