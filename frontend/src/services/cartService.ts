import { supabase } from '@/lib/supabase';
import { Product } from './productsService';
import { isSameSelectedVariant, normalizeSelectedVariant, type SelectedVariantJson } from '@/lib/product-variants';

export interface CartItem {
    id: string;
    product_id: string;
    quantity: number;
    applied_price?: number | null;
    selected_variant_json?: SelectedVariantJson;
    product?: Product;
}

export const fetchUserCart = async (userId: string): Promise<CartItem[]> => {
    // We join the products table to get product details for each cart item
    const { data, error } = await supabase
        .from('cart_items')
        .select(`
            id,
            product_id,
            quantity,
            applied_price,
            selected_variant_json,
            product:products (
                id,
                name,
                price,
                image_url,
                discount_percentage,
                specifications
            )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        // AbortError is a transient Web Lock conflict — ignore silently
        if (error.message?.includes('AbortError') || error.message?.includes('Lock broken')) {
            return [];
        }
        console.error('Error fetching user cart:', error?.message || error);
        return [];
    }

    return (data || []) as unknown as CartItem[];
};

export const addToCart = async (
    userId: string,
    productId: string,
    quantity: number = 1,
    appliedPrice?: number | null,
    selectedVariantJson?: SelectedVariantJson,
) => {
    const normalizedVariant = normalizeSelectedVariant(selectedVariantJson);
    // Upsert logic: If item exists, we should ideally increment quantity instead of inserting new.
    // Let's first check if it exists
    const { data: existingItems } = await supabase
        .from('cart_items')
        .select('id, quantity, applied_price, selected_variant_json')
        .eq('user_id', userId)
        .eq('product_id', productId);

    const existing = (existingItems || []).find((item) =>
        isSameSelectedVariant(item.selected_variant_json, normalizedVariant)
    );

    if (existing) {
        const { data, error } = await supabase
            .from('cart_items')
            .update({
                quantity: existing.quantity + quantity,
                applied_price: appliedPrice ?? existing.applied_price ?? null,
                selected_variant_json: normalizedVariant,
            })
            .eq('id', existing.id)
            .select()
            .single();
        return { data, error };
    } else {
        const { data, error } = await supabase
            .from('cart_items')
            .insert({
                user_id: userId,
                product_id: productId,
                quantity,
                applied_price: appliedPrice || null,
                selected_variant_json: normalizedVariant,
            })
            .select()
            .single();
        return { data, error };
    }
};

export const updateCartItemQuantity = async (cartItemId: string, newQuantity: number) => {
    const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', cartItemId)
        .select()
        .single();
    return { data, error };
};

export const removeFromCart = async (cartItemId: string) => {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);
    return { error };
};

export const clearUserCart = async (userId: string) => {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId);
    return { error };
};
