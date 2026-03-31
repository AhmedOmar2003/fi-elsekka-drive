"use client"

import React from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProductsProvider } from '@/contexts/ProductsContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { ThemeProvider } from 'next-themes';
import { SiteVisitTracker } from '@/components/analytics/site-visit-tracker';

export function Providers({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const useLegacyStoreProviders =
        pathname?.startsWith('/products') ||
        pathname?.startsWith('/cart') ||
        pathname?.startsWith('/favorites') ||
        pathname?.startsWith('/discounts') ||
        pathname?.startsWith('/offers') ||
        pathname?.startsWith('/checkout');

    const content = useLegacyStoreProviders ? (
        <AppSettingsProvider>
            <AuthProvider>
                <ProductsProvider>
                    <CartProvider>
                        <FavoritesProvider>
                            <SiteVisitTracker />
                            {children}
                        </FavoritesProvider>
                    </CartProvider>
                </ProductsProvider>
            </AuthProvider>
        </AppSettingsProvider>
    ) : (
        <AuthProvider>
            <SiteVisitTracker />
            {children}
        </AuthProvider>
    );

    return (
        <ThemeProvider attribute="class" forcedTheme="dark" defaultTheme="dark" enableSystem={false}>
            {content}
        </ThemeProvider>
    );
}
