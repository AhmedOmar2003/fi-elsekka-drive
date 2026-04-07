import { supabase } from '@/lib/supabase';
import { Product } from './productsService';
import type { SelectedVariantJson } from '@/lib/product-variants';

export interface Order {
    id: string;
    user_id: string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    total_amount: number;
    shipping_address: any;
    created_at: string;
    order_items?: OrderItem[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    price_at_purchase: number;
    selected_variant_json?: SelectedVariantJson;
    product?: Product; // joined details
}

const dispatchOrderNotifications = async (orderId: string) => {
    if (!orderId) return;

    try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;

        await Promise.allSettled([
            fetch(`/api/orders/${orderId}/admin-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            }),
            fetch(`/api/orders/${orderId}/restaurant-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            }),
        ]);
    } catch (error) {
        console.error('Failed to dispatch order notifications:', error);
    }
};

export type CancelledOrderDecision = 'insist' | 'confirm_cancel';
export type QuotedOrderDecision = 'approve' | 'reject';
type CustomerCancelOrigin = 'grace_period' | 'account';

export const createOrder = async (
    userId: string,
    cartItems: any[], // Allows CartItem or GuestCartItem union from CartContext
    shippingDetails: any,
    subtotalAmount: number,
    options?: {
        clearCartAfterOrder?: boolean
    }
) => {
    const clearCartAfterOrder = options?.clearCartAfterOrder ?? true
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
        return { error: new Error('لازم تكون مسجل دخول قبل ما تأكد الطلب') };
    }

    const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            userId,
            cartItems,
            shippingDetails,
            subtotalAmount,
            clearCartAfterOrder,
        }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { error: new Error(payload?.error || 'في حاجة عطلتنا وإحنا بنأكد الطلب') };
    }

    return { data: payload.data };
};

export const fetchUserOrders = async (userId: string): Promise<Order[]> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
        return [];
    }

    const res = await fetch('/api/orders/user', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        console.error('Error fetching user orders:', payload?.error || res.statusText);
        return [];
    }

    return (payload?.data || []) as Order[];
};

export const updateOrderStatus = async (orderId: string, status: string) => {
    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();

    return { data, error };
};

export const cancelOrderByCustomer = async (orderId: string, origin: CustomerCancelOrigin = 'grace_period') => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
        return { data: null, error: new Error("Unauthorized") };
    }

    const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ origin }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { data: null, error: new Error(payload?.error || "تعذر إلغاء الطلب") };
    }

    return { data: payload.data, error: null };
};

export const confirmOrderGracePeriod = async (orderId: string) => {
    // We update the shipping_address JSON to set is_grace_period: false
    // Since we don't know the exact JSON shape without fetching, we fetch first.
    const { data: order } = await supabase.from('orders').select('shipping_address').eq('id', orderId).single();
    if (!order || !order.shipping_address) return { error: new Error("Order not found") };

    const newShipping = { ...order.shipping_address, is_grace_period: false };
    
    const { data, error } = await supabase
        .from('orders')
        .update({ shipping_address: newShipping })
        .eq('id', orderId)
        .select()
        .single();

    if (!error && data?.id) {
        void dispatchOrderNotifications(data.id);
    }

    return { data, error };
};

export const respondToCancelledOrder = async (orderId: string, decision: CancelledOrderDecision) => {
    const res = await fetch(`/api/orders/${orderId}/cancel-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل إرسال ردك على الإلغاء');
    }
    return data as { success: true; decision: CancelledOrderDecision; shipping_address: any };
};

export const respondToQuotedTextOrder = async (orderId: string, decision: QuotedOrderDecision) => {
    const res = await fetch(`/api/orders/${orderId}/quote-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || 'فشل إرسال ردك على التسعيرة');
    }
    return data as { success: true; decision: QuotedOrderDecision; shipping_address: any; status: Order['status'] };
};

export const updateUserProfile = async (userId: string, updates: any) => {
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

    return { data, error };
};
