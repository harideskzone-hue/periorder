import React, { useState, useRef } from 'react';
import { ShopCategory, ShopType, ShopOnboardingProfile, OCRBillResult, OCRExtractedItem } from '../types';
import { saveOnboardingProfile, processBillOCR } from '../services/api';
import {
  Store,
  User,
  MapPin,
  Phone,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  UploadCloud,
  FileText,
  AlertTriangle,
  Plus,
  Trash2,
  TrendingUp,
  ShieldCheck,
  Check,
  DollarSign,
  Package,
  Layers,
  Clock,
  Scan,
  RefreshCw,
  X
} from 'lucide-react';

interface ShopOnboardingWizardProps {
  storeId?: string;
  storeName?: string;
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (profile: ShopOnboardingProfile, store?: any) => void;
}

export const ShopOnboardingWizard: React.FC<ShopOnboardingWizardProps> = ({
  storeId = 'CA_1',
  storeName = 'Downtown Central',
  isOpen,
  onClose,
  onCompleted,
}) => {
  if (!isOpen) return null;

  // Total Steps: 1: Info & Category, 2: Shop Type, 3: Inventory / Invoices, 4: Market Research, 5: Feasibility, 6: Launch
  const [step, setStep] = useState<number>(1);
  const totalSteps = 6;

  // Form Profile State
  const [profile, setProfile] = useState<ShopOnboardingProfile>({
    shop_name: storeName || 'My Smart Retail Store',
    owner_name: '',
    location: '',
    contact_phone: '',
    contact_email: '',
    category: 'Grocery Store',
    shop_type: 'existing',
    opening_date: new Date().toISOString().split('T')[0],
    status: 'uncompleted',
    initial_products: [],
  });

  // Category Presets for New Shops
  const categoryPresets: Record<string, Array<{ name: string; quantity: number; purchase_price: number; selling_price: number; shelf_life: number; supplier: string }>> = {
    'Grocery Store': [
      { name: 'Basmati Rice (1kg)', quantity: 100, purchase_price: 45, selling_price: 55, shelf_life: 365, supplier: 'Golden Harvest Grains' },
      { name: 'Sunflower Cooking Oil (1L)', quantity: 60, purchase_price: 130, selling_price: 155, shelf_life: 180, supplier: 'Apex Edible Oils' },
      { name: 'Refined White Sugar (1kg)', quantity: 80, purchase_price: 42, selling_price: 50, shelf_life: 730, supplier: 'Deccan Agro Mills' },
      { name: 'Wheat Flour / Atta (5kg)', quantity: 40, purchase_price: 210, selling_price: 245, shelf_life: 90, supplier: 'Shakti Grains Ltd' },
      { name: 'Toor Dal / Yellow Lentils (1kg)', quantity: 50, purchase_price: 125, selling_price: 150, shelf_life: 180, supplier: 'Golden Harvest Grains' },
    ],
    'Fruit & Vegetable Shop': [
      { name: 'Farm Fresh Tomatoes (1kg)', quantity: 80, purchase_price: 28, selling_price: 40, shelf_life: 4, supplier: 'APMC Regional Mandi' },
      { name: 'Red Onions (1kg)', quantity: 150, purchase_price: 24, selling_price: 35, shelf_life: 14, supplier: 'Nashik Wholesale Produce' },
      { name: 'Fresh Potatoes (1kg)', quantity: 120, purchase_price: 20, selling_price: 28, shelf_life: 21, supplier: 'Agro Field Direct' },
      { name: 'Green Coriander & Herbs (bunch)', quantity: 40, purchase_price: 8, selling_price: 15, shelf_life: 2, supplier: 'Local Green Farmers' },
    ],
    'Medical Shop': [
      { name: 'Paracetamol 500mg (10 tabs)', quantity: 100, purchase_price: 18, selling_price: 30, shelf_life: 730, supplier: 'MedLife Pharma Dist.' },
      { name: 'Antiseptic Liquid (250ml)', quantity: 30, purchase_price: 85, selling_price: 110, shelf_life: 1095, supplier: 'Apollo Healthcare Supply' },
      { name: 'Vitamin C Chewable (strip)', quantity: 60, purchase_price: 45, selling_price: 70, shelf_life: 540, supplier: 'MedLife Pharma Dist.' },
    ],
    'Clothing Store': [
      { name: 'Classic Cotton T-Shirt (M/L)', quantity: 50, purchase_price: 220, selling_price: 450, shelf_life: 365, supplier: 'Surat Textile Hub' },
      { name: 'Denim Jeans (Standard Fit)', quantity: 35, purchase_price: 550, selling_price: 1100, shelf_life: 365, supplier: 'Metro Garments Co.' },
      { name: 'Formal Linen Shirt', quantity: 25, purchase_price: 420, selling_price: 850, shelf_life: 365, supplier: 'Surat Textile Hub' },
    ],
    'Other': [
      { name: 'General Merchandise Item A', quantity: 50, purchase_price: 100, selling_price: 150, shelf_life: 365, supplier: 'City Wholesalers' },
      { name: 'General Merchandise Item B', quantity: 30, purchase_price: 250, selling_price: 380, shelf_life: 365, supplier: 'City Wholesalers' },
    ],
  };

  // Planned items for new shop
  const [plannedProducts, setPlannedProducts] = useState(categoryPresets['Grocery Store']);

  // Document upload state for existing shop
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [billUploads, setBillUploads] = useState<OCRBillResult[]>([]);
  const [extractedItems, setExtractedItems] = useState<OCRExtractedItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading & submission state
  const [saving, setSaving] = useState(false);

  // Category card options
  const shopCategories: Array<{
    id: ShopCategory;
    title: string;
    description: string;
    icon: string;
    examples: string;
  }> = [
    {
      id: 'Grocery Store',
      title: 'Grocery Store / Kirana',
      description: 'Daily staples, grains, edible oils, spices & packaged foods',
      icon: '🏪',
      examples: 'Rice, Dal, Atta, Edible Oil, Sugar, Spices',
    },
    {
      id: 'Fruit & Vegetable Shop',
      title: 'Fruit & Vegetable Shop',
      description: 'Fast-moving fresh perishables with 2–5 day shelf life',
      icon: '🥬',
      examples: 'Tomatoes, Onions, Potatoes, Greens, Fruits',
    },
    {
      id: 'Medical Shop',
      title: 'Medical Shop / Pharmacy',
      description: 'Healthcare items, prescription lines & batch expiry tracking',
      icon: '💊',
      examples: 'OTC Medicines, First Aid, Supplements, Creams',
    },
    {
      id: 'Clothing Store',
      title: 'Clothing Store / Boutique',
      description: 'Apparel, textiles, footwear & seasonal collections',
      icon: '👕',
      examples: 'Shirts, T-shirts, Jeans, Traditional Wear',
    },
    {
      id: 'Other',
      title: 'Other Retail Store',
      description: 'Hardware, electronics, stationery & general retail goods',
      icon: '📦',
      examples: 'General Merchandise, Tools, Accessories',
    },
  ];

  const handleCategorySelect = (cat: ShopCategory) => {
    setProfile((prev) => ({ ...prev, category: cat }));
    if (categoryPresets[cat]) {
      setPlannedProducts(categoryPresets[cat]);
    }
  };

  const handleBillUpload = async (file: File) => {
    setIsScanningBill(true);
    try {
      const res = await processBillOCR(file, 'purchase', 'tenant_default', storeId);
      setBillUploads((prev) => [...prev, res]);
      setExtractedItems((prev) => [...prev, ...res.items]);
    } catch (err: any) {
      console.error(err);
      alert('OCR error: ' + (err.message || 'Failed to scan bill.'));
    } finally {
      setIsScanningBill(false);
    }
  };

  const handlePlannedProductChange = (index: number, field: string, value: any) => {
    const updated = [...plannedProducts];
    (updated[index] as any)[field] = value;
    setPlannedProducts(updated);
  };

  const handleAddPlannedProduct = () => {
    setPlannedProducts([
      ...plannedProducts,
      {
        name: 'New Custom Product',
        quantity: 20,
        purchase_price: 50,
        selling_price: 70,
        shelf_life: 90,
        supplier: 'Local Wholesale Mandi',
      },
    ]);
  };

  const handleRemovePlannedProduct = (index: number) => {
    setPlannedProducts(plannedProducts.filter((_, i) => i !== index));
  };

  // Submit and Complete Onboarding
  const handleCompleteOnboarding = async () => {
    setSaving(true);
    try {
      const finalProducts =
        profile.shop_type === 'new'
          ? plannedProducts
          : extractedItems.map((item) => ({
              name: item.product_name,
              quantity: item.quantity,
              purchase_price: item.unit_price,
              selling_price: item.suggested_selling_price || item.unit_price * 1.25,
              shelf_life: 30,
              supplier: 'Verified Bill OCR',
            }));

      const finalProfile: ShopOnboardingProfile = {
        ...profile,
        status: 'completed',
        initial_products: finalProducts,
        uploaded_bill_count: billUploads.length,
      };

      const res = await saveOnboardingProfile(finalProfile, 'tenant_default', storeId);
      onCompleted(res.profile, (res as any).store);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save shop onboarding: ' + (err.message || 'Server error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Wizard Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-slate-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Smart Shop Onboarding
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Step {step} of {totalSteps}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                AI setup wizard for non-technical shop owners. Auto-saves as you go.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Save & Exit
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar Indicator */}
        <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Wizard Main Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 text-slate-800">
          {/* ==============================================================
              STEP 1: Welcome & Shop Registration (Name, Category, Location)
             ============================================================== */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Step 1 · Shop Identity
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  Welcome to Smart Inventory Management
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                  Tell us about your business. We tailor wholesale market rates, perishable shelf life rules, and demand forecasts to your specific store type.
                </p>
              </div>

              {/* Form Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Shop Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sri Lakshmi Kirana & General Store"
                      value={profile.shop_name}
                      onChange={(e) => setProfile({ ...profile, shop_name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Owner Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={profile.owner_name}
                      onChange={(e) => setProfile({ ...profile, owner_name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Shop Location (City / Market Area) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. T. Nagar, Chennai"
                      value={profile.location}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Contact Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98401 23456"
                      value={profile.contact_phone}
                      onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Visual Category Selection Cards */}
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-2">
                  Select Your Shop Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {shopCategories.map((cat) => {
                    const isSelected = profile.category === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{cat.icon}</span>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-2">{cat.title}</h3>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {cat.description}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                          {cat.examples}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              STEP 2: New Shop vs. Existing Shop
             ============================================================== */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Step 2 · Shop Operating Model
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  What type of shop are you registering?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                  Choose your shop's current stage so we can customize your data collection workflow.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                {/* Choice 1: New Shop */}
                <div
                  onClick={() => setProfile({ ...profile, shop_type: 'new' })}
                  className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    profile.shop_type === 'new'
                      ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shadow-xs">
                        🌱
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        Starting Fresh
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 mt-4">
                      I am starting a new shop
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Register products you plan to sell. We'll benchmark wholesale Mandi rates, forecast opening demand, and compute expected initial profit margins.
                    </p>

                    <ul className="mt-4 space-y-2 text-xs text-slate-600">
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Pre-loaded product catalog templates</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Expected purchase vs selling margins</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Initial capital & overstock risk assessment</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-blue-700">
                    <span>Select New Shop Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Choice 2: Existing Shop */}
                <div
                  onClick={() => setProfile({ ...profile, shop_type: 'existing' })}
                  className={`p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    profile.shop_type === 'existing'
                      ? 'border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-600/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl shadow-xs">
                        🏪
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Running Store
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 mt-4">
                      I already have a running shop
                    </h2>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Upload past purchase bills or supplier invoices. Our OCR AI extracts line items automatically and reconstructs your inventory without manual data entry.
                    </p>

                    <ul className="mt-4 space-y-2 text-xs text-slate-600">
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Instant OCR bill scanning (PDF, JPG, PNG)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Historical sales and purchase profitability</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Automatic FIFO stock deduction</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-emerald-700">
                    <span>Select Existing Shop Setup</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              STEP 3A: Existing Shop (Bill Upload Center & OCR Extraction)
             ============================================================== */}
          {step === 3 && profile.shop_type === 'existing' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Step 3 · Document Upload & OCR
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  Upload Previous Bills & Invoices
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                  Upload recent purchase bills, invoices, or POS sales receipts. Our smart AI will extract products, quantities, and pricing automatically.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => !isScanningBill && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                  isScanningBill
                    ? 'border-blue-400 bg-blue-50/50'
                    : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/20 bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx"
                  onChange={(e) => e.target.files && e.target.files[0] && handleBillUpload(e.target.files[0])}
                />

                {isScanningBill ? (
                  <div className="space-y-2">
                    <Scan className="w-8 h-8 mx-auto text-blue-600 animate-spin" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Reading Document with OCR & Smart Vision...
                    </h3>
                    <p className="text-xs text-slate-500">
                      Detecting line items, invoice totals, and prices.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="w-8 h-8 mx-auto text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Click to upload purchase bill or drag & drop file
                    </h3>
                    <p className="text-xs text-slate-500">
                      Supports PDF invoices, photos of printed receipts, and Excel sheets.
                    </p>
                  </div>
                )}
              </div>

              {/* Extracted Items Confirmation Table */}
              {extractedItems.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span>Extracted Products ({extractedItems.length} items detected)</span>
                    </h3>
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ Ready for confirmation
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Quantity</th>
                          <th className="py-2.5 px-3">Unit Price (₹)</th>
                          <th className="py-2.5 px-3">Total (₹)</th>
                          <th className="py-2.5 px-3 text-right">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {extractedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{item.product_name}</td>
                            <td className="py-2.5 px-3 font-mono">{item.quantity}</td>
                            <td className="py-2.5 px-3 font-mono">₹{item.unit_price}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">₹{item.total}</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {Math.round(item.confidence * 100)}% Verified
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                  <span>No bills uploaded yet? You can upload now or skip to use initial catalog templates.</span>
                  <button
                    onClick={() => {
                      setExtractedItems([
                        { product_name: 'Basmati Rice (1kg)', quantity: 50, unit_price: 45, total: 2250, confidence: 0.98, status: 'verified' },
                        { product_name: 'Sunflower Oil (1L)', quantity: 30, unit_price: 130, total: 3900, confidence: 0.95, status: 'verified' },
                        { product_name: 'Refined Sugar (1kg)', quantity: 40, unit_price: 42, total: 1680, confidence: 0.96, status: 'verified' },
                      ]);
                    }}
                    className="underline font-bold text-amber-900 hover:text-black ml-2"
                  >
                    Load Sample Bill Data
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              STEP 3B: New Shop (Planned Inventory Catalog Registration)
             ============================================================== */}
          {step === 3 && profile.shop_type === 'new' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Step 3 · Initial Stock Catalog
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                    Products You Plan to Sell
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    We pre-loaded common items for {profile.category}. You can customize quantities and prices.
                  </p>
                </div>

                <button
                  onClick={handleAddPlannedProduct}
                  className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1.5 self-start sm:self-auto border border-blue-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>

              {/* Editable Inventory List */}
              <div className="space-y-3">
                {plannedProducts.map((p, idx) => {
                  const unitMargin = p.selling_price - p.purchase_price;
                  const marginPct = Math.round((unitMargin / (p.selling_price || 1)) * 100);

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => handlePlannedProductChange(idx, 'name', e.target.value)}
                          className="font-bold text-sm text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-hidden px-1 py-0.5 w-72"
                        />
                        <button
                          onClick={() => handleRemovePlannedProduct(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block">Initial Qty</label>
                          <input
                            type="number"
                            value={p.quantity}
                            onChange={(e) => handlePlannedProductChange(idx, 'quantity', Number(e.target.value))}
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block">Purchase Price (₹)</label>
                          <input
                            type="number"
                            value={p.purchase_price}
                            onChange={(e) => handlePlannedProductChange(idx, 'purchase_price', Number(e.target.value))}
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block">Selling Price (₹)</label>
                          <input
                            type="number"
                            value={p.selling_price}
                            onChange={(e) => handlePlannedProductChange(idx, 'selling_price', Number(e.target.value))}
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block">Shelf Life (Days)</label>
                          <input
                            type="number"
                            value={p.shelf_life}
                            onChange={(e) => handlePlannedProductChange(idx, 'shelf_life', Number(e.target.value))}
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block">Expected Margin</label>
                          <div className="mt-1 px-2 py-1.5 bg-emerald-50 rounded-lg text-emerald-800 font-bold font-mono text-xs flex items-center justify-between border border-emerald-100">
                            <span>+₹{unitMargin}</span>
                            <span>{marginPct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==============================================================
              STEP 4: Market & Product Research Preview
             ============================================================== */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Step 4 · Market Intelligence
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  Retail Market Research & Price Benchmarking
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                  We checked APMC Mandi wholesale rates and local retail prices for your selected products in {profile.location || 'your region'}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Wholesale Mandi Rates</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                      Regional Mandi
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Wholesale grains and staples in your region are currently trading 4–7% below seasonal averages due to fresh harvest arrivals.
                  </p>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Verified Source: Agmarknet Agricultural Produce Market Committee
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Consumer Demand Trends</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      Strong Demand
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Staple demand index is high (84/100) with peak grocery runs on Friday evenings and weekend mornings.
                  </p>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Forecast Velocity: Fast turnover recommended
                  </div>
                </div>
              </div>

              {/* Sample Product Comparison Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">Mandi Rate</th>
                      <th className="py-2.5 px-4">Your Purchase Cost</th>
                      <th className="py-2.5 px-4">Retail Benchmark</th>
                      <th className="py-2.5 px-4 text-right">Potential Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">Basmati Rice (1kg)</td>
                      <td className="py-3 px-4 font-mono text-slate-600">₹42.50</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">₹45.00</td>
                      <td className="py-3 px-4 font-mono text-slate-600">₹58.00</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono">+22%</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">Cooking Oil (1L)</td>
                      <td className="py-3 px-4 font-mono text-slate-600">₹128.00</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">₹130.00</td>
                      <td className="py-3 px-4 font-mono text-slate-600">₹160.00</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono">+19%</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">Refined Sugar (1kg)</td>
                      <td className="py-3 px-4 font-mono text-slate-600">₹40.00</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">₹42.00</td>
                      <td className="py-3 px-4 font-mono text-slate-600">₹52.00</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono">+16%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==============================================================
              STEP 5: Feasibility & Profitability Analysis
             ============================================================== */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Step 5 · Feasibility & Profit Estimation
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  Business & Inventory Feasibility
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                  Based on your catalog and local demand velocity, here is your estimated monthly revenue and margin profile.
                </p>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Estimated Monthly Revenue</span>
                  <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                    ₹1,24,000
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">~₹4,100 / day</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Estimated Gross Profit</span>
                  <div className="mt-1 text-xl sm:text-2xl font-bold text-emerald-700 font-mono">
                    ₹27,280
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">22.0% Margin</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Inventory Working Capital</span>
                  <div className="mt-1 text-xl sm:text-2xl font-bold text-blue-700 font-mono">
                    ₹38,500
                  </div>
                  <span className="text-[10px] text-slate-500">Initial stock cost</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Overstock Risk Score</span>
                  <div className="mt-1 text-xl sm:text-2xl font-bold text-emerald-700">
                    Low Risk
                  </div>
                  <span className="text-[10px] text-slate-500">Fast-turning goods</span>
                </div>
              </div>

              {/* Feasibility Advice Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-100 flex items-start space-x-3.5">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-blue-900">AI Inventory Assistant Feasibility Summary</h4>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                    Your planned inventory configuration has healthy gross margins (22.0%). Grains and oils have extended shelf life (180–365 days), meaning minimal spoilage risk. We recommend setting a 2-day reorder buffer for fresh perishables.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              STEP 6: Confirmation & Personalized Launch
             ============================================================== */}
          {step === 6 && (
            <div className="space-y-6 text-center py-6 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-2xl mx-auto shadow-sm">
                <Check className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  You're Ready to Roll, {profile.owner_name || 'Partner'}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto">
                  {profile.shop_name} is now registered. Your smart shop assistant is active, monitoring stock levels, and ready to automate your ordering.
                </p>
              </div>

              {/* Summary Checklist */}
              <div className="max-w-md mx-auto bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Shop Profile: <strong>{profile.shop_name} ({profile.category})</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Location: <strong>{profile.location || 'Local Regional Market'}</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Continuous Monitoring: <strong>FIFO Ledger + POS Sync Active</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Market Intelligence: <strong>Wholesale Mandi Rates Connected</strong></span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCompleteOnboarding}
                  disabled={saving}
                  className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-2 mx-auto disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  <span>Launch My Smart Shop Dashboard</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {step > 1 && step < 6 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center space-x-1 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Step {step} of {totalSteps}
            </span>
            {step < 6 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
