import { supabase } from '@/lib/supabase';
import { normalizeAuthEmail, validateCustomerEmail, validateStrongPassword } from '@/lib/auth-validation';
import { optimizeImageForUpload } from '@/lib/image-upload';

export interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    profile_picture?: string;
    role?: string;
    permissions?: string[];
    disabled?: boolean;
    created_at?: string;
    last_login_at?: string | null;
}

export const signUp = async (email: string, password: string, fullName: string) => {
    const emailError = validateCustomerEmail(email);
    if (emailError) {
        return { data: null, error: new Error(emailError) };
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
        return { data: null, error: new Error(passwordError) };
    }

    const { data, error } = await supabase.auth.signUp({
        email: normalizeAuthEmail(email),
        password,
        options: {
            data: {
                full_name: fullName,
            }
        }
    });

    // Supabase will automatically send a verification email if that's configured in the dashboard.
    return { data, error };
};

export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizeAuthEmail(email),
        password,
    });
    return { data, error };
};

export const signOut = async () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('guestCart');
        localStorage.removeItem('fi-elsekka-auth-session');
    }
    if (typeof document !== 'undefined') {
        document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax;${window.location.protocol === 'https:' ? ' Secure' : ''}`;
    }
    
    // Attempt to sign out on the server
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        console.warn('Server signOut failed, forcing local session clear:', error.message);
        // Force local wipe if server wipe fails (e.g. due to expired token)
        await supabase.auth.signOut({ scope: 'local' });
        
        // Failsafe: clear standard supabase auth keys from local storage
        if (typeof window !== 'undefined') {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            });
        }
    }
    
    return { error: null }; // Always succeed from the client's perspective
};

export const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session, error };
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    const { data: operationalProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, account_status, created_at, last_login_at, avatar_path')
        .eq('id', userId)
        .single();

    if (!profileError && operationalProfile) {
        return {
            id: operationalProfile.id,
            full_name: operationalProfile.full_name || '',
            email: operationalProfile.email || '',
            profile_picture: operationalProfile.avatar_path || undefined,
            role: operationalProfile.role || undefined,
            permissions: [],
            disabled: operationalProfile.account_status && operationalProfile.account_status !== 'active',
            created_at: operationalProfile.created_at,
            last_login_at: operationalProfile.last_login_at,
        } as UserProfile;
    }

    const { data: legacyProfile, error: legacyError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (!legacyError && legacyProfile) {
        return legacyProfile as UserProfile;
    }

    const legacyUsersTableMissing =
        legacyError?.code === 'PGRST205' ||
        legacyError?.code === '42P01' ||
        legacyError?.message?.includes("Could not find the table 'public.users'");

    if (profileError) {
        if (profileError.message?.includes('AbortError') || profileError.message?.includes('Lock broken')) {
            return null;
        }
        console.error('Error fetching user profile:', profileError?.message || profileError);
        return null;
    }

    if (legacyError && !legacyUsersTableMissing) {
        console.error('Error fetching legacy user profile:', legacyError?.message || legacyError);
    }

    return null;
};

export const updateAuthEmail = async (newEmail: string) => {
    const emailError = validateCustomerEmail(newEmail);
    if (emailError) {
        return { data: null, error: new Error(emailError) };
    }

    const { data, error } = await supabase.auth.updateUser({ email: normalizeAuthEmail(newEmail) });
    return { data, error };
};

export const sendPasswordResetEmail = async (email: string) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fi-elsekka.vercel.app';
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/update-password`,
    });
    return { data, error };
};

export const updateAuthPassword = async (newPassword: string) => {
    const passwordError = validateStrongPassword(newPassword);
    if (passwordError) {
        return { data: null, error: new Error(passwordError) };
    }

    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
};

export const uploadAvatar = async (userId: string, file: File) => {
    try {
        const optimizedFile = await optimizeImageForUpload(file, { maxDimension: 1200, quality: 0.82 });
        const fileExt = optimizedFile.name.split('.').pop() || 'webp';
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload the file to the 'avatars' bucket
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, optimizedFile, {
                upsert: true,
                contentType: optimizedFile.type || 'image/webp',
            });

        if (uploadError) {
            console.error('Avatar upload error:', uploadError);
            return { publicUrl: null, error: uploadError };
        }

        // Get the public URL
        const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return { publicUrl: publicUrlData.publicUrl, error: null };
    } catch (e) {
        return { publicUrl: null, error: e };
    }
};
