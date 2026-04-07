"use client"

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import {
    fetchAdminProducts, fetchAdminCategories, createProduct,
    updateProduct, deleteProduct, uploadProductImage, saveProductSpecifications, clearExperimentalAdminData
} from '@/services/adminService';
import { Plus, Pencil, Trash2, Search, X, Upload, Loader2, ImageOff, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { BundleItem, getBundleItems, getProductMode, getBundleSummary, ProductMode } from '@/lib/product-presentation';
import {
    getCategoryTaxonomyConfig,
    getTaxonomyLabel,
    getTaxonomyPrimaryOptions,
    getTaxonomySecondaryOptions,
    getTaxonomyTertiaryOptions,
    getTaxonomySelection,
} from '@/lib/category-taxonomy';
import {
    extractBaseSpecifications,
    getProductCatalogMetadata,
    normalizeStringArray,
} from '@/lib/product-metadata';
import { getAdminProductPresets, getAdminProductSuggestions } from '@/lib/admin-product-suggestions';
import { ChipsInput } from '@/components/admin/chips-input';
import { RelatedProductsPicker } from '@/components/admin/related-products-picker';
import { fetchAdminRestaurants, type Restaurant } from '@/services/restaurantsService';

type Product = {
    id: string;
    name: string;
    price: number;
    stock_quantity: number;
    discount_percentage: number;
    category_id: string | null;
    image_url: string | null;
    images?: string[];
    description: string | null;
    show_in_offers?: boolean;
    specifications?: Record<string, any> | null;
    product_specifications?: { id?: string, label: string, description: string }[];
    categories?: { name: string } | null;
};

type Category = { id: string; name: string };

const EMPTY_FORM = {
    name: '', description: '', price: '', stock_quantity: '',
    discount_percentage: '', category_id: '', image_url: '',
    short_description: '',
    old_price: '',
    sku: '',
    brand: '',
    slug: '',
    status: 'published',
    featured: false,
    product_type: '',
    tags: [] as string[],
    keywords: [] as string[],
    gender: '',
    age_group: '',
    season: '',
    style: '',
    color_family: '',
    material: '',
    size_group: '',
    restaurant_id: '',
    restaurant_available: true,
    related_product_ids: [] as string[],
    images: ['', '', '', ''],
    image_file: null as File | null,
    images_files: [null, null, null, null] as (File | null)[],
    show_in_offers: false,
    specs: [] as { id?: string, label: string, description: string }[],
    product_mode: 'single' as ProductMode,
    bundle_items: [] as BundleItem[],
    taxonomy_primary: '',
    taxonomy_secondary: '',
    taxonomy_tertiary: '',
    specifications_base: {} as Record<string, any>,
};

const modalSectionLabelClass = "block text-xs font-black text-gray-300 mb-1.5";
const modalInputClass = "w-full rounded-xl border border-emerald-400/15 bg-[#101815] px-3 py-2.5 text-sm font-medium text-white placeholder:text-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const modalTextareaClass = `${modalInputClass} resize-none`;
const modalSelectClass = `${modalInputClass} appearance-none`;
const modalSoftPanelClass = "rounded-2xl border border-emerald-400/10 bg-[#101815]/80";

function normalizeSpecs(
    relationalSpecs?: { id?: string; label: string; description: string }[] | null,
    jsonSpecs?: Record<string, any> | null,
) {
    if (Array.isArray(relationalSpecs) && relationalSpecs.length > 0) {
        return relationalSpecs;
    }

    const fallbackSpecs = Array.isArray(jsonSpecs?.custom_specs) ? jsonSpecs.custom_specs : [];
    return fallbackSpecs
        .filter((spec: any) => spec?.label?.trim() && (spec?.description || spec?.value || '').trim())
        .map((spec: any) => ({
            label: spec.label.trim(),
            description: String(spec.description || spec.value).trim(),
        }));
}

export default function AdminProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [search, setSearch] = useState('');
    const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'single' | 'bundle'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isClearingAllProducts, setIsClearingAllProducts] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const selectedCategoryName = categories.find(category => category.id === form.category_id)?.name || '';
    const taxonomyConfig = getCategoryTaxonomyConfig(selectedCategoryName);
    const taxonomyPrimaryOptions = getTaxonomyPrimaryOptions(selectedCategoryName);
    const taxonomySecondaryOptions = getTaxonomySecondaryOptions(selectedCategoryName, form.taxonomy_primary);
    const taxonomyTertiaryOptions = getTaxonomyTertiaryOptions(selectedCategoryName, form.taxonomy_primary, form.taxonomy_secondary);
    const taxonomyLabels = getTaxonomyLabel(selectedCategoryName, form.taxonomy_primary, form.taxonomy_secondary, form.taxonomy_tertiary);
    const isRestaurantMenuProduct = selectedCategoryName === 'طعام' && form.taxonomy_primary === 'restaurants';
    const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === form.restaurant_id) || null;
    const smartSuggestions = React.useMemo(() => getAdminProductSuggestions({
        name: form.name,
        brand: form.brand,
        categoryName: selectedCategoryName,
        taxonomyPrimary: form.taxonomy_primary,
        taxonomySecondary: form.taxonomy_secondary,
        taxonomyTertiary: form.taxonomy_tertiary,
        taxonomyPrimaryLabel: taxonomyLabels.primary,
        taxonomySecondaryLabel: taxonomyLabels.secondary,
        taxonomyTertiaryLabel: taxonomyLabels.tertiary,
        productType: form.product_type,
        gender: form.gender,
        ageGroup: form.age_group,
        season: form.season,
        style: form.style,
        material: form.material,
        colorFamily: form.color_family,
        sizeGroup: form.size_group,
    }), [
        form.name,
        form.brand,
        form.taxonomy_primary,
        form.taxonomy_secondary,
        form.taxonomy_tertiary,
        form.product_type,
        form.gender,
        form.age_group,
        form.season,
        form.style,
        form.material,
        form.color_family,
        form.size_group,
        selectedCategoryName,
        taxonomyLabels.primary,
        taxonomyLabels.secondary,
        taxonomyLabels.tertiary,
    ]);
    const categoryPresets = React.useMemo(() => getAdminProductPresets(selectedCategoryName), [selectedCategoryName]);
    const suggestedSku = React.useMemo(() => {
        const basePrefix = smartSuggestions.sku.replace(/-\d{3}$/, '');
        if (!basePrefix) return smartSuggestions.sku;

        const matchingNumbers = products
            .filter(product => product.id !== editingId)
            .map(product => getProductCatalogMetadata(product.specifications).sku)
            .filter(Boolean)
            .filter(sku => sku.startsWith(`${basePrefix}-`))
            .map(sku => Number(sku.split('-').pop()))
            .filter(num => Number.isFinite(num));

        const nextNumber = (matchingNumbers.length ? Math.max(...matchingNumbers) : 0) + 1;
        return `${basePrefix}-${String(nextNumber).padStart(3, '0')}`;
    }, [editingId, products, smartSuggestions.sku]);

    const load = async () => {
        setIsLoading(true);
        const [p, c, r] = await Promise.all([fetchAdminProducts(), fetchAdminCategories(), fetchAdminRestaurants()]);
        setProducts(p as Product[]);
        setCategories(c as Category[]);
        setRestaurants(r);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const updateBundleItem = (index: number, key: keyof BundleItem, value: string) => {
        setForm(prev => {
            const nextItems = [...prev.bundle_items];
            nextItems[index] = { ...nextItems[index], [key]: value };
            return { ...prev, bundle_items: nextItems };
        });
    };

    const openNew = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setIsModalOpen(true);
    };

    const applySmartSuggestions = () => {
        setForm(prev => ({
            ...prev,
            sku: suggestedSku,
            product_type: smartSuggestions.productType || prev.product_type,
            tags: smartSuggestions.tags,
            keywords: smartSuggestions.keywords,
        }));
        toast.success('جهزت لك اقتراحات المنتج ✨');
    };

    const applySuggestedSkuOnly = () => {
        setForm(prev => ({ ...prev, sku: suggestedSku }));
        toast.success('حددت لك SKU جاهز ✨');
    };

    const applyCategoryPreset = (preset: ReturnType<typeof getAdminProductPresets>[number]) => {
        setForm(prev => ({
            ...prev,
            product_type: preset.productType || prev.product_type,
            gender: preset.gender || prev.gender,
            age_group: preset.ageGroup || prev.age_group,
            season: preset.season || prev.season,
            style: preset.style || prev.style,
            material: preset.material || prev.material,
            size_group: preset.sizeGroup || prev.size_group,
            tags: Array.from(new Set([...preset.tags, ...prev.tags])),
            keywords: Array.from(new Set([...preset.keywords, ...prev.keywords])),
        }));
        toast.success(`طبقت قالب ${preset.title} ✨`);
    };

    const openEdit = (p: Product) => {
        setEditingId(p.id);
        const pImages = p.images || [];
        const taxonomySelection = getTaxonomySelection(p.specifications);
        const metadata = getProductCatalogMetadata(p.specifications);
        const baseSpecifications = extractBaseSpecifications(p.specifications);
        setForm({
            name: p.name, description: p.description || '',
            price: String(p.price), stock_quantity: String(p.stock_quantity || 0),
            discount_percentage: String(p.discount_percentage || 0),
            category_id: p.category_id || '',
            image_url: p.image_url || '',
            short_description: metadata.shortDescription,
            old_price: metadata.oldPrice ? String(metadata.oldPrice) : '',
            sku: metadata.sku,
            brand: metadata.brand,
            slug: metadata.slug,
            status: metadata.status || 'published',
            featured: metadata.featured,
            product_type: metadata.productType,
            tags: metadata.tags,
            keywords: metadata.keywords,
            gender: metadata.gender,
            age_group: metadata.ageGroup,
            season: metadata.season,
            style: metadata.style,
            color_family: metadata.colorFamily,
            material: metadata.material,
            size_group: metadata.sizeGroup,
            restaurant_id: metadata.restaurantId,
            restaurant_available: metadata.restaurantAvailable,
            related_product_ids: metadata.relatedProductIds.filter((id) => id !== p.id),
            images: [
                pImages[0] || '',
                pImages[1] || '',
                pImages[2] || '',
                pImages[3] || ''
            ],
            image_file: null,
            images_files: [null, null, null, null],
            show_in_offers: !!p.show_in_offers,
            specs: normalizeSpecs(p.product_specifications, p.specifications),
            product_mode: getProductMode(p.specifications),
            bundle_items: getBundleItems(p.specifications),
            taxonomy_primary: taxonomySelection.primary,
            taxonomy_secondary: taxonomySelection.secondary,
            taxonomy_tertiary: taxonomySelection.tertiary,
            specifications_base: baseSpecifications,
        });
        setIsModalOpen(true);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const previewUrl = URL.createObjectURL(file);

        if (index === undefined) {
            setForm(prev => ({ ...prev, image_url: previewUrl, image_file: file }));
        } else {
            setForm(prev => {
                const newImages = [...prev.images];
                newImages[index] = previewUrl;
                const newFiles = [...prev.images_files];
                newFiles[index] = file;
                return { ...prev, images: newImages, images_files: newFiles };
            });
        }
        
        // Reset file input
        e.target.value = '';
    };

    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const handleSave = async () => {
        if (!form.name.trim() || !form.price) return;
        if (form.product_mode === 'bundle' && form.bundle_items.filter(item => item.name.trim()).length === 0) {
            toast.error('ضيف محتويات الباكج الأول علشان تظهر للعميل بشكل واضح');
            return;
        }
        if (taxonomyConfig && !form.taxonomy_primary) {
            toast.error(`اختار ${taxonomyConfig.primaryLabel} الأول علشان المنتج يظهر في المكان الصح`);
            return;
        }
        if (taxonomyConfig && taxonomySecondaryOptions.length > 0 && !form.taxonomy_secondary) {
            toast.error(`اختار ${taxonomyConfig.secondaryLabel} كمان علشان الفلترة تبقى دقيقة`);
            return;
        }
        if (taxonomyConfig && taxonomyTertiaryOptions.length > 0 && !form.taxonomy_tertiary) {
            toast.error(`اختار ${taxonomyConfig.tertiaryLabel || 'التصنيف الأدق'} علشان الترشيحات تبقى أذكى`);
            return;
        }
        if (isRestaurantMenuProduct && !form.restaurant_id) {
            toast.error('اختار المطعم اللي المنيو دي تابعة له الأول');
            return;
        }
        setSaveError(null);
        setSaveSuccess(false);
        setIsSaving(true);
        const loadingToast = toast.loading('جاري حفظ المنتج ورفع الصور...');

        try {
            // Upload main image and extra images concurrently
            let finalImageUrl = form.image_url;
            const finalImages = [...form.images];

            const uploadPromises: Promise<void>[] = [];

            if (form.image_file) {
                uploadPromises.push(
                    uploadProductImage(form.image_file).then(url => {
                        if (url) finalImageUrl = url;
                    })
                );
            }

            form.images_files.forEach((file, index) => {
                if (file) {
                    uploadPromises.push(
                        uploadProductImage(file).then(url => {
                            if (url) finalImages[index] = url;
                        })
                    );
                }
            });

            if (uploadPromises.length > 0) {
                await Promise.all(uploadPromises);
            }

            const cleanedBundleItems = form.bundle_items
                .map(item => ({
                    name: item.name.trim(),
                    quantity: item.quantity?.trim() || '',
                    note: item.note?.trim() || '',
                }))
                .filter(item => item.name);

            const normalizedStockQuantity = isRestaurantMenuProduct
                ? (form.restaurant_available ? 999 : 0)
                : (parseInt(form.stock_quantity) || 0);
            const payload: Record<string, unknown> = {
                name: form.name.trim(),
                description: form.description.trim() || null,
                price: parseFloat(form.price),
                stock_quantity: normalizedStockQuantity,
                discount_percentage: parseFloat(form.discount_percentage) || 0,
                category_id: form.category_id || null,
                image_url: finalImageUrl && !finalImageUrl.startsWith('blob:') ? finalImageUrl : null,
                images: finalImages.filter(url => url && url.trim() !== '' && !url.startsWith('blob:')),
                show_in_offers: form.show_in_offers,
                specifications: {
                    ...form.specifications_base,
                    slug: form.slug.trim(),
                    short_description: form.short_description.trim(),
                    old_price: form.old_price ? parseFloat(form.old_price) : null,
                    sku: form.sku.trim(),
                    brand: form.brand.trim(),
                    status: form.status || 'published',
                    featured: form.featured,
                    product_type: form.product_type.trim(),
                    tags: normalizeStringArray(form.tags),
                    keywords: normalizeStringArray(form.keywords),
                    gender: form.gender.trim(),
                    age_group: form.age_group.trim(),
                    season: form.season.trim(),
                    style: form.style.trim(),
                    color_family: form.color_family.trim(),
                    material: form.material.trim(),
                    size_group: form.size_group.trim(),
                    restaurant_id: isRestaurantMenuProduct ? form.restaurant_id : "",
                    restaurant_name: isRestaurantMenuProduct ? (selectedRestaurant?.name || "") : "",
                    restaurant_item: isRestaurantMenuProduct,
                    restaurant_available: isRestaurantMenuProduct ? form.restaurant_available : true,
                    availability_mode: isRestaurantMenuProduct ? "manual" : "stock",
                    related_product_ids: Array.from(new Set(form.related_product_ids.filter(id => id && id !== editingId))),
                    product_mode: form.product_mode,
                    bundle_items: form.product_mode === 'bundle' ? cleanedBundleItems : [],
                    category_taxonomy: taxonomyConfig ? {
                        primary: form.taxonomy_primary,
                        secondary: form.taxonomy_secondary,
                        tertiary: form.taxonomy_tertiary,
                        primary_label: getTaxonomyLabel(selectedCategoryName, form.taxonomy_primary, form.taxonomy_secondary, form.taxonomy_tertiary).primary,
                        secondary_label: getTaxonomyLabel(selectedCategoryName, form.taxonomy_primary, form.taxonomy_secondary, form.taxonomy_tertiary).secondary,
                        tertiary_label: getTaxonomyLabel(selectedCategoryName, form.taxonomy_primary, form.taxonomy_secondary, form.taxonomy_tertiary).tertiary,
                    } : null,
                    custom_specs: form.specs
                        .filter(spec => spec.label.trim() && spec.description.trim())
                        .map(spec => ({
                            label: spec.label.trim(),
                            description: spec.description.trim(),
                        })),
                },
            };
            let result;
            let specsResult = { error: null as any };
            if (editingId) {
                result = await updateProduct(editingId, payload);
                if (!result.error) specsResult = await saveProductSpecifications(editingId, form.specs);
            } else {
                result = await createProduct(payload);
                if (!result.error && result.data?.id) specsResult = await saveProductSpecifications(result.data.id, form.specs);
            }

            if (result?.error) {
                const msg = (result.error as any).message || JSON.stringify(result.error);
                setSaveError(`فشل الحفظ: ${msg}`);
                toast.error(`فشل الحفظ: ${msg}`, { id: loadingToast });
                return;
            }

            if (specsResult?.error) {
                const msg = (specsResult.error as any).message || JSON.stringify(specsResult.error);
                setSaveError(`المنتج اتحفظ بس المواصفات متسجلتش: ${msg}`);
                toast.error(`المنتج اتحفظ بس المواصفات متسجلتش: ${msg}`, { id: loadingToast });
                return;
            }

            // ✅ Success
            setSaveSuccess(true);
            toast.success(editingId ? 'تم تعديل المنتج بنجاح ✅' : 'تم إضافة المنتج بنجاح ✅', { id: loadingToast });
            setTimeout(() => {
                setIsModalOpen(false);
                setSaveSuccess(false);
                load();
            }, 800);

        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
            setSaveError(`فشل الحفظ: ${msg}`);
            toast.error(`فشل الحفظ: ${msg}`, { id: loadingToast });
        } finally {
            // ✅ ALWAYS reset the loading state — no more infinite spinner
            setIsSaving(false);
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }
    };


    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
        const res = await deleteProduct(id);
        if (!res.success) {
            if (res.error?.includes('foreign key constraint') || res.error?.includes('order_items')) {
                toast.error('لا يمكن حذف المنتج لأنه مرتبط بطلبات سابقة.');
            } else {
                toast.error(`خطأ في الحذف: ${res.error}`);
            }
            return;
        }
        toast.success('تم حذف المنتج بنجاح ✅');
        load();
    };

    const handleClearAllProducts = async () => {
        const confirmed = window.confirm('هيمسح كل المنتجات التجريبية. لو عندك طلبات قديمة مرتبطة بمنتجات، امسح الطلبات الأول. متأكد؟');
        if (!confirmed) return;

        setIsClearingAllProducts(true);
        try {
            const result = await clearExperimentalAdminData('products');
            const deletedProducts = Number(result?.summary?.deletedProducts || 0);
            toast.success(deletedProducts > 0 ? `تم مسح ${deletedProducts} منتج تجريبي` : 'تم مسح المنتجات التجريبية');
            await load();
        } catch (error: any) {
            toast.error(error.message || 'فشل مسح المنتجات التجريبية');
        } finally {
            setIsClearingAllProducts(false);
        }
    };

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
        if (productTypeFilter === 'all') return true;
        return getProductMode(p.specifications) === productTypeFilter;
    });

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-heading font-black text-foreground">المنتجات</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{products.length} منتج في المتجر</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleClearAllProducts}
                        disabled={isClearingAllProducts}
                        className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-400 transition-all hover:bg-rose-500/20 disabled:opacity-60"
                    >
                        {isClearingAllProducts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        مسح الكل
                    </button>
                    <button
                        onClick={openNew}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" /> إضافة منتج
                    </button>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="بحث عن منتج..."
                            className="w-full bg-surface border border-surface-hover rounded-xl pr-9 pl-4 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {[
                            { key: 'all', label: 'الكل' },
                            { key: 'single', label: 'منتجات عادية' },
                            { key: 'bundle', label: 'الباكجات' },
                        ].map(option => (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => setProductTypeFilter(option.key as 'all' | 'single' | 'bundle')}
                                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${productTypeFilter === option.key
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'border border-surface-hover bg-surface text-gray-400 hover:bg-surface-hover'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        <span className="shrink-0 text-xs font-black text-gray-500">القسم:</span>
                        <button
                            type="button"
                            onClick={() => setCategoryFilter('all')}
                            className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${categoryFilter === 'all'
                                ? 'bg-white text-background shadow-lg'
                                : 'border border-surface-hover bg-surface text-gray-400 hover:bg-surface-hover'
                                }`}
                        >
                            كل الأقسام
                        </button>
                        {categories.map(category => (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => setCategoryFilter(category.id)}
                                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-all ${categoryFilter === category.id
                                    ? 'bg-white text-background shadow-lg'
                                    : 'border border-surface-hover bg-surface text-gray-400 hover:bg-surface-hover'
                                    }`}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>

                    <p className="text-xs text-gray-500">
                        ظاهر لك دلوقتي {filtered.length} منتج
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-surface-hover rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead>
                            <tr className="border-b border-surface-hover">
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">المنتج</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right hidden sm:table-cell">القسم</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right">السعر</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right hidden md:table-cell">المخزون</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-right hidden md:table-cell">خصم</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-hover">
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-10 bg-surface-hover rounded-lg animate-pulse" /></td></tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center text-gray-500 py-12">لا توجد منتجات</td></tr>
                            ) : (
                                filtered.map((p) => {
                                    const discounted = p.discount_percentage > 0
                                        ? p.price * (1 - p.discount_percentage / 100)
                                        : null;
                                    return (
                                        <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {p.image_url ? (
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shrink-0">
                                                            <Image src={p.image_url} alt={p.name} width={40} height={40} className="object-contain w-full h-full p-0.5" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-xl bg-surface-hover flex items-center justify-center shrink-0">
                                                            <ImageOff className="w-4 h-4 text-gray-500" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-foreground line-clamp-1 block">{p.name}</span>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                        {getProductMode(p.specifications) === 'bundle' ? (
                                                            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-black text-primary">
                                                                باكج
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-bold text-gray-400">
                                                                منتج عادي
                                                            </span>
                                                        )}
                                                        {getProductMode(p.specifications) === 'bundle' && getBundleItems(p.specifications).length > 0 ? (
                                                            <span className="text-[10px] text-gray-500 line-clamp-1">
                                                                {getBundleSummary(getBundleItems(p.specifications))}
                                                            </span>
                                                        ) : null}
                                                        {(() => {
                                                            const categoryName = p.categories?.name || '';
                                                            const taxonomySelection = getTaxonomySelection(p.specifications);
                                                            const labels = getTaxonomyLabel(
                                                                categoryName,
                                                                taxonomySelection.primary,
                                                                taxonomySelection.secondary,
                                                                taxonomySelection.tertiary
                                                            );
                                                            if (!labels.primary) return null;
                                                            return (
                                                                <span className="text-[10px] text-gray-500 line-clamp-1">
                                                                    {labels.primary}
                                                                    {labels.secondary ? ` / ${labels.secondary}` : ''}
                                                                    {labels.tertiary ? ` / ${labels.tertiary}` : ''}
                                                                </span>
                                                            );
                                                        })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                <span className="px-2.5 py-1 bg-surface-hover rounded-lg text-xs text-gray-500 font-medium">
                                                    {p.categories?.name || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {discounted ? (
                                                    <div>
                                                        <span className="text-primary font-black">{discounted.toFixed(0)} ج.م</span>
                                                        <span className="text-xs text-gray-500 line-through block">{p.price} ج.م</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-white">{p.price} ج.م</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className={`font-bold ${p.stock_quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {p.stock_quantity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                {p.discount_percentage > 0 ? (
                                                    <span className="bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-lg text-xs font-bold">
                                                        {p.discount_percentage}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-[#0c1411] border border-emerald-400/10 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-surface-hover sticky top-0 bg-surface z-10">
                            <h2 className="font-heading font-black text-foreground">{editingId ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-foreground hover:bg-surface-hover">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {/* Images */}
                            <div>
                                <label className="block text-sm font-black text-gray-200 mb-3 border-b border-surface-hover pb-2">صور المنتج (صورة أساسية + 4 إضافية)</label>
                                <div className="space-y-4">
                                    {/* Main Image */}
                                    <div className={`${modalSoftPanelClass} p-3`}>
                                        <label className={modalSectionLabelClass}>الصورة الأساسية (الغلاف)</label>
                                        <div
                                            onClick={() => fileInput.current?.click()}
                                            className="w-full h-32 rounded-xl border-2 border-dashed border-gray-400/30 hover:border-primary/40 flex items-center justify-center cursor-pointer transition-colors relative overflow-hidden"
                                        >
                                            {form.image_url ? (
                                                <Image src={form.image_url} alt="Preview Main" fill className="object-contain p-2" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1.5 text-gray-500">
                                                    <Upload className="w-5 h-5" />
                                                    <span className="text-xs">اضغط لرفع الغلاف</span>
                                                </div>
                                            )}
                                        </div>
                                        <input type="file" ref={fileInput} accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e)} />
                                        <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                                            placeholder="أو أدخل رابط الصورة..."
                                            className={`mt-2 ${modalInputClass} text-xs`}
                                        />
                                    </div>

                                    {/* Extra Images Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {[0, 1, 2, 3].map(index => {
                                            const imgStr = form.images[index];
                                            let isValidUrl = false;
                                            try {
                                                if (imgStr) {
                                                    new URL(imgStr);
                                                    isValidUrl = true;
                                                }
                                            } catch (e) {
                                                isValidUrl = imgStr.startsWith('blob:') || imgStr.startsWith('/');
                                            }

                                            return (
                                                <div key={index} className={`${modalSoftPanelClass} p-2.5`}>
                                                    <label className="block text-[10px] font-bold text-gray-300 mb-1.5">صورة إضافية {index + 1}</label>
                                                    <label className="w-full h-20 rounded-lg border-2 border-dashed border-gray-400/30 hover:border-primary/40 flex items-center justify-center cursor-pointer transition-colors relative overflow-hidden block">
                                                        {isValidUrl ? (
                                                            <Image src={imgStr} alt={`Preview Extra ${index + 1}`} fill className="object-contain p-1" />
                                                        ) : imgStr ? (
                                                            <img src={imgStr} alt={`Preview Extra ${index + 1}`} className="object-contain p-1 w-full h-full" />
                                                        ) : (
                                                            <Upload className="w-4 h-4 text-gray-500" />
                                                        )}
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, index)} />
                                                </label>
                                                <input value={form.images[index]} onChange={e => {
                                                    const val = e.target.value;
                                                    setForm(f => {
                                                        const newImages = [...f.images];
                                                        newImages[index] = val;
                                                        return { ...f, images: newImages };
                                                    });
                                                }}
                                                    placeholder="أو رابط الصورة..."
                                                    className={`mt-1.5 ${modalInputClass} rounded-lg px-2 py-1.5 text-[10px]`}
                                                />
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {[
                                { key: 'name', label: 'اسم المنتج *', placeholder: 'اسم المنتج', type: 'text' },
                                { key: 'description', label: 'الوصف', placeholder: 'وصف مختصر للمنتج', type: 'textarea' },
                                { key: 'price', label: 'السعر (ج.م) *', placeholder: '100', type: 'number' },
                                { key: 'stock_quantity', label: 'الكمية في المخزن', placeholder: '0', type: 'number' },
                                { key: 'discount_percentage', label: 'الخصم (%)', placeholder: '0', type: 'number' },
                            ].filter(field => !(isRestaurantMenuProduct && field.key === 'stock_quantity')).map(({ key, label, placeholder, type }) => (
                                <div key={key}>
                                    <label className={modalSectionLabelClass}>{label}</label>
                                    {type === 'textarea' ? (
                                        <textarea
                                            rows={3}
                                            value={(form as any)[key]}
                                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                            placeholder={placeholder}
                                            className={modalTextareaClass}
                                        />
                                    ) : (
                                        <input
                                            type={type}
                                            value={(form as any)[key]}
                                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                            placeholder={placeholder}
                                            className={modalInputClass}
                                        />
                                    )}
                                </div>
                            ))}

                            {isRestaurantMenuProduct && (
                                <div className="md:col-span-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-primary">
                                    في منتجات المطاعم مش بنسجل مخزون رقمي. حالة التوفر هتتحدد من اختيار <span className="font-black">متاح الآن</span> تحت.
                                </div>
                            )}

                            <div className="rounded-2xl border border-emerald-400/10 bg-[#101815]/70 p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-black text-white mb-1">بيانات تسويقية وتجارية</label>
                                    <p className="text-[11px] text-gray-500">البيانات دي بتفيد صفحة المنتج والترشيحات والبحث الداخلي من غير ما نغيّر مسار البيع الحالي.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">وصف قصير</label>
                                        <textarea
                                            rows={2}
                                            value={form.short_description}
                                            onChange={e => setForm(f => ({ ...f, short_description: e.target.value }))}
                                            placeholder="سطرين يوضحوا أهم نقطة بيع للمنتج"
                                            className="w-full bg-surface border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50 resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className={modalSectionLabelClass}>السعر قبل الخصم</label>
                                            <input
                                                type="number"
                                                value={form.old_price}
                                                onChange={e => setForm(f => ({ ...f, old_price: e.target.value }))}
                                                placeholder="مثال: 250"
                                                className={modalInputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={modalSectionLabelClass}>SKU / كود المنتج</label>
                                            <input
                                                value={form.sku}
                                                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                                                placeholder="مثال: TSH-2026-01"
                                                className={modalInputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={modalSectionLabelClass}>البراند</label>
                                            <input
                                                value={form.brand}
                                                onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                                                placeholder="مثال: Nike / Fresh"
                                                className={modalInputClass}
                                            />
                                        </div>
                                        <div>
                                            <label className={modalSectionLabelClass}>Slug داخلي</label>
                                            <input
                                                value={form.slug}
                                                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                                                placeholder="مثال: black-jacket-light"
                                                className={modalInputClass}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className={modalSectionLabelClass}>حالة المنتج</label>
                                        <select
                                            value={form.status}
                                            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                            className={modalSelectClass}
                                        >
                                            <option value="published">منشور</option>
                                            <option value="active">نشط</option>
                                            <option value="draft">مسودة</option>
                                            <option value="archived">مؤرشف</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className={modalSectionLabelClass}>نوع المنتج التجاري</label>
                                        <input
                                            value={form.product_type}
                                            onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))}
                                            placeholder="مثال: تيشيرت / زبادي / سماعة"
                                            className={modalInputClass}
                                        />
                                    </div>

                                    <label className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.featured}
                                            onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))}
                                            className="h-4 w-4 accent-primary"
                                        />
                                        <span className="text-sm font-bold text-foreground">تمييز كمنتج Featured</span>
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-surface-hover bg-surface-hover/50 p-4">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">نوع المنتج</label>
                                        <p className="text-[11px] text-gray-500">اختار لو ده منتج لوحده ولا باكج فيها كذا حاجة بتتباع مع بعض.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, product_mode: 'single', bundle_items: [] }))}
                                            className={`rounded-2xl border px-4 py-3 text-start transition-all ${form.product_mode === 'single'
                                            ? 'border-primary bg-primary/10 text-white shadow-lg shadow-primary/10'
                                            : 'border-emerald-400/10 bg-[#101815] text-gray-200 hover:bg-[#12201a]'
                                            }`}
                                    >
                                        <p className="font-black text-sm mb-1">منتج عادي</p>
                                        <p className="text-[11px] text-gray-400">العميل يشتريه كقطعة واحدة عادي.</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, product_mode: 'bundle', bundle_items: f.bundle_items.length > 0 ? f.bundle_items : [{ name: '', quantity: '', note: '' }] }))}
                                            className={`rounded-2xl border px-4 py-3 text-start transition-all ${form.product_mode === 'bundle'
                                            ? 'border-primary bg-primary/10 text-white shadow-lg shadow-primary/10'
                                            : 'border-emerald-400/10 bg-[#101815] text-gray-200 hover:bg-[#12201a]'
                                            }`}
                                    >
                                        <p className="font-black text-sm mb-1">باكج / مجموعة</p>
                                        <p className="text-[11px] text-gray-400">مثال: زبادي + دقيق + سكر كأنهم منتج واحد.</p>
                                    </button>
                                </div>
                            </div>

                            {form.product_mode === 'bundle' && (
                                <div className="pt-4 border-t border-surface-hover">
                                    <div className="flex items-center justify-between mb-3 gap-3">
                                        <div>
                                            <label className="block text-sm font-bold text-foreground">محتويات الباكج</label>
                                            <p className="text-[11px] text-gray-500 mt-1">اكتب الحاجات اللي جوا الباكج علشان العميل يفهم هو بياخد إيه بالظبط.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, bundle_items: [...f.bundle_items, { name: '', quantity: '', note: '' }] }))}
                                            className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> إضافة عنصر
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {form.bundle_items.map((item, idx) => (
                                            <div key={idx} className="rounded-2xl border border-emerald-400/10 bg-[#101815] p-3 space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <input
                                                            value={item.name || ''}
                                                            onChange={e => updateBundleItem(idx, 'name', e.target.value)}
                                                            placeholder="اسم المنتج جوه الباكج"
                                                            className={`${modalInputClass} rounded-lg py-2 text-xs`}
                                                        />
                                                        <input
                                                            value={item.quantity || ''}
                                                            onChange={e => updateBundleItem(idx, 'quantity', e.target.value)}
                                                            placeholder="الكمية أو الحجم (مثال: 2 علبة / 1 كيلو)"
                                                            className={`${modalInputClass} rounded-lg py-2 text-xs`}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setForm(f => ({ ...f, bundle_items: f.bundle_items.filter((_, i) => i !== idx) }))}
                                                        className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 shrink-0 transition-colors"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <input
                                                    value={item.note || ''}
                                                    onChange={e => updateBundleItem(idx, 'note', e.target.value)}
                                                    placeholder="ملاحظة اختيارية (مثال: النكهات حسب المتوفر)"
                                                    className={`${modalInputClass} rounded-lg py-2 text-xs`}
                                                />
                                            </div>
                                        ))}

                                        {form.bundle_items.length === 0 && (
                                            <p className="text-xs text-gray-500 text-center py-4 bg-surface-hover rounded-xl border border-dashed border-gray-400/30">
                                                لسه مفيش منتجات جوه الباكج. ضيفهم من الزر اللي فوق.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Show in Offers */}
                            <label className="flex items-center gap-3 mt-2 cursor-pointer p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.show_in_offers}
                                    onChange={e => setForm(f => ({ ...f, show_in_offers: e.target.checked }))}
                                    className="w-4 h-4 rounded text-rose-500 bg-surface border-surface-hover accent-rose-500"
                                />
                                <span className="text-sm font-bold text-foreground">🔥 إظهار في قسم العروض</span>
                            </label>

                            {/* Category */}
                            <div>
                                <label className={modalSectionLabelClass}>القسم</label>
                                <div className="relative">
                                    <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <select
                                        value={form.category_id}
                                        onChange={e => {
                                            const nextCategoryId = e.target.value;
                                            const nextCategoryName = categories.find(category => category.id === nextCategoryId)?.name || '';
                                            const nextTaxonomyConfig = getCategoryTaxonomyConfig(nextCategoryName);
                                            setForm(f => ({
                                                ...f,
                                                category_id: nextCategoryId,
                                                taxonomy_primary: nextTaxonomyConfig ? f.taxonomy_primary : '',
                                                taxonomy_secondary: nextTaxonomyConfig ? f.taxonomy_secondary : '',
                                                taxonomy_tertiary: nextTaxonomyConfig ? f.taxonomy_tertiary : '',
                                                restaurant_id: nextCategoryName === 'طعام' ? f.restaurant_id : '',
                                                restaurant_available: nextCategoryName === 'طعام' ? f.restaurant_available : true,
                                            }));
                                        }}
                                        className={`${modalSelectClass} pr-9 pl-3`}
                                    >
                                        <option value="">— بدون قسم —</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {taxonomyConfig && (
                                <div className="rounded-2xl border border-emerald-400/10 bg-[#101815]/70 p-4 space-y-3">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 mb-1">تصنيفات {selectedCategoryName}</label>
                                        <p className="text-[11px] text-gray-500">اختار التصنيف الرئيسي والفرعي علشان المنتج يظهر للعميل في المكان الصح.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-black text-gray-300 mb-1.5">{taxonomyConfig.primaryLabel}</label>
                                            <select
                                                value={form.taxonomy_primary}
                                                onChange={e => setForm(f => ({
                                                    ...f,
                                                    taxonomy_primary: e.target.value,
                                                    taxonomy_secondary: '',
                                                    taxonomy_tertiary: '',
                                                    restaurant_id: e.target.value === 'restaurants' ? f.restaurant_id : '',
                                                    restaurant_available: e.target.value === 'restaurants' ? f.restaurant_available : true,
                                                }))}
                                                className={modalSelectClass}
                                            >
                                                <option value="">اختار التصنيف الرئيسي</option>
                                                {taxonomyPrimaryOptions.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-black text-gray-300 mb-1.5">{taxonomyConfig.secondaryLabel}</label>
                                            <select
                                                value={form.taxonomy_secondary}
                                                onChange={e => setForm(f => ({ ...f, taxonomy_secondary: e.target.value, taxonomy_tertiary: '' }))}
                                                disabled={!form.taxonomy_primary}
                                                className={`${modalSelectClass} disabled:opacity-50`}
                                            >
                                                <option value="">اختار التصنيف الفرعي</option>
                                                {taxonomySecondaryOptions.map(option => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {taxonomyTertiaryOptions.length > 0 && (
                                            <div className="sm:col-span-2">
                                                <label className="block text-[11px] font-black text-gray-300 mb-1.5">{taxonomyConfig.tertiaryLabel || 'التصنيف الأدق'}</label>
                                                <select
                                                    value={form.taxonomy_tertiary}
                                                    onChange={e => setForm(f => ({ ...f, taxonomy_tertiary: e.target.value }))}
                                                    disabled={!form.taxonomy_secondary}
                                                    className={`${modalSelectClass} disabled:opacity-50`}
                                                >
                                                    <option value="">اختار التصنيف الأدق</option>
                                                    {taxonomyTertiaryOptions.map(option => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <label className="block text-sm font-black text-foreground mb-1">اقتراحات ذكية للمنتج</label>
                                        <p className="text-[11px] text-gray-500">
                                            اختار القسم والتصنيفات واكتب اسم المنتج، وإحنا نجهز لك SKU وTags وKeywords تسرّع الإضافة جدًا.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={applySuggestedSkuOnly}
                                            className="inline-flex items-center justify-center rounded-xl border border-surface-hover bg-surface px-4 py-2 text-xs font-black text-foreground transition-all hover:bg-surface-hover"
                                        >
                                            استخدم الـ SKU فقط
                                        </button>
                                        <button
                                            type="button"
                                            onClick={applySmartSuggestions}
                                            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-black text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
                                        >
                                            استخدم الاقتراحات
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-emerald-400/10 bg-[#101815] px-3 py-3">
                                        <p className="text-[11px] font-black text-gray-500 mb-1">SKU المقترح</p>
                                        <p className="text-sm font-mono tracking-[0.14em] text-foreground" dir="ltr">{suggestedSku}</p>
                                        <p className="mt-1 text-[10px] text-gray-500">الرقم الأخير بيتحسب من الموجود عندك تلقائيًا كاقتراح، وأنت تقدر تعدله براحتك.</p>
                                    </div>
                                    <div className="rounded-xl border border-emerald-400/10 bg-[#101815] px-3 py-3">
                                        <p className="text-[11px] font-black text-gray-500 mb-1">نوع المنتج المقترح</p>
                                        <p className="text-sm font-bold text-foreground">{smartSuggestions.productType || 'لسه محتاج تحدد القسم أو التصنيف الفرعي'}</p>
                                    </div>
                                </div>

                                {categoryPresets.length > 0 && (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[11px] font-black text-gray-500 mb-1">قوالب جاهزة للقسم</p>
                                            <p className="text-[11px] text-gray-500">اختار القالب المناسب، وهو يملأ لك الحقول الشائعة فقط، وأنت تفضل متحكم في الباقي.</p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {categoryPresets.map(preset => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => applyCategoryPreset(preset)}
                                                    className="rounded-2xl border border-emerald-400/10 bg-[#101815] px-4 py-3 text-start transition-all hover:bg-[#12201a]"
                                                >
                                                    <p className="text-sm font-black text-foreground mb-1">{preset.title}</p>
                                                    <p className="text-[11px] leading-5 text-gray-500">{preset.description}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-emerald-400/10 bg-[#101815] px-3 py-3">
                                        <p className="text-[11px] font-black text-gray-500 mb-2">Tags جاهزة</p>
                                        <div className="flex flex-wrap gap-2">
                                            {smartSuggestions.tags.map(tag => (
                                                <span key={tag} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-emerald-400/10 bg-[#101815] px-3 py-3">
                                        <p className="text-[11px] font-black text-gray-500 mb-2">Keywords جاهزة</p>
                                        <div className="flex flex-wrap gap-2">
                                            {smartSuggestions.keywords.map(keyword => (
                                                <span key={keyword} className="rounded-full bg-surface-hover px-2.5 py-1 text-[11px] font-bold text-gray-300">
                                                    {keyword}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    </div>
                                </div>

                                {isRestaurantMenuProduct && (
                                    <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4 space-y-4">
                                        <div>
                                            <p className="text-sm font-black text-foreground">ربط المنتج بمطعم</p>
                                            <p className="mt-1 text-[11px] leading-5 text-gray-500">
                                                منتجات المطاعم ما بنعتمدش فيها على المخزون التقليدي. أنت بتحدد المطعم، ومن هنا تختار هل الصنف متاح الآن ولا لأ.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={modalSectionLabelClass}>المطعم</label>
                                                <select
                                                    value={form.restaurant_id}
                                                    onChange={e => setForm(f => ({ ...f, restaurant_id: e.target.value }))}
                                                    className={modalSelectClass}
                                                >
                                                    <option value="">اختار المطعم</option>
                                                    {restaurants.map(restaurant => (
                                                        <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
                                                    ))}
                                                </select>
                                                <p className="mt-1 text-[10px] text-gray-500">
                                                    لو المطعم لسه مش موجود، ضيفه أولًا من صفحة المطاعم في لوحة الإدارة.
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-surface-hover bg-[#101815] px-4 py-3">
                                                <label className="flex items-center gap-3 text-sm font-bold text-foreground">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.restaurant_available}
                                                        onChange={e => setForm(f => ({ ...f, restaurant_available: e.target.checked }))}
                                                        className="accent-primary"
                                                    />
                                                    متاح الآن للطلب
                                                </label>
                                                <p className="mt-2 text-[11px] leading-5 text-gray-500">
                                                    لو شلت العلامة، المنتج يفضل ظاهر لكن يبقى واضح إنه غير متاح حاليًا من المطعم.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-2xl border border-emerald-400/10 bg-[#101815]/70 p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-black text-foreground mb-1">حقول التشابه الذكي</label>
                                    <p className="text-[11px] text-gray-500">الحقول دي هي اللي هتخلّي النظام يطلع منتجات مشابهة بذكاء حسب كل قسم.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div>
                                        <label className={modalSectionLabelClass}>النوع / الجنس</label>
                                        <select
                                            value={form.gender}
                                            onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                            className={modalSelectClass}
                                        >
                                            <option value="">غير محدد</option>
                                            <option value="men">رجالي</option>
                                            <option value="women">نسائي</option>
                                            <option value="boys">أولاد</option>
                                            <option value="girls">بنات</option>
                                            <option value="unisex">للجنسين</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className={modalSectionLabelClass}>الفئة العمرية</label>
                                        <select
                                            value={form.age_group}
                                            onChange={e => setForm(f => ({ ...f, age_group: e.target.value }))}
                                            className={modalSelectClass}
                                        >
                                            <option value="">غير محدد</option>
                                            <option value="baby">بيبي</option>
                                            <option value="kids">أطفال</option>
                                            <option value="teens">مراهقين</option>
                                            <option value="adults">كبار</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className={modalSectionLabelClass}>الموسم</label>
                                        <select
                                            value={form.season}
                                            onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                                            className={modalSelectClass}
                                        >
                                            <option value="">غير محدد</option>
                                            <option value="summer">صيفي</option>
                                            <option value="winter">شتوي</option>
                                            <option value="spring">ربيعي</option>
                                            <option value="autumn">خريفي</option>
                                            <option value="all_season">كل المواسم</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className={modalSectionLabelClass}>الستايل</label>
                                        <input
                                            value={form.style}
                                            onChange={e => setForm(f => ({ ...f, style: e.target.value }))}
                                            placeholder="مثال: كاجوال / رسمي / سبورت"
                                            className={modalInputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={modalSectionLabelClass}>الخامة</label>
                                        <input
                                            value={form.material}
                                            onChange={e => setForm(f => ({ ...f, material: e.target.value }))}
                                            placeholder="مثال: قطن / بلاستيك / ستانلس"
                                            className={modalInputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={modalSectionLabelClass}>عائلة اللون</label>
                                        <input
                                            value={form.color_family}
                                            onChange={e => setForm(f => ({ ...f, color_family: e.target.value }))}
                                            placeholder="مثال: أسود / أبيض / متعدد"
                                            className={modalInputClass}
                                        />
                                    </div>

                                    <div>
                                        <label className={modalSectionLabelClass}>مجموعة المقاس</label>
                                        <input
                                            value={form.size_group}
                                            onChange={e => setForm(f => ({ ...f, size_group: e.target.value }))}
                                            placeholder="مثال: أطفال / Adult / Free Size"
                                            className={modalInputClass}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <ChipsInput
                                        label="Tags"
                                        helper="مثال: قطن، صيفي، عروض، بدون سكر، وايرلس"
                                        placeholder="اكتب tag واضغط Enter"
                                        values={form.tags}
                                        onChange={(values) => setForm(f => ({ ...f, tags: values }))}
                                    />
                                    <ChipsInput
                                        label="Keywords"
                                        helper="كلمات تساعد الترشيح والبحث الذكي"
                                        placeholder="اكتب keyword واضغط Enter"
                                        values={form.keywords}
                                        onChange={(values) => setForm(f => ({ ...f, keywords: values }))}
                                    />
                                </div>

                                <RelatedProductsPicker
                                    products={products}
                                    selectedIds={form.related_product_ids}
                                    onChange={(ids) => setForm(f => ({ ...f, related_product_ids: ids }))}
                                    currentProductId={editingId}
                                    currentCategoryId={form.category_id}
                                />
                            </div>

                            {/* Specifications */}
                            <div className="pt-4 border-t border-surface-hover">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-bold text-foreground">المواصفات الإضافية (اختياري)</label>
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, specs: [...f.specs, { label: '', description: '' }] }))}
                                        className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> إضافة صفة
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {form.specs.map((spec, idx) => (
                                        <div key={idx} className="flex gap-2 items-start p-3 bg-[#101815] rounded-xl border border-emerald-400/10">
                                            <div className="flex-1 space-y-2">
                                                <input
                                                    value={spec.label}
                                                    onChange={e => {
                                                        const newSpecs = [...form.specs];
                                                        newSpecs[idx].label = e.target.value;
                                                        setForm(f => ({ ...f, specs: newSpecs }));
                                                    }}
                                                    placeholder="الاسم (مثل: اللون, الماركة, الخامة)"
                                                    className={`${modalInputClass} rounded-lg py-2 text-xs`}
                                                />
                                                <input
                                                    value={spec.description}
                                                    onChange={e => {
                                                        const newSpecs = [...form.specs];
                                                        newSpecs[idx].description = e.target.value;
                                                        setForm(f => ({ ...f, specs: newSpecs }));
                                                    }}
                                                    placeholder="القيمة (مثل: أحمر, Apple, قطن 100%)"
                                                    className={`${modalInputClass} rounded-lg py-2 text-xs`}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newSpecs = form.specs.filter((_, i) => i !== idx);
                                                    setForm(f => ({ ...f, specs: newSpecs }));
                                                }}
                                                className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 shrink-0 mt-2 transition-colors"
                                                title="حذف"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {form.specs.length === 0 && (
                                        <p className="text-xs text-gray-500 text-center py-4 bg-surface-hover rounded-xl border border-dashed border-gray-400/30">
                                            لا يوجد مواصفات مضافة بعد.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 p-5 border-t border-surface-hover bg-[#0f1714]">
                            {/* Error banner */}
                            {saveError && (
                                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium px-3 py-2.5 rounded-xl">
                                    <span className="shrink-0 mt-0.5">⚠️</span>
                                    <span>{saveError}</span>
                                </div>
                            )}
                            {/* Success banner */}
                            {saveSuccess && (
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-2.5 rounded-xl">
                                    ✅ تم الحفظ بنجاح!
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <button onClick={() => { setIsModalOpen(false); setSaveError(null); }} className="flex-1 py-2.5 rounded-xl border border-emerald-400/10 text-sm font-bold text-gray-200 hover:text-white hover:bg-[#12201a] transition-all">
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || saveSuccess || !form.name || !form.price}
                                    className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {saveSuccess ? 'تم ✅' : editingId ? 'حفظ التعديلات' : 'إضافة المنتج'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
