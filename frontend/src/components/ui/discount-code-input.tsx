"use client"

import React, { useState, useEffect } from 'react';
import { Tag, Check, X, Loader2 } from 'lucide-react';
import {
    validateDiscountCode,
    applyDiscount,
    clearLegacyAppliedDiscountCode,
    getAppliedDiscountCodeForProduct,
    removeAppliedDiscountCodeForProduct,
    setAppliedDiscountCodeForProduct,
} from '@/services/discountCodesService';

interface DiscountCodeInputProps {
    originalPrice: number;
    productId?: string;
    categoryId?: string | null;
    userId?: string;
    onDiscountApplied: (finalPrice: number, savedAmount: number, label: string) => void;
    onDiscountRemoved: () => void;
}

export function DiscountCodeInput({ originalPrice, productId, categoryId, userId, onDiscountApplied, onDiscountRemoved }: DiscountCodeInputProps) {
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [appliedCode, setAppliedCode] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const loadSavedCode = async () => {
            clearLegacyAppliedDiscountCode();

            if (!productId || originalPrice <= 0) {
                setCode('');
                setAppliedCode('');
                setStatus('idle');
                setMessage('');
                return;
            }

            const savedCode = getAppliedDiscountCodeForProduct(productId);
            if (!savedCode) {
                setCode('');
                setAppliedCode('');
                setStatus('idle');
                setMessage('');
                return;
            }

            setCode(savedCode);
            setStatus('loading');
            const { discount, error } = await validateDiscountCode(savedCode, { userId, productId, categoryId });

            if (discount) {
                const result = applyDiscount(originalPrice, discount);
                setStatus('success');
                setAppliedCode(savedCode.trim().toUpperCase());
                setMessage(result.label);
                onDiscountApplied(result.finalPrice, result.savedAmount, result.label);
            } else {
                setStatus('idle');
                removeAppliedDiscountCodeForProduct(productId);
                if (error) setMessage(error);
                onDiscountRemoved();
            }
        };

        loadSavedCode();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryId, originalPrice, productId, userId]);

    const handleApply = async () => {
        if (!code.trim()) return;
        setStatus('loading');

        const { discount, error } = await validateDiscountCode(code, { userId, productId, categoryId });

        if (!discount) {
            setStatus('error');
            setMessage(error || 'الكود غير صالح. تحقق من الكود وحاول مجدداً.');
            return;
        }

        const result = applyDiscount(originalPrice, discount);
        setStatus('success');
        setAppliedCode(code.trim().toUpperCase());
        setMessage(result.label);
        if (productId) {
            setAppliedDiscountCodeForProduct(productId, code.trim().toUpperCase());
        } else {
            clearLegacyAppliedDiscountCode();
        }
        onDiscountApplied(result.finalPrice, result.savedAmount, result.label);
    };

    const handleRemove = () => {
        setCode('');
        setAppliedCode('');
        setStatus('idle');
        setMessage('');
        removeAppliedDiscountCodeForProduct(productId);
        clearLegacyAppliedDiscountCode();
        onDiscountRemoved();
    };

    const isApplied = status === 'success';

    return (
        <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                كود الخصم
            </p>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={isApplied ? appliedCode : code}
                    onChange={e => { if (!isApplied) setCode(e.target.value.toUpperCase()); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !isApplied) handleApply(); }}
                    placeholder="أدخل كود الخصم"
                    className={`flex-1 bg-surface border rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-foreground placeholder-gray-500 focus:outline-none transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${isApplied
                        ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-500'
                        : status === 'error'
                            ? 'border-rose-500/40 focus:border-rose-500/60'
                            : 'border-surface-border focus:border-primary/50'
                        }`}
                />

                {isApplied ? (
                    <button
                        onClick={handleRemove}
                        className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-bold transition-all active:scale-95 whitespace-nowrap"
                    >
                        <X className="w-4 h-4" />
                        إلغاء
                    </button>
                ) : (
                    <button
                        onClick={handleApply}
                        disabled={!code.trim() || status === 'loading'}
                        className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white border border-primary/30 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-lg shadow-primary/20"
                    >
                        {status === 'loading' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        تطبيق
                    </button>
                )}
            </div>

            {/* Feedback message */}
            {message && (
                <div className={`mt-2.5 flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl ${isApplied
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                    }`}>
                    {isApplied ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                    <span>{isApplied ? `تم تطبيق الكود بنجاح! ${message}` : message}</span>
                </div>
            )}
        </div>
    );
}
