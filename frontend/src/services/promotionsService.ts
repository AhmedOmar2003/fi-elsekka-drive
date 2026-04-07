import { supabase } from '@/lib/supabase';

export interface Promotion {
    id: number;
    title: string;
    description: string | null;
    discount_code: string | null;
    button_text: string | null;
    button_link: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Fetches the currently active promotion (if any).
 */
export const fetchActivePromotion = async (): Promise<Promotion | null> => {
    const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching promotion:', error.message);
        return null;
    }

    return data;
};

/**
 * Fetches all promotions (for the admin dashboard).
 */
export const fetchAllPromotions = async (): Promise<Promotion[]> => {
    const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching all promotions:', error.message);
        return [];
    }

    return data || [];
};

/**
 * Creates a new promotion.
 */
export const createPromotion = async (payload: Omit<Promotion, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
        .from('promotions')
        .insert([payload])
        .select()
        .single();
    return { data, error };
};

/**
 * Updates an existing promotion.
 */
export const updatePromotion = async (id: number, payload: Partial<Omit<Promotion, 'id' | 'created_at' | 'updated_at'>>) => {
    const { data, error } = await supabase
        .from('promotions')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    return { data, error };
};

/**
 * Deletes a promotion by id.
 */
export const deletePromotion = async (id: number) => {
    const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);
    return { error };
};
