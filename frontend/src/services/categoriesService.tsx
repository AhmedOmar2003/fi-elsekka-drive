import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import React from 'react';
import { Shirt, Laptop, Pill, ShoppingBasket, Baby, Sparkles, Home as HomeIcon, LayoutGrid, UtensilsCrossed } from 'lucide-react';

export interface Category {
    id: string;
    name: string;
    description: string | null;
    parent_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface CategoryDesign {
    iconComponent: React.ElementType;
    color: string;
    iconColor: string;
}

/**
 * Fetches all categories from Supabase
 */
export const fetchCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }

    return data || [];
};

/**
 * Maps a category name to a specific Icon and visual theme.
 */
export const getCategoryDesign = (name: string) => {
    switch (name.trim()) {
        case 'ملابس وأزياء':
            return {
                iconComponent: Shirt,
                color: "from-rose-500/20 to-rose-500/5 hover:from-rose-500/30",
                iconColor: "text-rose-500 bg-rose-500/10"
            };
        case 'إلكترونيات':
            return {
                iconComponent: Laptop,
                color: "from-slate-500/20 to-slate-500/5 hover:from-slate-500/30",
                iconColor: "text-slate-400 bg-slate-500/10"
            };
        case 'صيدلية':
            return {
                iconComponent: Pill,
                color: "from-blue-500/20 to-blue-500/5 hover:from-blue-500/30",
                iconColor: "text-blue-500 bg-blue-500/10"
            };
        case 'سوبر ماركت':
            return {
                iconComponent: ShoppingBasket,
                color: "from-emerald-500/20 to-emerald-500/5 hover:from-emerald-500/30",
                iconColor: "text-emerald-500 bg-emerald-500/10"
            };
        case 'طعام':
            return {
                iconComponent: UtensilsCrossed,
                color: "from-orange-500/20 to-orange-500/5 hover:from-orange-500/30",
                iconColor: "text-orange-500 bg-orange-500/10"
            };
        case 'ألعاب أطفال':
            return {
                iconComponent: Baby,
                color: "from-purple-500/20 to-purple-500/5 hover:from-purple-500/30",
                iconColor: "text-purple-500 bg-purple-500/10"
            };
        case 'عناية شخصية':
            return {
                iconComponent: Sparkles,
                color: "from-pink-500/20 to-pink-500/5 hover:from-pink-500/30",
                iconColor: "text-pink-500 bg-pink-500/10"
            };
        case 'أدوات منزلية':
            return {
                iconComponent: HomeIcon,
                color: "from-amber-500/20 to-amber-500/5 hover:from-amber-500/30",
                iconColor: "text-amber-500 bg-amber-500/10"
            };
        default:
            return {
                iconComponent: LayoutGrid,
                color: "from-gray-500/20 to-gray-500/5 hover:from-gray-500/30",
                iconColor: "text-gray-500 bg-gray-500/10"
            };
    }
};

/**
 * A hook that loads categories and sets up a Supabase Realtime subscription.
 */
export function useRealtimeCategories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const loadCategories = async () => {
            const data = await fetchCategories();
            if (mounted) {
                setCategories(data);
                setIsLoading(false);
            }
        };

        loadCategories();

        const channel = supabase
            .channel('public:categories')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'categories' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setCategories(prev => [...prev, payload.new as Category].sort((a, b) => a.name.localeCompare(b.name)));
                    } else if (payload.eventType === 'UPDATE') {
                        setCategories(prev => prev.map(c => c.id === payload.new.id ? (payload.new as Category) : c).sort((a, b) => a.name.localeCompare(b.name)));
                    } else if (payload.eventType === 'DELETE') {
                        setCategories(prev => prev.filter(c => c.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    return { categories, isLoading };
}
