"use client"

import React, { useEffect, useState } from 'react';
import { Ticket, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Percent, CircleDollarSign, Users } from 'lucide-react';
import { toast } from 'sonner';
import { 
    DiscountCode, fetchAllDiscountCodes, createDiscountCode, 
    updateDiscountCode, deleteDiscountCode, CreateDiscountCodeInput
} from '@/services/discountCodesService';
import { fetchProducts, Product } from '@/services/productsService';
import { Category, fetchCategories } from '@/services/categoriesService';

const EMPTY_FORM = {
    code: '',
    discount_type: 'percentage' as 'percentage' | 'amount',
    discount_value: '',
    is_active: true,
    max_uses: '',          // empty = unlimited
    target_scope: 'all' as 'all' | 'product' | 'category',
    applicable_product_id: '',
    applicable_category_id: '',
};

export default function AdminDiscountsPage() {
    const [codes, setCodes] = useState<DiscountCode[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [isSaving, setIsSaving] = useState(false);

    const load = async () => {
        setIsLoading(true);
        const [data, productData, categoryData] = await Promise.all([
            fetchAllDiscountCodes(),
            fetchProducts(),
            fetchCategories(),
        ]);
        setCodes(data);
        setProducts(productData);
        setCategories(categoryData);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setIsModalOpen(true);
    };

    const openEdit = (c: DiscountCode) => {
        setEditingId(c.id);
        const type = c.discount_amount ? 'amount' : 'percentage';
        const val = c.discount_amount ? c.discount_amount : (c.discount_percentage || 0);

        setForm({
            code: c.code,
            discount_type: type,
            discount_value: String(val),
            is_active: c.is_active,
            max_uses: c.max_uses !== null ? String(c.max_uses) : '',
            target_scope: c.applicable_product_id ? 'product' : c.applicable_category_id ? 'category' : 'all',
            applicable_product_id: c.applicable_product_id || '',
            applicable_category_id: c.applicable_category_id || '',
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim()) { toast.error('كود الخصم مطلوب!'); return; }
        const val = Number(form.discount_value);
        if (isNaN(val) || val <= 0) {
            toast.error('القيمة يجب أن تكون رقم صحيح وموجب!');
            return;
        }

        setIsSaving(true);

        const payload: CreateDiscountCodeInput = {
            code: form.code.trim().toUpperCase(),
            discount_percentage: form.discount_type === 'percentage' ? val : null,
            discount_amount: form.discount_type === 'amount' ? val : null,
            is_active: form.is_active,
            max_uses: form.max_uses.trim() !== '' ? parseInt(form.max_uses) : null,
            expires_at: null,
            applicable_product_id: form.target_scope === 'product' ? form.applicable_product_id || null : null,
            applicable_category_id: form.target_scope === 'category' ? form.applicable_category_id || null : null,
        };

        if (form.target_scope === 'product' && !form.applicable_product_id) {
            setIsSaving(false);
            toast.error('اختار المنتج اللي الكود ده هيشتغل عليه.');
            return;
        }

        if (form.target_scope === 'category' && !form.applicable_category_id) {
            setIsSaving(false);
            toast.error('اختار القسم اللي الكود ده هيشتغل عليه.');
            return;
        }

        const { error } = editingId
            ? await updateDiscountCode(editingId, payload)
            : await createDiscountCode(payload);

        setIsSaving(false);

        if (error) {
            toast.error(error.code === '23505' ? 'هذا الكود موجود بالفعل!' : `فشل الحفظ: ${(error as any).message}`);
        } else {
            toast.success(editingId ? 'تم تعديل الكود بنجاح ✅' : 'تم إضافة الكود بنجاح ✅');
            setIsModalOpen(false);
            load();
        }
    };

    const handleToggleActive = async (c: DiscountCode) => {
        const { error } = await updateDiscountCode(c.id, { is_active: !c.is_active });
        if (error) {
            toast.error('فشل تغيير الحالة.');
        } else {
            toast.success(c.is_active ? 'تم إيقاف الكود' : 'تم تفعيل الكود ✅');
            load();
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return;
        const { error } = await deleteDiscountCode(id);
        if (error) {
            toast.error('فشل الحذف.');
        } else {
            toast.success('تم حذف الكود ✅');
            setCodes(prev => prev.filter(c => c.id !== id));
        }
    };

    const getTargetLabel = (code: DiscountCode) => {
        if (code.applicable_product_id) {
            const product = products.find((item) => item.id === code.applicable_product_id);
            return product ? `منتج: ${product.name}` : 'منتج محدد';
        }

        if (code.applicable_category_id) {
            const category = categories.find((item) => item.id === code.applicable_category_id);
            return category ? `قسم: ${category.name}` : 'قسم محدد';
        }

        return 'كل المنتجات';
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-heading font-black text-foreground">أكواد الخصم</h1>
                    <p className="text-sm text-gray-500 mt-0.5">تحكم في الكوبونات ونسب الخصم للعملاء</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> إضافة كود
                </button>
            </div>

            {/* List */}
            <div className="bg-surface border border-surface-hover rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead>
                            <tr className="border-b border-surface-hover">
                                <th className="px-4 py-3 text-xs font-bold text-gray-500">الكود</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500">قيمة الخصم</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 hidden lg:table-cell">بيشتغل على</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 hidden md:table-cell">الاستخدام</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500">الحالة</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-hover">
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-10 bg-surface-hover rounded-lg animate-pulse" /></td></tr>
                                ))
                            ) : codes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16">
                                        <Ticket className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                                        <p className="text-gray-500">لا توجد أكواد خصم بعد، أضف الكود الأول!</p>
                                    </td>
                                </tr>
                            ) : codes.map(c => (
                                <tr key={c.id} className="hover:bg-surface-hover transition-colors">
                                    <td className="px-4 py-3">
                                        <span className="font-mono bg-surface-hover px-2.5 py-1 rounded-lg text-foreground font-bold tracking-widest border border-surface-hover uppercase">
                                            {c.code}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-primary font-bold tracking-tight">
                                        {c.discount_percentage ? `${c.discount_percentage}%` : `${c.discount_amount} ج.م`}
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <span className="inline-flex items-center rounded-full border border-surface-hover bg-surface-hover px-3 py-1 text-xs font-bold text-foreground">
                                            {getTargetLabel(c)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                            <Users className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="font-mono font-bold text-foreground">{c.used_count}</span>
                                            {c.max_uses !== null
                                                ? <span className="text-gray-500">/ {c.max_uses} استخدام</span>
                                                : <span className="text-gray-500">/ ∞ بلا حد</span>
                                            }
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleToggleActive(c)}
                                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${c.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-surface-hover text-gray-500 border-surface-hover hover:bg-gray-500/10'}`}>
                                            {c.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                            {c.is_active ? 'مفعّل' : 'موقوف'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-surface-hover transition-colors">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-surface border border-surface-hover rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-surface-hover bg-surface">
                            <h2 className="font-heading font-black text-foreground flex items-center gap-2">
                                <Ticket className="w-5 h-5 text-primary" />
                                {editingId ? 'تعديل كود الخصم' : 'إضافة كود جديد'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-foreground hover:bg-surface-hover">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-5">
                            {/* Code */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">الكود (إنجليزي فقط)</label>
                                <input type="text" value={form.code}
                                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    placeholder="مثال: WEEKEND20"
                                    className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50 uppercase" />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">نوع الخصم</label>
                                <div className="grid grid-cols-2 gap-2 bg-surface-hover p-1 rounded-xl">
                                    <button
                                        onClick={() => setForm({ ...form, discount_type: 'percentage' })}
                                        className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${form.discount_type === 'percentage' ? 'bg-surface border border-surface-hover text-foreground shadow-sm' : 'text-gray-500 hover:text-foreground'}`}>
                                        <Percent className="w-3.5 h-3.5" /> نسبة مئوية
                                    </button>
                                    <button
                                        onClick={() => setForm({ ...form, discount_type: 'amount' })}
                                        className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${form.discount_type === 'amount' ? 'bg-surface border border-surface-hover text-foreground shadow-sm' : 'text-gray-500 hover:text-foreground'}`}>
                                        <CircleDollarSign className="w-3.5 h-3.5" /> مبلغ ثابت
                                    </button>
                                </div>
                            </div>

                            {/* Value */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">قيمة الخصم</label>
                                <div className="relative">
                                    <input type="number" value={form.discount_value}
                                        onChange={e => setForm({ ...form, discount_value: e.target.value })}
                                        placeholder="مثال: 20"
                                        className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50 text-left ltr" dir="ltr" />
                                    <span className="absolute left-3 top-2.5 text-gray-500 font-bold select-none text-sm pointer-events-none">
                                        {form.discount_type === 'percentage' ? '%' : 'EGP'}
                                    </span>
                                </div>
                            </div>

                            {/* Max Uses */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">
                                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> الحد الأقصى للاستخدام (اتركه فارغاً = بلا حد)</span>
                                </label>
                                <input type="number" min="1" value={form.max_uses}
                                    onChange={e => setForm({ ...form, max_uses: e.target.value })}
                                    placeholder="مثال: 100"
                                    className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50" dir="ltr" />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-gray-500">الكود يشتغل على إيه؟</label>
                                <div className="grid grid-cols-3 gap-2 bg-surface-hover p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, target_scope: 'all', applicable_product_id: '', applicable_category_id: '' })}
                                        className={`py-2 text-xs font-bold rounded-lg transition-all ${form.target_scope === 'all' ? 'bg-surface border border-surface-hover text-foreground shadow-sm' : 'text-gray-500 hover:text-foreground'}`}
                                    >
                                        كل المنتجات
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, target_scope: 'product', applicable_category_id: '' })}
                                        className={`py-2 text-xs font-bold rounded-lg transition-all ${form.target_scope === 'product' ? 'bg-surface border border-surface-hover text-foreground shadow-sm' : 'text-gray-500 hover:text-foreground'}`}
                                    >
                                        منتج معيّن
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, target_scope: 'category', applicable_product_id: '' })}
                                        className={`py-2 text-xs font-bold rounded-lg transition-all ${form.target_scope === 'category' ? 'bg-surface border border-surface-hover text-foreground shadow-sm' : 'text-gray-500 hover:text-foreground'}`}
                                    >
                                        قسم معيّن
                                    </button>
                                </div>
                            </div>

                            {form.target_scope === 'product' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">اختار المنتج</label>
                                    <select
                                        value={form.applicable_product_id}
                                        onChange={(e) => setForm({ ...form, applicable_product_id: e.target.value })}
                                        className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                                    >
                                        <option value="">اختار منتج</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-[11px] text-gray-500">الكود ده هيتطبق على المنتج ده فقط، وبرضه المستخدم الواحد له مرة واحدة فقط.</p>
                                </div>
                            )}

                            {form.target_scope === 'category' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">اختار القسم</label>
                                    <select
                                        value={form.applicable_category_id}
                                        onChange={(e) => setForm({ ...form, applicable_category_id: e.target.value })}
                                        className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                                    >
                                        <option value="">اختار قسم</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-[11px] text-gray-500">الكود ده هيشتغل على كل منتجات القسم ده فقط، وبرضه المستخدم الواحد له مرة واحدة فقط.</p>
                                </div>
                            )}

                            {/* Active Toggle */}
                            <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${form.is_active ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-surface-hover border-surface-hover'}`}>
                                <input type="checkbox" checked={form.is_active}
                                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                                    className="w-4 h-4 accent-emerald-500" />
                                <div>
                                    <span className="text-sm font-bold text-foreground block">تفعيل الكود</span>
                                </div>
                            </label>

                            <button onClick={handleSave} disabled={isSaving || !form.code || !form.discount_value}
                                className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                                {isSaving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة الكود'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
