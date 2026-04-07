"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchProducts, fetchOffers, Product } from '@/services/productsService';
import { fetchCategories, Category } from '@/services/categoriesService';

// NOTE: Realtime subscriptions for `products` and `categories` tables have been
// intentionally removed for end users. These tables change only via admin actions.
// Instead, we now rely on:
//   - Next.js ISR revalidation (5 min) for Server Component pages (home, offers)
//   - Stale-While-Revalidate: products load once per session on client pages
// Admin panel manages its own direct Supabase queries and does not use this context.

interface ProductsContextType {
    products: Product[];
    offerProducts: Product[];
    categories: Category[];
    isLoadingProducts: boolean;
    isLoadingCategories: boolean;
    refreshProducts: () => Promise<void>;
    refreshOffers: () => Promise<void>;
    ensureProductsLoaded: () => Promise<void>;
    ensureCategoriesLoaded: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType>({
    products: [],
    offerProducts: [],
    categories: [],
    isLoadingProducts: true,
    isLoadingCategories: true,
    refreshProducts: async () => { },
    refreshOffers: async () => { },
    ensureProductsLoaded: async () => { },
    ensureCategoriesLoaded: async () => { },
});

export const ProductsProvider = ({ children }: { children: React.ReactNode }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [offerProducts, setOfferProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);
    const hasLoadedProductsRef = React.useRef(false);
    const hasLoadedOffersRef = React.useRef(false);
    const hasLoadedCategoriesRef = React.useRef(false);

    // ── Load products ─────────────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        setIsLoadingProducts(true);
        const data = await fetchProducts();
        setProducts(data);
        setIsLoadingProducts(false);
        hasLoadedProductsRef.current = true;
    }, []);

    // ── Load offer products ───────────────────────────────────────────────
    const loadOffers = useCallback(async () => {
        const data = await fetchOffers();
        setOfferProducts(data);
        hasLoadedOffersRef.current = true;
    }, []);

    // ── Load categories ───────────────────────────────────────────────────
    const loadCategories = useCallback(async () => {
        setIsLoadingCategories(true);
        const data = await fetchCategories();
        setCategories(data);
        setIsLoadingCategories(false);
        hasLoadedCategoriesRef.current = true;
    }, []);

    const ensureProductsLoaded = useCallback(async () => {
        if (hasLoadedProductsRef.current) return;
        await loadProducts();
    }, [loadProducts]);

    const ensureOffersLoaded = useCallback(async () => {
        if (hasLoadedOffersRef.current) return;
        await loadOffers();
    }, [loadOffers]);

    const ensureCategoriesLoaded = useCallback(async () => {
        if (hasLoadedCategoriesRef.current) return;
        await loadCategories();
    }, [loadCategories]);

    // ── Initial load (one-time per session) ──────────────────────────────
    useEffect(() => {
        void ensureCategoriesLoaded();
    }, [ensureCategoriesLoaded]);

    // ── Realtime subscriptions REMOVED for end users ──────────────────────
    // Products and categories update infrequently (admin-only).
    // Keeping open websocket connections per user is too expensive on the Free plan.
    // The admin dashboard manages its own state directly via Supabase (not this context).
    // If a product changes, the user will see it on next page load or manual refresh.

    return (
        <ProductsContext.Provider value={{
            products, offerProducts, categories,
            isLoadingProducts, isLoadingCategories,
            refreshProducts: loadProducts,
            refreshOffers: ensureOffersLoaded,
            ensureProductsLoaded,
            ensureCategoriesLoaded,
        }}>
            {children}
        </ProductsContext.Provider>
    );
};

export const useProducts = () => useContext(ProductsContext);
