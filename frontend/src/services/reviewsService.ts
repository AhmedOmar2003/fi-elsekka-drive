import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload } from '@/lib/image-upload';

export interface Review {
    id: string;
    user_id: string;
    product_id: string;
    rating: number;
    comment: string | null;
    images: string[];
    user_name: string | null;
    created_at: string;
}

export interface ReviewStats {
    averageRating: number;
    totalReviews: number;
    distribution: { [key: number]: number }; // 1-5 star counts
}

/** Fetch all reviews for a product */
export const fetchProductReviews = async (productId: string): Promise<Review[]> => {
    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchProductReviews error:', error);
        return [];
    }

    return (data ?? []) as Review[];
};

/** Calculate review statistics */
export const calcReviewStats = (reviews: Review[]): ReviewStats => {
    if (reviews.length === 0) {
        return { averageRating: 0, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    }

    const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;

    reviews.forEach(r => {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        total += r.rating;
    });

    return {
        averageRating: Number((total / reviews.length).toFixed(1)),
        totalReviews: reviews.length,
        distribution,
    };
};

/** Check if a user received a delivered order that contains this product */
export const checkUserPurchased = async (userId: string, productId: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('orders')
        .select('id, order_items!inner(product_id)')
        .eq('user_id', userId)
        .eq('status', 'delivered')
        .eq('order_items.product_id', productId)
        .limit(1);

    if (error) {
        console.error('checkUserPurchased error:', error);
        return false;
    }

    return (data?.length ?? 0) > 0;
};

/** Check if user already reviewed this product */
export const checkUserReviewed = async (userId: string, productId: string): Promise<boolean> => {
    const { data, error } = await supabase
        .from('reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
};

/** Fetch the current user's review for a product */
export const fetchUserProductReview = async (userId: string, productId: string): Promise<Review | null> => {
    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('fetchUserProductReview error:', error);
        return null;
    }

    return (data as Review | null) ?? null;
};

/** Create a new review */
export const createReview = async (
    userId: string,
    productId: string,
    rating: number,
    comment: string,
    images: string[],
    userName: string
): Promise<{ data: Review | null; error: any }> => {
    const canReview = await checkUserPurchased(userId, productId);
    if (!canReview) {
        return {
            data: null,
            error: new Error('مينفعش تكتب تقييم غير بعد ما الطلب يتسلم فعلًا وتتحول حالته إلى تم التوصيل'),
        };
    }

    const { data, error } = await supabase
        .from('reviews')
        .insert({
            user_id: userId,
            product_id: productId,
            rating,
            comment: comment || null,
            images,
            user_name: userName,
        })
        .select()
        .single();

    return { data: data as Review | null, error };
};

/** Update an existing review */
export const updateReview = async (
    reviewId: string,
    rating: number,
    comment: string,
    images: string[]
): Promise<{ data: Review | null; error: any }> => {
    const { data, error } = await supabase
        .from('reviews')
        .update({
            rating,
            comment: comment || null,
            images,
        })
        .eq('id', reviewId)
        .select()
        .single();

    return { data: data as Review | null, error };
};

/** Upload a review image to Supabase Storage */
export const uploadReviewImage = async (file: File): Promise<string | null> => {
    const optimizedFile = await optimizeImageForUpload(file, { maxDimension: 1400, quality: 0.82 });
    const ext = optimizedFile.name.split('.').pop() || 'webp';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage
        .from('review-images')
        .upload(fileName, optimizedFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: optimizedFile.type || 'image/webp',
        });

    if (error) {
        console.error('uploadReviewImage error:', error);
        return null;
    }

    const { data: urlData } = supabase.storage
        .from('review-images')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
};

// ── Admin Functions ──────────────────────────────────────────

/** Fetch all reviews across the platform (for admin dashboard) */
export const fetchAllReviews = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('reviews')
        .select(`
            *,
            product:products(name, image_url)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchAllReviews error:', error);
        return [];
    }

    return data || [];
};

/** Delete a review (Admin or Owner) */
export const deleteReview = async (reviewId: string): Promise<boolean> => {
    const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

    if (error) {
        console.error('deleteReview error:', error);
        return false;
    }

    return true;
};
