"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Trash2, Minus, Plus, ArrowRight, ShoppingCart, X } from "lucide-react"
import { Button } from "./button"
import { useCart } from "@/contexts/CartContext"

interface CartSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
    const { items, cartTotal, cartOriginalTotal, cartDiscountTotal, updateQuantity, removeItem, clearCart } = useCart()

    // Prevent background scrolling when sidebar is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => {
            document.body.style.overflow = "unset"
        }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ opacity: 0, x: "100%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-[101] w-full max-w-md bg-surface border-l border-surface-hover shadow-premium flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-surface-hover">
                            <div className="flex items-center gap-3">
                                <ShoppingCart className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-black text-foreground">سلة المشتريات</h2>
                                <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full text-xs">
                                    {items.length}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-500 hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
                                aria-label="إغلاق السلة"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                    <div className="w-20 h-20 bg-surface-hover rounded-full flex items-center justify-center">
                                        <ShoppingCart className="w-10 h-10 text-gray-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground">عربيتك فاضية!</h3>
                                    <p className="text-sm text-gray-500 max-w-[200px]">
                                        الرفوف مليانة حاجات هتعجبك، ابدأ التسوق دلوقتي.
                                    </p>
                                    <Button onClick={onClose} className="mt-4 rounded-xl">
                                        تصفح المنتجات
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex gap-4 p-3 rounded-2xl bg-surface-lighter border border-surface-border"
                                        >
                                            {/* Image */}
                                            <Link href={`/product/${item.product_id}`} onClick={onClose} className="shrink-0 w-20 h-20 rounded-xl bg-surface overflow-hidden">
                                                <img
                                                    src={item.product?.image_url || (item.product as any)?.specifications?.image_url || `https://th.bing.com/th/id/OIG1.3T.W.G_A_u2z4O6.7Z1Y?pid=ImgGn`}
                                                    alt={item.product?.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </Link>

                                            {/* Info */}
                                            <div className="flex flex-1 flex-col justify-between">
                                                <div className="flex justify-between items-start gap-2">
                                                    <Link href={`/product/${item.product_id}`} onClick={onClose}>
                                                        <h4 className="font-bold text-sm text-foreground line-clamp-2 hover:text-primary transition-colors">
                                                            {item.product?.name}
                                                        </h4>
                                                    </Link>
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="text-gray-500 hover:text-rose-500 transition-colors p-1"
                                                        aria-label="حذف المنتج"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between mt-2">
                                                    <div className="flex flex-col">
                                                        <div className="text-primary font-black text-sm">
                                                            {(() => {
                                                                const p = item.product;
                                                                if (!p) return 0;
                                                                if (p.discount_percentage && p.discount_percentage > 0) {
                                                                    return Math.round(p.price * (1 - p.discount_percentage / 100)) * item.quantity;
                                                                }
                                                                return (p.price || 0) * item.quantity;
                                                            })().toLocaleString()} ج.م
                                                        </div>
                                                        {item.product?.discount_percentage ? (
                                                            <span className="text-[10px] text-gray-500 line-through">
                                                                {((item.product?.price || 0) * item.quantity).toLocaleString()} ج.م
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center rounded-lg border border-surface-hover bg-background h-8">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                                            className="px-2 text-gray-500 hover:text-foreground active:scale-95 transition-all"
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className="w-6 text-center font-bold text-xs select-none">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            className="px-2 text-gray-500 hover:text-foreground active:scale-95 transition-all"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Summary */}
                        {items.length > 0 && (
                            <div className="border-t border-surface-hover p-4 sm:p-6 bg-surface/50 backdrop-blur-md">
                                <div className="flex flex-col mb-4">
                                    {cartDiscountTotal > 0 && (
                                        <div className="flex justify-between items-center text-sm text-gray-500 line-through mb-1">
                                            <span>المجموع الأصلي</span>
                                            <span>{cartOriginalTotal.toLocaleString()} ج.م</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-foreground font-medium">الإجمالي</span>
                                        <span className="text-2xl font-black text-primary">{cartTotal.toLocaleString()} ج.م</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (confirm("متاكد انك عاوز تفضي السلة؟")) {
                                                clearCart();
                                            }
                                        }}
                                        className="flex-1 rounded-xl h-12 text-rose-500 border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500"
                                    >
                                        تفريغ السلة
                                    </Button>
                                    <Button
                                        className="flex-[2] rounded-xl h-12 font-bold text-base shadow-lg shadow-primary/20 flex gap-2"
                                        asChild
                                    >
                                        <Link href="/checkout" onClick={onClose}>
                                            متابعة الدفع
                                            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </>
            )
            }
        </AnimatePresence >
    )
}
