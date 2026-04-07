"use client"

import React, { useEffect, useState } from 'react'
import {
    MessageSquare, Star, Search, Trash2, ExternalLink,
    AlertCircle, Image as ImageIcon, CheckCircle2, MoreVertical, Package
} from 'lucide-react'
import { fetchAllReviews, deleteReview } from '@/services/reviewsService'
import { invalidateReviewsCache } from '@/app/actions/reviewActions'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { arEG } from 'date-fns/locale'
import Link from 'next/link'

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterRating, setFilterRating] = useState<number | 'all'>('all')

    // Delete confirmation state
    const [reviewToDelete, setReviewToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        loadReviews()

        // Realtime subscription for new reviews
        const channel = supabase
            .channel('admin-reviews')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
                loadReviews()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const loadReviews = async () => {
        setIsLoading(true)
        const data = await fetchAllReviews()
        setReviews(data)
        setIsLoading(false)
    }

    const handleDelete = async () => {
        if (!reviewToDelete) return
        setIsDeleting(true)
        
        const success = await deleteReview(reviewToDelete)
        if (success) {
            await invalidateReviewsCache()
            toast.success("تم حذف التقييم بنجاح")
            setReviews(reviews.filter(r => r.id !== reviewToDelete))
        } else {
            toast.error("حدث خطأ أثناء الحذف")
        }
        
        setIsDeleting(false)
        setReviewToDelete(null)
    }

    // Filter logic
    const filteredReviews = reviews.filter(review => {
        const matchesSearch = 
            (review.comment?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (review.user_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (review.product?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
            
        const matchesRating = filterRating === 'all' || review.rating === filterRating

        return matchesSearch && matchesRating
    })

    // Stats
    const totalReviews = reviews.length
    const averageRating = totalReviews > 0 
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
        : 0
    const withImagesCount = reviews.filter(r => r.images && r.images.length > 0).length

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
                        <MessageSquare className="w-6 h-6 text-primary" />
                        تقييمات المنتجات
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        تابع آراء العملاء، وتفاعل معاها أو احذف التقييمات المخالفة.
                    </p>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface rounded-2xl p-5 border border-surface-hover flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm mb-1 font-medium">إجمالي التقييمات</p>
                        <p className="text-2xl font-black text-foreground font-heading leading-none">{totalReviews}</p>
                    </div>
                </div>
                <div className="bg-surface rounded-2xl p-5 border border-surface-hover flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0">
                        <Star className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm mb-1 font-medium">متوسط التقييم العام</p>
                        <p className="text-2xl font-black text-foreground font-heading leading-none">{averageRating} <span className="text-sm font-bold text-gray-400">/ 5</span></p>
                    </div>
                </div>
                <div className="bg-surface rounded-2xl p-5 border border-surface-hover flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm mb-1 font-medium">تقييمات بصور</p>
                        <p className="text-2xl font-black text-foreground font-heading leading-none">{withImagesCount}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-surface p-4 rounded-2xl border border-surface-hover">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="ابحث في تعليقات العملاء، أسماء المنتجات..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background border border-surface-hover rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                </div>
                <div className="flex gap-2 rtl:space-x-reverse overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    <button
                        onClick={() => setFilterRating('all')}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-all ${filterRating === 'all' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-background border border-surface-hover text-gray-600 hover:bg-surface-hover'}`}
                    >
                        الكل
                    </button>
                    {[5, 4, 3, 2, 1].map(star => (
                        <button
                            key={star}
                            onClick={() => setFilterRating(star)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold shrink-0 flex items-center gap-1.5 transition-all ${filterRating === star ? 'bg-background border-2 border-yellow-500 text-foreground shadow-sm' : 'bg-background border border-surface-hover text-gray-600 hover:bg-surface-hover'}`}
                        >
                            {star} <Star className={`w-4 h-4 ${filterRating === star ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Reviews List */}
            {filteredReviews.length === 0 ? (
                <div className="bg-surface rounded-3xl p-16 text-center border border-surface-hover flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-surface-hover rounded-full flex items-center justify-center mb-4">
                        <MessageSquare className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">مفيش تقييمات مطابقة</h3>
                    <p className="text-gray-500">جرب تغير كلمات البحث أو الفلتر</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredReviews.map((review) => (
                        <div key={review.id} className="bg-surface rounded-2xl border border-surface-hover overflow-hidden flex flex-col hover:border-surface-hover/80 hover:shadow-md transition-all">
                            
                            {/* Product info bar */}
                            <div className="bg-background/50 p-3 border-b border-surface-hover flex items-center gap-3">
                                {review.product?.image_url ? (
                                    <img src={review.product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-gray-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{review.product?.name || 'منتج محذوف'}</p>
                                    <Link href={`/product/${review.product_id}#reviews`} target="_blank" className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5">
                                        عرض في المتجر <ExternalLink className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>

                            {/* Review Content */}
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm text-foreground">{review.user_name || 'مستخدم'}</span>
                                            <span className="inline-flex items-center gap-0.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                <CheckCircle2 className="w-3 h-3" /> مؤكد
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            {format(new Date(review.created_at), 'dd MMMM yyyy - hh:mm a', { locale: arEG })}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setReviewToDelete(review.id)}
                                        className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="حذف التقييم"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex gap-0.5 mb-3">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'fill-yellow-500 text-yellow-500' : 'fill-gray-200 text-gray-200 dark:fill-gray-800 dark:text-gray-800'}`} />
                                    ))}
                                </div>

                                {review.comment ? (
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4 flex-1 break-words">
                                        "{review.comment}"
                                    </p>
                                ) : (
                                    <p className="text-sm text-gray-400 italic mb-4 flex-1">
                                        لم يترك تعليقاً نصياً
                                    </p>
                                )}

                                {/* Images */}
                                {review.images && review.images.length > 0 && (
                                    <div className="flex gap-2 mt-auto pt-4 border-t border-surface-hover">
                                        {review.images.map((img: string, idx: number) => (
                                            <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-surface-hover hover:opacity-80 transition-opacity">
                                                <img src={img} alt="صورة التقييم" className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Modal */}
            {reviewToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setReviewToDelete(null)} />
                    <div className="relative bg-surface rounded-3xl p-6 md:p-8 w-full max-w-sm shrink-0 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                        <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mb-5 mx-auto">
                            <AlertCircle className="w-7 h-7 text-rose-500" />
                        </div>
                        <h3 className="text-xl font-black text-foreground text-center mb-2">متأكد إنك عاوز تحذف التقييم ده؟</h3>
                        <p className="text-center text-gray-500 text-sm mb-8 leading-relaxed">
                            لو حذفت التقييم ده مش هتقدر ترجعه تاني، وهيختفي من صفحة المنتج تماماً للمستخدمين.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="w-full h-12 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70"
                            >
                                {isDeleting ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : 'أيوة، احذف التقييم'}
                            </button>
                            <button
                                onClick={() => setReviewToDelete(null)}
                                disabled={isDeleting}
                                className="w-full h-12 rounded-xl font-bold text-foreground bg-surface-hover hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-95 transition-all border border-transparent disabled:opacity-70"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
