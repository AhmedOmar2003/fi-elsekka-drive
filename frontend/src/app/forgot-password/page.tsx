"use client"

import * as React from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sendPasswordResetEmail } from "@/services/authService"
import { KeyRound, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pb-24 md:pb-12 bg-background min-h-[80vh] flex items-center justify-center p-4">
        <ForgotPasswordContent />
      </main>
      <Footer />
    </>
  )
}

function ForgotPasswordContent() {
  const [email, setEmail] = React.useState("")
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setStatus('loading')
    setErrorMsg("")

    const { error } = await sendPasswordResetEmail(email)

    if (error) {
      setStatus('error')
      // Map common Supabase errors
      if (error.message.includes("rate limit") || error.message.includes("Too many requests")) {
        setErrorMsg("طلبت استعادة كلمة المرور كتير، استنى شوية وحاول تاني.")
      } else {
        setErrorMsg("حصلت مشكلة واحنا بنبعت الإيميل، اتأكد إن الإيميل مكتوب صح أو حاول بعدين.")
      }
      return
    }

    setStatus('success')
  }

  return (
    <div className="w-full max-w-md bg-surface border border-surface-hover rounded-3xl p-6 sm:p-10 shadow-premium">
      {status === 'success' ? (
        <div className="text-center py-6 animate-in zoom-in-95 duration-500">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">شيك الإيميل بتاعك! 📫</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            بعتنالك رابط استعادة كلمة المرور على:<br/>
            <span className="font-bold text-foreground inline-block mt-2 direction-ltr">{email}</span>
          </p>
          <p className="text-xs text-gray-400 mb-8">
            لو ملقيتش الإيميل في الـ Inbox، بص في مجلد الرسائل المزعجة (Spam/Junk).
          </p>
          <Link href="/login" className="flex items-center justify-center gap-2 text-primary font-bold hover:underline">
            <ArrowRight className="w-4 h-4" />
            الرجوع لصفحة الدخول
          </Link>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground mb-2">نسيت الباسورد؟ 🤔</h1>
          <p className="text-gray-500 mb-8 text-sm sm:text-base leading-relaxed">
            ولا يهمك! اكتب البريد الإلكتروني بتاعك تحت وهنبعتلك رابط عشان تعمل باسورد جديد.
          </p>

          {status === 'error' && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl flex items-start gap-3 text-sm animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground px-1">البريد الإلكتروني</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@mail.com"
                className="h-12 rounded-xl bg-background border-surface-hover focus-visible:border-primary text-start direction-ltr"
                required
                disabled={status === 'loading'}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={status === 'loading'}
              className="w-full h-12 rounded-xl font-bold md:text-lg shadow-primary/20 shadow-lg mt-4 flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "ابعتلي رابط الاستعادة"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-foreground font-bold transition-colors">
              <ArrowRight className="w-4 h-4" />
              افتكرت الباسورد؟ جرب تسجل دخول تاني
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
