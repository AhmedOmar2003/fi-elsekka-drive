import { supabase } from '@/lib/supabase';

export interface DeliveryInfo {
    id: string;
    user_id: string;
    label: string;
    recipient_name?: string;
    phone_number?: string;
    city: string;
    area?: string;
    address: string;
    postal_code?: string;
    is_default: boolean;
    created_at: string;
}

export const fetchUserDeliveryAddresses = async (userId: string): Promise<DeliveryInfo[]> => {
    const { data, error } = await supabase
        .from('delivery_info')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });

    if (error) {
        console.error('Error fetching delivery info:', error.message);
        return [];
    }
    return data || [];
};

export const getDefaultDeliveryAddress = async (userId: string): Promise<DeliveryInfo | null> => {
    const { data, error } = await supabase
        .from('delivery_info')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();

    if (error) {
        console.error('Error fetching default delivery address:', error.message);
        return null;
    }
    return data;
};

export const saveDeliveryAddress = async (
    userId: string,
    payload: Omit<DeliveryInfo, 'id' | 'user_id' | 'created_at'>
) => {
    const { data, error } = await supabase
        .from('delivery_info')
        .insert({ ...payload, user_id: userId })
        .select()
        .single();

    return { data, error };
};

export const updateDeliveryAddress = async (
    id: string,
    payload: Partial<Omit<DeliveryInfo, 'id' | 'user_id' | 'created_at'>>
) => {
    const { data, error } = await supabase
        .from('delivery_info')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    return { data, error };
};

export const deleteDeliveryAddress = async (id: string) => {
    const { error } = await supabase
        .from('delivery_info')
        .delete()
        .eq('id', id);

    return { error };
};

export const setDefaultDeliveryAddress = async (id: string, userId: string) => {
    // The DB trigger will automatically unset others, we just set this one
    return updateDeliveryAddress(id, { is_default: true });
};
