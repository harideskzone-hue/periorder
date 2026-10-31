import React, { useState, useRef } from 'react';
import { OCRBillResult, OCRExtractedItem } from '../types';
import { processBillOCR, confirmBillIngestion } from '../services/api';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Trash2,
  Plus,
  RefreshCw,
  Clock,
  DollarSign,
  Receipt,
  Scan,
  ShieldCheck,
  Check,
  Info
} from 'lucide-react';

interface BillUploadCenterProps {
  storeId?: string;
  storeName?: string;
  onInventoryUpdated?: () => void;
}

export const BillUploadCenter: React.FC<BillUploadCenterProps> = ({
  storeId = 'CA_1',
  storeName = 'Downtown Central',
  onInventoryUpdated,
}) => {
  const [billType, setBillType] = useState<'purchase' | 'sales'>('purchase');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<OCRBillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  // Recent transactions list
  const [recentTransactions, setRecentTransactions] = useState<Array<{
    id: string;
    type: 'purchase' | 'sales';
    party: string;
    invoiceNo: string;
    date: string;
    itemsCount: number;
    amount: number;
    status: 'Verified & Committed' | 'Pending';
  }>>([
    {
      id: 'doc_prev_01',
      type: 'purchase',
      party: 'Golden Harvest Grains Ltd',
      invoiceNo: 'INV-2026-9812',
      date: '2026-10-29',
      itemsCount: 4,
      amount: 14200,
      status: 'Verified & Committed',
    },
    {
      id: 'doc_prev_02',
      type: 'sales',
      party: 'Counter POS Batch #41',
      invoiceNo: 'POS-REC-4890',
      date: '2026-10-30',
      itemsCount: 18,
      amount: 8640,
      status: 'Verified & Committed',
    },
    {
      id: 'doc_prev_03',
      type: 'purchase',
      party: 'Heritage Fresh Farm Dairy',
      invoiceNo: 'INV-2026-9904',
      date: '2026-10-30',
      itemsCount: 3,
      amount: 4750,
      status: 'Verified & Committed',
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setIsScanning(true);
    setScanProgress(15);
    setError(null);
    setSuccessMessage(null);

    const progressTimer = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressTimer);
          return 90;
        }
        return prev + 25;
      });
    }, 180);

    try {
      const res = await processBillOCR(file, billType, 'tenant_default', storeId);
      clearInterval(progressTimer);
      setScanProgress(100);
      setTimeout(() => {
        setOcrResult(res);
        setIsScanning(false);
      }, 300);
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsScanning(false);
      setError(err.message || 'Failed to process document. Please try a clearer image or PDF.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleItemChange = (index: number, field: keyof OCRExtractedItem, value: any) => {
    if (!ocrResult) return;
    const updatedItems = [...ocrResult.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
      total: field === 'quantity' || field === 'unit_price'
        ? (Number(field === 'quantity' ? value : updatedItems[index].quantity) || 0) *
          (Number(field === 'unit_price' ? value : updatedItems[index].unit_price) || 0)
        : updatedItems[index].total,
      status: 'verified', // Once edited by shopkeeper, mark verified
    };

    const newTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);

    setOcrResult({
      ...ocrResult,
      items: updatedItems,
      total_amount: newTotal,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!ocrResult) return;
    const updatedItems = ocrResult.items.filter((_, i) => i !== index);
    const newTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);
    setOcrResult({
      ...ocrResult,
      items: updatedItems,
      total_amount: newTotal,
    });
  };

  const handleAddItem = () => {
    if (!ocrResult) return;
    const newItem: OCRExtractedItem = {
      product_name: 'New Product Item',
      quantity: 10,
      unit_price: 50,
      total: 500,
      confidence: 1.0,
      status: 'verified',
    };
    setOcrResult({
      ...ocrResult,
      items: [...ocrResult.items, newItem],
      total_amount: ocrResult.total_amount + newItem.total,
    });
  };

  const handleConfirmAndCommit = async () => {
    if (!ocrResult) return;
    setIsCommitting(true);
    setError(null);
    try {
      const res = await confirmBillIngestion(
        {
          document_id: ocrResult.document_id,
          bill_type: ocrResult.bill_type,
          party_name: ocrResult.party_name,
          invoice_number: ocrResult.invoice_number,
          date: ocrResult.date,
          items: ocrResult.items.map((i) => ({
            product_name: i.product_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total: i.total,
          })),
        },
        'tenant_default',
        storeId
      );

      // Add to recent transactions
      setRecentTransactions((prev) => [
        {
          id: res.document_id,
          type: ocrResult.bill_type,
          party: ocrResult.party_name,
          invoiceNo: ocrResult.invoice_number,
          date: ocrResult.date,
          itemsCount: ocrResult.items.length,
          amount: ocrResult.total_amount,
          status: 'Verified & Committed',
        },
        ...prev,
      ]);

      setSuccessMessage(
        `Successfully committed! ${ocrResult.items.length} products automatically updated in your FIFO inventory ledger.`
      );
      setOcrResult(null);

      if (onInventoryUpdated) {
        onInventoryUpdated();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to commit bill to inventory');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Automatic Document Processing & Bill Ingestion
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Upload supplier purchase invoices or customer sales bills in any format (PDF, JPG, PNG, Excel). 
            Our AI extracts line items, verifies pricing against market benchmarks, and updates your inventory automatically.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setBillType('purchase')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              billType === 'purchase'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchase Invoices (Restock)
          </button>
          <button
            onClick={() => setBillType('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              billType === 'sales'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sales Receipts (Deductions)
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-medium">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Dropzone & Scanning State */}
      {!ocrResult && (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !isScanning && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
            isScanning
              ? 'border-blue-400 bg-blue-50/50'
              : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 bg-white'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx"
            onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(e.target.files[0])}
          />

          {isScanning ? (
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center animate-pulse shadow-md">
                <Scan className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Scanning Document with OCR & Smart Vision...
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Extracting product names, batch quantities, unit rates and matching items to inventory.
                </p>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-blue-700 font-semibold">{scanProgress}% completed</p>
            </div>
          ) : (
            <div className="max-w-lg mx-auto space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                <UploadCloud className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Click to upload or drag & drop your {billType === 'purchase' ? 'purchase bill' : 'sales bill'}
              </h3>
              <p className="text-xs text-slate-500">
                Supports PDF, JPG, PNG smartphone photos, and Excel invoices. No manual entry needed.
              </p>
              <div className="pt-2 flex items-center justify-center space-x-4 text-[11px] text-slate-500">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>OCR Line Detection</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Automated Matching</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Instant FIFO Ledger</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCR Result Verification & Editing Interface */}
      {ocrResult && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
          {/* Document Metadata Bar */}
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">{ocrResult.party_name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                    {ocrResult.bill_type}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Confidence: {Math.round(ocrResult.average_confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Invoice #{ocrResult.invoice_number} · Date: {ocrResult.date} · File: {ocrResult.filename}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setOcrResult(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel / Upload Another
              </button>
              <button
                onClick={handleConfirmAndCommit}
                disabled={isCommitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {isCommitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Confirm & Update Inventory (₹{ocrResult.total_amount.toLocaleString()})</span>
              </button>
            </div>
          </div>

          {/* Verification Advisory */}
          <div className="px-5 py-2.5 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Please review extracted values below. Items with yellow badges suggest double-checking numbers before confirming.
              </span>
            </div>
            <button
              onClick={handleAddItem}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Missing Line</span>
            </button>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Unit Rate (₹)</th>
                  <th className="py-3 px-4">Total Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ocrResult.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      {item.status === 'verified' ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-2.5 h-2.5" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Review</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-200 focus:border-blue-500 focus:outline-hidden font-medium text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        className="w-24 px-2 py-1 rounded border border-slate-200 focus:border-blue-500 focus:outline-hidden font-mono text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                        className="w-24 px-2 py-1 rounded border border-slate-200 focus:border-blue-500 focus:outline-hidden font-mono text-slate-900"
                      />
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                      ₹{item.total.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="text-slate-500">
              {ocrResult.items.length} items extracted by OCR engine ({ocrResult.ocr_engine})
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-slate-500 font-medium">Grand Total:</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                ₹{ocrResult.total_amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Processed Documents History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">
              Recently Processed Bills & Invoices
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {recentTransactions.length} recorded documents
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Supplier / Source</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500">{tx.date}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        tx.type === 'purchase'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{tx.party}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{tx.invoiceNo}</td>
                  <td className="py-3 px-4">{tx.itemsCount} products</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">
                    ₹{tx.amount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center space-x-1 text-emerald-700 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{tx.status}</span>
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
