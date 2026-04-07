"use client"

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const MESSAGES = [
    'جاهزين لأي طلب منك، في أي وقت.',
    'التسوق الذكي بيبدأ من هنا.',
    'توصيل سريع، جودة عالية، وأسعار منافسة.',
    'معاك في كل خطوة، بالسكة الصح.',
]

function WelcomeContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const name = searchParams.get('name') || 'بصاحبنا الجديد'

    const [timer, setTimer] = useState(8)
    const [msgIndex, setMsgIndex] = useState(0)
    const [visible, setVisible] = useState(false)

    // Fade in on mount
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 100)
        return () => clearTimeout(t)
    }, [])

    // Countdown — only update state here, no side effects
    useEffect(() => {
        if (timer <= 0) return
        const interval = setInterval(() => {
            setTimer(prev => (prev <= 1 ? 0 : prev - 1))
        }, 1000)
        return () => clearInterval(interval)
    }, [timer])

    // Navigate ONLY when timer reaches zero, outside of setState
    useEffect(() => {
        if (timer === 0) {
            router.push('/')
        }
    }, [timer, router])

    // Cycle through messages
    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex(prev => (prev + 1) % MESSAGES.length)
        }, 2500)
        return () => clearInterval(interval)
    }, [])

    const handleEnter = () => router.push('/')

    return (
        <div
            className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center min-h-[100dvh] bg-background overflow-hidden transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
            {/* Animated background glow blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[150vw] sm:w-[600px] h-[150vw] sm:h-[600px] rounded-full bg-emerald-500/5 blur-[80px] sm:blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 left-1/4 w-[100vw] sm:w-[300px] h-[100vw] sm:h-[300px] rounded-full bg-emerald-400/8 blur-[60px] sm:blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
                {/* Subtle grid */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(16,185,129,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.4) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />
            </div>

            {/* Floating particles */}
            {[...Array(12)].map((_, i) => (
                <div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-emerald-400/30 animate-float"
                    style={{
                        right: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${i * 0.4}s`,
                        animationDuration: `${4 + i * 0.5}s`,
                    }}
                />
            ))}

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg w-full">
                {/* Brand badge */}
                <div className="mb-8 w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <span className="text-3xl">🛍️</span>
                </div>

                {/* Welcome text */}
                <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-tight mb-3">
                    أهلاً وسهلاً
                </h1>
                <h2 className="text-2xl sm:text-3xl font-bold text-emerald-400 mb-6">
                    {name} 👋
                </h2>

                <p className="text-gray-500 text-base sm:text-lg leading-relaxed mb-3 max-w-sm">
                    يشرفنا إنضمامك لعيلة <span className="text-emerald-400 font-bold">في السكة</span>. إحنا متحمسين ليك وجاهزين لتوصيل أي طلب بأسرع وقت وأحسن جودة.
                </p>

                {/* Cycling message */}
                <div className="h-8 flex items-center justify-center mb-10">
                    <p
                        key={msgIndex}
                        className="text-sm text-gray-500 italic animate-fade-in"
                    >
                        ✦ {MESSAGES[msgIndex]}
                    </p>
                </div>

                {/* CTA button */}
                <button
                    onClick={handleEnter}
                    className="group relative w-full max-w-xs bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg py-4 px-8 rounded-2xl transition-all duration-300 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95"
                >
                    <span className="relative z-10">اطلب أول طلبك 🚀</span>
                    <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                {/* Auto redirect timer */}
                <div className="mt-6 flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-4 h-4 rounded-full border border-gray-700 flex items-center justify-center">
                        <span className="text-[9px] font-mono text-gray-500">{timer}</span>
                    </div>
                    <span>سيتم تحويلك تلقائياً بعد {timer} ثانية</span>
                </div>
            </div>

            {/* Bottom brand */}
            <div className="absolute bottom-6 text-xs text-gray-700 font-medium tracking-widest">
                في السكة · بالسكة الصح
            </div>
        </div>
    )
}

export default function WelcomePage() {
    return (
        <Suspense fallback={
            <div className="fixed inset-0 bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500" />
            </div>
        }>
            <WelcomeContent />
        </Suspense>
    )
}
