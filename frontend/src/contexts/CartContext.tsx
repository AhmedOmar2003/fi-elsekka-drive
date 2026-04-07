"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserCart, addToCart, removeFromCart, updateCartItemQuantity, clearUserCart, CartItem } from '@/services/cartService';
import { fetchProductById } from '@/services/productsService';
import { isSameSelectedVariant, normalizeSelectedVariant, type SelectedVariantJson } from '@/lib/product-variants';
import { toast } from 'sonner';

// ─── Guest cart item (has full product embedded) ───────────────────────────
export interface GuestCartItem {
    id: string;          // local-<timestamp>
    product_id: string;
    quantity: number;
    applied_price?: number | null;
    selected_variant_json?: SelectedVariantJson;
    product: {
        id: string;
        name: string;
        price: number;
        image_url?: string;
        slug?: string;
        discount_percentage?: number;
        specifications?: Record<string, any>;
    };
}

interface CartContextType {
    items: (CartItem | GuestCartItem)[];
    cartCount: number;
    cartTotal: number;
    cartOriginalTotal: number;
    cartDiscountTotal: number;
    isLoading: boolean;
    addItem: (
        productId: string,
        quantity?: number,
        appliedPrice?: number | null,
        selectedVariantJson?: SelectedVariantJson
    ) => Promise<void>;
    removeItem: (cartItemId: string) => Promise<void>;
    updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
    clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType>({
    items: [],
    cartCount: 0,
    cartTotal: 0,
    cartOriginalTotal: 0,
    cartDiscountTotal: 0,
    isLoading: true,
    addItem: async () => { },
    removeItem: async () => { },
    updateQuantity: async () => { },
    clearCart: async () => { },
});

// ─── Helpers ───────────────────────────────────────────────────────────────
const GUEST_KEY = 'guestCart';

function readGuestCart(): GuestCartItem[] {
    try {
        const raw = localStorage.getItem(GUEST_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeGuestCart(items: GuestCartItem[]) {
    localStorage.setItem(GUEST_KEY, JSON.stringify(items));
}

function clearGuestCart() {
    localStorage.removeItem(GUEST_KEY);
}

// ─── Provider ─────────────────────────────────────────────────────────────
export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<(CartItem | GuestCartItem)[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ── Load cart ─────────────────────────────────────────────────────────
    const loadCart = useCallback(async (options?: { silent?: boolean }) => {
        if (!options?.silent) {
            setIsLoading(true);
        }

        if (!user) {
            // Guest: load from localStorage
            setItems(readGuestCart());
            if (!options?.silent) {
                setIsLoading(false);
            }
            return;
        }

        // Logged in:
        // 1. Sync any guest items to DB first
        const guestItems = readGuestCart();
        if (guestItems.length > 0) {
            await Promise.all(
                guestItems.map(item => addToCart(user.id, item.product_id, item.quantity, item.applied_price, item.selected_variant_json))
            );
            clearGuestCart();
        }

        // 2. Load full cart from DB (with product details via join)
        const data = await fetchUserCart(user.id);
        setItems(data);
        if (!options?.silent) {
            setIsLoading(false);
        }
    }, [user]);

    // ── Subscribe to supabase realtime (auth users only) ──────────────────
    useEffect(() => {
        loadCart();

        if (!user) return;

        const channel = supabase
            .channel(`cart_items_${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cart_items', filter: `user_id=eq.${user.id}` },
                () => loadCart({ silent: true })
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, loadCart]);

    // ── Add item ──────────────────────────────────────────────────────────
    const addItem = async (
        productId: string,
        quantity: number = 1,
        appliedPrice?: number | null,
        selectedVariantJson?: SelectedVariantJson
    ) => {
        const product = await fetchProductById(productId);
        if (!product) {
            toast.error('عذراً، لم نتمكن من العثور على المنتج.');
            return;
        }

        const normalizedVariant = normalizeSelectedVariant(selectedVariantJson);

        if (!user) {
            // Guest: fetch product details so we can display them in cart
            const guestItems = readGuestCart();
            const existing = guestItems.find(
                i => i.product_id === productId && isSameSelectedVariant(i.selected_variant_json, normalizedVariant)
            );

            if (existing) {
                const updated = guestItems.map(i =>
                    i.product_id === productId && isSameSelectedVariant(i.selected_variant_json, normalizedVariant)
                        ? { ...i, quantity: i.quantity + quantity, applied_price: appliedPrice ?? i.applied_price ?? null }
                        : i
                );
                writeGuestCart(updated);
                setItems(updated);
            } else {
                const newItem: GuestCartItem = {
                    id: `local-${Date.now()}`,
                    product_id: productId,
                    quantity,
                    applied_price: appliedPrice || null,
                    selected_variant_json: normalizedVariant,
                    product: {
                        id: productId,
                        name: product.name || 'منتج',
                        price: product.price || 0,
                        image_url: product.image_url,
                        slug: product.slug,
                        discount_percentage: product.discount_percentage,
                        specifications: product.specifications,
                    }
                };
                const updated = [...guestItems, newItem];
                writeGuestCart(updated);
                setItems(updated);
            }
            toast.success(`تم إضافة "${product.name}" بنجاح!`);
            return;
        }

        // Logged-in: Optimistic update
        setItems(prev => {
            const existingIndex = prev.findIndex(
                i => i.product_id === productId && isSameSelectedVariant((i as any).selected_variant_json, normalizedVariant)
            );
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: updated[existingIndex].quantity + quantity,
                    applied_price: appliedPrice ?? (updated[existingIndex] as any).applied_price ?? null,
                    selected_variant_json: normalizedVariant,
                };
                return updated;
            } else {
                const newItem = {
                    id: `temp-${Date.now()}`, // Temporary ID until RealTime kicks in
                    product_id: productId,
                    quantity,
                    applied_price: appliedPrice || null,
                    selected_variant_json: normalizedVariant,
                    product: {
                        id: productId,
                        name: product.name,
                        price: product.price,
                        image_url: product.image_url,
                        slug: product.slug,
                        discount_percentage: product.discount_percentage,
                        specifications: product.specifications,
                    }
                };
                return [...prev, newItem as unknown as CartItem];
            }
        });

        const optimisticSnapshot = items;
        toast.success(`تم إضافة "${product.name}" بنجاح!`);

        // Write to DB, let realtime/loadCart update state
        const { error } = await addToCart(user.id, productId, quantity, appliedPrice, normalizedVariant);
        if (error) {
            console.error('Failed to add item to cart:', error);
            setItems(optimisticSnapshot);
            toast.error('محصلش حفظ للمنتج في السلة، جرّب تاني.');
            return;
        }
    };

    // ── Remove item ───────────────────────────────────────────────────────
    const removeItem = async (cartItemId: string) => {
        if (!user) {
            const updated = readGuestCart().filter(i => i.id !== cartItemId);
            writeGuestCart(updated);
            setItems(updated);
            return;
        }
        await removeFromCart(cartItemId);
        setItems(prev => prev.filter(i => i.id !== cartItemId));
    };

    // ── Update quantity ───────────────────────────────────────────────────
    const updateQuantity = async (cartItemId: string, quantity: number) => {
        if (quantity < 1) return;

        if (!user) {
            const updated = readGuestCart().map(i =>
                i.id === cartItemId ? { ...i, quantity } : i
            );
            writeGuestCart(updated);
            setItems(updated);
            return;
        }

        // Optimistic update, then write to DB
        const previousItems = items;
        setItems(prev => prev.map(i => i.id === cartItemId ? { ...i, quantity } : i));
        const { error } = await updateCartItemQuantity(cartItemId, quantity);
        if (error) {
            console.error('Failed to update cart quantity:', error);
            setItems(previousItems);
            toast.error('ماعرفناش نحدّث الكمية دلوقتي، جرّب تاني.');
        }
    };

    // ── Clear cart ────────────────────────────────────────────────────────
    const clearCart = async () => {
        if (!user) {
            clearGuestCart();
            setItems([]);
            return;
        }

        // Optimistic clear
        setItems([]);
        const { error } = await clearUserCart(user.id);
        if (error) {
            toast.error("حدث خطأ أثناء تفريغ السلة.");
            await loadCart(); // Revert on failure
        } else {
            toast.success("تم تفريغ السلة بنجاح!");
        }
    };

    // ── Derived values ─────────────────────────────────────────────────────
    const cartCount = items.reduce((t, i) => t + i.quantity, 0);

    const getFinalPrice = (item: CartItem | GuestCartItem) => {
        if (item.applied_price != null) return item.applied_price;

        const product = item.product;
        if (!product) return 0;
        if (product.discount_percentage && product.discount_percentage > 0) {
            return Math.round(product.price * (1 - product.discount_percentage / 100));
        }
        return product.price || 0;
    };

    const cartOriginalTotal = items.reduce((t, i) => t + ((i.product?.price || 0) * i.quantity), 0);
    const cartTotal = items.reduce((t, i) => t + (getFinalPrice(i) * i.quantity), 0);
    const cartDiscountTotal = cartOriginalTotal - cartTotal;

    return (
        <CartContext.Provider value={{
            items, cartCount, cartTotal, cartOriginalTotal, cartDiscountTotal,
            isLoading, addItem, removeItem, updateQuantity, clearCart
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
