"use client"

import React, { useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import {
    fetchAllPromotions, createPromotion, updatePromotion, deletePromotion, Promotion
} from '@/services/promotionsService';

const EMPTY_FORM = {
    title: '',
    description: '',
    discount_code: '',
    button_text: '',
    button_link: '/register',
    is_active: false,
};

export default function AdminPromotionsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [isSaving, setIsSaving] = useState(false);

    const load = async () => {
        setIsLoading(true);
        const data = await fetchAllPromotions();
        setPromotions(data);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setIsModalOpen(true);
    };

    const openEdit = (p: Promotion) => {
        setEditingId(p.id);
        setForm({
            title: p.title,
            description: p.description || '',
            discount_code: p.discount_code || '',
            button_text: p.button_text || '',
            button_link: p.button_link || '/register',
            is_active: p.is_active,
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.title.trim()) { toast.error('العنوان مطلوب!'); return; }
        setIsSaving(true);

        const payload = {
            title: form.title.trim(),
            description: form.description.trim() || null,
            discount_code: form.discount_code.trim() || null,
            button_text: form.button_text.trim() || null,
            button_link: form.button_link.trim() || '/register',
            is_active: form.is_active,
        };

        const { error } = editingId
            ? await updatePromotion(editingId, payload)
            : await createPromotion(payload);

        setIsSaving(false);

        if (error) {
            toast.error(`فشل الحفظ: ${(error as any).message}`);
        } else {
            toast.success(editingId ? 'تم تعديل العرض بنجاح ✅' : 'تم إضافة العرض بنجاح ✅');
            setIsModalOpen(false);
            load();
        }
    };

    const handleToggleActive = async (p: Promotion) => {
        const { error } = await updatePromotion(p.id, { is_active: !p.is_active });
        if (error) {
            toast.error('فشل تغيير الحالة.');
        } else {
            toast.success(p.is_active ? 'تم إيقاف العرض' : 'تم تفعيل العرض ✅');
            load();
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
        const { error } = await deletePromotion(id);
        if (error) {
            toast.error('فشل الحذف.');
        } else {
            toast.success('تم حذف العرض ✅');
            setPromotions(prev => prev.filter(p => p.id !== id));
        }
    };

    const field = (key: keyof typeof EMPTY_FORM, label: string, placeholder: string, type: 'text' | 'textarea' = 'text') => (
        <div key={key}>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">{label}</label>
            {type === 'textarea' ? (
                <textarea rows={3} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50 resize-none" />
            ) : (
                <input type="text" value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50" />
            )}
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-heading font-black text-foreground">العروض الترويجية</h1>
                    <p className="text-sm text-gray-500 mt-0.5">تحكم في اللافتة الترويجية للزوار الجدد</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> إضافة عرض
                </button>
            </div>

            {/* List */}
            <div className="bg-surface border border-surface-hover rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead>
                            <tr className="border-b border-surface-hover">
                                <th className="px-4 py-3 text-xs font-bold text-gray-500">العنوان</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 hidden sm:table-cell">كود الخصم</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500">الحالة</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-hover">
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <tr key={i}><td colSpan={4} className="px-4 py-4"><div className="h-10 bg-surface-hover rounded-lg animate-pulse" /></td></tr>
                                ))
                            ) : promotions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-16">
                                        <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                                        <p className="text-gray-500">لا توجد عروض بعد، أضف عرضك الأول!</p>
                                    </td>
                                </tr>
                            ) : promotions.map(p => (
                                <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-foreground">{p.title}</p>
                                        {p.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>}
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        {p.discount_code ? (
                                            <span className="font-mono bg-surface-hover px-2.5 py-1 rounded-lg text-primary text-xs tracking-widest border border-surface-hover">{p.discount_code}</span>
                                        ) : <span className="text-gray-500 text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleToggleActive(p)}
                                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${p.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-surface-hover text-gray-500 border-surface-hover hover:bg-surface'}`}>
                                            {p.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                            {p.is_active ? 'مفعّل' : 'موقوف'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-surface-hover transition-colors">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
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
                    <div className="bg-surface border border-surface-hover rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-surface-hover sticky top-0 bg-surface">
                            <h2 className="font-heading font-black text-foreground">{editingId ? 'تعديل العرض' : 'إضافة عرض جديد'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-foreground hover:bg-surface-hover">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {field('title', 'العنوان *', 'مثال: أطلب أول طلب ليك دلوقتي')}
                            {field('description', 'الوصف / التفاصيل', 'مثال: وهديتك 50 جنيه خصم وتوصيل مجاني بالكامل!', 'textarea')}
                            {field('discount_code', 'كود الخصم', 'مثال: AWAL50')}
                            {field('button_text', 'نص الزر', 'مثال: سجل حساب جديد')}
                            {field('button_link', 'رابط الزر', '/register')}

                            {/* Active toggle */}
                            <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${form.is_active ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10' : 'bg-surface-hover border-surface-hover hover:bg-surface'}`}>
                                <input type="checkbox" checked={form.is_active}
                                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                                    className="w-4 h-4 accent-emerald-500" />
                                <div>
                                    <span className="text-sm font-bold text-foreground block">تفعيل هذا العرض</span>
                                    <span className="text-xs text-gray-500">سيظهر هذا العرض للزوار غير المسجلين فور التفعيل</span>
                                </div>
                            </label>

                            {/* Preview */}
                            {form.title && (
                                <div className="rounded-xl overflow-hidden">
                                    <p className="text-xs font-bold text-gray-500 mb-2">معاينة:</p>
                                    <div className="relative bg-gradient-to-r from-emerald-600 to-primary text-white p-4 rounded-xl flex flex-col gap-2">
                                        <p className="font-black text-lg">{form.title}</p>
                                        {form.description && <p className="text-white/80 text-sm">{form.description}</p>}
                                        {form.discount_code && (
                                            <span className="font-mono bg-black/20 px-3 py-1 rounded-lg inline-block text-sm tracking-widest w-fit border border-white/10">
                                                كود: {form.discount_code}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button onClick={handleSave} disabled={isSaving}
                                className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                                {isSaving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة العرض'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
