"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchFavoriteIds, addFavorite, removeFavorite, clearAllFavorites as clearAllFavoritesApi } from '@/services/favoritesService';

const GUEST_KEY = 'guest_favorites';

interface FavoritesContextValue {
    favoriteIds: Set<string>;
    isLoading: boolean;
    isFavorite: (productId: string) => boolean;
    toggleFavorite: (productId: string) => Promise<void>;
    clearAllFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue>({
    favoriteIds: new Set(),
    isLoading: false,
    isFavorite: () => false,
    toggleFavorite: async () => {},
    clearAllFavorites: async () => {},
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    // Load favorites when user changes
    useEffect(() => {
        if (user) {
            // Authenticated: load from Supabase
            setIsLoading(true);
            fetchFavoriteIds(user.id).then(ids => {
                setFavoriteIds(new Set(ids));
                setIsLoading(false);
            });
        } else {
            // Guest: load from localStorage
            try {
                const stored = localStorage.getItem(GUEST_KEY);
                const ids: string[] = stored ? JSON.parse(stored) : [];
                setFavoriteIds(new Set(ids));
            } catch {
                setFavoriteIds(new Set());
            }
        }
    }, [user]);

    const isFavorite = useCallback((productId: string) => {
        return favoriteIds.has(productId);
    }, [favoriteIds]);

    const toggleFavorite = useCallback(async (productId: string) => {
        const alreadyFav = favoriteIds.has(productId);

        // Optimistic update
        setFavoriteIds(prev => {
            const next = new Set(prev);
            if (alreadyFav) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });

        if (user) {
            // Persist in Supabase
            if (alreadyFav) {
                await removeFavorite(user.id, productId);
            } else {
                await addFavorite(user.id, productId);
            }
        } else {
            // Persist in localStorage for guests
            setFavoriteIds(prev => {
                const ids = Array.from(prev);
                localStorage.setItem(GUEST_KEY, JSON.stringify(ids));
                return prev;
            });
        }
    }, [user, favoriteIds]);

    const clearAll = useCallback(async () => {
        setFavoriteIds(new Set());
        if (user) {
            await clearAllFavoritesApi(user.id);
        } else {
            localStorage.removeItem(GUEST_KEY);
        }
    }, [user]);

    return (
        <FavoritesContext.Provider value={{ favoriteIds, isLoading, isFavorite, toggleFavorite, clearAllFavorites: clearAll }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    return useContext(FavoritesContext);
}
