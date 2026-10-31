import React, { useEffect, useState } from 'react';
import { POSStatusResponse, TestWebhookPayload } from '../types';
import { fetchPOSStatus, sendPOSTransactionWebhook } from '../services/api';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Clock,
  ArrowRight,
  ShieldCheck,
  Receipt,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const POSIntegration: React.FC = () => {
  const [statusData, setStatusData] = useState<POSStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Test webhook state
  const [submitting, setSubmitting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{
    status: string;
    transaction_id: string;
    is_duplicate: boolean;
    items_deducted: number;
    reconciled_stock: Record<string, number>;
    message: string;
  } | null>(null);
  const [webhookError, setWebhookError] = useState('');
  const [copied, setCopied] = useState(false);

  // Selected test preset
  const [testPreset, setTestPreset] = useState<'basket' | 'produce' | 'custom'>('basket');
  const [customTxId, setCustomTxId] = useState(`TX_POS_${Date.now().toString().slice(-6)}`);

  const loadStatus = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await fetchPOSStatus('tenant_default', 'CA_1');
      setStatusData(res);
    } catch (err: unknown) {
      console.error(err);
      setError('Could not connect to the PeriOrder POS Gateway service. Check that the backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleCopyWebhookUrl = () => {
    if (!statusData?.webhook_url) return;
    navigator.clipboard.writeText(statusData.webhook_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestWebhook = async (forceDuplicate = false) => {
    setSubmitting(true);
    setWebhookResult(null);
    setWebhookError('');

    const txId = forceDuplicate && webhookResult?.transaction_id
      ? webhookResult.transaction_id
      : customTxId;

    let items = [
      { product_id: 'FOODS_2_043_CA_1', quantity: 2, unit_price: 2.40 },
      { product_id: 'FOODS_2_021_TX_1', quantity: 1, unit_price: 1.60 },
    ];

    if (testPreset === 'produce') {
      items = [
        { product_id: 'FOODS_1_018_CA_4', quantity: 3, unit_price: 3.10 },
        { product_id: 'FOODS_2_015_WI_3', quantity: 1, unit_price: 2.80 },
      ];
    }

    const totalAmount = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

    const payload: TestWebhookPayload = {
      transaction_id: txId,
      tenant_id: 'tenant_default',
      store_id: 'CA_1',
      items,
      total_amount: Number(totalAmount.toFixed(2)),
    };

    try {
      const res = await sendPOSTransactionWebhook(payload);
      setWebhookResult(res);
      // Refresh status to update live counters & stream
      await loadStatus(true);
      // Generate next transaction ID for next fresh test
      if (!forceDuplicate) {
        setCustomTxId(`TX_POS_${Date.now().toString().slice(-6)}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Webhook transmission failed';
      setWebhookError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center space-y-3" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#2563EB]" />
        <span className="text-sm font-medium text-slate-600">Connecting to POS integration gateway…</span>
      </div>
    );
  }

  const isConnected = statusData?.pos_connected ?? false;
  const lastSync = statusData?.last_sync_timestamp
    ? new Date(statusData.last_sync_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'None recorded today';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              POS Connection &amp; Live Sync
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isConnected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-600 animate-pulse' : 'bg-slate-400'}`} />
              {isConnected ? 'Connected & Active' : 'Disconnected'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Real-time sales transaction ingestion, webhook health, and automated inventory ledger synchronization
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => loadStatus(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh Status'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadStatus()}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Telemetry Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Connection Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Gateway Status</span>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-slate-400" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {isConnected ? 'Active & Live' : 'Offline'}
            </span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Provider: <strong className="text-slate-800">Generic Mock Webhook Adapter</strong>
          </div>
        </div>

        {/* Card 2: Last Sync Timestamp */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Last Transaction Sync</span>
            <Clock className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{lastSync}</span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Store: <strong className="text-slate-800">{statusData?.store_name}</strong>
          </div>
        </div>

        {/* Card 3: Total Transactions Ingested */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Ingested Transactions</span>
            <Receipt className="h-4 w-4 text-[#0F766E]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {statusData?.total_transactions_ingested ?? 0}
            </span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Tracked in <strong className="text-[#0F766E]">immutable movement ledger</strong>
          </div>
        </div>

        {/* Card 4: Idempotency & Sync Health */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider">Sync Integrity</span>
            <ShieldCheck className="h-4 w-4 text-[#16A34A]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">100% Validated</span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Failed syncs: <strong className="text-slate-800">{statusData?.failed_sync_count ?? 0}</strong> · Zero duplicates
          </div>
        </div>
      </div>

      {/* Interactive Test Webhook Generator Section */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/40 to-white p-6 shadow-sm space-y-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#2563EB]">
              <Zap className="h-4 w-4 text-[#2563EB]" />
              <span>Interactive Webhook Simulator</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Test Live POS Transaction Ingestion &amp; Idempotency
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Simulate customer checkout transactions to verify real-time inventory ledger debiting and FIFO deductions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTestPreset('basket');
                setCustomTxId(`TX_POS_${Date.now().toString().slice(-6)}`);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                testPreset === 'basket'
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Grocery Basket (Milk + Bread)
            </button>
            <button
              onClick={() => {
                setTestPreset('produce');
                setCustomTxId(`TX_POS_${Date.now().toString().slice(-6)}`);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                testPreset === 'produce'
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Fresh Produce Surge (Berries + Eggs)
            </button>
          </div>
        </div>

        {/* Webhook Test Action Row */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Transaction ID:</span>
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-800">
                {customTxId}
              </code>
              <span className="text-xs text-slate-500">
                ({testPreset === 'basket' ? 'Milk 2L + Wheat Bread 1pk' : 'Organic Strawberries 3pk + Large Eggs 1pk'})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSendTestWebhook(false)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? 'Transmitting…' : 'Fire POS Webhook'}
            </button>

            {webhookResult && (
              <button
                onClick={() => handleSendTestWebhook(true)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                title="Re-sends the exact same transaction ID to verify duplicate rejection"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                Resend Same ID (Test Idempotency)
              </button>
            )}
          </div>
        </div>

        {/* Live Result Feedback Box */}
        {webhookResult && (
          <div
            className={`rounded-xl border p-4 text-xs leading-relaxed transition-all ${
              webhookResult.is_duplicate
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-green-300 bg-green-50 text-green-950'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {webhookResult.is_duplicate ? (
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {webhookResult.is_duplicate
                    ? 'Idempotency Protection Confirmed: Duplicate Transaction Skipped'
                    : 'Transaction Ingested Successfully'}
                </div>
                <p>{webhookResult.message}</p>
                {!webhookResult.is_duplicate && webhookResult.reconciled_stock && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-green-200 pt-2 font-mono text-[11px]">
                    <span className="font-semibold text-green-900">Updated Reconciled Stock:</span>
                    {Object.entries(webhookResult.reconciled_stock).map(([pid, stock]) => (
                      <span key={pid} className="rounded bg-white px-2 py-0.5 text-slate-800 border border-green-200">
                        {pid}: <strong>{stock} units</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {webhookError && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{webhookError}</span>
          </div>
        )}
      </div>

      {/* Live Transaction Stream Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Live Ingested Sales Transactions
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Recent sales transactions processed via Point of Sale webhooks for Store CA_1
            </p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {statusData?.recent_transactions?.length ?? 0} Transactions Shown
          </span>
        </div>

        {statusData?.recent_transactions && statusData.recent_transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Purchased Items</th>
                  <th className="py-3 px-3 text-right">Total Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {statusData.recent_transactions.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {tx.transaction_id}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-wrap gap-1.5">
                        {tx.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800 text-[11px]"
                          >
                            {it.product_id} (×{it.quantity})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-[#0F766E]">
                      ${tx.total_amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 font-semibold text-green-800 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Reconciled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-800">No transactions recorded yet today</p>
            <p className="mt-1 text-xs text-slate-500">
              Use the Webhook Simulator above to send test checkouts and verify live inventory reconciliation.
            </p>
          </div>
        )}
      </div>

      {/* Webhook Configuration Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#2563EB]" />
            <h3 className="text-sm font-bold text-slate-900">
              POS Ingestion Endpoint &amp; Security Specs
            </h3>
          </div>
          <button
            onClick={handleCopyWebhookUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied Endpoint' : 'Copy Webhook URL'}
          </button>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
          <span className="text-[#2563EB] font-bold">POST</span>
          <span className="truncate">{statusData?.webhook_url || 'http://127.0.0.1:8000/api/pos/webhooks/transactions'}</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Integration contract:</strong> Transmit POS checkout transactions as JSON payloads with <code>transaction_id</code>, <code>items</code>, and <code>total_amount</code>. Optional <code>X-POS-Signature</code> header can be provided for HMAC-SHA256 payload integrity verification.
        </p>
      </div>
    </div>
  );
};
