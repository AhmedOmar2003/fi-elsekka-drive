"use client"

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getUserProfile, UserProfile } from '@/services/authService';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: (UserProfile & { permissions?: string[]; disabled?: boolean }) | null;
    isLoading: boolean;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    refreshProfile: async () => { },
});

const PERSISTED_SESSION_KEY = 'fi-elsekka-auth-session';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Ref to prevent concurrent profile fetches
    const fetchingProfile = useRef(false);

    const loadProfile = async (currentUser: User) => {
        // Guard: skip if already in-flight
        if (fetchingProfile.current) return;
        fetchingProfile.current = true;
        try {
            let fastProfile = null;
            // Fast path: if auth metadata already contains admin role, avoid hitting RLS immediately
            if (currentUser?.user_metadata?.role) {
                fastProfile = {
                    id: currentUser.id,
                    email: currentUser.email || '',
                    full_name: currentUser.user_metadata?.username || currentUser.email || 'Admin',
                    role: currentUser.user_metadata?.role,
                    permissions: currentUser.user_metadata?.permissions || [],
                    disabled: currentUser.user_metadata?.disabled || false,
                };
                setProfile(fastProfile);
            }
            
            const userProfile = await getUserProfile(currentUser.id);
            if (userProfile) {
                setProfile({
                    ...userProfile,
                    role: userProfile.role || fastProfile?.role || currentUser?.user_metadata?.role || null,
                    permissions: userProfile.permissions || fastProfile?.permissions || currentUser?.user_metadata?.permissions || [],
                    disabled: userProfile.disabled ?? fastProfile?.disabled ?? false,
                });
            }
        } catch (err: unknown) {
            // Silently swallow AbortError — it's a transient lock conflict
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes('AbortError') && !msg.includes('Lock broken')) {
                console.error('AuthContext: loadProfile error', err);
            }
        } finally {
            fetchingProfile.current = false;
        }
    };

    const refreshProfile = async () => {
        if (user) await loadProfile(user);
    };

    const setAuthCookie = (accessToken?: string | null) => {
        if (typeof document === 'undefined') return;
        if (accessToken) {
            document.cookie = `sb-access-token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax;${window.location.protocol === 'https:' ? ' Secure' : ''}`;
        } else {
            document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax;${window.location.protocol === 'https:' ? ' Secure' : ''}`;
        }
    };

    const persistSessionSnapshot = (nextSession?: Session | null) => {
        if (typeof window === 'undefined') return;
        if (nextSession) {
            localStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify(nextSession));
        } else {
            localStorage.removeItem(PERSISTED_SESSION_KEY);
        }
    };

    const getPersistedSessionSnapshot = (): Session | null => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(PERSISTED_SESSION_KEY);
            return raw ? JSON.parse(raw) as Session : null;
        } catch {
            return null;
        }
    };

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const persistedSession = getPersistedSessionSnapshot();
                if (persistedSession?.user && mounted) {
                    setSession(persistedSession);
                    setUser(persistedSession.user);
                }

                // 1. Explicitly fetch the session on mount to guarantee we resolve `isLoading`
                let { data: { session: initialSession }, error } = await supabase.auth.getSession();
                
                if (!mounted) return;

                if (error) {
                    console.error("AuthContext: getSession error", error);
                }

                if (!initialSession && persistedSession) {
                    const refreshed = await supabase.auth.refreshSession().catch(() => null);
                    if (refreshed?.data?.session) {
                        initialSession = refreshed.data.session;
                    }
                }

                setSession(initialSession);
                setUser(initialSession?.user ?? null);
                setAuthCookie(initialSession?.access_token);
                persistSessionSnapshot(initialSession);

                if (initialSession?.user) {
                    await loadProfile(initialSession.user);
                } else {
                    setProfile(null);
                }
            } catch (err) {
                console.error("AuthContext: initialization error", err);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        // Initialize immediately
        initializeAuth();

        // 2. Listen for future auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                if (!mounted) return;

                // When user clicks the password reset link in their email,
                // Supabase fires PASSWORD_RECOVERY. We must redirect them to
                // the update-password page before any other logic runs.
                if (event === 'PASSWORD_RECOVERY') {
                    setSession(newSession);
                    setUser(newSession?.user ?? null);
                    setIsLoading(false);
                    // Only redirect if we're not already on the update-password page
                    if (typeof window !== 'undefined' && !window.location.pathname.includes('/update-password')) {
                        window.location.href = '/update-password';
                    }
                    return;
                }

                // Explicitly handle SIGNED_OUT to guarantee state wipes
                if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setAuthCookie(null);
                    persistSessionSnapshot(null);
                    setIsLoading(false);
                    return;
                }

                // For other events, update state
                setSession(newSession);
                setUser(newSession?.user ?? null);
                setAuthCookie(newSession?.access_token);
                persistSessionSnapshot(newSession);

                if (newSession?.user) {
                     // Don't block UI for profile updates on subsequent events
                    loadProfile(newSession.user);
                } else {
                    setProfile(null);
                }
                
                // Ensure isLoading is false once an event fires
                setIsLoading(false);
            }
        );

        return () => { 
            mounted = false;
            subscription.unsubscribe(); 
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isRefreshingSession = false;

        const refreshSessionState = async () => {
            if (isRefreshingSession) return;
            isRefreshingSession = true;

            try {
                const { data: { session: freshSession }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error('AuthContext: refresh session error', error);
                    return;
                }

                setSession(freshSession);
                setUser(freshSession?.user ?? null);
                setAuthCookie(freshSession?.access_token);
                persistSessionSnapshot(freshSession);

                if (freshSession?.user) {
                    await loadProfile(freshSession.user);
                } else {
                    setProfile(null);
                }
            } catch (err) {
                console.error('AuthContext: visibility refresh error', err);
            } finally {
                isRefreshingSession = false;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refreshSessionState();
            }
        };

        const handleWindowFocus = () => {
            void refreshSessionState();
        };

        const handlePageShow = () => {
            void refreshSessionState();
        };

        const handleOnline = () => {
            void refreshSessionState();
        };

        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('pageshow', handlePageShow);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user]);

    return (
        <AuthContext.Provider value={{ session, user, profile, isLoading, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
