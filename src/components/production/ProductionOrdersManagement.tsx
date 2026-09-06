import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Search, CheckCircle, Clock, Ban, AlertCircle, X, 
  Eye, Calendar, Layers, Check, PlayCircle, Tag, Users, FileText, 
  Settings, Award, Trash2, LayoutGrid, Warehouse, Activity, Zap, TrendingUp,
  MapPin, User, ChevronLeft, ArrowRight, Package, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProductionOrder, ProductDef, BillOfMaterial, WorkCenter } from './types';
import { api } from '../../utils/api';

const DEFAULT_PRODUCTS: ProductDef[] = [
  { id: '1', code: 'RAW-001', name: 'حديد صلب', category: 'معادن', type: 'raw', unit: 'طن', costMethod: 'FIFO' },
  { id: '2', code: 'SFP-102', name: 'إطار سيارة (نصف مصنع)', category: 'هياكل', type: 'semi_finished', unit: 'قطعة', costMethod: 'Standard' },
  { id: '3', code: 'FIN-500', name: 'سيارة سيدان', category: 'سيارات', type: 'finished', unit: 'سيارة', costMethod: 'Actual' },
];

const DEFAULT_BOMS: BillOfMaterial[] = [
  {
    id: 'b1',
    productId: 'FIN-500',
    name: 'BOM سيارة سيدان',
    version: 'v1.0',
    scrapPercentage: 2.5,
    items: [
      { materialId: 'RAW-001', quantity: 2 },
      { materialId: 'SFP-102', quantity: 4 }
    ],
    routings: [
      { id: 'r1', opNumber: 10, description: 'قص الألواح والحديد بجهاز الليزر', workCenterId: 'MC-101', setupTime: 15, runTime: 45 },
      { id: 'r2', opNumber: 20, description: 'تجميع الهيكل الخارجي وتركيب الإطارات', workCenterId: 'LN-001', setupTime: 30, runTime: 120 }
    ]
  }
];

const DEFAULT_CENTERS: WorkCenter[] = [
  { id: '1', code: 'MC-101', name: 'غرفة القطع بالليزر', type: 'machine', capacity: 100, costPerHour: 500, efficiency: 95 },
  { id: '2', code: 'LN-001', name: 'خط التجميع الرئيسي', type: 'line', capacity: 50, costPerHour: 2000, efficiency: 85 },
];

const MOCK_ORDERS: ProductionOrder[] = [
  { 
    id: '1', 
    orderNumber: 'PRD-2026-001', 
    productId: 'FIN-500', 
    quantity: 15, 
    bomId: 'b1', 
    startDate: '2026-06-15', 
    endDate: '2026-06-20', 
    priority: 'high', 
    status: 'in_progress', 
    progress: 45,
    salesReference: 'SO-1092',
    workCenterId: 'LN-001',
    supervisor: 'م. أحمد الشافعي',
    notes: 'برجاء التحقق من معايرة ماكينات ليزر القطع قبل بدء الوردية.'
  },
  { 
    id: '2', 
    orderNumber: 'PRD-2026-002', 
    productId: 'SFP-102', 
    quantity: 200, 
    bomId: 'b1', 
    startDate: '2026-06-12', 
    endDate: '2026-06-14', 
    priority: 'normal', 
    status: 'completed', 
    progress: 100,
    salesReference: 'مخزون الأمان الرئيسي',
    workCenterId: 'MC-101',
    supervisor: 'م. عادل حسني',
    notes: 'إنتاج استباقي لتغذية خط التجميع النهائي.'
  },
];

export function ProductionOrdersManagement() {
  const [orders, setOrders] = useState<ProductionOrder[]>(() => {
    const saved = localStorage.getItem('remo_production_orders');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.id && item.orderNumber);
        }
      } catch (e) { 
        console.error('Failed to parse from local storage', e); 
      }
    }
    return MOCK_ORDERS;
  });

  // DB Registrations for cross references
  const [products] = useState<ProductDef[]>(() => {
    const saved = localStorage.getItem('remo_production_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.code);
        }
      } catch (e) {}
    }
    return DEFAULT_PRODUCTS;
  });

  const [boms] = useState<BillOfMaterial[]>(() => {
    const saved = localStorage.getItem('remo_production_boms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.id);
        }
      } catch (e) {}
    }
    return DEFAULT_BOMS;
  });

  const [workCenters] = useState<WorkCenter[]>(() => {
    const saved = localStorage.getItem('remo_production_workcenters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.id);
        }
      } catch (e) {}
    }
    return DEFAULT_CENTERS;
  });

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Live ERP Database Linkage States
  const [dbWarehouses, setDbWarehouses] = useState<any[]>([]);
  const [dbIngredients, setDbIngredients] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [selectedRawWarehouse, setSelectedRawWarehouse] = useState<number | null>(null);
  const [selectedFinishedWarehouse, setSelectedFinishedWarehouse] = useState<number | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<Record<number, number>>({});
  const [loadingStock, setLoadingStock] = useState(false);
  const [postingToInventory, setPostingToInventory] = useState(false);

  // 1. Fetch live warehouses, products and ingredients from PG database on mount
  useEffect(() => {
    api.get('/api/inventory/warehouses')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDbWarehouses(data);
          // Auto-select first main warehouse or fallback to the first element
          const mainWh = data.find((w: any) => w.is_main === 1 || w.type === 'main') || data[0];
          if (mainWh) {
            setSelectedRawWarehouse(mainWh.id);
            setSelectedFinishedWarehouse(mainWh.id);
          }
        }
      })
      .catch(err => console.error('Failed to load warehouses:', err));

    api.get('/api/pos/data')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (Array.isArray(data.products)) setDbProducts(data.products);
          if (Array.isArray(data.ingredients)) setDbIngredients(data.ingredients);
        }
      })
      .catch(err => {
        console.error('Failed to load raw POS data, fetching ingredients separately:', err);
        api.get('/api/ingredients')
          .then(res => res.json())
          .then(ings => {
            if (Array.isArray(ings)) setDbIngredients(ings);
          })
          .catch(e => console.error('Failed to load individual ingredients:', e));
      });
  }, []);

  // 2. Fetch live stock levels in the selected raw materials warehouse whenever warehouse or selected order changes
  useEffect(() => {
    if (!selectedRawWarehouse) return;
    setLoadingStock(true);
    api.get(`/api/inventory/items?warehouse_id=${selectedRawWarehouse}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const stockMap: Record<number, number> = {};
          data.forEach((item: any) => {
            if (item.ingredient_id) {
              stockMap[item.ingredient_id] = parseFloat(item.quantity) || 0;
            }
          });
          setWarehouseStock(stockMap);
        }
      })
      .catch(err => console.error('Failed to fetch warehouse items stock:', err))
      .finally(() => setLoadingStock(false));
  }, [selectedRawWarehouse, selectedOrder]);

  // Form states
  const [newOrder, setNewOrder] = useState<Partial<ProductionOrder>>({
    orderNumber: '',
    productId: '',
    quantity: 10,
    bomId: '',
    startDate: '',
    endDate: '',
    priority: 'normal',
    status: 'planned',
    progress: 0,
    salesReference: '',
    workCenterId: '',
    supervisor: '',
    notes: ''
  });

  // Product Filter search term inside Modal Creator
  const [productSearch, setProductSearch] = useState('');

  // Auto incremental order number builder
  const suggestNextOrderNumber = (currentOrders: ProductionOrder[]) => {
    const year = new Date().getFullYear();
    const prefix = `PRD-${year}-`;
    let lastNum = 0;
    
    const safeOrders = Array.isArray(currentOrders) ? currentOrders : [];
    safeOrders.forEach(o => {
      if (o && o.orderNumber && typeof o.orderNumber === 'string' && o.orderNumber.startsWith(prefix)) {
        const parts = o.orderNumber.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > lastNum) {
          lastNum = num;
        }
      }
    });

    const nextSeq = lastNum + 1;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  };

  const handleOpenCreateModal = () => {
    const nextOrderNum = suggestNextOrderNumber(orders);
    
    // Auto find first available finished or semi_finished product 
    const safeProducts = Array.isArray(products) ? products : [];
    const initialProduct = safeProducts.find(p => p && (p.type === 'finished' || p.type === 'semi_finished')) || safeProducts[0];
    const targetProductCode = initialProduct ? initialProduct.code : '';
    const safeBoms = Array.isArray(boms) ? boms : [];
    const matchingBOM = safeBoms.find(b => b && b.productId === targetProductCode);
    
    // Preset default dates
    const today = new Date().toISOString().split('T')[0];
    const targetEnd = new Date();
    targetEnd.setDate(targetEnd.getDate() + 5);
    const endStr = targetEnd.toISOString().split('T')[0];

    const safeWorkCenters = Array.isArray(workCenters) ? workCenters.filter(Boolean) : [];

    setNewOrder({
      orderNumber: nextOrderNum,
      productId: targetProductCode,
      quantity: 50,
      bomId: matchingBOM ? matchingBOM.id : '',
      startDate: today,
      endDate: endStr,
      priority: 'normal',
      status: 'planned',
      progress: 0,
      salesReference: '',
      workCenterId: safeWorkCenters[0] ? (safeWorkCenters[0].code || safeWorkCenters[0].id) : '',
      supervisor: 'م. فادي القاضي',
      notes: ''
    });

    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleAddOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.orderNumber || !newOrder.productId) {
      alert('الرجاء التأكد من رقم الأمر والمنتج المستهدف!');
      return;
    }

    const safeOrders = Array.isArray(orders) ? orders : [];
    // Verify uniqueness
    const numExists = safeOrders.some(o => o && o.orderNumber === newOrder.orderNumber);
    if (numExists) {
      alert('رقم الأمر هذا مسجل مسبقاً! تم تكييف رمز جديد تلقائي.');
      return;
    }

    const added: ProductionOrder = {
      ...(newOrder as ProductionOrder),
      id: `ord-${Date.now()}`,
      progress: newOrder.status === 'completed' ? 100 : (newOrder.progress || 0)
    };

    const updated = [added, ...safeOrders];
    setOrders(updated);
    localStorage.setItem('remo_production_orders', JSON.stringify(updated));
    setIsModalOpen(false);
  };

  const handleDeleteOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('هل أنت متأكد من إلغاء وحذف أمر الإنتاج بالكامل؟')) {
      const safeOrders = Array.isArray(orders) ? orders : [];
      const updated = safeOrders.filter(o => o && o.id !== id);
      setOrders(updated);
      localStorage.setItem('remo_production_orders', JSON.stringify(updated));
      setIsDetailOpen(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStats: ProductionOrder['status'], newProg: number) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const orderToUpdate = safeOrders.find(o => o && o.id === id);
    if (orderToUpdate && newStats === 'completed') {
      const savedCerts = localStorage.getItem('remo_pro_quality_final_certs');
      let isApproved = false;
      if (savedCerts) {
         try {
           const certs = JSON.parse(savedCerts);
           if (Array.isArray(certs)) {
             const matched = certs.find((c: any) => c && c.orderNumber === orderToUpdate.orderNumber);
             if (matched) {
               if (matched.decision === 'certified_approved') {
                 isApproved = true;
               } else if (matched.decision === 'rejected_rework') {
                 alert('✖ هذا الأمر تم رفضه ومحجوز بالحجر الصحي للجودة ولا يمكن ترحيله للمخازن إلا بعد اعتماده من الجودة.');
                 return;
               }
             }
           }
         } catch (e) {}
      }
      
      if (!isApproved) {
        const proceed = window.confirm(
          `⚠ تنبيه أمان الجودة (ERP Quality Inspector Alert):\n` +
          `لم يصدر بعد قرار فحص الجودة ومطابقة المواصفات لأمر الإنتاج ${orderToUpdate.orderNumber}.\n\n` +
          `اضغط 'موافق' لتجاوز قفل الجودة اليدوي، أو 'إلغاء' للذهاب لمديول 'مراقبة الجودة' لفرز الدفعة واعتمادها أولاً.`
        );
        if (!proceed) return;
      }

      // ACTIVE REAL-TIME WAREHOUSE INTEGRATION WITH POSTGRES DB
      if (selectedRawWarehouse && selectedFinishedWarehouse) {
        setPostingToInventory(true);
        try {
          const associatedProduct = getProductDetails(orderToUpdate.productId);
          const linkedBom = boms.find(b => b.id === orderToUpdate.bomId) || boms[0];
          
          let alertDetails = "";
          let successLog = false;

          // Step A: Deduct raw materials consumed from the Raw warehouse
          if (linkedBom && Array.isArray(linkedBom.items)) {
            for (const item of linkedBom.items) {
              const prodObj = getProductDetails(item.materialId);
              const matchedIng = dbIngredients.find(
                ing => ing.name === prodObj?.name || ing.item_code === item.materialId || ing.name === item.materialId
              );

              if (matchedIng) {
                const totalNet = item.quantity * orderToUpdate.quantity;
                const withScrap = Math.ceil(totalNet * (1 + (linkedBom.scrapPercentage / 100)) * 100) / 100;
                
                // POST adjustment to PostgreSQL
                const adjRes = await api.post('/api/inventory/adjust', {
                    warehouse_id: selectedRawWarehouse,
                    ingredient_id: matchedIng.id,
                    quantity: -withScrap,
                    notes: `أمر تصنيع رقم ${orderToUpdate.orderNumber} - استهلاك مادة: ${matchedIng.name}`
                  });

                if (adjRes.ok) {
                  alertDetails += `\n 📉 صرف مادة [${matchedIng.name}] بكمية ${withScrap} ${matchedIng.unit} من مخيرن المواد الخام`;
                  successLog = true;
                }
              }
            }
          }

          // Step B: Add finished goods produced to the Finished warehouse
          if (associatedProduct) {
            const finishedIng = dbIngredients.find(ing => ing.name === associatedProduct.name);
            if (finishedIng) {
              // POST adjustment to PostgreSQL for finished good
              const addRes = await api.post('/api/inventory/adjust', {
                warehouse_id: selectedFinishedWarehouse,
                ingredient_id: finishedIng.id,
                quantity: orderToUpdate.quantity,
                notes: `أمر تصنيع رقم ${orderToUpdate.orderNumber} - إضافة المنتج النهائي: ${finishedIng.name}`
              });

              if (addRes.ok) {
                alertDetails += `\n 📈 إضافة منتج تام [${finishedIng.name}] بكمية ${orderToUpdate.quantity} ${finishedIng.unit} إلى مخزن التام`;
                successLog = true;
              }
            }
          }

          if (successLog) {
            alert(
              `✅ تم ربط المخازن والترحيل التلقائي بنجاح (Material Allocations Posted):\n` +
              `تم ترحيل قفل أمر التشغيل إلى مديول المخازن، وحُدّثت الأرصدة والمخزون في قاعدة البيانات للفرعين بالتوازي!\n` +
              alertDetails
            );
          }
        } catch (e) {
          console.error("Failed to sync inventory allocations:", e);
        } finally {
          setPostingToInventory(false);
        }
      }
    }

    const updated = safeOrders.map(o => {
      if (o && o.id === id) {
        const stats = {
          ...o,
          status: newStats,
          progress: newStats === 'completed' ? 100 : newProg
        };
        // Update selected view
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder(stats);
        }
        return stats;
      }
      return o;
    });

    setOrders(updated);
    localStorage.setItem('remo_production_orders', JSON.stringify(updated));
  };

  const handleViewDetails = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': 
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><AlertCircle className="w-3.5 h-3.5"/> مسودة</span>;
      case 'planned': 
        return <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Calendar className="w-3.5 h-3.5"/> مخطط إنتاجه</span>;
      case 'released': 
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><PlayCircle className="w-3.5 h-3.5"/> مطلق للتشغيل</span>;
      case 'in_progress': 
        return <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit animate-pulse"><Clock className="w-3.5 h-3.5"/> قيد العمل</span>;
      case 'completed': 
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle className="w-3.5 h-3.5"/> مكتمل وجاهز</span>;
      case 'cancelled': 
        return <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Ban className="w-3.5 h-3.5"/> ملغي</span>;
      default: 
        return <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-extrabold border border-red-200">عالية جداً</span>;
      case 'normal':
        return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-extrabold">عادية</span>;
      case 'low':
        return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">منخفضة</span>;
      default:
        return null;
    }
  };

  // Searching logic based on Order Code, Product Code, OR Product Name (امكانية البحث من اسم المنتج)!
  // Helper to find a product details from either local state products or database products (إدارة المنتجات)
  const getProductDetails = (prodId: string) => {
    // 1. Find in local production products from localStorage
    const pLocal = Array.isArray(products) ? products.find(p => p && (p.code === prodId || p.id === prodId || p.name === prodId)) : null;
    if (pLocal) return pLocal;

    // 2. Find in real database products (إدارة المنتجات)
    const pDb = Array.isArray(dbProducts) ? dbProducts.find(p => p && (p.code === prodId || `PROD-${p.id}` === prodId || p.name === prodId || String(p.id) === prodId)) : null;
    if (pDb) {
      return {
        id: String(pDb.id),
        code: pDb.code || `PROD-${pDb.id}`,
        name: pDb.name,
        category: pDb.category_name || pDb.category || 'منتجات مبيعات مستودع',
        unit: pDb.unit || 'وحدة',
        type: 'finished',
        plmStatus: 'approved'
      };
    }

    return {
      id: prodId,
      code: prodId,
      name: prodId,
      category: 'عام',
      unit: 'وحدة',
      type: 'finished',
      plmStatus: 'approved'
    };
  };

  const filteredOrders = (Array.isArray(orders) ? orders : []).filter(o => {
    if (!o) return false;
    const term = (search || '').toLowerCase();
    const isOrderNumberMatch = o.orderNumber && typeof o.orderNumber === 'string' && o.orderNumber.toLowerCase().includes(term);
    const isProductIdMatch = o.productId && typeof o.productId === 'string' && o.productId.toLowerCase().includes(term);
    
    const product = getProductDetails(o.productId);
    const productName = product && product.name ? product.name.toLowerCase() : '';
    const isProductNameMatch = productName.includes(term);
    
    return isOrderNumberMatch || isProductIdMatch || isProductNameMatch;
  });

  // Modal selector product filtering list - Local Products (التي يتم كرياتها في إدارة الانتاج)
  const modalFilteredProducts = (Array.isArray(products) ? products : []).filter(p => {
    if (!p) return false;
    const matchesSearch = (p.name || '').toLowerCase().includes((productSearch || '').toLowerCase()) || 
                          (p.code || '').toLowerCase().includes((productSearch || '').toLowerCase());
    return matchesSearch;
  });

  // Modal selector product filtering list - DB Products (إزالة منتجات المتجر ونقاط البيع بناء على رغبة العميل)
  const modalFilteredDbProducts: any[] = [];

  return (
    <div className="p-6 md:p-12 w-full max-w-[1800px] mx-auto space-y-10 animate-fadeIn" id="production_orders_main">
      {/* Header Hub - Professional Production Management UI */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 p-8 rounded-[2.5rem] shadow-sm flex flex-col lg:flex-row justify-between items-center gap-8 translate-y-0 hover:-translate-y-1 transition-all duration-500">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 rotate-3 group hover:rotate-0 transition-transform duration-500">
            <ClipboardList className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">أوامر الإنتاج وتتبع النشاط</h1>
            <p className="text-slate-500 font-medium mt-1.5 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-emerald-500" />
              تخطيط، جدولة، ومراقبة أوامر التشغيل الميدانية في الوقت الفعلي
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-96">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="البحث برقم الأمر، كود المنتج أو اسم الصنف التام..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
            />
          </div>
          
          <button 
            onClick={handleOpenCreateModal}
            className="px-8 py-4 bg-indigo-600 hover:bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all text-sm group cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            إنشاء كرت أمر إنتاج جديد
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/50">
          <button 
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              viewMode === 'list' 
                ? 'bg-white text-slate-900 shadow-md translate-y-0 border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <LayoutGrid className={`w-4 h-4 ${viewMode === 'list' ? 'text-indigo-600' : ''}`} />
            جدول أوامر التشغيل
          </button>
          <button 
            type="button"
            onClick={() => setViewMode('gantt')}
            className={`px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              viewMode === 'gantt' 
                ? 'bg-white text-slate-900 shadow-md translate-y-0 border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <Calendar className={`w-4 h-4 ${viewMode === 'gantt' ? 'text-indigo-600' : ''}`} />
            المخطط الزمني (Gantt)
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{orders.filter(o => o.status === 'completed').length} مكتمل</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{orders.filter(o => o.status === 'in_progress').length} نشط</span>
           </div>
           <div className="w-12 h-[1px] bg-slate-200" />
           <span className="uppercase tracking-widest text-slate-400">ERP LIVE TRACKING</span>
        </div>
      </div>

      {viewMode === 'gantt' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 text-right">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 justify-end">
                مخطط وجدولة إنتاج الورشة - Gantt Chart Scheduler
                <Calendar className="w-5 h-5 text-indigo-600" />
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">مخطط زمني تفاعلي لتوزيع الأوامر، الحصص، والمواعيد وتفادي فترات تراكم العمل</p>
            </div>
            {/* Legend indicators */}
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600" dir="rtl">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-400 rounded-full"></span> مخطط (Planned)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> تحت العمل (Running)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> مكتمل وجاهز (Done)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px] border border-slate-100 rounded-xl overflow-hidden">
              {/* Timeline Header Row */}
              <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-150 text-center font-bold text-xs text-slate-600 py-3 pr-2">
                <div className="col-span-3 text-right pr-4">كود الأمر والمنتج النهائي المستهدف</div>
                <div className="col-span-9 grid grid-cols-12 gap-0.5 font-mono text-[11px]">
                  {['06-11', '06-12', '06-13', '06-14', '06-15', '06-16', '06-17', '06-18', '06-19', '06-20', '06-21', '06-22'].map(d => (
                    <div key={d} className="border-r border-slate-200/40 last:border-0 py-0.5">{d.split('-').reverse().join('/')}</div>
                  ))}
                </div>
              </div>

              {/* Rows matching orders */}
              <div className="divide-y divide-slate-100">
                {(filteredOrders || []).map((order, oIdx) => {
                  if (!order) return null;
                  const associatedProduct = getProductDetails(order.productId);
                  const daysList = ['06-11', '06-12', '06-13', '06-14', '06-15', '06-16', '06-17', '06-18', '06-19', '06-20', '06-21', '06-22'];
                  
                  return (
                    <div key={`po-timeline-${order.id ?? oIdx}-${oIdx}`} className="grid grid-cols-12 hover:bg-slate-50/50 items-center py-3 text-xs text-right cursor-pointer transition-colors" onClick={() => handleViewDetails(order)}>
                      <div className="col-span-3 pr-4 space-y-0.5">
                        <div className="flex items-center gap-1.5 justify-start">
                          <span className="font-mono font-bold text-indigo-600 text-xs">{order.orderNumber}</span>
                          {getPriorityBadge(order.priority)}
                        </div>
                        <p className="font-bold text-slate-700 truncate text-[11px]">{associatedProduct ? associatedProduct.name : order.productId}</p>
                        <p className="text-[10px] text-slate-400 font-mono">الكمية: {order.quantity} {associatedProduct ? associatedProduct.unit : 'وحدات'} | التراص: {order.lotNumber || 'غير محدد'}</p>
                      </div>

                      <div className="col-span-9 grid grid-cols-12 gap-0.5 h-10 items-stretch border-r border-slate-100" dir="ltr">
                        {daysList.map((day, dIdx) => {
                          const dayNormalized = `2026-${day}`;
                          const start = order.startDate;
                          const end = order.endDate || order.startDate;
                          
                          const isActive = dayNormalized >= start && dayNormalized <= end;
                          
                          let cellBg = 'bg-slate-50/20';
                          if (isActive) {
                            if (order.status === 'completed') {
                              cellBg = 'bg-emerald-500/85 hover:bg-emerald-600 text-white font-bold';
                            } else if (order.status === 'in_progress') {
                              cellBg = 'bg-amber-400/90 hover:bg-amber-500 text-amber-950 font-bold animate-pulse';
                            } else if (order.status === 'planned') {
                              cellBg = 'bg-sky-400/80 hover:bg-sky-500 text-sky-950 font-bold';
                            } else {
                              cellBg = 'bg-indigo-400/80 hover:bg-indigo-500 text-indigo-950';
                            }
                          }

                          return (
                            <div 
                              key={`po-day-${order.id ?? oIdx}-${day}-${dIdx}`} 
                              className={`flex flex-col items-center justify-center transition-colors border-r border-slate-100/50 relative group ${cellBg} text-[9px]`}
                              title={`${order.orderNumber}: ${day.split('-').reverse().join('/')}`}
                            >
                              {isActive && (
                                <span className="absolute inset-0 flex items-center justify-center font-mono opacity-0 group-hover:opacity-100 bg-black/75 text-white text-[8px] z-10 px-1 rounded">
                                  {order.progress}%
                                </span>
                              )}
                              {isActive && <div className="h-1.5 w-1.5 bg-white/70 rounded-full animate-bounce" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">لا يوجد أوامر إنتاج مجدولة.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm shadow-slate-200/20 translate-y-0 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-700">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/50 text-slate-400 font-black border-b border-slate-100 uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="p-6">تعريف أمر الإنتاج</th>
                  <th className="p-6">المنتج والوصفة (BOM)</th>
                  <th className="p-6 text-center">الكمية</th>
                  <th className="p-6">الأولوية والجدولة</th>
                  <th className="p-6">خط التشغيل / المشرف</th>
                  <th className="p-6">حالة المسار الميداني</th>
                  <th className="p-6">تقدم التنفيذ</th>
                  <th className="p-6 text-center">الأدوات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(filteredOrders || []).map((order, index) => {
                  if (!order) return null;
                  const associatedProduct = getProductDetails(order.productId);
                  const associatedWC = Array.isArray(workCenters) ? workCenters.find(w => w && (w.code === order.workCenterId || w.id === order.workCenterId)) : null;
                  const linkedBom = Array.isArray(boms) ? boms.find(b => b && b.id === order.bomId) : null;

                  return (
                    <motion.tr 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      key={order.id} 
                      className="hover:bg-slate-50/50 cursor-default transition-colors group"
                      onClick={() => handleViewDetails(order)}
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-500 group-hover:scale-110 ${
                            order.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                            order.status === 'in_progress' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                            'bg-indigo-50 text-indigo-600'
                          }`}>
                            <Activity className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Order Ref</span>
                            <span className="font-black text-indigo-600 font-mono text-base">{order.orderNumber}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="space-y-1.5">
                          <h4 className="font-black text-slate-900 text-sm">{associatedProduct ? associatedProduct.name : 'منتج غير معروف'}</h4>
                          <div className="flex items-center gap-2">
                             <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 border border-slate-200 uppercase tracking-tighter">
                                <Tag className="w-2.5 h-2.5" />
                                {associatedProduct?.code || order.productId}
                             </div>
                             <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 rounded text-[9px] font-black text-indigo-600 border border-indigo-100">
                                <Layers className="w-2.5 h-2.5" />
                                {linkedBom ? linkedBom.name : 'Master BOM'}
                             </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex flex-col items-center">
                           <span className="text-xl font-black text-slate-900 font-mono leading-none">{order.quantity}</span>
                           <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{associatedProduct?.unit || 'Units'}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="space-y-2">
                           <div className="flex justify-start">{getPriorityBadge(order.priority)}</div>
                           <div className="flex items-center gap-2 text-slate-400">
                              <Calendar className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-bold font-mono tracking-tighter">{order.startDate} <ArrowRight className="w-3 h-3 inline mx-0.5" /> {order.endDate || '...'}</span>
                           </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 border border-rose-100">
                               <Zap className="w-3 h-3" />
                            </div>
                            <span className="font-black text-slate-800 text-xs">{associatedWC ? associatedWC.name : 'General Line'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                             <User className="w-3.5 h-3.5" />
                             <span className="text-[11px] font-bold">{order.supervisor || 'غير محدد'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="p-6">
                        <div className="w-32 space-y-2" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-between items-end">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</span>
                             <span className="text-xs font-black text-slate-900 font-mono">{order.progress}%</span>
                          </div>
                          <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden border border-white shadow-inner">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${order.progress}%` }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                order.status === 'completed' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-indigo-600 shadow-sm shadow-indigo-500/50'
                              }`} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleViewDetails(order); }}
                          className="p-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-800"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-24 text-slate-500 font-bold bg-slate-50/20">
                       <AlertCircle className="w-20 h-20 mx-auto text-slate-200 mb-4" />
                       <h3 className="text-xl font-black text-slate-400 tracking-tight">لا توجد أوامر إنتاج مطابقة</h3>
                       <p className="text-slate-300 font-medium mt-1">جرب تعديل كلمات البحث لمشاهدة السجلات</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] w-full max-w-5xl shadow-2xl shadow-indigo-500/10 overflow-hidden relative border border-slate-200"
            >
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

              <div className="p-8 md:p-12 border-b border-slate-100 flex justify-between items-center bg-white relative z-10">
                <div className="flex items-center gap-6 text-right">
                  <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl rotate-6">
                    <Package className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">معالج إنشاء أوامر الإنتاج الذكي</h2>
                    <p className="text-slate-500 font-bold mt-1.5 flex items-center gap-2 text-sm leading-relaxed">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      توليد سجل إنتاج متكامل مع ربط آلي للمخازن والمواد الخام
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 group"
                >
                  <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                </button>
              </div>

              <form onSubmit={handleAddOrderSubmit} className="p-8 md:p-12 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar relative z-10">
                
                {/* Section 1: Identification & Core Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  <div className="md:col-span-4 space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pr-1">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      رقم الأمر التسلسلي
                    </label>
                    <div className="relative group">
                      <input 
                        required
                        type="text" 
                        value={newOrder.orderNumber}
                        readOnly
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-indigo-700 text-center tracking-widest text-lg" 
                        dir="ltr"
                      />
                      <div className="absolute inset-y-2 right-2 px-3 bg-white border border-slate-200 rounded-xl flex items-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                         Auto ID
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-4 space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pr-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      أولوية التشغيل
                    </label>
                    <select 
                      value={newOrder.priority}
                      onChange={e => setNewOrder({...newOrder, priority: e.target.value as ProductionOrder['priority']})}
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-700"
                    >
                      <option value="normal">عادية (Normal)</option>
                      <option value="high">أولوية قصوى (High)</option>
                      <option value="low">منخفضة (Low)</option>
                    </select>
                  </div>

                  <div className="md:col-span-4 space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pr-1">
                      <FileText className="w-3.5 h-3.5 text-sky-500" />
                      المرجع (SO/REF)
                    </label>
                    <input 
                      type="text" 
                      placeholder="رقم طلب المبيعات الملحق..."
                      value={newOrder.salesReference}
                      onChange={e => setNewOrder({...newOrder, salesReference: e.target.value})}
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 text-sm"
                    />
                  </div>
                </div>

                {/* Section 2: Product Selection - The Heart of the Order */}
                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[2.5rem] p-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <Layers className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">إسناد المنتج والوصفة الفنية</h3>
                    </div>
                    <span className="px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                       Module 1: Product Definition
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 pr-1 tracking-widest uppercase">Quick Search Filter</label>
                       <div className="relative group">
                          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                          <input 
                            type="text"
                            placeholder="ابحث بكتابة اسم المنتج أو كود التصفية..."
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 text-sm italic"
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-400 pr-1 tracking-widest uppercase">Target Finished Product</label>
                       <select
                        required
                        value={newOrder.productId}
                        onChange={e => {
                          const selectedProdCode = e.target.value;
                          const matchingBOM = boms.find(b => b.productId === selectedProdCode);
                          setNewOrder(prev => ({
                            ...prev,
                            productId: selectedProdCode,
                            bomId: matchingBOM ? matchingBOM.id : ''
                          }));
                        }}
                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-indigo-900"
                      >
                        <option value="">-- اختر المنتج من القائمة --</option>
                        {modalFilteredProducts.map(p => (
                          <option key={p.id} value={p.code}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  {modalFilteredProducts.length === 0 && (
                    <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                       <AlertCircle className="w-5 h-5 text-rose-500" />
                       <p className="text-xs font-bold text-rose-600">لا توجد منتجات مطابقة في قاعدة البيانات لإدارة التصنيع.</p>
                    </div>
                  )}
                </div>

                {/* Section 3: Logistics & Timeframes */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Target Quantity</label>
                    <div className="relative">
                       <input 
                        required
                        type="number" 
                        min="1"
                        value={newOrder.quantity}
                        onChange={e => setNewOrder({...newOrder, quantity: parseInt(e.target.value) || 1})}
                        className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-900 text-lg" 
                        dir="ltr"
                      />
                      <div className="absolute inset-y-2 left-2 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center text-[10px] font-black text-slate-400">
                         PCS
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Production BOM</label>
                    <select 
                      value={newOrder.bomId}
                      onChange={e => setNewOrder({...newOrder, bomId: e.target.value})}
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-700 text-sm"
                    >
                      <option value="">Manual Build</option>
                      {boms.filter(b => b.productId === newOrder.productId).map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.version})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Start Date</label>
                    <input 
                      required
                      type="date" 
                      value={newOrder.startDate}
                      onChange={e => setNewOrder({...newOrder, startDate: e.target.value})}
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-700 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Deadline Date</label>
                    <input 
                      required
                      type="date" 
                      value={newOrder.endDate}
                      onChange={e => setNewOrder({...newOrder, endDate: e.target.value})}
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-700 text-sm"
                    />
                  </div>
                </div>

                {/* Section 4: Operational Assignment */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Assigned Work Center</label>
                    <select 
                      value={newOrder.workCenterId}
                      onChange={e => setNewOrder({...newOrder, workCenterId: e.target.value})}
                      className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-700 text-sm"
                    >
                      <option value="">-- اختر مركز التشغيل --</option>
                      {workCenters.map(wc => (
                        <option key={wc.id} value={wc.code || wc.id}>
                          {wc.name} ({wc.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Field Supervisor</label>
                    <div className="relative group">
                       <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <input 
                        type="text" 
                        value={newOrder.supervisor}
                        placeholder="اسم المهندس المسؤول..."
                        onChange={e => setNewOrder({...newOrder, supervisor: e.target.value})}
                        className="w-full pr-12 pl-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Initial Hub Status</label>
                    <select 
                      value={newOrder.status}
                      onChange={e => {
                        const st = e.target.value as ProductionOrder['status'];
                        setNewOrder({...newOrder, status: st, progress: st === 'completed' ? 100 : 0});
                      }}
                      className="w-full px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 outline-none font-black text-white text-sm"
                    >
                      <option value="planned">مخطط وجدول (Planned)</option>
                      <option value="released">مطلق للتنفيذ (Released)</option>
                      <option value="in_progress">قيد العمل (In Progress)</option>
                      <option value="draft">مسودة (Draft)</option>
                    </select>
                  </div>
                </div>

                {/* Section 5: Extra Notes */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest pr-1">Production Guidelines & Notes</label>
                  <textarea 
                    rows={4}
                    placeholder="اكتب أي تعليمات خاصة لمشغل خط الإنتاج أو شروط الجودة المطلوبة..."
                    value={newOrder.notes}
                    onChange={e => setNewOrder({...newOrder, notes: e.target.value})}
                    className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 text-sm leading-relaxed"
                  />
                </div>

                {/* Footer Actions */}
                <div className="pt-10 flex flex-col sm:flex-row gap-4 border-t border-slate-100">
                  <button 
                    type="submit" 
                    className="flex-1 px-10 py-5 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl font-black text-base shadow-2xl shadow-indigo-600/20 transition-all cursor-pointer active:scale-95 group flex items-center justify-center gap-3"
                  >
                    🚀 اعتماد وحفظ أمر الإنتاج في الدفاتر الإدارية
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-10 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-base hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    إلغاء الإجراء
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC COMPONENT BREAKDOWN & ROUTING DETAILS DRAWER/MODAL */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    تفاصيل كرت العمل لأمر الإنتاج: {selectedOrder.orderNumber}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">عرض خلاصة الخامات، نسب الهالك الافتراضية، ومسار الحركة الفعلية</p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 border rounded-xl bg-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-right">
              
              {/* Core Information Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/50">
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">المنتج المستهدف</span>
                  <span className="font-extrabold text-slate-800">
                    {(() => {
                      const prod = getProductDetails(selectedOrder.productId);
                      return prod ? `${prod.name} (${prod.code})` : selectedOrder.productId;
                    })()}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">الكمية المستهدفة</span>
                  <span className="font-extrabold text-slate-800 text-base font-mono">
                    {selectedOrder.quantity}{' '}
                    {(() => {
                      const prod = getProductDetails(selectedOrder.productId);
                      return prod ? prod.unit : 'وحدات';
                    })()}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">فترة الجدولة</span>
                  <span className="text-xs text-slate-700 font-mono">
                    من: <strong className="text-slate-800">{selectedOrder.startDate}</strong>
                    <br />
                    إلي: <strong className="text-slate-800">{selectedOrder.endDate || '-'}</strong>
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">المشرف المسؤول</span>
                  <span className="font-extrabold text-slate-800">{selectedOrder.supervisor || 'غير معين'}</span>
                </div>
              </div>

              {/* WAREHOUSE BINDING INTEGRATION CARD */}
              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4">
                <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center border-b border-slate-200 pb-2 gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Warehouse className="w-5 h-5 text-indigo-600 animate-pulse" />
                      ربط وتخصيص مستودعات الجرد (Warehouse Inventory Linkage)
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">حدد مستودعات سحب الخامات وإيداع المنتجات الجاهزة لربطها بمديول المخازن تلقائياً</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100/50">ربط مؤتمت نشط</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                  {/* Raw Material Warehouse */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      مستودع سحب المواد الخام والمكونات:
                    </label>
                    <select
                      value={selectedRawWarehouse || ''}
                      onChange={e => setSelectedRawWarehouse(parseInt(e.target.value) || null)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-xs"
                    >
                      {dbWarehouses.map((wh: any, idx: number) => (<option key={`wh-pom-${wh.id || idx}-${idx}`} value={wh.id}>
                          📦 {wh.name} {wh.is_main === 1 ? '(رئيسي)' : ''}
                        </option>
                      ))}
                      {dbWarehouses.length === 0 && <option value="">جاري تحميل المستودعات...</option>}
                    </select>
                  </div>

                  {/* Finished Goods Warehouse */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      مستودع إيداع المنتجات تامة الصنع:
                    </label>
                    <select
                      value={selectedFinishedWarehouse || ''}
                      onChange={e => setSelectedFinishedWarehouse(parseInt(e.target.value) || null)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-xs"
                    >
                      {dbWarehouses.map((wh: any, idx: number) => (<option key={`wh-pom-${wh.id || idx}-${idx}`} value={wh.id}>
                          🏢 {wh.name} {wh.is_main === 1 ? '(رئيسي)' : ''}
                        </option>
                      ))}
                      {dbWarehouses.length === 0 && <option value="">جاري تحميل المستودعات...</option>}
                    </select>
                  </div>
                </div>
              </div>

              {/* Status Update Quick Bar */}
              <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h4 className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                    <Settings className="w-4 h-4 animate-spin" />
                    تحديث مسار الإنتاج وقفل الكرت
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">يمكنك نقل حالة الأمر بناءً على التقدم الفعلي لعمالية الورش</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'in_progress', 30)}
                    disabled={selectedOrder.status === 'in_progress'}
                    className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-40 transition-opacity"
                  >
                    بدء العمل التشغيلي (30%)
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'completed', 100)}
                    disabled={selectedOrder.status === 'completed'}
                    className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-40 transition-opacity flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    إكمال واستلام (100%)
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled', 0)}
                    disabled={selectedOrder.status === 'cancelled'}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold disabled:opacity-40 transition-opacity"
                  >
                    إلغاء الأمر
                  </button>
                </div>
              </div>

              {/* DYNAMIC REAL-TIME RAW MATERIALS BREAKDOWN (Peak Integration Core) */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-indigo-700">
                    <Layers className="w-5 h-5" />
                    تحديد متطلبات المواد الخام الإنشائية الفعلية (Dynamic Components Breakdown)
                  </h3>
                  <span className="text-xs text-slate-400">
                    محسوبة بناءً على الكمية: <strong className="text-indigo-600 text-sm font-mono">{selectedOrder.quantity}</strong>
                  </span>
                </div>

                {(() => {
                  const linkedBom = boms.find(b => b.id === selectedOrder.bomId) || boms[0]; // fallback
                  if (!linkedBom) return (
                    <p className="text-xs text-center py-4 text-slate-400 font-bold bg-slate-50 rounded-xl">
                      لا توجد وصفة (BOM) معرفة لتفكيك خامات هذا الموديل. قم بتعريف الخبز والصناعة بمديول الوصفات لتشبيك الاحتياجات الفورية.
                    </p>
                  );

                  return (
                    <div className="space-y-4">
                      <div className="bg-amber-500/10 text-amber-900 text-xs p-3 rounded-xl border border-amber-200/50 flex justify-between">
                        <span>الوصفة المتبعة: <strong>{linkedBom.name} ({linkedBom.version})</strong></span>
                        <span>نسبة الهالك الإضافية المجدولة بالوصفة: <strong className="text-amber-700">{linkedBom.scrapPercentage}%</strong></span>
                      </div>

                      <div className="border rounded-xl font-sans overflow-hidden">
                        <table className="w-full text-sm text-right">
                          <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b">
                            <tr>
                              <th className="px-4 py-2.5 font-bold">كود الخام</th>
                              <th className="px-4 py-2.5 font-bold">اسم المادة الخام</th>
                              <th className="px-4 py-2.5 text-center font-bold">الكمية لكل وحدة</th>
                              <th className="px-4 py-2.5 text-center bg-indigo-50/40 font-bold">الصافي الإجمالي المطلوب</th>
                              <th className="px-4 py-2.5 text-center text-amber-700 font-bold bg-amber-50/20">شامل الهالك المقدر {linkedBom.scrapPercentage}%</th>
                              <th className="px-4 py-2.5 text-center font-bold">وحدة القياس</th>
                              <th className="px-4 py-2.5 text-center font-bold bg-indigo-50/20 text-indigo-900">حالة الرصيد (الربط المخزني)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-xs font-medium">
                            {linkedBom.items && linkedBom.items.map((item, id) => {
                              const prodObj = getProductDetails(item.materialId);
                              const totalNet = item.quantity * selectedOrder.quantity;
                              const withScrap = Math.ceil(totalNet * (1 + (linkedBom.scrapPercentage / 100)) * 100) / 100;

                              // Live Matching Ingredient Check
                              const matchedIng = dbIngredients.find(
                                ing => ing.name === prodObj?.name || ing.item_code === item.materialId || ing.name === item.materialId
                              );
                              const currentStockQty = matchedIng ? (warehouseStock[matchedIng.id] || 0) : null;

                              let stockBadge = null;
                              if (currentStockQty === null) {
                                stockBadge = <span className="text-slate-400 italic text-[11px]">غير مسجل بالمستودع</span>;
                              } else if (currentStockQty >= withScrap) {
                                stockBadge = (
                                  <span className="inline-flex bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full text-[11px] font-bold items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    متوفر: {currentStockQty}
                                  </span>
                                );
                              } else {
                                stockBadge = (
                                  <span className="inline-flex bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 rounded-full text-[11px] font-bold items-center gap-1 animate-pulse">
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    عجز: {Math.max(0, withScrap - currentStockQty).toFixed(1)} (متوفر: {currentStockQty})
                                  </span>
                                );
                              }

                              return (
                                <tr key={id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-mono text-slate-500">{item.materialId}</td>
                                  <td className="px-4 py-3 font-bold text-slate-800">{prodObj ? prodObj.name : 'قطعة خام أساسية'}</td>
                                  <td className="px-4 py-3 text-center text-slate-500 font-mono">{item.quantity}</td>
                                  <td className="px-4 py-3 text-center font-bold text-indigo-700 font-mono bg-indigo-50/10 text-sm">{totalNet}</td>
                                  <td className="px-4 py-3 text-center font-bold text-amber-700 font-mono bg-amber-50/10 text-sm">{withScrap}</td>
                                  <td className="px-4 py-3 text-center text-slate-600">{prodObj ? prodObj.unit : 'وحدة'}</td>
                                  <td className="px-4 py-3 text-center font-bold bg-slate-50/30">{stockBadge}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Linked routing checklist stages */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b pb-3 text-rose-700">
                  <Award className="w-5 h-5" />
                  مراحل ومسار التوجيه للإنتاج الأرضي والماكينات (Routing Operations checklist)
                </h3>

                {(() => {
                  const linkedBom = boms.find(b => b.id === selectedOrder.bomId) || boms[0]; // fallback
                  if (!linkedBom || !linkedBom.routings || linkedBom.routings.length === 0) return (
                    <p className="text-xs text-center py-3 text-slate-400 italic">لا توجد مراحل توجيه مسجلة لهذا المسار.</p>
                  );

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {linkedBom.routings.map((routing, index) => {
                        const targetWC = workCenters.find(w => (w.code === routing.workCenterId || w.id === routing.workCenterId));
                        const totalUnitTimes = (routing.setupTime + routing.runTime) * selectedOrder.quantity;
                        return (
                          <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="flex justify-between items-center mb-2">
                              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                                خطوة تتابعية رقم {routing.opNumber}
                              </span>
                              <span className="text-xs text-slate-400 font-bold">زيت التشغيل الكلي: {totalUnitTimes} د</span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 mb-1">{routing.description}</h4>
                            <p className="text-[10px] text-slate-500 mt-2">
                              مركز العمل: <strong>{targetWC ? targetWC.name : routing.workCenterId}</strong> | تكلفة الجهد للوردية: {targetWC ? (totalUnitTimes * (targetWC.costPerHour / 60)).toFixed(2) : 0} ج.م
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Notes Context */}
              {selectedOrder.notes && (
                <div className="p-4 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200/55 flex gap-2">
                  <FileText className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <strong className="block mb-1">تعليمات وتوصيات خاصة:</strong>
                    <span>{selectedOrder.notes}</span>
                  </div>
                </div>
              )}

            </div>

            {/* Footer and deletion */}
            <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
              <button 
                onClick={(e) => handleDeleteOrder(selectedOrder.id, e)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                حذف وإلغاء كرت العمل
              </button>
              
              <button 
                onClick={() => setIsDetailOpen(false)} 
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                إغلاق وتاكيد
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
