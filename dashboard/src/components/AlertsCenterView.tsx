import React, { useState, useEffect } from 'react';
import { AlertsResponse, ShopAlert } from '../types';
import { fetchShopAlerts } from '../services/api';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ShoppingCart,
  TrendingUp,
  Tag,
  CheckCircle2,
  Filter,
  Sparkles,
  Loader2,
  RefreshCw,
  Package
} from 'lucide-react';

interface AlertsCenterViewProps {
  storeId?: string;
  storeName?: string;
  onNavigateToOrders?: () => void;
  onOpenProductAnalytics?: (productName: string) => void;
}

export const AlertsCenterView: React.FC<AlertsCenterViewProps> = ({
  storeId = 'CA_1',
  storeName = 'Downtown Central',
  onNavigateToOrders,
  onOpenProductAnalytics,
}) => {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchShopAlerts('tenant_default', storeId);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load shop alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [storeId]);

  const handleAction = (alert: ShopAlert) => {
    if (alert.type === 'low_stock' && onNavigateToOrders) {
      onNavigateToOrders();
    } else {
      // Mark as acknowledged/actioned
      setResolvedIds((prev) => new Set([...prev, alert.id]));
    }
  };

  const filteredAlerts = (data?.alerts || []).filter((a) => {
    if (resolvedIds.has(a.id)) return false;
    if (severityFilter === 'all') return true;
    return a.severity === severityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              AI Inventory Alerts & Action Recommendations
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Plain-English stock health diagnosis. The system continuously evaluates shelf life, demand velocity, 
            and lead times to prevent both stockouts and wasted inventory.
          </p>
        </div>

        {data && (
          <div className="flex items-center space-x-2 text-xs bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                severityFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({data.alerts.length - resolvedIds.size})
            </button>
            <button
              onClick={() => setSeverityFilter('critical')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                severityFilter === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Urgent ({data.critical_count})
            </button>
            <button
              onClick={() => setSeverityFilter('warning')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                severityFilter === 'warning'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              Warnings ({data.warning_count})
            </button>
            <button
              onClick={() => setSeverityFilter('info')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                severityFilter === 'info'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              Growth ({data.info_count})
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Scanning inventory trajectory and generating plain-English alerts...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-700">
          <p className="font-semibold text-sm">Failed to load alerts</p>
          <p className="text-xs text-rose-500 mt-1">{error}</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">All Clear! No Pending Stock Alerts</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Your inventory is currently well-balanced across all categories. Incoming bills and POS sales are monitored continuously.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border transition-all bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCritical
                    ? 'border-rose-200 hover:border-rose-300'
                    : isWarning
                    ? 'border-amber-200 hover:border-amber-300'
                    : 'border-blue-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isCritical
                        ? 'bg-rose-100 text-rose-700'
                        : isWarning
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isCritical ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : isWarning ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <TrendingUp className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {alert.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isCritical
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isWarning
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {alert.type.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {alert.message}
                    </p>

                    <div className="mt-2 flex items-center space-x-4 text-[11px] text-slate-500">
                      <span>Current Stock: <strong className="text-slate-800">{alert.current_stock} units</strong></span>
                      <span>Estimated Depletion: <strong className="text-slate-800">{alert.days_remaining} days</strong></span>
                      {alert.reorder_quantity > 0 && (
                        <span>Suggested Order: <strong className="text-blue-700 font-bold">+{alert.reorder_quantity} units</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleAction(alert)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 ${
                      isCritical
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : isWarning
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isCritical ? (
                      <ShoppingCart className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{alert.action_label}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
