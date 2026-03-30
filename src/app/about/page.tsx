"use client"

import * as React from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { ShieldCheck, Zap, HeartHandshake, Smile, TrendingUp, CheckCircle2, Navigation } from "lucide-react"

export default function AboutUsPage() {
  return (
    <>
      <Header />

      <main className="flex-1 w-full max-w-md mx-auto pt-24 pb-32 px-4 animate-fade-in bg-[linear-gradient(180deg,rgba(15,21,19,1),rgba(20,28,25,1))]">
        
        {/* Subtle decorative background glow */}
        <div className="fixed top-0 left-0 w-full h-[600px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none -z-10"></div>

        {/* ── Hero Section ────────────────────────────────────────────── */}
        <section className="relative pt-6 pb-10 text-center">
          
          <div className="inline-flex items-center justify-center px-4 py-2 bg-primary/10 rounded-full mb-6 border border-primary/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <span className="text-primary font-bold text-xs tracking-wide flex items-center gap-2">
              <Smile className="w-4 h-4" />
              أهلاً بيك في عالم "في السكة"
            </span>
          </div>

          <h1 className="text-4xl font-black text-foreground mb-4 leading-tight drop-shadow-sm tracking-tight text-balance">
            صاحبك الجدع في <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
              كل مشوار
            </span>
          </h1>

          <p className="text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed text-balance">
            إحنا مش مجرد تطبيق توصيل، إحنا رفيق دربك اللي بيوصلك أمان وبسرعة وبأحسن سعر، في أي وقت وفي كل مكان.
          </p>
        </section>

        {/* ── Our Story ──────────────────────────────────────────────── */}
        <section className="py-8">
          <div className="flex flex-col gap-6">
            
            {/* Story Image / Graphic */}
            <div className="relative aspect-video rounded-[28px] bg-surface-container-low border border-white/5 overflow-hidden shadow-inner flex items-center justify-center group backdrop-blur-xl">
              <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors duration-700"></div>
              <div className="relative flex flex-col items-center justify-center gap-4">
                <Navigation className="w-16 h-16 text-primary drop-shadow-[0_0_15px_rgba(61,161,132,0.6)] transform transition-transform duration-700 group-hover:-rotate-12 group-hover:scale-110" />
              </div>
            </div>

            {/* Story Text */}
            <div className="flex flex-col bg-surface-container-low border border-white/5 p-5 rounded-[28px]">
              <h2 className="text-2xl font-black text-foreground mb-3">
                إزاي بدأنا الحكاية؟
              </h2>
              <div className="space-y-4 text-sm text-gray-400 leading-relaxed text-start">
                <p>
                  الفكرة دايماً كانت بتبدأ من احتياج بسيط. الزحمة، وتأخير المواعيد، وصعوبة إنك تلاقي وسيلة مواصلات مريحة وبسعر مناسب. فكرنا... ليه متبقاش في طريقة أسهل؟
                </p>
                <p>
                  من هنا اتولدت فكرة <strong className="text-foreground">"في السكة"</strong>. اسم بيعبر عننا، عن سرعتنا وعن إننا دايماً في طريقنا ليك. لمينا أكفأ كباتن وأحدث عربيات وتكاتك عشان نوفرلك رحلة متتنسيش.
                </p>
                <div className="flex items-center gap-2 pt-2 text-primary font-bold text-sm">
                  <HeartHandshake className="w-5 h-5" />
                  <span>عشان نفضل دايماً رقم واحد في الثقة.</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── Call to Action Board ────────────────────────────────────── */}
        <section className="py-8">
          <div className="relative rounded-[32px] overflow-hidden p-[1px] bg-gradient-to-br from-primary/50 via-primary/10 to-transparent shadow-premium">
            <div className="relative bg-surface-container-high p-8 rounded-[31px] text-center flex flex-col items-center overflow-hidden backdrop-blur-xl">
              
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-[50px] rounded-full mix-blend-screen pointer-events-none"></div>
              
              <TrendingUp className="w-10 h-10 text-primary mb-4" />
              <h2 className="text-xl font-black text-foreground mb-3">
                مستني إيه؟ اطلب توصيلتك دلوقتي!
              </h2>
              <p className="text-xs text-gray-400 max-w-lg mb-6 leading-relaxed">
                انضم لعيلتنا واستمتع بأسرع وأأمن المشاوير الحصرية اللي مش هتلاقيها في أي مكان تاني.
              </p>
              
              <Link href="/book" className="inline-flex w-full">
                <button className="h-14 w-full rounded-[20px] font-black text-base text-white bg-primary hover:bg-primary-hover shadow-[0_8px_30px_rgba(16,185,129,0.4)] active:scale-95 transition-all">
                  احجز مشوارك
                </button>
              </Link>

            </div>
          </div>
        </section>

      </main>
    </>
  )
}
