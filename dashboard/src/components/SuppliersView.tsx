import React, { useState, useEffect } from 'react';
import { SupplierInfo } from '../types';
import { fetchSuppliers } from '../services/api';
import {
  Truck,
  Phone,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  Search,
  Plus,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Package
} from 'lucide-react';

interface SuppliersViewProps {
  storeId?: string;
  storeName?: string;
  onPlaceOrder?: (supplierName: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  storeId = 'CA_1',
  storeName = 'Downtown Central',
  onPlaceOrder,
}) => {
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSuppliers('tenant_default', storeId);
      setSuppliers(res.suppliers);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [storeId]);

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.categories.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <Truck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Suppliers & Vendor Directory
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Maintain verified supplier contacts, lead times, and fulfillment reliability scores for automated reordering.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 w-56"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading supplier contacts and delivery history...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-700">
          <p className="font-semibold text-sm">Failed to load suppliers</p>
          <p className="text-xs text-rose-500 mt-1">{error}</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          No suppliers found matching "{searchQuery}"
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {supplier.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Contact: {supplier.contact_person}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{supplier.reliability_score_pct}% Reliable</span>
                  </span>
                </div>

                {/* Details list */}
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supplier.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supplier.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supplier.location}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-semibold text-slate-800">
                      Standard Lead Time: {supplier.lead_time_days} days
                    </span>
                  </div>
                </div>

                {/* Categories */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
                  {supplier.categories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Active orders: <strong className="text-slate-800">{supplier.active_orders}</strong>
                </span>
                <a
                  href={`tel:${supplier.phone}`}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call Supplier</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
