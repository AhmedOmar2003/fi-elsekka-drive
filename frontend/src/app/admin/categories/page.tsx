"use client"

import React, { useEffect, useState } from 'react';
import { fetchAdminCategories, createCategory, updateCategory, deleteCategory } from '@/services/adminService';
import { Plus, Pencil, Trash2, Tag, X, Loader2 } from 'lucide-react';

type Category = { id: string; name: string; description: string | null; products: { id: string }[] };

export default function AdminCategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const load = async () => {
        setIsLoading(true);
        const data = await fetchAdminCategories();
        setCategories(data as Category[]);
        setIsLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setEditingId(null); setName(''); setDescription(''); setIsModalOpen(true);
    };

    const openEdit = (cat: Category) => {
        setEditingId(cat.id); setName(cat.name); setDescription(cat.description || ''); setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsSaving(true);
        if (editingId) {
            await updateCategory(editingId, name.trim(), description.trim());
        } else {
            await createCategory(name.trim(), description.trim());
        }
        setIsSaving(false);
        setIsModalOpen(false);
        load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('حذف هذا القسم؟ المنتجات المرتبطة به ستفقد قسمها.')) return;
        await deleteCategory(id);
        load();
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-heading font-black text-foreground">الأقسام</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{categories.length} قسم في المتجر</p>
                </div>
                <button
                    onClick={openNew}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4" /> إضافة قسم
                </button>
            </div>

            {/* Grid of category cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="h-28 bg-surface-hover rounded-2xl animate-pulse border border-surface-hover" />
                    ))
                ) : categories.length === 0 ? (
                    <div className="col-span-3 text-center text-gray-500 py-16">لا توجد أقسام بعد. أضف أول قسم!</div>
                ) : (
                    categories.map((cat) => (
                        <div key={cat.id} className="bg-surface border border-surface-hover rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-all shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                        <Tag className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground text-sm">{cat.name}</h3>
                                        {cat.description && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{cat.description}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-surface-hover transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="bg-surface-hover text-gray-500 px-2.5 py-1 rounded-lg text-xs font-bold">
                                    {cat.products?.length || 0} منتج
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-surface border border-surface-hover rounded-3xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-surface-hover">
                            <h2 className="font-heading font-black text-foreground">{editingId ? 'تعديل القسم' : 'إضافة قسم جديد'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-foreground hover:bg-surface-hover">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">اسم القسم *</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="مثال: إلكترونيات"
                                    className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">الوصف</label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="وصف مختصر للقسم..."
                                    className="w-full bg-surface-hover border border-surface-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50 resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-5 border-t border-surface-hover">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-surface-hover text-sm font-bold text-gray-500 hover:text-foreground hover:bg-surface-hover transition-all">
                                إلغاء
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !name.trim()}
                                className="flex-[2] py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editingId ? 'حفظ التعديلات' : 'إضافة القسم'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
