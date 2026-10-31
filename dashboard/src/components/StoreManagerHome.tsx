import React, { useEffect, useState } from 'react';
import { StoreManagerOverview } from '../types';
import { fetchStoreManagerOverview } from '../services/api';
import { 
  AlertCircle, 
  Clock, 
  PackageCheck, 
  ShoppingCart, 
  TrendingUp, 
  ArrowRight, 
  ShieldCheck, 
  DollarSign,
  ChevronRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface StoreManagerHomeProps {
  onNavigateToOrders: () => void;
  onNavigateToInventory: () => void;
}

export const StoreManagerHome: React.FC<StoreManagerHomeProps> = ({ 
  onNavigateToOrders, 
  onNavigateToInventory 
}) => {
  const [data, setData] = useState<StoreManagerOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStoreManagerOverview()
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
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e8e8ed] gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            {data.greeting}
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            4 critical items need attention today · 8 smart replenishment orders ready for review
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-[#f5f5f7] px-3 py-1.5 rounded-full border border-[#e8e8ed] text-[#6e6e73]">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
          <span>Store Status: Operational · Normal Schedule</span>
        </div>
      </div>

      {/* 4 Core Quick Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Products */}
        <div 
          onClick={onNavigateToInventory}
          className="card-apple p-5 cursor-pointer hover:border-[#0071e3]/40 transition-all"
        >
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium">Products monitored</span>
            <PackageCheck className="w-4 h-4 text-[#0071e3]" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-[#1d1d1f] mt-2">
            {data.monitored_products}
          </div>
          <span className="text-[11px] text-[#0071e3] font-medium mt-1 inline-flex items-center">
            View full catalog <ChevronRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        {/* Need Attention */}
        <div 
          onClick={onNavigateToInventory}
          className="card-apple p-5 border-l-4 border-l-[#f43f5e] cursor-pointer hover:border-[#f43f5e]/40 transition-all bg-gradient-to-br from-[#ffffff] to-[#fff1f2]/30"
        >
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium text-[#f43f5e]">Need attention</span>
            <AlertCircle className="w-4 h-4 text-[#f43f5e]" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-[#f43f5e] mt-2">
            {data.need_attention}
          </div>
          <span className="text-[11px] text-[#f43f5e] font-medium mt-1 inline-flex items-center">
            Action required today
          </span>
        </div>

        {/* Orders to Review */}
        <div 
          onClick={onNavigateToOrders}
          className="card-apple p-5 border-l-4 border-l-[#0071e3] cursor-pointer hover:border-[#0071e3]/40 transition-all bg-gradient-to-br from-[#ffffff] to-[#f0f7ff]/40"
        >
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium text-[#0071e3]">Orders to review</span>
            <ShoppingCart className="w-4 h-4 text-[#0071e3]" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-[#0071e3] mt-2">
            {data.orders_to_review}
          </div>
          <span className="text-[11px] text-[#0071e3] font-medium mt-1 inline-flex items-center">
            Review suggested orders <ChevronRight className="w-3 h-3 ml-0.5" />
          </span>
        </div>

        {/* Products Expiring Soon */}
        <div 
          onClick={onNavigateToInventory}
          className="card-apple p-5 border-l-4 border-l-[#d97706] cursor-pointer hover:border-[#d97706]/40 transition-all bg-gradient-to-br from-[#ffffff] to-[#fffbeb]/30"
        >
          <div className="flex items-center justify-between text-[#86868b]">
            <span className="text-xs font-medium text-[#d97706]">Expiring soon</span>
            <Clock className="w-4 h-4 text-[#d97706]" />
          </div>
          <div className="text-3xl font-bold tracking-tight text-[#d97706] mt-2">
            {data.products_expiring_soon}
          </div>
          <span className="text-[11px] text-[#d97706] font-medium mt-1 inline-flex items-center">
            Within 24 to 48 hours
          </span>
        </div>
      </div>

      {/* Main Action Banner: Today's Order Recommendation */}
      <div className="card-apple p-6 bg-gradient-to-r from-[#0071e3] to-[#2563eb] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-[#0071e3]/15">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-white/80">
            <Sparkles className="w-4 h-4" />
            <span>Today's Recommendation</span>
          </div>
          <h2 className="text-xl font-bold">
            {data.today_recommendation_summary.title} ({data.today_recommendation_summary.total_units_suggested} units)
          </h2>
          <p className="text-xs text-white/90 max-w-xl">
            {data.today_recommendation_summary.description} Est. order value: <strong>${data.today_recommendation_summary.estimated_order_value_usd.toFixed(2)}</strong>. Prevents weekend stockouts while preventing unnecessary overage.
          </p>
        </div>

        <button
          onClick={onNavigateToOrders}
          className="px-5 py-2.5 rounded-xl bg-white text-[#0071e3] hover:bg-[#f5f5f7] font-semibold text-xs transition-all shadow-sm flex items-center space-x-1.5 whitespace-nowrap self-stretch md:self-auto justify-center"
        >
          <span>Review Suggested Orders</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Two Column Grid: Needs Your Attention vs Business Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Urgent Attention List (Takes 2 Cols) */}
        <div className="lg:col-span-2 card-apple p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0f0f4]">
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Needs your attention
              </h2>
              <p className="text-xs text-[#6e6e73]">
                Items requiring replenishment or shelf rotation today
              </p>
            </div>
            <button
              onClick={onNavigateToInventory}
              className="text-xs font-medium text-[#0071e3] hover:underline"
            >
              See all items
            </button>
          </div>

          <div className="space-y-3">
            {data.urgent_attention_items.map((item) => {
              const isLowStock = item.issue_type === 'Low stock';
              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-[#e8e8ed] bg-[#ffffff] hover:border-[#d2d2d7] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-[#1d1d1f]">
                        {item.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isLowStock
                            ? 'bg-[#fee2e2] text-[#b91c1c]'
                            : 'bg-[#fef3c7] text-[#b45309]'
                        }`}
                      >
                        {item.issue_type}
                      </span>
                    </div>
                    <p className="text-xs text-[#6e6e73]">
                      {item.description}
                    </p>
                    <p className="text-xs text-[#16a34a] font-medium flex items-center space-x-1">
                      <span>Suggested action:</span>
                      <span className="underline">{item.suggested_action}</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    <div className="text-right text-xs">
                      <span className="text-[#86868b] block text-[10px]">On shelf</span>
                      <span className="font-semibold text-[#1d1d1f]">{item.current_stock} units</span>
                    </div>
                    <button
                      onClick={onNavigateToOrders}
                      className="px-3 py-1.5 rounded-lg bg-[#f5f5f7] hover:bg-[#e8e8ed] text-xs font-medium text-[#1d1d1f] transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: High-Level Performance Health */}
        <div className="card-apple p-5 space-y-4">
          <div className="pb-3 border-b border-[#f0f0f4]">
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Inventory Health &amp; Savings
            </h2>
            <p className="text-xs text-[#6e6e73]">
              Business results achieved with smart ordering
            </p>
          </div>

          <div className="space-y-4">
            {/* Savings */}
            <div className="p-4 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0]">
              <span className="text-xs font-semibold text-[#16a34a] uppercase tracking-wider block">
                Estimated Monthly Savings
              </span>
              <div className="text-2xl font-bold text-[#166534] mt-1">
                +${data.business_performance.estimated_monthly_savings_usd.toFixed(2)}
              </div>
              <p className="text-[11px] text-[#166534]/80 mt-1">
                Saved compared to traditional static reorder rules by reducing waste and avoiding emergency restocks.
              </p>
            </div>

            {/* Days without stockouts */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-[#1d1d1f]">Days Without Stockouts</span>
                <span className="font-bold text-[#16a34a]">
                  {data.business_performance.days_without_stockouts_pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-[#f0f0f4] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#16a34a] h-2 rounded-full" 
                  style={{ width: `${data.business_performance.days_without_stockouts_pct}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-[#86868b]">
                Fraction of days products remain fully in stock
              </span>
            </div>

            {/* Customer demand fulfilled */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-[#1d1d1f]">Customer Demand Fulfilled</span>
                <span className="font-bold text-[#0071e3]">
                  {data.business_performance.customer_demand_fulfilled_pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-[#f0f0f4] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#0071e3] h-2 rounded-full" 
                  style={{ width: `${data.business_performance.customer_demand_fulfilled_pct}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-[#86868b]">
                Total customer orders satisfied on first visit
              </span>
            </div>

            {/* Expired products */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-[#1d1d1f]">Products Expired (Waste)</span>
                <span className="font-bold text-[#d97706]">
                  {data.business_performance.products_expired_pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-[#f0f0f4] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#d97706] h-2 rounded-full" 
                  style={{ width: `${data.business_performance.products_expired_pct}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-[#86868b]">
                Expired units divided by total supplier deliveries
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
