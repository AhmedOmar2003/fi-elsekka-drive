"use client"

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fetchActivePromotion, Promotion } from '@/services/promotionsService';
import { useAuth } from '@/contexts/AuthContext';

export function PromoBanner() {
    const { user, isLoading: authLoading } = useAuth();
    const [promo, setPromo] = useState<Promotion | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchActivePromotion().then(setPromo);

        const channel = supabase
            .channel('public:promotions:banner')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, () => {
                fetchActivePromotion().then(setPromo);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // While auth is loading, render nothing to avoid flash
    if (authLoading) return null;

    // If no active promotion is set by admin, hide the section
    if (!promo) return null;

    const handleCopy = () => {
        if (promo.discount_code) {
            navigator.clipboard.writeText(promo.discount_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleLogout = () => { }; // unused but kept for safety

    return (
        <section className="py-12 sm:py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="group relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(135deg,#237860_0%,#2f9274_100%)] p-7 text-white shadow-[var(--shadow-material-2)] sm:flex-row sm:p-14">

                    {/* Text */}
                    <div className="z-10 text-center sm:text-start">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-black tracking-[0.08em] backdrop-blur-sm">
                            <span className="h-2 w-2 rounded-full bg-white/80 animate-pulse"></span>
                            عرض متاح دلوقتي
                        </div>
                        <h3 className="mb-3 text-3xl font-black leading-tight tracking-[-0.04em] drop-shadow-sm sm:text-4xl">
                            {promo.title}
                        </h3>
                        {promo.description && (
                            <p className="max-w-md text-base font-medium leading-relaxed text-white/90 sm:text-xl">
                                {promo.description}
                            </p>
                        )}
                        {promo.discount_code && (
                            <button
                                onClick={handleCopy}
                                title="انقر لنسخ الكود"
                                className="mt-4 inline-flex cursor-pointer select-none items-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-4 py-2.5 font-mono text-lg tracking-widest text-white backdrop-blur-sm transition-all hover:bg-black/30 active:scale-95"
                            >
                                <span className="text-sm text-white/60 font-sans ml-1">استخدم كود:</span>
                                {promo.discount_code}
                                <span className="text-xs text-white/50 font-sans">{copied ? '✓ تم النسخ' : '📋 نسخ'}</span>
                            </button>
                        )}
                    </div>

                    {/* CTA Button — guest goes to register, logged-in goes to /offers with admin's button text */}
                    <div className="shrink-0 z-10 w-full sm:w-auto mx-auto sm:mx-0">
                        {user ? (
                            <Link
                                href="/offers"
                                className="flex items-center justify-center rounded-[24px] border border-white/40 bg-white px-10 py-4 text-center text-lg font-black text-primary shadow-[var(--shadow-material-2)] transition-all hover:-translate-y-0.5 active:scale-95"
                            >
                                {promo.button_text || 'شوف العروض'}
                            </Link>
                        ) : (
                            <Link
                                href="/register"
                                className="flex items-center justify-center rounded-[24px] border border-white/40 bg-white px-10 py-4 text-center text-lg font-black text-primary shadow-[var(--shadow-material-2)] transition-all hover:-translate-y-0.5 active:scale-95"
                            >
                                سجل حساب جديد
                            </Link>
                        )}
                    </div>

                    {/* Decorative bg blobs */}
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.18),transparent_22%)]" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
                    <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 translate-x-12 -translate-y-12 rounded-full bg-white opacity-20 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 -translate-x-12 translate-y-12 rounded-full bg-black opacity-20 blur-2xl" />
                </div>
            </div>
        </section>
    );
}
