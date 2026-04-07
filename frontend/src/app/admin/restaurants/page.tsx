"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChipsInput } from "@/components/admin/chips-input";
import { toast } from "sonner";
import { clearExperimentalAdminData, fetchAdminCategories } from "@/services/adminService";
import {
  Restaurant,
  createRestaurant,
  deleteRestaurant,
  fetchAdminRestaurants,
  updateRestaurant,
  uploadRestaurantImage,
} from "@/services/restaurantsService";
import { Eye, Loader2, Pencil, Plus, Store, Trash2, Upload, UtensilsCrossed, X } from "lucide-react";

type Category = { id: string; name: string };

const EMPTY_FORM = {
  name: "",
  short_description: "",
  description: "",
  cuisine: "",
  image_url: "",
  phone: "",
  manager_name: "",
  manager_email: "",
  manager_password: "",
  menu_sections: [] as string[],
  is_active: true,
  is_available: true,
  sort_order: "0",
};

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isClearingAllRestaurants, setIsClearingAllRestaurants] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const foodCategory = useMemo(
    () => categories.find((category) => category.name === "طعام") || null,
    [categories]
  );

  const loadData = async () => {
    setLoading(true);
    const [restaurantsData, categoriesData] = await Promise.all([
      fetchAdminRestaurants(),
      fetchAdminCategories(),
    ]);
    setRestaurants(restaurantsData);
    setCategories(categoriesData as Category[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (restaurant: Restaurant) => {
    setEditing(restaurant);
    setForm({
      name: restaurant.name || "",
      short_description: restaurant.short_description || "",
      description: restaurant.description || "",
      cuisine: restaurant.cuisine || "",
      image_url: restaurant.image_url || "",
      phone: restaurant.phone || "",
      manager_name: restaurant.manager_name || "",
      manager_email: restaurant.manager_email || "",
      manager_password: "",
      menu_sections: restaurant.menu_sections || [],
      is_active: restaurant.is_active,
      is_available: restaurant.is_available,
      sort_order: String(restaurant.sort_order ?? 0),
    });
    setModalOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const url = await uploadRestaurantImage(file);
    setUploading(false);

    if (!url) {
      toast.error("رفع الصورة ماكملش، جرّب تاني");
      return;
    }

    setForm((prev) => ({ ...prev, image_url: url }));
    toast.success("اترفعت صورة المطعم ✨");
  };

  const syncRestaurantAccount = async (restaurantId: string, restaurantName: string, previousManagerEmail?: string | null) => {
    const managerEmail = form.manager_email.trim().toLowerCase();
    const managerPassword = form.manager_password.trim();
    const managerName = form.manager_name.trim() || restaurantName;

    if (!managerEmail) return { ok: true, skipped: true };

    const response = await fetch("/api/admin/restaurants/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        restaurantName,
        managerName,
        managerEmail,
        previousManagerEmail: previousManagerEmail || null,
        password: managerPassword || undefined,
        disabled: !form.is_active,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "المطعم اتحفظ لكن حساب الدخول ما اتظبطش");
    }

    return { ok: true, skipped: false };
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("اكتب اسم المطعم الأول");
      return;
    }

    if (!foodCategory?.id) {
      toast.error("قسم طعام مش موجود حاليًا، ضيفه الأول من الأقسام");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      cuisine: form.cuisine.trim() || null,
      image_url: form.image_url.trim() || null,
      phone: form.phone.trim() || null,
      manager_name: form.manager_name.trim() || null,
      manager_email: form.manager_email.trim() || null,
      menu_sections: form.menu_sections,
      category_id: foodCategory.id,
      is_active: form.is_active,
      is_available: form.is_available,
      sort_order: Number(form.sort_order) || 0,
    };

    const result = editing
      ? await updateRestaurant(editing.id, payload)
      : await createRestaurant(payload);

    setSaving(false);

    if (result.error) {
      toast.error(result.error.message || "فشل حفظ المطعم");
      return;
    }

    const savedRestaurant = result.data as Restaurant | null;

    try {
      if (savedRestaurant?.id) {
        await syncRestaurantAccount(savedRestaurant.id, payload.name, editing?.manager_email || null);
      }

      toast.success(editing ? "تم تحديث بيانات المطعم" : "تم إضافة المطعم");
      setModalOpen(false);
      await loadData();
    } catch (accountError) {
      const message = accountError instanceof Error ? accountError.message : "المطعم اتحفظ لكن حساب الدخول ما اتظبطش";
      toast.error(message);
      if (savedRestaurant) {
        setEditing(savedRestaurant);
      }
      await loadData();
    }
  };

  const handleDelete = async (restaurant: Restaurant) => {
    const confirmed = window.confirm(`متأكد إنك عاوز تحذف مطعم "${restaurant.name}"؟`);
    if (!confirmed) return;

    const result = await deleteRestaurant(restaurant.id);
    if (result.error) {
      toast.error(result.error.message || "فشل حذف المطعم");
      return;
    }

    toast.success("تم حذف المطعم");
    await loadData();
  };

  const handleClearAllRestaurants = async () => {
    const confirmed = window.confirm('هيمسح كل المطاعم التجريبية ومنيوهاتها. لو عندك طلبات مطاعم، امسح الطلبات الأول. متأكد؟');
    if (!confirmed) return;

    setIsClearingAllRestaurants(true);
    try {
      const result = await clearExperimentalAdminData('restaurants');
      const deletedRestaurants = Number(result?.summary?.deletedRestaurants || 0);
      toast.success(deletedRestaurants > 0 ? `تم مسح ${deletedRestaurants} مطعم تجريبي` : 'تم مسح المطاعم التجريبية');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'فشل مسح المطاعم التجريبية');
    } finally {
      setIsClearingAllRestaurants(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground">إدارة المطاعم</h1>
          <p className="text-sm text-gray-500">
            من هنا تضيف المطعم وتجهز بياناته، وبعدها تدخل مباشرة على صفحة منتجات المطعم وتضيف المنيو من هناك.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClearAllRestaurants}
            disabled={isClearingAllRestaurants}
            className="gap-2 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
          >
            {isClearingAllRestaurants ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            مسح الكل
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة مطعم
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-hover bg-surface p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-surface-hover bg-background/60 p-4">
            <p className="text-xs font-black text-gray-500">إجمالي المطاعم</p>
            <p className="mt-2 text-3xl font-black text-foreground">{restaurants.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <p className="text-xs font-black text-gray-500">المتاح حاليًا</p>
            <p className="mt-2 text-3xl font-black text-emerald-400">
              {restaurants.filter((item) => item.is_available && item.is_active).length}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
            <p className="text-xs font-black text-gray-500">الموقوف أو غير المتاح</p>
            <p className="mt-2 text-3xl font-black text-amber-400">
              {restaurants.filter((item) => !item.is_available || !item.is_active).length}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-hover bg-surface overflow-hidden">
        <div className="grid grid-cols-12 gap-3 border-b border-surface-hover bg-surface-hover px-4 py-3 text-xs font-black text-gray-500">
          <div className="col-span-4">المطعم</div>
          <div className="col-span-2">الحالة</div>
          <div className="col-span-2">التوفر</div>
          <div className="col-span-2">بيانات التواصل</div>
          <div className="col-span-2 text-left">التحكم</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : restaurants.length === 0 ? (
            <div className="py-16 text-center">
              <Store className="mx-auto h-10 w-10 text-gray-600" />
              <p className="mt-4 text-sm font-bold text-foreground">لسه ما أضفتش مطاعم</p>
            <p className="mt-1 text-xs text-gray-500">ابدأ بإضافة أول مطعم، وبعدها افتح صفحة منتجاته من هنا وأضف المنيو بسهولة.</p>
          </div>
        ) : (
          restaurants.map((restaurant) => (
            <div key={restaurant.id} className="grid grid-cols-12 gap-3 border-t border-surface-hover px-4 py-4 text-sm items-center">
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-surface-hover bg-background/70">
                  {restaurant.image_url ? (
                    <Image src={restaurant.image_url} alt={restaurant.name} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-500">
                      <Store className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-black text-foreground">{restaurant.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                    {restaurant.short_description || "وصف قصير للمطعم هيظهر للعميل هنا."}
                  </p>
                  {restaurant.cuisine ? (
                    <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
                      {restaurant.cuisine}
                    </span>
                  ) : null}
                  {restaurant.menu_sections?.length ? (
                    <p className="mt-2 text-[11px] text-gray-500">
                      تصنيفات المنيو: {restaurant.menu_sections.join(" - ")}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="col-span-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${restaurant.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {restaurant.is_active ? "ظاهر في المتجر" : "موقوف"}
                </span>
              </div>
              <div className="col-span-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${restaurant.is_available ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-400"}`}>
                  {restaurant.is_available ? "متاح الآن" : "غير متاح الآن"}
                </span>
              </div>
              <div className="col-span-2 text-xs text-gray-500">
                <p>{restaurant.phone || "بدون هاتف"}</p>
                <p className="mt-1 truncate">{restaurant.manager_email || "بدون إيميل متابعة"}</p>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/admin/restaurants/overview/${restaurant.id}`} className="gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    صفحة المطعم
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/admin/restaurants/${restaurant.id}`} className="gap-1">
                    <UtensilsCrossed className="h-3.5 w-3.5" />
                    منتجات المطعم
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(restaurant)}>
                  <Pencil className="h-3 w-3" />
                  تعديل
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                  onClick={() => handleDelete(restaurant)}
                >
                  <Trash2 className="h-3 w-3" />
                  حذف
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-surface-hover bg-surface">
            <div className="flex items-center justify-between border-b border-surface-hover px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-foreground">{editing ? "تعديل مطعم" : "إضافة مطعم"}</h2>
                <p className="mt-1 text-xs text-gray-500">البيانات دي هتظهر للعميل داخل تصنيف المطاعم في قسم الطعام.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">اسم المطعم</label>
                  <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">الوصف القصير</label>
                  <Input
                    value={form.short_description}
                    onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
                    placeholder="هيظهر في كارت المطعم للعميل"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-black text-gray-400">الوصف الطويل</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full rounded-2xl border border-surface-hover bg-background px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
                    placeholder="اكتب نبذة أطول عن المطعم والقائمة اللي بيقدمها"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">نوع المطبخ</label>
                  <Input
                    value={form.cuisine}
                    onChange={(e) => setForm((prev) => ({ ...prev, cuisine: e.target.value }))}
                    placeholder="مثال: بيتزا إيطالي، أكل شرقي، وجبات سريعة..."
                  />
                </div>
                <div className="space-y-1.5">
                  <ChipsInput
                    label="تصنيفات المنيو"
                    helper="اكتب التصنيفات اللي هتظهر فوق منيو المطعم زي: بيتزا، كريب، مشروبات، حلويات."
                    placeholder="اكتب تصنيف واضغط Enter"
                    values={form.menu_sections}
                    onChange={(values) => setForm((prev) => ({ ...prev, menu_sections: values }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">هاتف المطعم</label>
                  <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">ترتيب الظهور</label>
                  <Input value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">اسم المسؤول داخل المطعم</label>
                  <Input value={form.manager_name} onChange={(e) => setForm((prev) => ({ ...prev, manager_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">إيميل المتابعة للمطعم</label>
                  <Input
                    type="email"
                    value={form.manager_email}
                    onChange={(e) => setForm((prev) => ({ ...prev, manager_email: e.target.value }))}
                    placeholder="الإيميل اللي المطعم هيسجل به في بوابة الطلبات"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-400">باسورد دخول المطعم</label>
                  <Input
                    type="password"
                    value={form.manager_password}
                    onChange={(e) => setForm((prev) => ({ ...prev, manager_password: e.target.value }))}
                    placeholder={editing ? "سيبه فاضي لو مش عاوز تغيّره" : "اكتب الباسورد اللي هتسلمه للمطعم"}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-black text-gray-400">صورة المطعم</label>
                  <div className="flex flex-col gap-3 rounded-2xl border border-surface-hover bg-background/60 p-4 md:flex-row md:items-center">
                    <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-surface-hover bg-surface">
                      {form.image_url ? (
                        <Image src={form.image_url} alt="صورة المطعم" fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-500">
                          <Store className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        value={form.image_url}
                        onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                        placeholder="أو الصق رابط الصورة هنا"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(file);
                            e.currentTarget.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          ارفع صورة
                        </Button>
                        <span className="text-[11px] text-gray-500">بنحوّل الصورة تلقائيًا لـ WebP لتبقى أخف وأسرع.</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-surface-hover bg-background/60 p-4">
                  <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    />
                    ظاهر في المتجر
                  </label>
                  <p className="mt-2 text-xs text-gray-500">لو شلت العلامة، المطعم يفضل محفوظ عندك لكن يختفي من المستخدمين.</p>
                </div>
                <div className="rounded-2xl border border-surface-hover bg-background/60 p-4">
                  <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={form.is_available}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_available: e.target.checked }))}
                    />
                    متاح الآن
                  </label>
                  <p className="mt-2 text-xs text-gray-500">العلامة دي هتظهر للمستخدم علشان يعرف إن المطعم شغال ومتقبل طلبات حاليًا.</p>
                </div>
                <div className="rounded-2xl border border-surface-hover bg-background/60 p-4 md:col-span-2">
                  <p className="text-sm font-bold text-foreground">بوابة المطعم</p>
                  <p className="mt-2 text-xs leading-6 text-gray-500">
                    لو كتبت الإيميل هنا، المطعم هيبقى له رابط دخول مستقل من <span dir="ltr" className="font-mono text-primary">/restaurant/login</span>.
                    الباسورد مطلوب أول مرة لو هتفتح للمطعم حساب، وبعد كده تقدر تسيبه فاضي لو مش محتاج تغيّره.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-surface-hover px-6 py-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? "حفظ التعديلات" : "إضافة المطعم"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
