"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearExperimentalAdminData } from "@/services/adminService";
import { getPermissionMeta, getRoleMeta, hasFullAdminAccess, hasPermission } from "@/lib/permissions";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Shield,
  Edit2,
  LockKeyhole,
  Slash,
  CheckCircle2,
  Trash2,
  Info,
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Bike,
  Package,
  ShoppingBag,
  Tag,
  Users,
  ShieldAlert,
  Search,
  History,
  MessageSquare,
  Megaphone,
  Ticket,
  Database,
  ChevronDown,
} from "lucide-react";

type Staff = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  disabled: boolean;
  created_at: string;
  last_login_at?: string | null;
};

const ROLE_OPTIONS = [
  { value: "super_admin", label: "مشرف عام" },
  { value: "operations_manager", label: "إدارة العمليات" },
  { value: "catalog_manager", label: "إدارة المنتجات" },
  { value: "support_agent", label: "دعم" },
];

const PERMISSION_OPTIONS = [
  "view_orders",
  "update_order_status",
  "assign_driver",
  "view_drivers",
  "manage_products",
  "manage_categories",
  "manage_offers",
  "manage_discounts",
  "manage_users",
  "manage_admins",
  "manage_settings",
  "view_reports",
];

const PREVIEW_ITEMS = [
  { label: "لوحة التحكم", description: "الصفحة الرئيسية للأدمن والملخص السريع.", access: "يشوف الملخص العام", icon: LayoutDashboard, perm: null, fullAdmin: true },
  { label: "التحليلات", description: "أرقام المبيعات والزيارات والتقارير.", access: "يشوف التقارير والتحليلات", icon: BarChart3, perm: "view_reports", fullAdmin: false },
  { label: "الطلبات", description: "عرض الطلبات ومتابعة حالتها.", access: "يشوف الطلبات ويتابعها", icon: ShoppingCart, perm: "view_orders", fullAdmin: false },
  { label: "طلبات بندور عليها", description: "متابعة الطلبات اللي محتاجة بحث وتسعير.", access: "يشوف الطلبات الخاصة والردود", icon: Clock, perm: "view_orders", fullAdmin: false },
  { label: "مركز العمليات", description: "أدوات التشغيل السريعة والمتقدمة.", access: "وصول كامل لأدوات التشغيل", icon: AlertTriangle, perm: null, fullAdmin: true },
  { label: "المندوبين", description: "قائمة المندوبين والتوفر وحالة التوزيع.", access: "يشوف المندوبين ويتابعهم", icon: Bike, perm: "view_drivers", fullAdmin: false },
  { label: "المنتجات", description: "إضافة وتعديل المنتجات والباقات.", access: "يدير المنتجات ويعدّلها", icon: Package, perm: "manage_products", fullAdmin: false },
  { label: "المطاعم", description: "إضافة المطاعم وإدارة بياناتها وربط المنيو بها.", access: "يدير المطاعم وربط منتجاتها", icon: ShoppingBag, perm: "manage_products", fullAdmin: false },
  { label: "الأقسام", description: "إدارة الأقسام وترتيب ظهورها.", access: "يدير الأقسام وترتيبها", icon: Tag, perm: "manage_categories", fullAdmin: false },
  { label: "المستخدمون", description: "مراجعة حسابات العملاء وبياناتهم.", access: "يشوف العملاء ويعدّل بياناتهم", icon: Users, perm: "manage_users", fullAdmin: false },
  { label: "إدارة الطاقم", description: "إدارة الموظفين والصلاحيات.", access: "يدير الموظفين والصلاحيات", icon: ShieldAlert, perm: "manage_admins", fullAdmin: false },
  { label: "البحث الشامل", description: "بحث إداري سريع داخل النظام كله.", access: "وصول كامل للبحث الإداري", icon: Search, perm: null, fullAdmin: true },
  { label: "سجل الإدارة", description: "متابعة التغييرات الإدارية المهمة.", access: "يشوف سجل التغييرات الإدارية", icon: History, perm: null, fullAdmin: true },
  { label: "التقييمات", description: "مراجعة تقييمات العملاء للمنتجات.", access: "يشوف التقييمات ويراجعها", icon: MessageSquare, perm: "view_reports", fullAdmin: false },
  { label: "العروض الترويجية", description: "إدارة البانرات والحملات والعروض.", access: "يدير العروض والحملات", icon: Megaphone, perm: "manage_offers", fullAdmin: false },
  { label: "أكواد الخصم", description: "إنشاء ومتابعة أكواد الخصم.", access: "ينشئ ويعدّل أكواد الخصم", icon: Ticket, perm: "manage_discounts", fullAdmin: false },
  { label: "النسخ الاحتياطي", description: "تصدير واسترجاع النسخ الاحتياطية.", access: "يدير النسخ الاحتياطية", icon: Database, perm: "manage_settings", fullAdmin: false },
] as const;

function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-surface-hover bg-surface text-gray-500 transition-colors group-hover:border-primary/30 group-hover:text-primary">
        <Info className="h-3 w-3" />
      </span>
      <span className="pointer-events-none absolute bottom-[calc(100%+10px)] start-1/2 z-20 hidden w-64 -translate-x-1/2 rounded-2xl border border-surface-hover bg-background px-3 py-2 text-[11px] font-medium leading-5 text-gray-300 shadow-2xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

export default function StaffPage() {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    role: "operations_manager",
    permissions: ["view_orders", "update_order_status", "assign_driver", "view_drivers"],
    tempPassword: "",
    disabled: false,
  });
  const [permissionsOpen, setPermissionsOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [isClearingAllStaff, setIsClearingAllStaff] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    const role = profile?.role;
    const perms = profile?.permissions || [];
    const allowed = role === "super_admin" || role === "admin" || perms.includes("manage_admins");
    if (!allowed) {
      router.replace("/admin");
      return;
    }
    (async () => {
      await loadStaff();
    })();
  }, [profile, isLoading, router]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      if (!res.ok) throw new Error("فشل تحميل الطاقم");
      const data = await res.json();
      setStaff(data.staff || []);
    } catch (e: any) {
      toast.error(e.message || "خطأ في تحميل الطاقم");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      full_name: "",
      username: "",
      email: "",
      role: "operations_manager",
      permissions: ["view_orders", "update_order_status", "assign_driver", "view_drivers"],
      tempPassword: "",
      disabled: false,
    });
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setPermissionsOpen(true);
    setPreviewOpen(true);
    setModalOpen(true);
  };

  const openEdit = (item: Staff) => {
    setEditing(item);
    setPermissionsOpen(true);
    setPreviewOpen(true);
    setForm({
      full_name: item.full_name || "",
      username: item.username || "",
      email: item.email || "",
      role: item.role,
      permissions: item.permissions || [],
      tempPassword: "",
      disabled: item.disabled,
    });
    setModalOpen(true);
  };

  const togglePerm = (perm: string) => {
    setForm((f) => {
      const exists = f.permissions.includes(perm);
      return {
        ...f,
        permissions: exists ? f.permissions.filter((p) => p !== perm) : [...f.permissions, perm],
      };
    });
  };

  const handleSave = async () => {
    if (!form.email || !form.full_name || !form.username) {
      toast.error("املأ الحقول المطلوبة");
      return;
    }
    const payload = {
      ...form,
      tempPassword: form.tempPassword || undefined,
    };
    try {
      const url = editing ? `/api/admin/staff/${editing.id}` : "/api/admin/staff";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || "فشل الحفظ";
        throw new Error(msg);
      }
      toast.success(editing ? "تم تحديث بيانات الموظف" : "تم إضافة موظف جديد");
      setModalOpen(false);
      await loadStaff();
    } catch (e: any) {
      toast.error(e.message || "خطأ أثناء الحفظ");
    }
  };

  const handleDisable = async (id: string | undefined, disable: boolean) => {
    if (!id) {
      toast.error("معرّف الموظف مفقود، حاول إعادة تحميل الصفحة");
      return;
    }
    try {
      const url = `/api/admin/staff/${encodeURIComponent(id)}`;
      if (process.env.NODE_ENV !== "production") {
        console.debug("Disabling staff", { id, url, disable });
      }
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: disable }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "فشل التحديث");
      toast.success(disable ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
      await loadStaff();
    } catch (e: any) {
      toast.error(e.message || "خطأ أثناء التحديث");
    }
  };

  const handleResetPassword = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/staff/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "فشل إعادة التهيئة");
      toast.success(`كلمة مرور مؤقتة: ${data.tempPassword || ''}`);
    } catch (e: any) {
      toast.error(e.message || "خطأ أثناء إعادة التهيئة");
    }
  };

  const handleDeleteStaff = async (member: Staff) => {
    if (!member?.id) {
      toast.error("معرّف الموظف مفقود");
      return;
    }

    const confirmed = window.confirm(`هل أنت متأكد من حذف الموظف "${member.full_name || member.email}" نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/staff/${encodeURIComponent(member.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "فشل حذف الموظف");
      toast.success("تم حذف الموظف نهائيًا");
      await loadStaff();
    } catch (e: any) {
      toast.error(e.message || "خطأ أثناء حذف الموظف");
    }
  };

  const handleClearAllStaff = async () => {
    const confirmed = window.confirm("هيمسح كل الطاقم التجريبي ويترك السوبر أدمن فقط. متأكد؟");
    if (!confirmed) return;

    setIsClearingAllStaff(true);
    try {
      const result = await clearExperimentalAdminData("staff");
      const deletedStaff = Number(result?.summary?.deletedStaff || 0);
      toast.success(
        deletedStaff > 0 ? `تم مسح ${deletedStaff} حساب من الطاقم` : "تم تنظيف الطاقم التجريبي"
      );
      await loadStaff();
    } catch (e: any) {
      toast.error(e.message || "فشل مسح الطاقم");
    } finally {
      setIsClearingAllStaff(false);
    }
  };

  const roleLabel = useMemo(() => (value: string) => getRoleMeta(value).label, []);

  const protectedStaff = useMemo(
    () => staff.filter((member) => member.role === "super_admin"),
    [staff]
  );

  const teamStaff = useMemo(
    () => staff.filter((member) => member.role !== "super_admin"),
    [staff]
  );

  const previewProfile = useMemo(
    () => ({ role: form.role, permissions: form.permissions }),
    [form.permissions, form.role]
  );

  const visiblePreviewItems = useMemo(
    () =>
      PREVIEW_ITEMS.filter((item) => {
        if (item.fullAdmin) return hasFullAdminAccess(previewProfile);
        if (item.perm === null) return true;
        return hasPermission(previewProfile, item.perm as any);
      }),
    [previewProfile]
  );

  const hiddenPreviewItems = useMemo(
    () => PREVIEW_ITEMS.filter((item) => !visiblePreviewItems.includes(item)),
    [visiblePreviewItems]
  );

  const previewAccess = useMemo(() => {
    const fullAccess = hasFullAdminAccess(previewProfile);
    return {
      label: fullAccess ? "وصول كامل" : "وصول محدود",
      description: fullAccess
        ? "الموظف هيشوف أغلب أقسام لوحة الإدارة الأساسية بدون قيود كبيرة."
        : "الموظف هيشوف فقط الأقسام اللي أنت فعّلتها له، والباقي هيفضل مخفي.",
      className: fullAccess
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        : "border-amber-500/20 bg-amber-500/10 text-amber-400",
    };
  }, [previewProfile]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground">إدارة الطاقم</h1>
          <p className="text-gray-500 text-sm">إضافة، تعديل، تعطيل، وصلاحيات الموظفين</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAllStaff}
            disabled={isClearingAllStaff}
            className="gap-2 border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
          >
            {isClearingAllStaff ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            مسح الكل
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة موظف
          </Button>
        </div>
      </div>

      {protectedStaff.length > 0 && (
        <div className="bg-surface border border-amber-500/20 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/10 bg-amber-500/5 px-4 py-3">
            <div>
              <h2 className="text-sm font-black text-foreground">الحسابات المحمية</h2>
              <p className="text-xs text-gray-500 mt-0.5">الحسابات دي دخولها ثابت، ومش بتتوقفش أو تتحذف من إدارة الطاقم.</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500">
              {protectedStaff.length} حساب
            </span>
          </div>

          <div className="divide-y divide-surface-hover">
            {protectedStaff.map((member) => (
              <div key={member.id} className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-foreground">{member.full_name || member.username}</p>
                    <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-black text-white border border-white/10">
                      Super Admin
                    </span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                      {roleLabel(member.role)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                      دخول ثابت
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">{member.email}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    آخر دخول: {member.last_login_at ? new Date(member.last_login_at).toLocaleString() : "—"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(member)}>
                    <Edit2 className="w-3 h-3" /> تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleResetPassword(member.id)}
                  >
                    <LockKeyhole className="w-3 h-3" /> إعادة تعيين
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface border border-surface-hover rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-surface-hover px-4 py-3">
          <div>
            <h2 className="text-sm font-black text-foreground">الطاقم التشغيلي</h2>
            <p className="text-xs text-gray-500 mt-0.5">كل الحسابات اللي بتدير التشغيل اليومي، من غير الحسابات المحمية.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-bold text-gray-400">
            {teamStaff.length} حساب
          </span>
        </div>
        <div className="grid grid-cols-12 bg-surface-hover px-4 py-3 text-xs font-bold text-gray-500">
          <div className="col-span-2">الاسم</div>
          <div className="col-span-2">البريد</div>
          <div className="col-span-2">المسمى</div>
          <div className="col-span-2">الحالة</div>
          <div className="col-span-2">آخر دخول</div>
          <div className="col-span-2 text-left">الإجراءات</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : teamStaff.length === 0 ? (
          <div className="py-10 text-center text-gray-500">لا يوجد طاقم تشغيلي بعد</div>
        ) : (
          teamStaff.map((s) => (
            <div key={s.id} className="grid grid-cols-12 px-4 py-3 border-t border-surface-hover text-sm items-center">
              <div className="col-span-2">
                <div className="font-bold text-foreground">{s.full_name || s.username}</div>
                <div className="text-xs text-gray-500">{s.username}</div>
              </div>
              <div className="col-span-2">{s.email}</div>
              <div className="col-span-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                {roleLabel(s.role)}
              </div>
              <div className="col-span-2">
                {s.disabled ? (
                  <span className="text-rose-500 text-xs font-bold">معطل</span>
                ) : (
                  <span className="text-emerald-500 text-xs font-bold">نشط</span>
                )}
              </div>
              <div className="col-span-2 text-xs text-gray-500">
                {s.last_login_at ? new Date(s.last_login_at).toLocaleString() : "—"}
              </div>
              <div className="col-span-2 flex items-center gap-2 justify-end">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(s)}>
                  <Edit2 className="w-3 h-3" /> تعديل
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => handleResetPassword(s.id)}
                >
                  <LockKeyhole className="w-3 h-3" /> إعادة تعيين
                </Button>
                <Button
                  size="sm"
                  variant={s.disabled ? "outline" : "danger"}
                  className="gap-1"
                  onClick={() => handleDisable(s.id, !s.disabled)}
                  disabled={s.role === 'super_admin'}
                  title={s.role === 'super_admin' ? 'السوبر أدمن له دخول ثابت وماينفعش يتعطل من هنا' : undefined}
                >
                  {s.disabled ? <CheckCircle2 className="w-3 h-3" /> : <Slash className="w-3 h-3" />}
                  {s.disabled ? "تفعيل" : "تعطيل"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                  onClick={() => handleDeleteStaff(s)}
                  disabled={user?.id === s.id || s.role === 'super_admin'}
                  title={s.role === 'super_admin' ? "السوبر أدمن له دخول ثابت وماينفعش يتحذف من هنا" : user?.id === s.id ? "لا يمكنك حذف حسابك الحالي" : "حذف الموظف نهائيًا"}
                >
                  <Trash2 className="w-3 h-3" />
                  حذف
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-hover rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-surface-hover">
              <div>
                <h2 className="text-xl font-black text-foreground">
                  {editing ? "تعديل موظف" : "إضافة موظف جديد"}
                </h2>
                <p className="text-xs text-gray-500">الصلاحيات تُعدل من هنا مباشرة</p>
              </div>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                إغلاق
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-bold">الاسم الكامل</label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-bold">اسم المستخدم</label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-bold">البريد</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
                <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 font-bold">الدور</label>
                  <InfoHint text={getRoleMeta(form.role).description} />
                </div>
                <select
                  className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
                  style={{ colorScheme: "dark" }}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] leading-5 text-gray-500">{getRoleMeta(form.role).description}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-bold">كلمة مرور مؤقتة (اختياري)</label>
                <Input
                  type="text"
                  placeholder="ستُولد تلقائياً إن تركتها فارغة"
                  value={form.tempPassword}
                  onChange={(e) => setForm({ ...form, tempPassword: e.target.value })}
                />
              </div>
              <div className="space-y-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.disabled}
                  onChange={(e) => setForm({ ...form, disabled: e.target.checked })}
                />
                <span className="text-sm text-gray-500">تعطيل الحساب</span>
                <InfoHint text="لو فعلت الاختيار ده، الموظف مش هيقدر يسجل دخول لحسابه لحد ما ترجع تفعله تاني." />
              </div>
            </div>

            <div className="rounded-2xl border border-surface-hover bg-surface-hover/20">
              <button
                type="button"
                onClick={() => setPermissionsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
              >
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-gray-500">الصلاحيات</div>
                  <InfoHint text="كل صلاحية من دول بتحدد الموظف هيشوف إيه وهيقدر يعمل إيه جوه لوحة الإدارة." />
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
                    {form.permissions.length} مفعلة
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${permissionsOpen ? "rotate-180" : ""}`} />
              </button>
              {permissionsOpen && (
                <div className="border-t border-surface-hover px-4 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {PERMISSION_OPTIONS.map((perm) => {
                      const meta = getPermissionMeta(perm);
                      return (
                      <label
                        key={perm}
                        title={meta.description}
                        className={`group relative flex items-center gap-2 text-xs rounded-xl px-3 py-2 border ${
                          form.permissions.includes(perm) ? "border-primary text-primary" : "border-surface-hover text-gray-500"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(perm)}
                          onChange={() => togglePerm(perm)}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{meta.label}</span>
                            <InfoHint text={meta.description} />
                          </div>
                          <span className="mt-0.5 block text-[10px] leading-4 text-gray-500">
                            {meta.description}
                          </span>
                        </div>
                      </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-surface-hover bg-surface-hover/40">
              <button
                type="button"
                onClick={() => setPreviewOpen((prev) => !prev)}
                className="flex w-full items-start justify-between gap-3 px-4 py-4 text-start"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-gray-500">معاينة لوحة الموظف</div>
                    <InfoHint text="المعاينة دي بتوضح لك الأقسام اللي هتظهر للموظف في السايدبار بناءً على الدور والصلاحيات الحالية قبل ما تحفظ." />
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-gray-500">
                    كده تقدر تعرف بالضبط هو هيشوف إيه قدامه في لوحة التحكم، وإيه اللي هيفضل مخفي عنه.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-black ${previewAccess.className}`}>
                    {previewAccess.label}
                  </div>
                  <ChevronDown className={`mt-1 h-4 w-4 text-gray-500 transition-transform ${previewOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {previewOpen && (
                <div className="border-t border-surface-hover px-4 py-4 space-y-4">
                  <div className="rounded-2xl border border-surface-hover bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-surface-hover bg-surface px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-foreground">{form.full_name || "اسم الموظف هيظهر هنا"}</p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {getRoleMeta(form.role).label} · {previewAccess.description}
                        </p>
                      </div>
                      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                        <Shield className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                      <p className="mb-3 text-sm font-black text-foreground">اللي هيظهر للموظف</p>
                      <div className="rounded-2xl border border-emerald-500/10 bg-surface p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-400">شكل قريب من السايدبار</p>
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400">
                            {visiblePreviewItems.length} قسم ظاهر
                          </span>
                        </div>
                        <div className="space-y-2">
                          {visiblePreviewItems.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-start gap-3 rounded-xl border border-emerald-500/10 bg-background/80 px-3 py-2.5"
                            >
                              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 text-emerald-400">
                                <item.icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                                    {item.access}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] leading-5 text-gray-500">{item.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-surface-hover bg-surface/60 p-4">
                      <p className="mb-3 text-sm font-black text-foreground">اللي هيبقى مخفي عنه</p>
                      <div className="rounded-2xl border border-surface-hover bg-background/70 p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-400">أقسام مش هتظهر في السايدبار</p>
                          <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black text-gray-400">
                            {hiddenPreviewItems.length} قسم مخفي
                          </span>
                        </div>
                        <div className="space-y-2">
                          {hiddenPreviewItems.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-start gap-3 rounded-xl border border-dashed border-surface-hover bg-background px-3 py-2.5 opacity-80"
                            >
                              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-hover bg-surface text-gray-500">
                                <item.icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-bold text-gray-300">{item.label}</p>
                                  <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-gray-400">
                                    مخفي
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] leading-5 text-gray-500">{item.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 -mx-6 mt-2 border-t border-surface-hover bg-surface px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave}>{editing ? "حفظ التغييرات" : "إضافة"}</Button>
            </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

