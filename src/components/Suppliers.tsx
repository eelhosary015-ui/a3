import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  XCircle,
  FileText,
  DollarSign,
  Search,
  Eye,
  Phone,
  MapPin,
  Mail,
  Building,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Star,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Receipt,
  RotateCcw,
  UserCheck,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";
import { api, authFetch } from "../utils/api";
import { SupplierAdvancedPanel } from "./SupplierAdvancedPanel";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════
interface Supplier {
  id: number;
  supplier_code?: string | null;
  name: string;
  name_en?: string | null;
  currency?: string;
  contact_person?: string | null;
  phone: string | null;
  phone_2: string | null;
  email: string | null;
  address: string | null;
  commercial_register: string | null;
  tax_number: string | null;
  group_name: string | null;
  payment_terms: string;
  credit_limit: number;
  balance: number;
  opening_balance: number;
  rating: number;
  notes: string | null;
  status: string;
  created_at: string;
  total_purchases?: number;
  total_paid?: number;
  total_payments?: number;
  total_returns?: number;
  purchase_count?: number;
}

interface SupplierTransaction {
  id: number;
  supplier_id: number;
  type: string;
  amount: number;
  notes: string | null;
  timestamp: string;
  reference_id: number | null;
  effect?: number;
  running_balance?: number;
}

interface DashboardStats {
  active_suppliers: number;
  total_suppliers: number;
  total_payable: number;
  purchases_30d: number;
  payments_30d: number;
  pending_orders: number;
  overdue_payable?: number;
}

interface SupplierProps {
  onBack: () => void;
}

type TabType = "list" | "detail" | "statement";
type PaymentTerms = "cash" | "credit_30" | "credit_60" | "credit_90";

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit_30: "آجل 30 يوم",
  credit_60: "آجل 60 يوم",
  credit_90: "آجل 90 يوم",
};

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  inactive: "متوقف",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-rose-100 text-rose-700",
};

const TX_TYPE_LABELS: Record<string, string> = {
  purchase: "شراء",
  payment: "سداد",
  return: "مرتجع",
  adjustment: "تسوية",
};

const TX_TYPE_COLORS: Record<string, string> = {
  purchase: "text-rose-600 bg-rose-50",
  payment: "text-emerald-600 bg-emerald-50",
  return: "text-blue-600 bg-blue-50",
  adjustment: "text-amber-600 bg-amber-50",
};

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
export function Suppliers({ onBack }: SupplierProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("list");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Form data
  const emptyForm = {
    name: "",
    phone: "",
    phone_2: "",
    email: "",
    address: "",
    commercial_register: "",
    tax_number: "",
    group_name: "",
    payment_terms: "cash" as PaymentTerms,
    credit_limit: "",
    opening_balance: "",
    notes: "",
    status: "active" as string,
  };

  const [formData, setFormData] = useState(emptyForm);
  const [formDocType, setFormDocType] = useState("بطاقة المورد");
  const [formDocNumber, setFormDocNumber] = useState("");
  const [formDocIssueDate, setFormDocIssueDate] = useState("");
  const [formDocExpiryDate, setFormDocExpiryDate] = useState("");
  const [formDocNotes, setFormDocNotes] = useState("");
  const [formDocFile, setFormDocFile] = useState<File | null>(null);
  const [uploadingFormDoc, setUploadingFormDoc] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
  });

  // ═══════════════════════════════════════
  // Data Fetching
  // ═══════════════════════════════════════
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterGroup !== "all") params.set("group", filterGroup);
      const res = await api.get(`/api/suppliers?${params.toString()}`);
      const data = await res.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch suppliers", error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterStatus, filterGroup]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get("/api/suppliers-dashboard");
      const data = await res.json();
      if (data.stats) setDashboard(data.stats);
    } catch (error) {
      console.error("Failed to fetch dashboard", error);
    }
  }, []);

  const fetchSupplierDetail = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/api/suppliers/${id}`);
      const data = await res.json();
      setSelectedSupplier(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch supplier detail", error);
      return null;
    }
  }, []);

  const fetchTransactions = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/api/suppliers/${id}/transactions?limit=100`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
      setTransactions([]);
    }
  }, []);

  const fetchStatement = useCallback(async (id: number) => {
    try {
      const res = await api.get(`/api/suppliers/${id}/statement`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch statement", error);
      setTransactions([]);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ═══════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════
  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setFormData(emptyForm);
    resetFormDocument();
    setShowFormModal(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      phone_2: supplier.phone_2 || "",
      email: supplier.email || "",
      address: supplier.address || "",
      commercial_register: supplier.commercial_register || "",
      tax_number: supplier.tax_number || "",
      group_name: supplier.group_name || "",
      payment_terms: (supplier.payment_terms as PaymentTerms) || "cash",
      credit_limit: String(supplier.credit_limit || ""),
      opening_balance: String(supplier.opening_balance || ""),
      notes: supplier.notes || "",
      status: supplier.status || "active",
    });
    setSelectedSupplier(supplier);
    resetFormDocument();
    setShowFormModal(true);
  };

  const resetFormDocument = () => {
    setFormDocType("بطاقة المورد");
    setFormDocNumber("");
    setFormDocIssueDate("");
    setFormDocExpiryDate("");
    setFormDocNotes("");
    setFormDocFile(null);
  };

  const uploadFormDocument = async (supplierId:number) => {
    if (!formDocFile) return true;
    if (formDocFile.size > 15 * 1024 * 1024) {
      throw new Error("حجم المستند يجب ألا يتجاوز 15MB");
    }
    const fd = new FormData();
    fd.append("file", formDocFile);
    fd.append("document_type", formDocType);
    if (formDocNumber) fd.append("document_number", formDocNumber);
    if (formDocIssueDate) fd.append("issue_date", formDocIssueDate);
    if (formDocExpiryDate) fd.append("expiry_date", formDocExpiryDate);
    if (formDocNotes) fd.append("notes", formDocNotes);
    const r = await authFetch(`/api/suppliers/${supplierId}/documents`, { method: "POST", body: fd });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || "فشل رفع المستند");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingFormDoc) return;
    try {
      setUploadingFormDoc(true);
      const body = {
        ...formData,
        credit_limit: Number(formData.credit_limit) || 0,
        opening_balance: Number(formData.opening_balance) || 0,
      };
      const isEdit = !!selectedSupplier;
      const url = isEdit ? `/api/suppliers/${selectedSupplier!.id}` : "/api/suppliers";
      const res = isEdit ? await api.put(url, body) : await api.post(url, body);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "فشل حفظ بيانات المورد");
        return;
      }

      const supplierId = Number(data.id || selectedSupplier?.id);
      if (formDocFile && supplierId) {
        try {
          await uploadFormDocument(supplierId);
        } catch (docError:any) {
          alert(`تم حفظ المورد بنجاح، لكن تعذر حفظ المستند: ${docError.message || "خطأ غير معروف"}`);
          await fetchSupplierDetail(supplierId);
          setShowFormModal(false);
          setSelectedSupplier(null);
          resetFormDocument();
          fetchSuppliers();
          fetchDashboard();
          return;
        }
      }

      setShowFormModal(false);
      setSelectedSupplier(null);
      resetFormDocument();
      fetchSuppliers();
      fetchDashboard();
    } catch (error:any) {
      alert(error?.message || "فشل حفظ بيانات المورد");
    } finally {
      setUploadingFormDoc(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`هل أنت متأكد من حذف المورد "${supplier.name}"؟`)) return;
    try {
      const res = await api.delete(`/api/suppliers/${supplier.id}`);
      if (res.ok) {
        fetchSuppliers();
        fetchDashboard();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "فشل حذف المورد");
      }
    } catch (error) {
      alert("فشل حذف المورد");
    }
  };

  const handleOpenPayment = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setPaymentData({ amount: "", payment_method: "cash", notes: "" });
    setShowPaymentModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    try {
      const res = await api.post(
        `/api/suppliers/${selectedSupplier.id}/payments`,
        {
          amount: Number(paymentData.amount),
          payment_method: paymentData.payment_method,
          notes: paymentData.notes,
        }
      );
      if (res.ok) {
        setShowPaymentModal(false);
        fetchSuppliers();
        fetchDashboard();
        if (activeTab === "detail" || activeTab === "statement") {
          fetchSupplierDetail(selectedSupplier.id);
          fetchTransactions(selectedSupplier.id);
        }
      } else {
        alert("فشل تسجيل الدفعة");
      }
    } catch (error) {
      alert("فشل تسجيل الدفعة");
    }
  };

  const handleViewDetail = async (supplier: Supplier) => {
    await fetchSupplierDetail(supplier.id);
    await fetchTransactions(supplier.id);
    setActiveTab("detail");
  };

  const handleViewStatement = async (supplier: Supplier) => {
    await fetchSupplierDetail(supplier.id);
    await fetchStatement(supplier.id);
    setActiveTab("statement");
  };

  const handleBackToList = () => {
    setActiveTab("list");
    setSelectedSupplier(null);
    setTransactions([]);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  // ═══════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════
  const supplierGroups = useMemo(() => {
    const groups = new Set<string>();
    suppliers.forEach((s) => {
      if (s.group_name) groups.add(s.group_name);
    });
    return Array.from(groups);
  }, [suppliers]);

  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "", "ar");
          break;
        case "balance":
          cmp = (a.balance || 0) - (b.balance || 0);
          break;
        case "total_purchases":
          cmp = (a.total_purchases || 0) - (b.total_purchases || 0);
          break;
        case "created_at":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        default:
          cmp = 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [suppliers, sortBy, sortDir]);

  // ═══════════════════════════════════════
  // Render Helpers
  // ═══════════════════════════════════════
  const formatCurrency = (val: number | null | undefined) =>
    ((val || 0) as number).toLocaleString("ar-EG", {
      maximumFractionDigits: 2,
    });

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-orange-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-orange-500" />
    );
  };

  // ═══════════════════════════════════════
  // Dashboard Cards
  // ═══════════════════════════════════════
  const renderDashboardCards = () => {
    if (!dashboard) return null;
    const cards = [
      {
        label: "إجمالي الموردين",
        value: dashboard.total_suppliers || 0,
        sub: `${dashboard.active_suppliers || 0} نشط`,
        icon: <Truck className="w-6 h-6" />,
        color: "from-blue-500 to-blue-600",
        bgLight: "bg-blue-50",
        textColor: "text-blue-600",
      },
      {
        label: "إجمالي المستحقات",
        value: `${formatCurrency(dashboard.total_payable)} ج.م`,
        sub: "رصيد الموردين الحالي",
        icon: <CreditCard className="w-6 h-6" />,
        color: "from-rose-500 to-rose-600",
        bgLight: "bg-rose-50",
        textColor: "text-rose-600",
      },
      {
        label: "مشتريات 30 يوم",
        value: `${formatCurrency(dashboard.purchases_30d)} ج.م`,
        sub: "إجمالي المشتريات الأخيرة",
        icon: <TrendingUp className="w-6 h-6" />,
        color: "from-amber-500 to-amber-600",
        bgLight: "bg-amber-50",
        textColor: "text-amber-600",
      },
      {
        label: "مدفوعات 30 يوم",
        value: `${formatCurrency(dashboard.payments_30d)} ج.م`,
        sub: "إجمالي المدفوعات",
        icon: <TrendingDown className="w-6 h-6" />,
        color: "from-emerald-500 to-emerald-600",
        bgLight: "bg-emerald-50",
        textColor: "text-emerald-600",
      },
      {
        label: "مستحقات متأخرة",
        value: `${formatCurrency(dashboard.overdue_payable)} ج.م`,
        sub: "فواتير تجاوزت تاريخ الاستحقاق",
        icon: <AlertCircle className="w-6 h-6" />,
        color: "from-orange-500 to-orange-600",
        bgLight: "bg-orange-50",
        textColor: "text-orange-600",
      },
      {
        label: "أوامر شراء معلقة",
        value: dashboard.pending_orders || 0,
        sub: "بانتظار الاستلام",
        icon: <Clock className="w-6 h-6" />,
        color: "from-purple-500 to-purple-600",
        bgLight: "bg-purple-50",
        textColor: "text-purple-600",
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {cards.map((card, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {card.label}
              </span>
              <div className={`p-2 rounded-xl ${card.bgLight} ${card.textColor}`}>
                {card.icon}
              </div>
            </div>
            <p className="text-xl font-black text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Supplier List View
  // ═══════════════════════════════════════
  const renderListView = () => (
    <>
      {renderDashboardCards()}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف أو الرقم الضريبي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">متوقف</option>
          </select>

          {supplierGroups.length > 0 && (
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">كل المجموعات</option>
              {supplierGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}

          <span className="text-xs text-slate-400 mr-auto">
            {sortedSuppliers.length} مورد
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th
                  className="p-3 px-4 font-bold text-slate-600 cursor-pointer hover:text-orange-600 text-sm"
                  onClick={() => handleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    المورد <SortIcon field="name" />
                  </span>
                </th>
                <th className="p-3 px-4 font-bold text-slate-600 text-sm hidden lg:table-cell">
                  الهاتف
                </th>
                <th className="p-3 px-4 font-bold text-slate-600 text-sm hidden md:table-cell">
                  المجموعة
                </th>
                <th className="p-3 px-4 font-bold text-slate-600 text-sm hidden xl:table-cell">
                  شروط الدفع
                </th>
                <th
                  className="p-3 px-4 font-bold text-slate-600 cursor-pointer hover:text-orange-600 text-sm"
                  onClick={() => handleSort("balance")}
                >
                  <span className="inline-flex items-center gap-1">
                    الرصيد <SortIcon field="balance" />
                  </span>
                </th>
                <th
                  className="p-3 px-4 font-bold text-slate-600 cursor-pointer hover:text-orange-600 text-sm hidden lg:table-cell"
                  onClick={() => handleSort("total_purchases")}
                >
                  <span className="inline-flex items-center gap-1">
                    إجمالي المشتريات <SortIcon field="total_purchases" />
                  </span>
                </th>
                <th className="p-3 px-4 font-bold text-slate-600 text-sm">
                  الحالة
                </th>
                <th className="p-3 px-4 font-bold text-slate-600 text-sm">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-12 text-center text-slate-400"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      جاري التحميل...
                    </div>
                  </td>
                </tr>
              ) : sortedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-slate-100 rounded-2xl">
                        <Truck className="w-10 h-10 text-slate-300" />
                      </div>
                      <p className="text-slate-400 font-bold">
                        {searchQuery || filterStatus !== "all"
                          ? "لا توجد نتائج مطابقة"
                          : "لا يوجد موردين بعد"}
                      </p>
                      {!searchQuery && filterStatus === "all" && (
                        <button
                          onClick={handleOpenCreate}
                          className="text-sm text-orange-500 hover:text-orange-600 font-bold"
                        >
                          إضافة أول مورد
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="hover:bg-orange-50/30 transition-colors"
                  >
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                          {supplier.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">
                            {supplier.name}
                          </p>
                          {supplier.tax_number && (
                            <p className="text-[11px] text-slate-400">
                              ض.ر: {supplier.tax_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-sm text-slate-600 hidden lg:table-cell">
                      {supplier.phone || "-"}
                    </td>
                    <td className="p-3 px-4 text-sm text-slate-500 hidden md:table-cell">
                      {supplier.group_name ? (
                        <span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold">
                          {supplier.group_name}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 px-4 text-sm text-slate-500 hidden xl:table-cell">
                      {PAYMENT_TERMS_LABELS[supplier.payment_terms] || supplier.payment_terms}
                    </td>
                    <td className="p-3 px-4">
                      <span
                        className={`font-bold text-sm ${(supplier.balance || 0) > 0 ? "text-rose-600" : (supplier.balance || 0) < 0 ? "text-blue-600" : "text-slate-500"}`}
                      >
                        {formatCurrency(supplier.balance)} ج.م
                      </span>
                    </td>
                    <td className="p-3 px-4 text-sm text-slate-600 font-bold hidden lg:table-cell">
                      {formatCurrency(supplier.total_purchases)} ج.م
                    </td>
                    <td className="p-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[supplier.status] || "bg-slate-100 text-slate-500"}`}
                      >
                        {STATUS_LABELS[supplier.status] || supplier.status}
                      </span>
                    </td>
                    <td className="p-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewDetail(supplier)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewStatement(supplier)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="كشف حساب"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenPayment(supplier)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="تسديد دفعة"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(supplier)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  // ═══════════════════════════════════════
  // Supplier Detail View
  // ═══════════════════════════════════════
  const renderDetailView = () => {
    if (!selectedSupplier) return null;
    const s = selectedSupplier;

    const statCards = [
      {
        label: "الرصيد المستحق",
        value: `${formatCurrency(s.balance)} ج.م`,
        color: (s.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600",
        icon: <CreditCard className="w-5 h-5" />,
        bg: (s.balance || 0) > 0 ? "bg-rose-50" : "bg-emerald-50",
      },
      {
        label: "إجمالي المشتريات",
        value: `${formatCurrency(s.total_purchases)} ج.م`,
        color: "text-blue-600",
        icon: <Package className="w-5 h-5" />,
        bg: "bg-blue-50",
      },
      {
        label: "إجمالي المدفوعات",
        value: `${formatCurrency(s.total_payments)} ج.م`,
        color: "text-emerald-600",
        icon: <TrendingDown className="w-5 h-5" />,
        bg: "bg-emerald-50",
      },
      {
        label: "عدد فواتير الشراء",
        value: s.purchase_count || 0,
        color: "text-purple-600",
        icon: <Receipt className="w-5 h-5" />,
        bg: "bg-purple-50",
      },
    ];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-lg">
                {s.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900">
                  {s.name}
                </h1>
                <div className="text-[11px] text-slate-400 font-bold">كود المورد: {s.supplier_code || `SUP-${String(s.id).padStart(6,"0")}`}</div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {s.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {s.phone}
                    </span>
                  )}
                  {s.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {s.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold ${STATUS_COLORS[s.status]}`}
          >
            {STATUS_LABELS[s.status]}
          </span>
          <button
            onClick={() => handleOpenPayment(s)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-bold text-sm"
          >
            <DollarSign className="w-4 h-4" />
            تسديد دفعة
          </button>
          <button
            onClick={() => handleOpenEdit(s)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-bold text-sm"
          >
            <Pencil className="w-4 h-4" />
            تعديل
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold">
                    {card.label}
                  </p>
                  <p className={`text-lg font-black ${card.color}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SupplierAdvancedPanel supplierId={s.id} />

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Contact Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-orange-500" />
              بيانات المورد
            </h3>
            <div className="space-y-3 text-sm">
              {s.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{s.phone}</span>
                </div>
              )}
              {s.phone_2 && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{s.phone_2}</span>
                </div>
              )}
              {s.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{s.email}</span>
                </div>
              )}
              {s.address && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{s.address}</span>
                </div>
              )}
              {s.commercial_register && (
                <div className="flex items-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>س.ت: {s.commercial_register}</span>
                </div>
              )}
              {s.tax_number && (
                <div className="flex items-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>ض.ر: {s.tax_number}</span>
                </div>
              )}
              {s.group_name && (
                <div className="flex items-center gap-2 text-slate-600">
                  <UserCheck className="w-4 h-4 text-slate-400" />
                  <span>{s.group_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Credit Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-500" />
              بيانات ائتمانية
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">شروط الدفع</span>
                <span className="font-bold text-slate-800">
                  {PAYMENT_TERMS_LABELS[s.payment_terms] || s.payment_terms}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">حد الائتمان</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(s.credit_limit)} ج.م
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">الرصيد الافتتاحي</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(s.opening_balance)} ج.م
                </span>
              </div>
              <div className="h-px bg-slate-100 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-slate-500">المستحق حالياً</span>
                <span
                  className={`font-black text-lg ${(s.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {formatCurrency(s.balance)} ج.م
                </span>
              </div>
              {/* Credit utilization bar */}
              {s.credit_limit > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>نسبة الاستخدام</span>
                    <span>
                      {Math.min(100, Math.round(((s.balance || 0) / s.credit_limit) * 100))}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${((s.balance || 0) / s.credit_limit) > 0.8 ? "bg-rose-500" : ((s.balance || 0) / s.credit_limit) > 0.5 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{
                        width: `${Math.min(100, ((s.balance || 0) / s.credit_limit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-500" />
              معلومات إضافية
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">تاريخ التسجيل</span>
                <span className="font-bold text-slate-800">
                  {formatDate(s.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">إجمالي المرتجعات</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(s.total_returns)} ج.م
                </span>
              </div>
              {s.notes && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">ملاحظات</p>
                  <p className="text-sm text-slate-700">{s.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              آخر الحركات ({transactions.length})
            </h3>
            <button
              onClick={() => handleViewStatement(s)}
              className="text-sm text-orange-500 hover:text-orange-600 font-bold flex items-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4" />
              كشف حساب كامل
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 px-4 font-bold text-slate-600">التاريخ</th>
                  <th className="p-3 px-4 font-bold text-slate-600">النوع</th>
                  <th className="p-3 px-4 font-bold text-slate-600">المبلغ</th>
                  <th className="p-3 px-4 font-bold text-slate-600">ملاحظات</th>
                  <th className="p-3 px-4 font-bold text-slate-600">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      لا توجد حركات
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 20).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-3 px-4 text-slate-600">
                        {formatDate(tx.timestamp)}
                      </td>
                      <td className="p-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-bold ${TX_TYPE_COLORS[tx.type] || "bg-slate-100 text-slate-500"}`}
                        >
                          {TX_TYPE_LABELS[tx.type] || tx.type}
                        </span>
                      </td>
                      <td className="p-3 px-4">
                        <span
                          className={`font-bold ${tx.type === "payment" || tx.type === "return" ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {tx.type === "payment" || tx.type === "return"
                            ? "-"
                            : ""}
                          {formatCurrency(tx.amount)} ج.م
                        </span>
                      </td>
                      <td className="p-3 px-4 text-slate-500 text-xs max-w-[200px] truncate">
                        {tx.notes || "-"}
                      </td>
                      <td className="p-3 px-4 font-bold text-slate-700">
                        {tx.running_balance !== undefined
                          ? `${formatCurrency(tx.running_balance)} ج.م`
                          : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Statement View
  // ═══════════════════════════════════════
  const renderStatementView = () => {
    if (!selectedSupplier) return null;
    const s = selectedSupplier;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-900">
              كشف حساب المورد
            </h1>
            <p className="text-sm text-slate-500">{s.name}</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400">الرصيد الحالي</p>
            <p
              className={`text-2xl font-black ${(s.balance || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {formatCurrency(s.balance)} ج.م
            </p>
          </div>
        </div>

        {/* Statement Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="p-4 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white">
            <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-purple-500" />
              كشف حساب تفصيلي
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-3 px-4 font-bold text-slate-600 w-12">#</th>
                  <th className="p-3 px-4 font-bold text-slate-600">التاريخ</th>
                  <th className="p-3 px-4 font-bold text-slate-600">البيان</th>
                  <th className="p-3 px-4 font-bold text-slate-600">مدين</th>
                  <th className="p-3 px-4 font-bold text-slate-600">دائن</th>
                  <th className="p-3 px-4 font-bold text-slate-600">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-12 text-center text-slate-400"
                    >
                      لا توجد حركات
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => {
                    const isDebit = tx.type === "purchase";
                    const isCredit =
                      tx.type === "payment" || tx.type === "return";
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-3 px-4 text-slate-400 text-xs">
                          {idx + 1}
                        </td>
                        <td className="p-3 px-4 text-slate-600 text-xs">
                          {formatDate(tx.timestamp)}
                        </td>
                        <td className="p-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-bold ${TX_TYPE_COLORS[tx.type] || "bg-slate-100"}`}
                          >
                            {TX_TYPE_LABELS[tx.type] || tx.type}
                          </span>
                          {tx.notes && (
                            <span className="text-xs text-slate-400 mr-2">
                              {tx.notes}
                            </span>
                          )}
                        </td>
                        <td className="p-3 px-4 font-bold text-rose-600">
                          {isDebit ? formatCurrency(tx.amount) : ""}
                        </td>
                        <td className="p-3 px-4 font-bold text-emerald-600">
                          {isCredit ? formatCurrency(tx.amount) : ""}
                        </td>
                        <td className="p-3 px-4 font-bold text-slate-800">
                          {tx.running_balance !== undefined
                            ? formatCurrency(tx.running_balance)
                            : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {transactions.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="p-3 px-4 font-black text-slate-700">
                      الرصيد الختامي
                    </td>
                    <td className="p-3 px-4 font-black text-rose-600">
                      {formatCurrency(
                        transactions
                          .filter((t) => t.type === "purchase")
                          .reduce((s, t) => s + (t.amount || 0), 0)
                      )}
                    </td>
                    <td className="p-3 px-4 font-black text-emerald-600">
                      {formatCurrency(
                        transactions
                          .filter(
                            (t) => t.type === "payment" || t.type === "return"
                          )
                          .reduce((s, t) => s + (t.amount || 0), 0)
                      )}
                    </td>
                    <td className="p-3 px-4 font-black text-slate-900 text-lg">
                      {formatCurrency(s.balance)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Form Modal (Create/Edit)
  // ═══════════════════════════════════════
  const renderFormModal = () => {
    if (!showFormModal) return null;
    const isEdit = !!selectedSupplier;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
            <h2 className="text-lg font-black text-slate-800">
              {isEdit ? "تعديل بيانات مورد" : "إضافة مورد جديد"}
            </h2>
            <button
              onClick={() => setShowFormModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Row 1: Name + Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  اسم المورد *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Row 2: Phone 2 + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  هاتف بديل
                </label>
                <input
                  type="text"
                  value={formData.phone_2}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_2: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Row 3: Address + Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  العنوان
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  مجموعة الموردين
                </label>
                <input
                  type="text"
                  value={formData.group_name}
                  onChange={(e) =>
                    setFormData({ ...formData, group_name: e.target.value })
                  }
                  placeholder="مثال: موردين رئيسيين"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Row 4: CR + Tax */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  السجل التجاري
                </label>
                <input
                  type="text"
                  value={formData.commercial_register}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      commercial_register: e.target.value,
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  الرقم الضريبي
                </label>
                <input
                  type="text"
                  value={formData.tax_number}
                  onChange={(e) =>
                    setFormData({ ...formData, tax_number: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Row 5: Payment Terms + Credit Limit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  شروط الدفع
                </label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      payment_terms: e.target.value as PaymentTerms,
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                >
                  <option value="cash">نقدي</option>
                  <option value="credit_30">آجل 30 يوم</option>
                  <option value="credit_60">آجل 60 يوم</option>
                  <option value="credit_90">آجل 90 يوم</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  حد الائتمان (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) =>
                    setFormData({ ...formData, credit_limit: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  الرصيد الافتتاحي (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      opening_balance: e.target.value,
                    })
                  }
                  disabled={isEdit}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm disabled:opacity-50"
                />
              </div>
            </div>

            {/* Row 6: Status */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                الحالة
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full md:w-48 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
              >
                <option value="active">نشط</option>
                <option value="inactive">متوقف</option>
              </select>
            </div>

            {/* Row 7: Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                ملاحظات
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm resize-none"
              />
            </div>

            {/* Supplier Documents */}
            <div className="border border-purple-200 bg-purple-50/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-black text-slate-800">مستندات المورد</h3>
                  <p className="text-xs text-slate-500">يمكنك رفع بطاقة المورد أو البطاقة الضريبية وحفظها مباشرة داخل قاعدة البيانات</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={formDocType} onChange={e=>setFormDocType(e.target.value)} className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm">
                  <option>بطاقة المورد</option>
                  <option>السجل التجاري</option>
                  <option>البطاقة الضريبية</option>
                  <option>شهادة ضريبة القيمة المضافة</option>
                  <option>بيانات المورد</option>
                  <option>عقد</option>
                  <option>شهادة بنكية</option>
                  <option>مستند آخر</option>
                </select>
                <input value={formDocNumber} onChange={e=>setFormDocNumber(e.target.value)} placeholder="رقم المستند" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
                <input type="date" value={formDocIssueDate} onChange={e=>setFormDocIssueDate(e.target.value)} title="تاريخ الإصدار" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
                <input type="date" value={formDocExpiryDate} onChange={e=>setFormDocExpiryDate(e.target.value)} title="تاريخ الانتهاء" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
              </div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.doc,.docx,.xls,.xlsx" onChange={e=>setFormDocFile(e.target.files?.[0] || null)} className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm" />
              {formDocFile && <div className="text-xs text-purple-700 font-bold">المحدد: {formDocFile.name} — {(formDocFile.size/1024/1024).toFixed(2)} MB</div>}
              <textarea value={formDocNotes} onChange={e=>setFormDocNotes(e.target.value)} rows={2} placeholder="ملاحظات على المستند (اختياري)" className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm resize-none" />
              <div className="text-[11px] text-slate-500">الحد الأقصى 15MB. المستند يُرفع بعد حفظ المورد مباشرة، سواء عند الإضافة أو التعديل.</div>
            </div>

            {/* Actions */}
            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
              >
                {uploadingFormDoc ? "جاري الحفظ ورفع المستند..." : (isEdit ? "حفظ التعديلات" : "إضافة المورد")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Payment Modal
  // ═══════════════════════════════════════
  const renderPaymentModal = () => {
    if (!showPaymentModal || !selectedSupplier) return null;
    const s = selectedSupplier;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-black text-slate-800">
              تسديد دفعة للمورد
            </h2>
            <button
              onClick={() => setShowPaymentModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handlePayment} className="p-5 space-y-4">
            <div className="bg-gradient-to-l from-emerald-50 to-white p-4 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {PAYMENT_TERMS_LABELS[s.payment_terms] || "نقدي"}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">الرصيد المستحق:</span>
                <span className="font-black text-lg text-rose-600">
                  {formatCurrency(s.balance)} ج.م
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                طريقة الدفع
              </label>
              <select
                value={paymentData.payment_method}
                onChange={(e) =>
                  setPaymentData({
                    ...paymentData,
                    payment_method: e.target.value,
                  })
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              >
                <option value="cash">نقدي</option>
                <option value="bank">تحويل بنكي</option>
                <option value="check">شيك</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                المبلغ المدفوع (ج.م) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      amount: e.target.value,
                    })
                  }
                  className="w-full p-3 pl-14 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-bold"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  ج.م
                </span>
              </div>
              {paymentData.amount && s.balance > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  المتبقي بعد الدفع:{" "}
                  <span className="font-bold text-slate-600">
                    {formatCurrency(Math.max(0, s.balance - Number(paymentData.amount)))}{" "}
                    ج.م
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={paymentData.notes}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, notes: e.target.value })
                }
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                placeholder="رقم الشيك أو مرجع التحويل..."
              />
            </div>

            <div className="pt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                تأكيد السداد
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* Top Header (only in list view) */}
      {activeTab === "list" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <XCircle className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Truck className="w-8 h-8 text-orange-500" />
                إدارة الموردين
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                سجل الموردين وحساباتهم وكشوفات الحساب
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-bold text-sm shadow-lg shadow-orange-500/25"
          >
            <Plus className="w-5 h-5" />
            إضافة مورد
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === "list" && renderListView()}
      {activeTab === "detail" && renderDetailView()}
      {activeTab === "statement" && renderStatementView()}

      {/* Modals */}
      {renderFormModal()}
      {renderPaymentModal()}
    </div>
  );
}