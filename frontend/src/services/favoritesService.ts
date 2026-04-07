import { supabase } from '@/lib/supabase';
import { Product } from './productsService';

export interface Favorite {
    id: string;
    user_id: string;
    product_id: string;
    created_at: string;
    product?: Product;
}

/** Fetch all favorite products for a user (with product details joined) */
export const fetchUserFavorites = async (userId: string): Promise<Product[]> => {
    const { data, error } = await supabase
        .from('favorites')
        .select('product_id, products(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchUserFavorites error:', error);
        return [];
    }

    return (data ?? [])
        .map((row: any) => row.products)
        .filter(Boolean) as Product[];
};

/** Fetch only the favorite product IDs for a user (fast, for state init) */
export const fetchFavoriteIds = async (userId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', userId);

    if (error) {
        console.error('fetchFavoriteIds error:', error);
        return [];
    }

    return (data ?? []).map((r: any) => r.product_id);
};

/** Add a product to favorites */
export const addFavorite = async (userId: string, productId: string): Promise<{ error: any }> => {
    const { error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, product_id: productId });
    return { error };
};

/** Remove a product from favorites */
export const removeFavorite = async (userId: string, productId: string): Promise<{ error: any }> => {
    const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
    return { error };
};

/** Remove ALL favorites for a user */
export const clearAllFavorites = async (userId: string): Promise<{ error: any }> => {
    const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId);
    return { error };
};
