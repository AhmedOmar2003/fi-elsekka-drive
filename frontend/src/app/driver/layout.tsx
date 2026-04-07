"use client"
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, History, Package, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/authService';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

    const handleLogout = async () => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('driver_logout_flash', '1');
        }
        await signOut();
        window.location.href = '/driver/login?logged_out=1';
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-3xl border border-surface-hover bg-surface p-6 shadow-2xl">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
                            <LogOut className="h-6 w-6" />
                        </div>
                        <h2 className="text-center text-xl font-black text-foreground">هتسجل خروج؟</h2>
                        <p className="mt-2 text-center text-sm leading-7 text-gray-500">
                            لو خلصت شغلك دلوقتي تقدر تخرج، ولو لسه مكمل دوس على الزر التاني ونكمل عادي.
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-400 transition-colors hover:bg-rose-500 hover:text-white"
                            >
                                تسجيل الخروج
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(false)}
                                className="rounded-2xl border border-surface-hover bg-background px-4 py-3 text-sm font-black text-foreground transition-colors hover:bg-surface-hover"
                            >
                                لا، هكمل
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Simple Mobile-Friendly Header */}
            <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-surface-hover px-4 pt-4 pb-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <Bike className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-heading font-black text-lg">
                                {profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name 
                                    ? `أهلاً بمندوبنا الجميل ${(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name).split(' ')[0]} ✨` 
                                    : 'لوحة المندوب'}
                            </h1>
                            <p className="text-[10px] text-gray-500 font-bold">في السكة</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowLogoutConfirm(true)} className="p-2 text-gray-400 hover:bg-surface-hover rounded-xl transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center justify-between gap-3 -mb-px">
                    <div className="flex gap-1">
                        <Link
                            href="/driver"
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black border-b-2 transition-colors ${
                                pathname === '/driver'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-400 hover:text-foreground'
                            }`}
                        >
                            <Package className="w-4 h-4" />
                            طلباتي
                        </Link>
                        <Link
                            href="/driver/history"
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black border-b-2 transition-colors ${
                                pathname === '/driver/history'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-400 hover:text-foreground'
                            }`}
                        >
                            <History className="w-4 h-4" />
                            السجل
                        </Link>
                    </div>

                    <div className="mb-1 shrink-0">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 max-w-lg mx-auto w-full">
                {children}
            </main>
        </div>
    );
}
