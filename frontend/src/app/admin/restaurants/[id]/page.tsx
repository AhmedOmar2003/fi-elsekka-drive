"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Store,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RelatedProductsPicker } from "@/components/admin/related-products-picker";
import { deleteProduct, uploadProductImage } from "@/services/adminService";
import {
  type Restaurant,
  fetchAdminRestaurantProducts,
  fetchRestaurantById,
  saveRestaurantMenuProduct,
} from "@/services/restaurantsService";
import type { Product } from "@/services/productsService";
import { getProductCatalogMetadata } from "@/lib/product-metadata";
import { getRestaurantSizeOptions } from "@/lib/product-variants";

type MenuFormState = {
  name: string;
  short_description: string;
  description: string;
  price: string;
  discount_percentage: string;
  image_url: string;
  available: boolean;
  menu_section: string;
  related_product_ids: string[];
  size_options: { id: string; label: string; price: string }[];
  custom_specs: { label: string; value: string }[];
};

const EMPTY_FORM: MenuFormState = {
  name: "",
  short_description: "",
  description: "",
  price: "",
  discount_percentage: "",
  image_url: "",
  available: true,
  menu_section: "",
  related_product_ids: [],
  size_options: [],
  custom_specs: [],
};

const PIZZA_SIZE_PRESET = [
  { id: "large", label: "كبيرة", price: "" },
  { id: "medium", label: "متوسطة", price: "" },
  { id: "small", label: "صغيرة", price: "" },
];

function extractRestaurantCustomSpecs(product: Product) {
  if (Array.isArray(product.product_specifications) && product.product_specifications.length > 0) {
    return product.product_specifications
      .filter((spec) => spec?.label?.trim() && spec?.description?.trim())
      .map((spec) => ({
        label: spec.label.trim(),
        value: spec.description.trim(),
      }));
  }

  const fallbackSpecs = Array.isArray(product.specifications?.custom_specs)
    ? product.specifications.custom_specs
    : [];

  return fallbackSpecs
    .filter((spec: any) => spec?.label?.trim() && (spec?.description || spec?.value || "").trim())
    .map((spec: any) => ({
      label: spec.label.trim(),
      value: String(spec.description || spec.value).trim(),
    }));
}

function normalizeDiscountFromProduct(product: Product) {
  const metadata = getProductCatalogMetadata(product.specifications);
  if (typeof product.discount_percentage === "number" && product.discount_percentage > 0) {
    return String(product.discount_percentage);
  }

  if (metadata.oldPrice && metadata.oldPrice > product.price) {
    const discount = Math.round((1 - product.price / metadata.oldPrice) * 100);
    return discount > 0 ? String(discount) : "";
  }

  return "";
}

function buildDerivedOldPrice(price: number, discountPercentage: number) {
  if (!discountPercentage || discountPercentage <= 0 || discountPercentage >= 100) return null;
  const original = price / (1 - discountPercentage / 100);
  return Math.round(original * 100) / 100;
}

export default function AdminRestaurantProductsPage() {
  const params = useParams<{ id: string }>();
  const restaurantId = Array.isArray(params?.id) ? params?.id[0] : params?.id;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<MenuFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!restaurantId) return;
    setLoading(true);

    const [restaurantData, productData] = await Promise.all([
      fetchRestaurantById(restaurantId),
      fetchAdminRestaurantProducts(restaurantId),
    ]);

    setRestaurant(restaurantData);
    setProducts(productData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [restaurantId]);

  const restaurantProductsForPicker = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        image_url: product.image_url || null,
        category_id: product.category_id || null,
        categories: product.categories || null,
      })),
    [products]
  );

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    const metadata = getProductCatalogMetadata(product.specifications);
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      short_description: metadata.shortDescription || "",
      description: product.description || "",
      price: String(product.price || ""),
      discount_percentage: normalizeDiscountFromProduct(product),
      image_url: product.image_url || "",
      available: metadata.restaurantAvailable !== false,
      menu_section: metadata.restaurantSection || "",
      related_product_ids: metadata.relatedProductIds || [],
      size_options: getRestaurantSizeOptions(product.specifications).map((option) => ({
        id: option.id,
        label: option.label,
        price: String(option.price),
      })),
      custom_specs: extractRestaurantCustomSpecs(product),
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const url = await uploadProductImage(file);
    setUploading(false);

    if (!url) {
      toast.error("رفع صورة المنتج ماكملش، جرّب تاني");
      return;
    }

    setForm((prev) => ({ ...prev, image_url: url }));
    toast.success("اترفعت صورة المنتج");
  };

  const handleSave = async () => {
    if (!restaurant) return;

    const name = form.name.trim();
    const shortDescription = form.short_description.trim();
    const description = form.description.trim();
    const sizeOptions = form.size_options
      .map((option, index) => ({
        id: option.id || `size-${index + 1}`,
        label: option.label.trim(),
        price: Number(option.price || 0),
      }))
      .filter((option) => option.label && Number.isFinite(option.price) && option.price > 0);
    const price = sizeOptions[0]?.price || Number(form.price);
    const discountPercentage = Number(form.discount_percentage || 0);

    if (!name) {
      toast.error("اكتب اسم المنتج الأول");
      return;
    }

    if (!form.image_url.trim()) {
      toast.error("ضيف صورة للمنتج علشان يظهر بشكل مناسب");
      return;
    }

    if (!sizeOptions.length && (!Number.isFinite(price) || price <= 0)) {
      toast.error("اكتب سعر صحيح للمنتج");
      return;
    }

    if (!shortDescription) {
      toast.error("اكتب وصف قصير سريع علشان العميل يفهم المنتج من أول نظرة");
      return;
    }

    if (discountPercentage < 0 || discountPercentage >= 100) {
      toast.error("نسبة الخصم لازم تكون من 0 لحد 99");
      return;
    }

    setSaving(true);
    try {
      await saveRestaurantMenuProduct({
        restaurant,
        productId: editingProduct?.id || null,
        name,
        shortDescription,
        description,
        price,
        oldPrice: buildDerivedOldPrice(price, discountPercentage),
        discountPercentage,
        imageUrl: form.image_url.trim(),
        available: form.available,
        menuSection: form.menu_section,
        relatedProductIds: form.related_product_ids,
        sizeOptions,
        specs: form.custom_specs
          .map((spec) => ({
            label: spec.label.trim(),
            description: spec.value.trim(),
          }))
          .filter((spec) => spec.label && spec.description),
      });

      toast.success(editingProduct ? "تم تحديث منتج المطعم" : "تمت إضافة منتج جديد للمطعم");
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setEditingProduct(null);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل حفظ منتج المطعم";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(`متأكد إنك عاوز تحذف "${product.name}" من منيو ${restaurant?.name || "المطعم"}؟`);
    if (!confirmed) return;

    const result = await deleteProduct(product.id);
    if (!result.success) {
      toast.error(result.error || "فشل حذف المنتج");
      return;
    }

    toast.success("تم حذف المنتج من منيو المطعم");
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="rounded-3xl border border-surface-hover bg-surface p-8 text-center">
        <Store className="mx-auto h-10 w-10 text-gray-500" />
        <h1 className="mt-4 text-xl font-black text-foreground">المطعم ده مش موجود</h1>
        <p className="mt-2 text-sm text-gray-500">ممكن يكون اتحذف أو الرابط نفسه مش صحيح.</p>
        <Button asChild className="mt-5">
          <Link href="/admin/restaurants">ارجع لإدارة المطاعم</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" className="h-auto px-0 text-gray-500 hover:text-foreground">
            <Link href="/admin/restaurants" className="gap-2">
              <ArrowRight className="h-4 w-4" />
              رجوع لإدارة المطاعم
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground">منتجات مطعم {restaurant.name}</h1>
            <p className="text-sm text-gray-500">
              من هنا تضيف المنيو بسرعة من غير ما تدخل على فورم المنتجات الكبيرة. السعر هنا هو السعر الحالي للعميل،
              ولو فيه خصم اكتب نسبته بس.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة منتج للمطعم
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-surface-hover bg-surface p-5">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-3xl border border-surface-hover bg-background/70">
              {restaurant.image_url ? (
                <Image src={restaurant.image_url} alt={restaurant.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-500">
                  <Store className="h-7 w-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-black text-foreground">{restaurant.name}</p>
              <p className="mt-1 text-sm text-gray-500">
                {restaurant.short_description || "أضف منيو المطعم من هنا وخلي الربط كله يفضل من نفس المكان."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                  {restaurant.is_available ? "المطعم متاح الآن" : "المطعم غير متاح الآن"}
                </span>
                {restaurant.phone ? (
                  <span className="inline-flex rounded-full bg-background/80 px-3 py-1 text-xs font-black text-gray-400">
                    {restaurant.phone}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-3xl border border-surface-hover bg-surface p-4">
            <p className="text-xs font-black text-gray-500">إجمالي منتجات المنيو</p>
            <p className="mt-2 text-3xl font-black text-foreground">{products.length}</p>
          </div>
          <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <p className="text-xs font-black text-gray-500">المتاح الآن</p>
            <p className="mt-2 text-3xl font-black text-emerald-400">
                {
                  products.filter((product) => {
                    const metadata = getProductCatalogMetadata(product.specifications);
                    return metadata.restaurantAvailable !== false;
                  }).length
                }
            </p>
          </div>
          <div className="rounded-3xl border border-amber-500/15 bg-amber-500/5 p-4">
            <p className="text-xs font-black text-gray-500">غير المتاح الآن</p>
            <p className="mt-2 text-3xl font-black text-amber-400">
                {
                  products.filter((product) => {
                    const metadata = getProductCatalogMetadata(product.specifications);
                    return metadata.restaurantAvailable === false;
                  }).length
                }
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-surface-hover bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-foreground">منيو المطعم</h2>
            <p className="mt-1 text-xs text-gray-500">
              التقييمات والمنتجات المشابهة هتشتغل طبيعي، لكن الاختيار اليدوي هنا هيبقى من نفس المطعم فقط.
            </p>
          </div>
        </div>

        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-surface-hover bg-background/50 px-6 py-14 text-center">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-gray-600" />
            <p className="mt-4 text-sm font-black text-foreground">لسه ما ضفتش منتجات للمطعم ده</p>
            <p className="mt-2 text-xs text-gray-500">ابدأ بأول منتج، وبعدها تقدر تعدّل أو توقف أي عنصر من نفس الصفحة.</p>
            <Button className="mt-5 gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              إضافة أول منتج
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const metadata = getProductCatalogMetadata(product.specifications);
              const isAvailable = metadata.restaurantAvailable !== false;
              const discountPercentage = typeof product.discount_percentage === "number" ? product.discount_percentage : 0;

              return (
                <div key={product.id} className="rounded-3xl border border-surface-hover bg-background/60 p-4">
                  <div className="relative mb-4 aspect-square overflow-hidden rounded-3xl border border-surface-hover bg-surface">
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="(max-width: 1280px) 50vw, 20vw" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-500">
                        <ImagePlus className="h-7 w-7" />
                      </div>
                    )}
                    <div className="absolute right-3 top-3 flex flex-col gap-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${
                          isAvailable ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                        }`}
                      >
                        {isAvailable ? "متاح الآن" : "غير متاح"}
                      </span>
                      {discountPercentage > 0 ? (
                        <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-[11px] font-black text-white">
                          خصم %{discountPercentage}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="line-clamp-1 text-base font-black text-foreground">{product.name}</p>
                    {metadata.restaurantSection ? (
                      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                        {metadata.restaurantSection}
                      </span>
                    ) : null}
                    <p className="line-clamp-2 text-sm text-gray-500">
                      {metadata.shortDescription || product.description || "بدون وصف قصير حتى الآن."}
                    </p>
                    <div className="flex items-end justify-between gap-3 border-t border-surface-hover pt-3">
                      <div>
                        <p className="text-xs text-gray-500">السعر الحالي</p>
                        <div className="mt-1 flex items-end gap-2">
                          <span className="text-2xl font-black text-primary">{product.price}</span>
                          <span className="pb-1 text-sm font-black text-primary/80">ج.م</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(product)}>
                          <Pencil className="h-3.5 w-3.5" />
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => handleDelete(product)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-surface-hover bg-surface">
            <div className="flex items-center justify-between border-b border-surface-hover px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-foreground">
                  {editingProduct ? `تعديل منتج في ${restaurant.name}` : `إضافة منتج جديد لـ ${restaurant.name}`}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  فورم مبسطة مخصوص للمنيو. أنت تكتب السعر الحالي والخصم لو موجود، والنظام يكمل الربط من تلقاء نفسه.
                </p>
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
              <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-black text-gray-400">اسم المنتج</label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="مثال: بيتزا مارجريتا كبيرة"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">السعر الحالي</label>
                      <Input
                        type="number"
                        value={form.price}
                        onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                        placeholder="اكتب السعر النهائي للعميل"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">نسبة الخصم لو موجودة</label>
                      <Input
                        type="number"
                        value={form.discount_percentage}
                        onChange={(e) => setForm((prev) => ({ ...prev, discount_percentage: e.target.value }))}
                        placeholder="مثال: 15"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-black text-gray-400">تصنيف المنيو</label>
                      <select
                        value={form.menu_section}
                        onChange={(e) =>
                          setForm((prev) => {
                            const nextSection = e.target.value
                            const shouldSeedPizzaSizes =
                              nextSection === "بيتزا" &&
                              prev.size_options.length === 0

                            return {
                              ...prev,
                              menu_section: nextSection,
                              size_options: shouldSeedPizzaSizes ? PIZZA_SIZE_PRESET : prev.size_options,
                            }
                          })
                        }
                        className="w-full rounded-2xl border border-surface-hover bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                      >
                        <option value="">بدون تصنيف محدد</option>
                        {(restaurant.menu_sections || []).map((section) => (
                          <option key={section} value={section}>
                            {section}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500">
                        لو اخترت تصنيف، المنتج هيظهر تحت التبويب المناسب في صفحة المطعم.
                      </p>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-black text-gray-400">الأسعار حسب الحجم</label>
                      <div className="rounded-2xl border border-surface-hover bg-background/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-foreground">اختيارات الحجم للعميل</p>
                            <p className="mt-1 text-[11px] leading-6 text-gray-500">
                              لو المنتج له أحجام مثل بيتزا أو كريب، اكتب كل حجم مع سعره. أول حجم صحيح هنا هو اللي هيظهر كسعر البداية.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                size_options: [...prev.size_options, { id: `size-${Date.now()}`, label: "", price: "" }],
                              }))
                            }
                          >
                            <Plus className="h-4 w-4" />
                            أضف حجم
                          </Button>
                        </div>

                        {form.size_options.length === 0 ? (
                          <div className="mt-4 rounded-2xl border border-dashed border-surface-hover px-4 py-5 text-center text-xs text-gray-500">
                            لو المنتج بسعر واحد فقط، سيب الجزء ده فاضي واستخدم السعر الحالي فوق.
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {form.size_options.map((option, index) => (
                              <div key={option.id || index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                <Input
                                  value={option.label}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      size_options: prev.size_options.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, label: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="الحجم: كبيرة"
                                />
                                <Input
                                  type="number"
                                  value={option.price}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      size_options: prev.size_options.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, price: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="السعر: 320"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="gap-2 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                                  onClick={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      size_options: prev.size_options.filter((_, itemIndex) => itemIndex !== index),
                                    }))
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                  حذف
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-black text-gray-400">وصف قصير</label>
                      <Input
                        value={form.short_description}
                        onChange={(e) => setForm((prev) => ({ ...prev, short_description: e.target.value }))}
                        placeholder="سطر سريع يشرح الوجبة أو المنتج"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-black text-gray-400">وصف كامل</label>
                      <textarea
                        rows={5}
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full rounded-2xl border border-surface-hover bg-background px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
                        placeholder="تفاصيل أكثر عن المكونات أو الحجم أو أي حاجة مهمة للعميل"
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-surface-hover bg-background/60 p-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-400">صورة المنتج</label>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-surface-hover bg-surface">
                          {form.image_url ? (
                            <Image src={form.image_url} alt="صورة المنتج" fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-500">
                              <ImagePlus className="h-6 w-6" />
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
                                if (file) handleImageUpload(file);
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
                              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                              ارفع صورة
                            </Button>
                            <span className="text-[11px] text-gray-500">بنحوّل الصورة تلقائيًا لـ WebP علشان تبقى أخف وأسرع.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-surface-hover bg-background/60 p-4">
                    <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                      <input
                        type="checkbox"
                        checked={form.available}
                        onChange={(e) => setForm((prev) => ({ ...prev, available: e.target.checked }))}
                      />
                      المنتج متاح الآن
                    </label>
                    <p className="mt-2 text-xs text-gray-500">
                      لو شلت العلامة، المنتج يفضل موجود في المنيو لكن العميل هيشوفه غير متاح حاليًا.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-surface-hover bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-foreground">مواصفات بسيطة للمنتج</p>
                        <p className="mt-1 text-xs text-gray-500">
                          لو الوجبة أو المنتج له تفاصيل زي الحجم، الحشو، أو عدد القطع، اكتبها هنا كاسم وقيمة.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            custom_specs: [...prev.custom_specs, { label: "", value: "" }],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                        إضافة مواصفة
                      </Button>
                    </div>

                    {form.custom_specs.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-surface-hover px-4 py-5 text-center text-xs text-gray-500">
                        لو المنتج ملوش مواصفات إضافية، سيب الجزء ده فاضي عادي.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {form.custom_specs.map((spec, index) => (
                          <div key={`${index}-${spec.label}-${spec.value}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                            <Input
                              value={spec.label}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  custom_specs: prev.custom_specs.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: e.target.value } : item
                                  ),
                                }))
                              }
                              placeholder="اسم المواصفة: الحجم"
                            />
                            <Input
                              value={spec.value}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  custom_specs: prev.custom_specs.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, value: e.target.value } : item
                                  ),
                                }))
                              }
                              placeholder="القيمة: كبير"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="gap-2 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  custom_specs: prev.custom_specs.filter((_, itemIndex) => itemIndex !== index),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              حذف
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-primary/10 bg-primary/5 p-4 text-sm text-gray-300">
                    <p className="font-black text-foreground">النظام هيعمل إيه تلقائيًا؟</p>
                    <ul className="mt-3 space-y-2 text-xs leading-6 text-gray-400">
                      <li>• المنتج هيتربط تلقائيًا بـ {restaurant.name}.</li>
                      <li>• هيتحط داخل قسم طعام وتصنيف مطاعم من غير ما تختاره يدويًا.</li>
                      <li>• لو اخترت تصنيف منيو، العميل هيلاقيه فوق في تبويب مستقل داخل صفحة المطعم.</li>
                      <li>• المنتجات المشابهة اليدوية هنا هتكون من نفس المطعم فقط.</li>
                      <li>• التقييمات تفضل شغالة طبيعي على صفحة المنتج.</li>
                    </ul>
                  </div>

                  <RelatedProductsPicker
                    products={restaurantProductsForPicker}
                    selectedIds={form.related_product_ids}
                    onChange={(ids) => setForm((prev) => ({ ...prev, related_product_ids: ids }))}
                    currentProductId={editingProduct?.id || null}
                    currentCategoryId={restaurant.category_id || null}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-surface-hover px-6 py-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingProduct ? "حفظ التعديلات" : "إضافة المنتج"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
