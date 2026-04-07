import { supabase } from '@/lib/supabase';

const LEGACY_APPLIED_DISCOUNT_CODE_KEY = 'applied_discount_code';
const APPLIED_DISCOUNT_CODES_KEY = 'applied_discount_codes';

export interface DiscountCode {
    id: number;
    code: string;
    discount_percentage: number | null;
    discount_amount: number | null;
    applicable_product_id?: string | null;
    applicable_category_id?: string | null;
    is_active: boolean;
    max_uses: number | null;       // null = unlimited
    used_count: number;
    expires_at: string | null;     // ISO datetime string, null = no expiry
    used_by: string[] | null;      // Array of user IDs who have used this code
    created_at: string;
}

interface DiscountValidationContext {
    userId?: string;
    productId?: string | null;
    categoryId?: string | null;
}

type AppliedDiscountCodesMap = Record<string, string>;

const isBrowser = () => typeof window !== 'undefined';

const normalizeDiscountCode = (code: string) => code.trim().toUpperCase();

const readAppliedDiscountCodesMap = (): AppliedDiscountCodesMap => {
    if (!isBrowser()) return {};

    try {
        const raw = localStorage.getItem(APPLIED_DISCOUNT_CODES_KEY);
        if (!raw) return {};

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed)
                .filter(([key, value]) => !!key && typeof value === 'string' && value.trim().length > 0)
                .map(([key, value]) => [key, normalizeDiscountCode(value as string)])
        );
    } catch {
        return {};
    }
};

const writeAppliedDiscountCodesMap = (codes: AppliedDiscountCodesMap) => {
    if (!isBrowser()) return;

    const entries = Object.entries(codes).filter(
        ([key, value]) => !!key && typeof value === 'string' && value.trim().length > 0
    );

    if (entries.length === 0) {
        localStorage.removeItem(APPLIED_DISCOUNT_CODES_KEY);
        return;
    }

    localStorage.setItem(APPLIED_DISCOUNT_CODES_KEY, JSON.stringify(Object.fromEntries(entries)));
};

export const clearLegacyAppliedDiscountCode = () => {
    if (!isBrowser()) return;
    localStorage.removeItem(LEGACY_APPLIED_DISCOUNT_CODE_KEY);
};

export const getAppliedDiscountCodeForProduct = (productId?: string | null): string | null => {
    if (!productId) return null;
    const codes = readAppliedDiscountCodesMap();
    return codes[productId] || null;
};

export const setAppliedDiscountCodeForProduct = (productId: string, code: string) => {
    if (!productId) return;
    const codes = readAppliedDiscountCodesMap();
    codes[productId] = normalizeDiscountCode(code);
    writeAppliedDiscountCodesMap(codes);
    clearLegacyAppliedDiscountCode();
};

export const removeAppliedDiscountCodeForProduct = (productId?: string | null) => {
    if (!productId) return;
    const codes = readAppliedDiscountCodesMap();
    delete codes[productId];
    writeAppliedDiscountCodesMap(codes);
};

export const getAppliedDiscountCodesForProducts = (productIds: string[]): string[] => {
    const codes = readAppliedDiscountCodesMap();
    return Array.from(
        new Set(
            productIds
                .map((productId) => codes[productId])
                .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
        )
    );
};

export const clearAppliedDiscountCodesForProducts = (productIds: string[]) => {
    const codes = readAppliedDiscountCodesMap();
    let hasChanges = false;

    productIds.forEach((productId) => {
        if (codes[productId]) {
            delete codes[productId];
            hasChanges = true;
        }
    });

    if (hasChanges) {
        writeAppliedDiscountCodesMap(codes);
    }

    clearLegacyAppliedDiscountCode();
};

/**
 * Validates a discount code and returns the discount record if valid,
 * also checking expiry and usage limits.
 */
export const validateDiscountCode = async (
    code: string,
    context?: string | DiscountValidationContext
): Promise<{ discount: DiscountCode | null; error?: string }> => {
    const normalizedContext: DiscountValidationContext =
        typeof context === 'string'
            ? { userId: context }
            : (context || {});

    const { userId, productId, categoryId } = normalizedContext;

    const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

    if (error || !data) return { discount: null, error: 'كود الخصم غير صحيح أو غير موجود.' };

    const discount = data as DiscountCode;

    // Check expiry
    if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
        return { discount: null, error: 'انتهت صلاحية هذا الكود.' };
    }

    // Check usage limit
    if (discount.max_uses !== null && discount.used_count >= discount.max_uses) {
        return { discount: null, error: 'تم استنفاد استخدامات هذا الكود.' };
    }

    // Check one-time per user limit
    if (userId && discount.used_by && discount.used_by.includes(userId)) {
        return { discount: null, error: 'لقد قمت باستخدام هذا الكود مسبقاً.' };
    }

    if (discount.applicable_product_id) {
        if (!productId || discount.applicable_product_id !== productId) {
            return { discount: null, error: 'الكود ده شغال على منتج معين، ومش متاح للمنتج الحالي.' };
        }
    }

    if (discount.applicable_category_id) {
        if (!categoryId || discount.applicable_category_id !== categoryId) {
            return { discount: null, error: 'الكود ده مخصوص لقسم تاني، ومش متاح على المنتج الحالي.' };
        }
    }

    return { discount };
};

/**
 * Calculates the final price after applying a discount code.
 */
export const applyDiscount = (originalPrice: number, discount: DiscountCode): {
    finalPrice: number;
    savedAmount: number;
    label: string;
} => {
    let finalPrice = originalPrice;
    let savedAmount = 0;
    let label = '';

    if (discount.discount_percentage) {
        savedAmount = Math.round(originalPrice * discount.discount_percentage / 100);
        finalPrice = originalPrice - savedAmount;
        label = `خصم ${discount.discount_percentage}% (وفرت ${savedAmount} ج.م)`;
    } else if (discount.discount_amount) {
        savedAmount = Math.min(discount.discount_amount, originalPrice);
        finalPrice = originalPrice - savedAmount;
        label = `خصم ${savedAmount} ج.م ثابت`;
    }

    return { finalPrice: Math.max(0, finalPrice), savedAmount, label };
};

// ── Admin CRUD ─────────────────────────────────────────────────────────────

export const fetchAllDiscountCodes = async (): Promise<DiscountCode[]> => {
    const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error('fetchAllDiscountCodes:', error.message); return []; }
    return data || [];
};

export type CreateDiscountCodeInput = Omit<DiscountCode, 'id' | 'created_at' | 'used_count' | 'used_by'>;
export type UpdateDiscountCodeInput = Partial<CreateDiscountCodeInput>;

export const createDiscountCode = async (payload: CreateDiscountCodeInput) => {
    return supabase.from('discount_codes').insert([{ ...payload, code: payload.code.toUpperCase(), used_count: 0, used_by: [] }]).select().single();
};

export const updateDiscountCode = async (id: number, payload: UpdateDiscountCodeInput) => {
    if (payload.code) payload.code = payload.code.toUpperCase();
    return supabase.from('discount_codes').update(payload).eq('id', id).select().single();
};

export const deleteDiscountCode = async (id: number) => {
    return supabase.from('discount_codes').delete().eq('id', id);
};

/**
 * Increments the used_count for a discount code after a successful order.
 * Also appends the user ID to the used_by array.
 */
export const incrementDiscountCodeUsage = async (code: string, userId: string): Promise<void> => {
    const { data } = await supabase
        .from('discount_codes')
        .select('id, used_count, used_by')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle();

    if (!data) return;

    const currentUsedBy = data.used_by || [];
    if (!currentUsedBy.includes(userId)) {
        currentUsedBy.push(userId);
    }

    await supabase
        .from('discount_codes')
        .update({ 
            used_count: (data.used_count || 0) + 1,
            used_by: currentUsedBy
        })
        .eq('id', data.id);
};
