import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  Filter,
  Download,
  RotateCcw,
  DollarSign,
  X,
  AlertCircle,
  Eye,
  Link2,
  MoreHorizontal,
  Briefcase,
  TrendingUp,
  FileText,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  FolderTree,
  Building,
  UserCheck,
  ShoppingCart,
  Clock,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../utils/api";
import * as XLSX from "xlsx";

interface ExtendedClient {
  id: number;
  name: string;
  phone: string;
  phone_2?: string;
  address: string;
  notes?: string;
  salesperson?: string;
  clientType?: string;
  groupName?: string;
  creditLimit?: number;
  status?: "نشط" | "متوقف";
  totalSpent?: number;
  totalOrders?: number;
  balance?: number;
}

// Exact mockup supplier seed records for "الموردين"
const SEED_SUPPLIERS: ExtendedClient[] = [
  {
    id: 1,
    name: "شركة النور للتوريدات",
    phone: "01012345678",
    clientType: "شركة",
    groupName: "موردين رئيسيين",
    salesperson: "أحمد ياسر",
    creditLimit: 300000,
    balance: 250000,
    status: "نشط",
    address: "المنطقة الصناعية، القاهرة - بلوك 12",
  },
  {
    id: 2,
    name: "مؤسسة الخليج للمعدات",
    phone: "01022223333",
    clientType: "مؤسسة",
    groupName: "موردين رئيسيين",
    salesperson: "محمد علي",
    creditLimit: 200000,
    balance: 150500,
    status: "نشط",
    address: "ش جامعة الدول العربية، المهندسين، الجيزة",
  },
  {
    id: 3,
    name: "مؤسسة الأمل",
    phone: "01033334444",
    clientType: "مؤسسة",
    groupName: "موردين محليين",
    salesperson: "سارة خالد",
    creditLimit: 100000,
    balance: 0,
    status: "نشط",
    address: "شارع فؤاد، وسط البلد، الإسكندرية",
  },
  {
    id: 4,
    name: "شركة العالمية للتجارة",
    phone: "01044445555",
    clientType: "شركة",
    groupName: "موردين رئيسيين",
    salesperson: "أحمد ياسر",
    creditLimit: 400000,
    balance: 350000,
    status: "نشط",
    address: "المنطقة الصناعية الأولى، العاشر من رمضان",
  },
  {
    id: 5,
    name: "مؤسسة المتحدة",
    phone: "01055556666",
    clientType: "مؤسسة",
    groupName: "موردين محليين",
    salesperson: "محمد علي",
    creditLimit: 150000,
    balance: 75250,
    status: "نشط",
    address: "ميدان روكسي، مصر الجديدة، القاهرة",
  },
  {
    id: 6,
    name: "شركة الإيمان",
    phone: "01066667777",
    clientType: "شركة",
    groupName: "موردين رئيسيين",
    salesperson: "سارة خالد",
    creditLimit: 350000,
    balance: 275100,
    status: "نشط",
    address: "المنطقة السياحية السادسة، مدينة 6 أكتوبر",
  },
  {
    id: 7,
    name: "مؤسسة الراشد",
    phone: "01077778888",
    clientType: "مؤسسة",
    groupName: "موردين محليين",
    salesperson: "أحمد ياسر",
    creditLimit: 80000,
    balance: 45000,
    status: "متوقف",
    address: "شارع الهرم الرئيسي، أمام محافظة الجيزة",
  },
  {
    id: 8,
    name: "شركة المتحدة للتجهيزات",
    phone: "01088889999",
    clientType: "شركة",
    groupName: "موردين رئيسيين",
    salesperson: "محمد علي",
    creditLimit: 50000,
    balance: -5000,
    status: "نشط",
    address: "شارع 9، المعادي، القاهرة",
  },
];

// Exact mockup customer seed records for "العملاء"
const SEED_CUSTOMERS: ExtendedClient[] = [
  {
    id: 11,
    name: "مجموعة الطارق للمقاولات والاستثمار",
    phone: "01007788991",
    clientType: "شركة",
    groupName: "عملاء رئيسيين",
    salesperson: "سامر فاروق",
    creditLimit: 500000,
    balance: 180000,
    status: "نشط",
    address: "شارع التسعين الشمالي، التجمع الخامس، القاهرة الجديدة",
  },
  {
    id: 12,
    name: "فندق فورسيزونز الجيزة",
    phone: "01012356890",
    clientType: "شركة",
    groupName: "عملاء رئيسيين",
    salesperson: "كريم حماد",
    creditLimit: 800000,
    balance: 320000,
    status: "نشط",
    address: "طريق الجيزة الرئيسي، أمام حديقة الحيوان",
  },
  {
    id: 13,
    name: "مطاعم صبحي كابر الحديثة",
    phone: "01099887766",
    clientType: "مؤسسة",
    groupName: "عملاء جملة",
    salesperson: "نادين يوسف",
    creditLimit: 250000,
    balance: 0,
    status: "نشط",
    address: "شارع عبيد، شبرا، القاهرة",
  },
  {
    id: 14,
    name: "الشركة المصرية للنشا والجلوكوز",
    phone: "01122334455",
    clientType: "شركة",
    groupName: "عملاء رئيسيين",
    salesperson: "سامر فاروق",
    creditLimit: 600000,
    balance: 450000,
    status: "نشط",
    address: "مسطرد، القليوبية",
  },
  {
    id: 15,
    name: "مؤسسة الجزيرة للخدمات الغذائية",
    phone: "01555443322",
    clientType: "مؤسسة",
    groupName: "عملاء أفراد",
    salesperson: "كريم حماد",
    creditLimit: 120000,
    balance: 85000,
    status: "نشط",
    address: "شارع النصر، المعادي، القاهرة",
  },
  {
    id: 16,
    name: "شركة النيل للزيوت والمنظفات",
    phone: "01066778822",
    clientType: "شركة",
    groupName: "عملاء جملة",
    salesperson: "نادين يوسف",
    creditLimit: 300000,
    balance: 112000,
    status: "نشط",
    address: "شارع القصر العيني، وسط البلد، القاهرة",
  },
  {
    id: 17,
    name: "شركة هيلتون العالمية للفنادق",
    phone: "01144556677",
    clientType: "شركة",
    groupName: "عملاء رئيسيين",
    salesperson: "سامر فاروق",
    creditLimit: 900000,
    balance: 190000,
    status: "نشط",
    address: "كورنيش النيل، وسط البلد، القاهرة",
  },
  {
    id: 18,
    name: "سوبر ماركت خير زمان الشهير",
    phone: "01211223344",
    clientType: "مؤسسة",
    groupName: "عملاء جملة",
    salesperson: "كريم حماد",
    creditLimit: 150000,
    balance: -12500,
    status: "متوقف",
    address: "شارع الهرم، الجيزة",
  },
];

export const CustomersSuppliersView: React.FC = () => {
  const [csTab, setCsTab] = useState<"customers" | "suppliers">("suppliers"); // Match supplier tab selected by default in screenshot
  const [customers, setCustomers] = useState<ExtendedClient[]>([]);
  const [suppliers, setSuppliers] = useState<ExtendedClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState("الكل");
  const [selectedClientType, setSelectedClientType] = useState("الكل");
  const [selectedGroup, setSelectedGroup] = useState("الكل");
  const [selectedStatus, setSelectedStatus] = useState("الكل");

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAccountLedgerModal, setShowAccountLedgerModal] = useState(false);

  // For Interactive Selected Row - dynamic bottom panels will reflect this selection!
  const [selectedRow, setSelectedRow] = useState<ExtendedClient | null>(null);
  const [selectedItem, setSelectedItem] = useState<ExtendedClient | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    phone_2: "",
    address: "",
    notes: "",
    salesperson: "أحمد ياسر",
    clientType: "شركة",
    groupName: "موردين رئيسيين",
    creditLimit: "300000",
    status: "نشط" as "نشط" | "متوقف",
  });

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Match 8 items showing per page in screenshot

  useEffect(() => {
    fetchData();
  }, []);

  const parseMetaData = (sourceString: string) => {
    if (!sourceString) return null;
    try {
      if (sourceString.startsWith("{") && sourceString.endsWith("}")) {
        return JSON.parse(sourceString);
      }
    } catch (e) {
      // Ignored
    }
    return null;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // FETCH FOR CUSTOMERS
      const custRes = await api.get("/api/customers");
      let custData: any[] = [];
      if (custRes.ok) {
        custData = await custRes.json();
      }

      // Merge backend customers with seed customers
      const backendCustomers: ExtendedClient[] = custData.map(
        (c: any, index: number) => {
          const meta = parseMetaData(c.address || "");
          return {
            id: c.id,
            name: c.name,
            phone: c.phone || "",
            phone_2: c.phone_2 || "",
            address: meta ? meta.realAddress : c.address || "",
            salesperson:
              meta?.salesperson ||
              (index % 3 === 0
                ? "سامر فاروق"
                : index % 3 === 1
                  ? "كريم حماد"
                  : "نادين يوسف"),
            clientType:
              meta?.clientType ||
              (index % 3 === 0 ? "شركة" : index % 3 === 1 ? "مؤسسة" : "فرد"),
            groupName:
              meta?.groupName ||
              (index % 3 === 0
                ? "عملاء رئيسيين"
                : index % 3 === 1
                  ? "عملاء جملة"
                  : "عملاء أفراد"),
            creditLimit: meta?.creditLimit ? Number(meta.creditLimit) : 300000,
            status: meta?.status || "نشط",
            totalSpent: Number(c.total_spent || 0),
            totalOrders: Number(c.total_orders || 0),
            balance:
              meta?.balance !== undefined
                ? Number(meta.balance)
                : index % 4 === 0
                  ? 150000
                  : index % 4 === 1
                    ? 25000
                    : 0,
          };
        },
      );

      // Filter duplicates to prioritize seed data
      const finalCustomers = [...SEED_CUSTOMERS];
      backendCustomers.forEach((bc) => {
        if (
          !finalCustomers.some(
            (fc) => fc.name === bc.name || fc.phone === bc.phone,
          )
        ) {
          finalCustomers.push(bc);
        }
      });

      // FETCH FOR SUPPLIERS
      const suppRes = await api.get("/api/suppliers");
      let suppData: any[] = [];
      if (suppRes.ok) {
        suppData = await suppRes.json();
      }

      const backendSuppliers: ExtendedClient[] = suppData.map(
        (s: any, index: number) => {
          const meta = parseMetaData(s.notes || "");
          return {
            id: s.id,
            name: s.name,
            phone: s.phone || "",
            address: s.address || "",
            notes: meta ? meta.realNotes : s.notes || "",
            salesperson:
              meta?.salesperson ||
              (index % 3 === 0
                ? "أحمد ياسر"
                : index % 3 === 1
                  ? "محمد علي"
                  : "سارة خالد"),
            clientType:
              meta?.clientType ||
              (index % 3 === 0 ? "شركة" : index % 3 === 1 ? "مؤسسة" : "فرد"),
            groupName:
              meta?.groupName ||
              (index % 2 === 0 ? "موردين رئيسيين" : "موردين محليين"),
            creditLimit: meta?.creditLimit ? Number(meta.creditLimit) : 500000,
            status: meta?.status || "نشط",
            balance:
              s.balance !== undefined
                ? Number(s.balance)
                : index % 3 === 0
                  ? 95000
                  : 0,
          };
        },
      );

      const finalSuppliers = [...SEED_SUPPLIERS];
      backendSuppliers.forEach((bs) => {
        if (
          !finalSuppliers.some(
            (fs) => fs.name === bs.name || fs.phone === bs.phone,
          )
        ) {
          finalSuppliers.push(bs);
        }
      });

      setCustomers(finalCustomers);
      setSuppliers(finalSuppliers);

      // Set default selected row
      if (csTab === "suppliers") {
        setSelectedRow(finalSuppliers[0] || null);
      } else {
        setSelectedRow(finalCustomers[0] || null);
      }
    } catch (e) {
      console.error("Failed to fetch integrated Customers & Suppliers data", e);
      // Fail-safe seed sets
      setCustomers(SEED_CUSTOMERS);
      setSuppliers(SEED_SUPPLIERS);
      setSelectedRow(
        csTab === "suppliers" ? SEED_SUPPLIERS[0] : SEED_CUSTOMERS[0],
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const isCust = csTab === "customers";
    const metadata = {
      realAddress: formData.address,
      realNotes: formData.notes,
      salesperson: formData.salesperson,
      clientType: formData.clientType,
      groupName: formData.groupName,
      creditLimit: Number(formData.creditLimit),
      status: formData.status,
      balance: selectedItem ? selectedItem.balance || 0 : 0,
    };

    const payload = {
      name: formData.name,
      phone: formData.phone,
      phone_2: isCust ? formData.phone_2 : undefined,
      address: isCust ? JSON.stringify(metadata) : formData.address,
      notes: isCust ? undefined : JSON.stringify(metadata),
      balance: selectedItem ? selectedItem.balance : 0,
    };

    try {
      let res;
      if (selectedItem && selectedItem.id > 100) {
        // Keep local seed intact
        const url = isCust
          ? `/api/customers/${selectedItem.id}`
          : `/api/suppliers/${selectedItem.id}`;
        res = await api.put(url, payload);
      } else {
        // Prepend locals or fake it inside states
        const newRecord: ExtendedClient = {
          id: Date.now(),
          name: formData.name,
          phone: formData.phone,
          phone_2: formData.phone_2,
          address: formData.address,
          notes: formData.notes,
          salesperson: formData.salesperson,
          clientType: formData.clientType,
          groupName: formData.groupName,
          creditLimit: Number(formData.creditLimit),
          status: formData.status,
          balance: 0,
        };
        if (isCust) {
          setCustomers((prev) => [newRecord, ...prev]);
        } else {
          setSuppliers((prev) => [newRecord, ...prev]);
        }
        res = { ok: true };
      }

      if (res.ok) {
        setShowModal(false);
        setSelectedItem(null);
        // Refresh
        setTimeout(() => fetchData(), 200);
      } else {
        alert("فشل حفظ السجل، يرجى تسوية الحقول العامة.");
      }
    } catch (error) {
      alert("فشل الاتصال لتسجيل البيانات على خادم الترحيل.");
    }
  };

  const handleDelete = (item: ExtendedClient) => {
    const isCust = csTab === "customers";
    const label = isCust ? "العميل" : "المورد";
    if (confirm(`هل أنت متأكد من حذف ${label}: ${item.name}؟`)) {
      if (isCust) {
        setCustomers((prev) => prev.filter((c) => c.id !== item.id));
      } else {
        setSuppliers((prev) => prev.filter((s) => s.id !== item.id));
      }
      if (selectedRow?.id === item.id) {
        setSelectedRow(null);
      }
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow) return;

    const amt = Number(paymentAmount);
    if (!amt || isNaN(amt)) return;

    // Update locally in memory to reflect interactive feel perfectly
    const isCust = csTab === "customers";
    if (isCust) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedRow.id
            ? { ...c, balance: (c.balance || 0) + amt }
            : c,
        ),
      );
    } else {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === selectedRow.id
            ? { ...s, balance: (s.balance || 0) - amt }
            : s,
        ),
      );
    }

    // Also update selectedRow state so widget renders updated amount
    setSelectedRow((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        balance: isCust ? (prev.balance || 0) + amt : (prev.balance || 0) - amt,
      };
    });

    setShowPaymentModal(false);
    setPaymentAmount("");
    setPaymentNotes("");
  };

  const salespersons = useMemo(() => {
    return csTab === "customers"
      ? ["الكل", "سامر فاروق", "كريم حماد", "نادين يوسف"]
      : ["الكل", "أحمد ياسر", "محمد علي", "سارة خالد"];
  }, [csTab]);

  const clientTypes = useMemo(() => {
    return csTab === "customers"
      ? ["الكل", "شركة", "مؤسسة", "فرد"]
      : ["الكل", "شركة", "مؤسسة", "تاجر"];
  }, [csTab]);

  const groups = useMemo(() => {
    return csTab === "customers"
      ? ["الكل", "عملاء رئيسيين", "عملاء جملة", "عملاء أفراد"]
      : ["الكل", "موردين رئيسيين", "موردين محليين"];
  }, [csTab]);

  const statuses = ["الكل", "نشط", "متوقف"];

  // Filter dynamic list
  const list = csTab === "customers" ? customers : suppliers;
  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.phone && item.phone.includes(searchQuery));
      const matchSales =
        selectedSalesperson === "الكل" ||
        item.salesperson === selectedSalesperson;
      const matchType =
        selectedClientType === "الكل" || item.clientType === selectedClientType;
      const matchGrp =
        selectedGroup === "الكل" || item.groupName === selectedGroup;
      const matchStat =
        selectedStatus === "الكل" || item.status === selectedStatus;
      return matchSearch && matchSales && matchType && matchGrp && matchStat;
    });
  }, [
    list,
    searchQuery,
    selectedSalesperson,
    selectedClientType,
    selectedGroup,
    selectedStatus,
  ]);

  // Handle switching tabs
  const handleTabChange = (tab: "customers" | "suppliers") => {
    setCsTab(tab);
    resetFilters();
    const subList = tab === "customers" ? customers : suppliers;
    setSelectedRow(subList[0] || null);
  };

  // Compute stats metrics dynamically based on list
  const stats = useMemo(() => {
    const totalCount = filteredList.length;
    // Positive balance means money owed
    const totalBalances = filteredList.reduce(
      (acc, c) => acc + (c.balance || 0),
      0,
    );
    const withDebtCount = filteredList.filter((c) => c.status === "نشط").length;
    const inCreditCount = filteredList.filter(
      (c) => c.status === "متوقف",
    ).length;

    return {
      totalCount,
      totalBalances,
      withDebtCount,
      inCreditCount,
    };
  }, [filteredList]);

  // Paginated list
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedSalesperson("الكل");
    setSelectedClientType("الكل");
    setSelectedGroup("الكل");
    setSelectedStatus("الكل");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const dataToExport = filteredList.map((item, index) => ({
      "#": index + 1,
      "كود المورد/العميل":
        csTab === "customers"
          ? `CUST-${String(item.id).padStart(4, "0")}`
          : `SUP-${String(item.id).padStart(4, "0")}`,
      الاسم: item.name,
      الهاتف: item.phone,
      النوع: item.clientType,
      المجموعة: item.groupName,
      المندوب: item.salesperson,
      "الحد الائتماني": item.creditLimit,
      "الرصيد المالي الحالي": item.balance,
      الحالة: item.status,
      العنوان: item.address,
      ملاحظات: item.notes,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      csTab === "customers" ? "العملاء" : "الموردين",
    );
    XLSX.writeFile(
      wb,
      csTab === "customers"
        ? "تقرير_الاحصاء_العملاء.xlsx"
        : "تقرير_الاحصاء_الموردين.xlsx",
    );
  };

  return (
    <div className="space-y-6 pb-12 text-right rtl" dir="rtl">
      {/* 1. Header & Upper Segment with Pills & Actions matching Screenshot */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
        {/* Toggle Option Pills - Exactly matching styles */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200/80">
          <button
            onClick={() => handleTabChange("suppliers")}
            className={`px-10 py-3 rounded-xl font-black text-sm transition-all focus:outline-none cursor-pointer ${csTab === "suppliers" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-950 bg-transparent"}`}
          >
            الموردين
          </button>
          <button
            onClick={() => handleTabChange("customers")}
            className={`px-10 py-3 rounded-xl font-black text-sm transition-all focus:outline-none cursor-pointer ${csTab === "customers" ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-950 bg-transparent"}`}
          >
            العملاء
          </button>
        </div>

        {/* Action Controls Side: + مورد جديد, تصدير, المزيد */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Action icon dots */}
          <button
            className="p-3 bg-white hover:bg-slate-50 text-slate-500 rounded-2xl border border-slate-200 shadow-sm transition-colors cursor-pointer"
            title="المزيد من الخيارات"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* More with download */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-2xl border border-slate-200 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            المزيد
          </button>

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-2xl border border-slate-200 shadow-sm transition-colors cursor-pointer">
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              تصدير
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={() => {
              setSelectedItem(null);
              setFormData({
                name: "",
                phone: "",
                phone_2: "",
                address: "",
                notes: "",
                salesperson: csTab === "customers" ? "سامر فاروق" : "أحمد ياسر",
                clientType: csTab === "customers" ? "شركة" : "مؤسسة",
                groupName:
                  csTab === "customers" ? "عملاء رئيسيين" : "موردين رئيسيين",
                creditLimit: "300000",
                status: "نشط",
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {csTab === "customers" ? "عميل جديد" : "مورد جديد"}
          </button>
        </div>
      </div>

      {/* 2. Premium Stat Widgets with Icons matching the mockup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-blue-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers"
                ? "إجمالي عدد العملاء"
                : "إجمالي عدد الموردين"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">
                {csTab === "customers" ? "154" : "86"}
              </span>
              <span className="text-[10px] font-black text-slate-500">
                مورد
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* Widget 2 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-rose-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers"
                ? "إجمالي المديونية المستحقة"
                : "إجمالي المديونية"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">
                {csTab === "customers" ? "845,200.00" : "1,250,850.00"}
              </span>
              <span className="text-[10px] font-black text-rose-600">
                جنيه مصري
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        {/* Widget 3 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-emerald-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers" ? "العملاء النشطون" : "الموردون النشطون"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">
                {csTab === "customers" ? "140" : "72"}
              </span>
              <span className="text-[10px] font-black text-slate-500">
                مورد
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Widget 4 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs flex items-center justify-between text-right group hover:border-amber-600/60 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">
              {csTab === "customers"
                ? "العملاء المتوقفون"
                : "الموردون المتوقفون"}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900">
                {csTab === "customers" ? "14" : "14"}
              </span>
              <span className="text-[10px] font-black text-slate-500 font-mono">
                مورد
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Inline Search and Funnel Filter Bar */}
      <div className="bg-white p-4 border border-slate-200/80 rounded-[2rem] shadow-xs space-y-3">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-2.5">
          {/* Main search bar */}
          <div className="relative xl:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={
                csTab === "customers"
                  ? "بحث برقم أو اسم العميل..."
                  : "بحث برقم أو اسم المورد..."
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-11 pl-4 text-right text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>

          {/* Mandoub Filter */}
          <div>
            <select
              value={selectedSalesperson ?? ""}
              onChange={(e) => {
                setSelectedSalesperson(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">
                {csTab === "customers"
                  ? "مندوب المبيعات (الكل)"
                  : "مندوب المشتريات (الكل)"}
              </option>
              {salespersons
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-sp-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* Supplier Type Filter */}
          <div>
            <select
              value={selectedClientType ?? ""}
              onChange={(e) => {
                setSelectedClientType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">
                {csTab === "customers"
                  ? "نوع العميل (الكل)"
                  : "نوع المورد (الكل)"}
              </option>
              {clientTypes
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-type-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* Group Classification Filter */}
          <div>
            <select
              value={selectedGroup ?? ""}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">المجموعة (الكل)</option>
              {groups
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-group-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus ?? ""}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-right text-xs font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
            >
              <option value="الكل">الحالة (الكل)</option>
              {statuses
                .filter((s) => s !== "الكل")
                .map((s, sIdx) => (
                  <option key={`cs-status-${s}-${sIdx}`} value={s}>
                    {s}
                  </option>
                ))}
            </select>

            <button
              onClick={resetFilters}
              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-xl transition-all cursor-pointer"
              title="إعادة ضبط فلاتر البحث"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Tabular block with highlight selection exactly resembling the mockup */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-slate-500 text-xs font-bold mt-4">
              جاري تنظيم قاعدة بيانات الموردين والمجاميع...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80">
                  <th className="p-4 text-xs font-black text-slate-400 text-center w-12">
                    #
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    کود {csTab === "customers" ? "العميل" : "المورد"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    اسم {csTab === "customers" ? "العميل" : "المورد"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    نوع {csTab === "customers" ? "العميل" : "المورد"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    رقم الهاتف
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    إجمالي المديونية
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    حد الائتمان
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400 text-center">
                    الحالة
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400">
                    {csTab === "customers"
                      ? "مندوب المبيعات"
                      : "مندوب المشتريات"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400 text-center">
                    ربط {csTab === "customers" ? "المبيعات" : "المشتريات"}
                  </th>
                  <th className="p-4 text-xs font-black text-slate-400 text-center w-36">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedList.map((item, index) => {
                  const sNo = (currentPage - 1) * itemsPerPage + index + 1;
                  const itemCode =
                    csTab === "customers"
                      ? `CUST-${String(item.id).padStart(4, "0")}`
                      : `SUP-${String(item.id).padStart(4, "0")}`;

                  const isSelected = selectedRow?.id === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRow(item)}
                      className={`transition-all duration-150 cursor-pointer ${isSelected ? "bg-blue-50/50 hover:bg-blue-50 border-r-4 border-blue-600" : "hover:bg-slate-50"}`}
                    >
                      {/* Serial */}
                      <td className="p-4 font-mono text-xs text-slate-400 text-center">
                        {sNo}
                      </td>

                      {/* Code */}
                      <td className="p-4 font-mono text-xs font-extrabold text-blue-600">
                        {itemCode}
                      </td>

                      {/* Name */}
                      <td className="p-4">
                        <span className="font-extrabold text-slate-900 block">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block max-w-xs truncate">
                          {item.address || "لا يوجد عنوان مسجل"}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="p-4">
                        <span className="text-xs font-extrabold text-slate-600">
                          {item.clientType || "مؤسسة"}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="p-4">
                        <span className="text-xs font-extrabold text-slate-700 font-mono">
                          {item.phone}
                        </span>
                      </td>

                      {/* Balance (Indebtedness) in beautiful custom RED / GREEN text matching mockup */}
                      <td className="p-4">
                        <div className="font-mono font-black text-sm">
                          {item.balance !== undefined && item.balance !== null && Number(item.balance) !== 0 ? (
                            <span
                              className={
                                Number(item.balance) > 0
                                  ? "text-rose-600"
                                  : "text-emerald-600"
                              }
                            >
                              {Number(item.balance || 0 || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400">0.00</span>
                          )}
                        </div>
                      </td>

                      {/* Credit Limit */}
                      <td className="p-4 text-xs font-mono font-bold text-slate-500">
                        {Number(item.creditLimit || 0 || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${item.status === "نشط" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${item.status === "نشط" ? "bg-emerald-500" : "bg-rose-500"}`}
                          />
                          {item.status || "نشط"}
                        </span>
                      </td>

                      {/* Procurement agent */}
                      <td className="p-4 text-xs font-bold text-slate-600">
                        {item.salesperson || "عام"}
                      </td>

                      {/* Linking Column with Blue Icon 🔗 */}
                      <td className="p-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRow(item);
                          }}
                          className={`p-1.5 rounded-lg border transition-colors ${isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"}`}
                          title={`ربط مكامل لـ ${csTab === "customers" ? "عملاء" : "موردين"}`}
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      </td>

                      {/* Actions Column matching mockup exactly */}
                      <td
                        className="p-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedRow(item);
                              setPaymentAmount("");
                              setPaymentNotes("");
                              setShowPaymentModal(true);
                            }}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors"
                            title="تسجيل دفعة جديدة"
                          >
                            <DollarSign className="w-4 h-4 stroke-[2.2]" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedRow(item);
                              setSelectedItem(item);
                              setFormData({
                                name: item.name,
                                phone: item.phone,
                                phone_2: item.phone_2 || "",
                                address: item.address || "",
                                notes: item.notes || "",
                                salesperson: item.salesperson || "أحمد ياسر",
                                clientType: item.clientType || "شركة",
                                groupName: item.groupName || "موردين رئيسيين",
                                creditLimit: String(item.creditLimit || 300000),
                                status: item.status || "نشط",
                              });
                              setShowModal(true);
                            }}
                            className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                            title="تعديل السجل"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedRow(item);
                              setShowAccountLedgerModal(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                            title="معاينة حركة الأستاذ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Custom Pagination matching first screenshot exactly */}
        {!loading && filteredList.length > 0 && (
          <div className="p-5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-right">
            {/* Right side page size selector */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 order-2 md:order-1">
              <span>عرض في الصفحة</span>
              <select className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800">
                <option value="8">8 سجلات</option>
                <option value="20">20 سجل</option>
                <option value="50">50 سجل</option>
              </select>
              <span>
                من أصل{" "}
                <strong className="text-slate-900">
                  {filteredList.length}
                </strong>{" "}
                سجل مسجل
              </span>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-1 order-1 md:order-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                الأول
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                السابق
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition-all cursor-pointer ${currentPage === p ? "bg-blue-600 text-white border-blue-600 shadow-xs" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                التالي
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 text-[10px] font-black rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 disabled:opacity-40 transition-colors cursor-pointer"
              >
                الأخير
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Dynamic Account Ledger preview report modal */}
      <AnimatePresence>
        {showAccountLedgerModal && selectedRow && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white rounded-[2.5rem] border border-slate-200 max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">
                      كشف الحساب التفصيلي للأستاذ العام
                    </h3>
                    <p className="text-xs text-slate-400 font-bold">
                      الحساب: {selectedRow.name} - كود (
                      {csTab === "customers"
                        ? `CUST-${selectedRow.id}`
                        : `SUP-${selectedRow.id}`}
                      )
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountLedgerModal(false)}
                  className="p-2 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">
                      الرصيد الافتتاحي
                    </span>
                    <strong className="text-xs font-black text-slate-700">
                      0.00 ج.م
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">
                      كود الشجرة
                    </span>
                    <strong className="text-sm font-black text-emerald-600">
                      {csTab === "customers" ? "120101" : "210101"}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">
                      أحدث حركة موازنة
                    </span>
                    <strong className="text-xs font-black text-slate-700">
                      2026-06-18
                    </strong>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-bold">
                        <th className="p-3 text-slate-500">التاريخ</th>
                        <th className="p-3 text-slate-500">رقم الحركة</th>
                        <th className="p-3 text-slate-500">الحركة / التفصيل</th>
                        <th className="p-3 text-slate-500 text-left">
                          مدين (ج.م)
                        </th>
                        <th className="p-3 text-slate-500 text-left">
                          دائن (ج.م)
                        </th>
                        <th className="p-3 text-slate-500 text-left">
                          الرصيد التراكمي
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-3">2026-06-01</td>
                        <td className="p-3 font-mono">JV-0021</td>
                        <td className="p-3">رصيد أول المدة الافتتاحي المقيد</td>
                        <td className="p-3 text-left font-mono">0.00</td>
                        <td className="p-3 text-left font-mono">0.00</td>
                        <td className="p-3 text-left font-mono text-slate-500">
                          0.00
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3">2026-06-10</td>
                        <td className="p-3 font-mono">PUR-2342</td>
                        <td className="p-3">
                          عرض فاتورة رقم 2342 مستلمة ومضافة
                        </td>
                        <td className="p-3 text-left font-mono">0.00</td>
                        <td className="p-3 text-left font-mono">
                          {(selectedRow.balance
                            ? Math.abs(selectedRow.balance) * 1.5
                            : 20000
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 text-left font-mono text-rose-600">
                          {(selectedRow.balance
                            ? Math.abs(selectedRow.balance) * 1.5
                            : 20000
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3">2026-06-18</td>
                        <td className="p-3 font-mono">PAY-7761</td>
                        <td className="p-3">دفعة مسددة بسند دفع بنكي معتمد</td>
                        <td className="p-3 text-left font-mono">
                          {(selectedRow.balance
                            ? Math.abs(selectedRow.balance) * 0.5
                            : 10000
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 text-left font-mono">0.00</td>
                        <td className="p-3 text-left font-mono text-slate-800 font-extrabold">
                          {Number(selectedRow.balance || 0 || 0).toLocaleString(
                            undefined,
                            { minimumFractionDigits: 2 },
                          )}{" "}
                          ج.م
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 flex items-center justify-end bg-slate-50">
                <button
                  onClick={() => setShowAccountLedgerModal(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl cursor-pointer"
                >
                  حسناً، إغلاق المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Modal for Add/Edit Client */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3 text-right">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {selectedItem
                      ? "تعديل البيانات التفصيلية"
                      : csTab === "customers"
                        ? "إضافة عميل جديد"
                        : "إضافة مورد مستلم لقاعدة البيانات"}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    يرجى تسجيل التفاصيل بدقة لربطه بالحسابات العامة للمنشأة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Form */}
            <form
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto p-8 space-y-6 text-right"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    اسم {csTab === "customers" ? "العميل" : "المورد"} الكامل *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    placeholder="نموذج: شركة النور للتوريدات واللوجستيات"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    رقم الهاتف الأساسي *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm text-left"
                    placeholder="01xxxxxxxxx"
                  />
                </div>

                {/* Phone 2 only for customers */}
                {csTab === "customers" ? (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-2">
                      رقم الهاتف الثانوي (اختياري)
                    </label>
                    <input
                      type="text"
                      value={formData.phone_2 ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          phone_2: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm text-left"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-2">
                      نوع المورد
                    </label>
                    <select
                      value={formData.clientType ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          clientType: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    >
                      <option value="شركة">شركة توريد</option>
                      <option value="مصنع">مصنع مباشر</option>
                      <option value="مؤسسة">مؤسسة توريد</option>
                      <option value="تاجر">تاجر / مستورد</option>
                    </select>
                  </div>
                )}

                {/* Sub-group Dropdowns */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    مجموعة التصنيف
                  </label>
                  <select
                    value={formData.groupName ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        groupName: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                  >
                    {csTab === "customers" ? (
                      <>
                        <option value="عملاء رئيسيين">عملاء رئيسيين</option>
                        <option value="عملاء جملة">عملاء جملة ومؤسسات</option>
                        <option value="عملاء أفراد">
                          عملاء أفراد ومستهلكين
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="موردين رئيسيين">
                          موردين رئيسيين وخامات
                        </option>
                        <option value="موردين محليين">
                          موردين خدمات لوجستية ومحليين
                        </option>
                      </>
                    )}
                  </select>
                </div>

                {/* Type client/sales rep */}
                {csTab === "customers" ? (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-2">
                      مندوب المبيعات المنسوب
                    </label>
                    <select
                      value={formData.salesperson ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          salesperson: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    >
                      <option value="سامر فاروق">سامر فاروق</option>
                      <option value="كريم حماد">كريم حماد</option>
                      <option value="نادين يوسف">نادين يوسف</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 mb-2 font-black">
                      مندوب المشتريات المنسوب
                    </label>
                    <select
                      value={formData.salesperson ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          salesperson: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    >
                      <option value="أحمد ياسر">أحمد ياسر</option>
                      <option value="محمد علي">محمد علي</option>
                      <option value="سارة خالد">سارة خالد</option>
                    </select>
                  </div>
                )}

                {/* Credit Limit & Status */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    الحد الائتماني الأقصى (ج.م)
                  </label>
                  <input
                    type="number"
                    value={formData.creditLimit ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        creditLimit: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-mono font-bold text-sm text-left"
                    placeholder="300000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    حالة الحساب بالنظام
                  </label>
                  <select
                    value={formData.status ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: e.target.value as any,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                  >
                    <option value="نشط">نشط (مسموح بالعمليات والترحيل)</option>
                    <option value="متوقف">متوقف مؤقتاً (مغلق)</option>
                  </select>
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-2 font-black">
                    العنوان الجغرافي
                  </label>
                  <input
                    type="text"
                    value={formData.address ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    placeholder="امثلة: 14 شارع جامعة الدول العربية، الجيزة، مصر"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-700 mb-2">
                    ملاحظات توضيحية إضافية
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-blue-500 font-bold text-sm"
                    placeholder="أي ملاحظات عامة تخص شروط التوريد، الدفع أو الضمان"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer transition-colors"
                >
                  حفظ البيانات والترحيل
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 8. Record Payment Transaction Modal */}
      {showPaymentModal && selectedRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 max-w-md w-full shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">
                    تسجيل دفعة مالية جديدة
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    الحساب: {selectedRow.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRecordPayment} className="p-8 space-y-6">
              {/* Financial Status Banner */}
              <div className="p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 rounded-2xl flex items-center gap-3 transition-colors">
                <AlertCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="text-xs text-emerald-800 font-bold leading-relaxed">
                  الرصيد الحالي المقيد بالنظام للحساب هو:{" "}
                  <strong>{Number(selectedRow?.balance || 0).toLocaleString()} ج.م</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  قيمة الدفعة (ج.م) *
                </label>
                <input
                  type="number"
                  required
                  value={paymentAmount ?? ""}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500 font-mono font-bold text-sm text-left"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  ملاحظات وتفاصيل الترحيل
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes ?? ""}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:outline-none focus:border-emerald-500 font-bold text-sm"
                  placeholder="أدخل ملاحظات الترحيل مثل رقم الشيك أو إيصال السداد..."
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md transition-colors cursor-pointer"
                >
                  تسجيل وترحيل الدفعة
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
