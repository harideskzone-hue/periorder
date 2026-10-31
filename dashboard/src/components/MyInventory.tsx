import React, { useEffect, useState } from 'react';
import { StoreProduct } from '../types';
import { fetchStoreManagerProducts } from '../services/api';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Package, 
  RotateCcw, 
  ShoppingCart,
  ChevronRight,
  X,
  RefreshCw
} from 'lucide-react';

interface MyInventoryProps {
  onReorderProduct: (productName: string) => void;
  storeId?: string;
  storeName?: string;
}

export const MyInventory: React.FC<MyInventoryProps> = ({ 
  onReorderProduct,
  storeId = 'CA_1',
  storeName
}) => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [sortByUrgency, setSortByUrgency] = useState(true);

  useEffect(() => {
    setLoading(true);
    let active = true;
    setError('');
    fetchStoreManagerProducts(selectedCategory, selectedStatus, 'tenant_default', storeId)
      .then((res) => {
        if (!active) return;
        setProducts(res.products);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!active) return;
        setError('We could not load inventory. Check that the PeriOrder API is running, then try again.');
        setLoading(false);
      });
    return () => { active = false; };
  }, [selectedCategory, selectedStatus, storeId]);

  const filteredProducts = products
    .filter((p) =>
      p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (!sortByUrgency) return a.name.localeCompare(b.name);
      const rank: Record<string, number> = { 'Out of stock': 0, 'Low stock': 1, 'Expiring soon': 2, Sufficient: 3 };
      return (rank[a.status] ?? 4) - (rank[b.status] ?? 4) || a.days_of_supply - b.days_of_supply;
    });

  const displayTitle = storeName ? `${storeName} (${storeId})` : `Store ${storeId}`;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e8e8ed] gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              {displayTitle}
            </span>
            <span className="text-xs text-[#64748B]">Branch Catalog</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] mt-1">
            My Inventory
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Monitor current shelf stock, product shelf life, and replenishment needs for {displayTitle}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <Package className="w-4 h-4 text-[#2563EB]" />
          <span>{filteredProducts.length} products in branch</span>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        <strong>Branch inventory:</strong> stock quantities, shelf-life values and supplier lead times on this page reflect {displayTitle}. All records are isolated per store branch.
      </div>

      {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span>{error}</span>
        <button onClick={() => { setLoading(true); setError(''); fetchStoreManagerProducts(selectedCategory, selectedStatus, 'tenant_default', storeId).then(r => setProducts(r.products)).catch(() => setError('Retry failed. Please check the API server.')).finally(() => setLoading(false)); }} className="inline-flex items-center gap-1 font-semibold"><RefreshCw className="h-4 w-4"/> Retry</button>
      </div>}

      {/* Filter & Search Bar */}
      <div className="card-apple p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#86868b]" />
            <input
              type="text"
              placeholder="Search products by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#f5f5f7] border border-[#e8e8ed] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0071e3] transition-all"
            />
          </div>

          <button
            onClick={() => setSortByUrgency(v => !v)}
            className="w-full sm:w-auto rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#334155] hover:bg-slate-50"
          >
            Sort: {sortByUrgency ? 'Most urgent first' : 'Product name'}
          </button>
          {/* Status Filter */}
          <div className="flex items-center space-x-2 text-xs w-full sm:w-auto">
            <span className="text-[#86868b] whitespace-nowrap">Status:</span>
            <div className="flex rounded-lg bg-[#f5f5f7] p-1 border border-[#e8e8ed] overflow-x-auto">
              {['All', 'Out of stock', 'Low stock', 'Expiring soon', 'Sufficient'].map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    selectedStatus === st
                      ? 'bg-white text-[#0071e3] shadow-subtle'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-2 pt-2 border-t border-[#f0f0f4] text-xs">
          <span className="text-[#86868b]">Category:</span>
          <div className="flex flex-wrap gap-1.5">
            {['All', 'Dairy', 'Bakery', 'Produce', 'Meat'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#0071e3] text-white border-[#0071e3]'
                    : 'bg-white text-[#6e6e73] border-[#e8e8ed] hover:border-[#d2d2d7]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Catalog Table */}
      <div className="card-apple overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1d1d1f]">
            <thead className="bg-[#f5f5f7] text-[#6e6e73] font-medium border-b border-[#e8e8ed]">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">On-Shelf Stock</th>
                <th className="py-3 px-3 text-right">Expected Daily Demand</th>
                <th className="py-3 px-3 text-right">Days of Supply</th>
                <th className="py-3 px-3 text-center">Shelf Life Left</th>
                <th className="py-3 px-3 text-center">Supplier Delivery</th>
                <th className="py-3 px-3 text-center">Stock Health</th>
                <th className="py-3 px-4 text-center">Suggested Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f4]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#86868b]">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0071e3] mx-auto mb-2"></div>
                    Loading inventory catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#86868b]">
                    No products found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.status === 'Low stock';
                  const isExpiring = p.status === 'Expiring soon';

                  return (
                    <tr key={p.id} className="hover:bg-[#fafafc] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#1d1d1f]">
                        <button onClick={() => setSelectedProduct(p)} className="text-left hover:text-[#2563EB] hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                          {p.name}
                        </button>
                        <div className="text-[10px] font-normal text-[#94A3B8]">{p.id}</div>
                      </td>
                      <td className="py-3 px-3 text-[#6e6e73]">{p.category}</td>
                      <td className="py-3 px-3 text-right font-bold text-[#1d1d1f]">
                        {p.current_stock} units
                      </td>
                      <td className="py-3 px-3 text-right text-[#6e6e73]">
                        ~{p.expected_daily_demand} units/day
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        <span className={p.days_of_supply < 1.5 ? 'text-[#f43f5e]' : 'text-[#1d1d1f]'}>
                          {p.days_of_supply.toFixed(1)} days
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          p.days_remaining <= 2
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-[#f5f5f7] text-[#6e6e73]'
                        }`}>
                          Illustrative: {p.days_remaining} {p.days_remaining === 1 ? 'day' : 'days'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-[#6e6e73]">
                        {p.supplier_lead_time}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center space-x-1 ${
                            isLow
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : isExpiring
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-green-50 text-green-700 border border-green-200'
                          }`}
                        >
                          {isLow ? <AlertTriangle className="w-3 h-3 mr-0.5" /> : null}
                          {isExpiring ? <Clock className="w-3 h-3 mr-0.5" /> : null}
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.action === 'Reorder' ? (
                          <button
                            onClick={() => onReorderProduct(p.name)}
                            className="px-3 py-1 rounded-lg bg-[#0071e3] hover:bg-[#0077ed] text-white font-medium text-xs transition-all shadow-sm"
                          >
                            Order Now
                          </button>
                        ) : p.action === 'Rotate' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-[#fef3c7] text-[#b45309] font-medium text-xs">
                            Rotate Stock
                          </span>
                        ) : (
                          <span className="text-[#86868b] text-xs">
                            No action
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProduct(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="product-detail-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Product details · Demonstration data</p>
                <h2 id="product-detail-title" className="mt-1 text-lg font-bold text-[#0F172A]">{selectedProduct.name}</h2>
                <p className="text-xs text-[#64748B]">{selectedProduct.category} · {selectedProduct.id}</p>
              </div>
              <button aria-label="Close product details" onClick={() => setSelectedProduct(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Illustrative stock</p><p className="mt-1 text-xl font-bold">{selectedProduct.current_stock} units</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Expected daily demand</p><p className="mt-1 text-xl font-bold">{selectedProduct.expected_daily_demand} units</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Days of supply</p><p className="mt-1 text-xl font-bold">{selectedProduct.days_of_supply.toFixed(1)} days</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Illustrative shelf-life left</p><p className="mt-1 text-xl font-bold">{selectedProduct.days_remaining} days</p></div>
            </div>
            <p className="mt-4 text-sm text-slate-600">Status: <strong>{selectedProduct.status}</strong>. Supplier delivery estimate: <strong>{selectedProduct.supplier_lead_time}</strong>.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => setSelectedProduct(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Close</button>
              {selectedProduct.action === 'Reorder' && <button onClick={() => { onReorderProduct(selectedProduct.name); setSelectedProduct(null); }} className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white">Review order suggestion</button>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
