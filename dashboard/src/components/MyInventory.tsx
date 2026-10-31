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
  ChevronRight
} from 'lucide-react';

interface MyInventoryProps {
  onReorderProduct: (productName: string) => void;
}

export const MyInventory: React.FC<MyInventoryProps> = ({ onReorderProduct }) => {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
    setLoading(true);
    fetchStoreManagerProducts(selectedCategory, selectedStatus)
      .then((res) => {
        setProducts(res.products);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedCategory, selectedStatus]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#e8e8ed] gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
            My Inventory
          </h1>
          <p className="text-sm text-[#6e6e73] mt-0.5">
            Monitor current shelf stock, product shelf life, and replenishment needs
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center space-x-2 text-xs bg-[#ffffff] px-3.5 py-1.5 rounded-xl border border-[#e8e8ed] shadow-subtle text-[#6e6e73]">
          <Package className="w-3.5 h-3.5 text-[#0071e3]" />
          <span>Showing {filteredProducts.length} items</span>
        </div>
      </div>

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

          {/* Status Filter */}
          <div className="flex items-center space-x-2 text-xs w-full sm:w-auto">
            <span className="text-[#86868b] whitespace-nowrap">Status:</span>
            <div className="flex rounded-lg bg-[#f5f5f7] p-1 border border-[#e8e8ed] overflow-x-auto">
              {['All', 'Low stock', 'Expiring soon', 'Sufficient'].map((st) => (
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
                        {p.name}
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
                          {p.days_remaining} {p.days_remaining === 1 ? 'day' : 'days'}
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
    </div>
  );
};
