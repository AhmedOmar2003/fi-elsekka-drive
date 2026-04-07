"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateAuthPassword } from "@/services/authService"
import { KeyRound, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { PasswordInput } from "@/components/ui/password-input"
import { generateStrongPassword, validateStrongPassword } from "@/lib/auth-validation"

export default function UpdatePasswordPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pb-24 md:pb-12 bg-background min-h-[80vh] flex items-center justify-center p-4">
        <UpdatePasswordContent />
      </main>
      <Footer />
    </>
  )
}

function UpdatePasswordContent() {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [status, setStatus] = React.useState<'checking' | 'idle' | 'loading' | 'success' | 'invalid'>('checking')
  const [errorMsg, setErrorMsg] = React.useState("")
  const [suggestedPassword, setSuggestedPassword] = React.useState(() => generateStrongPassword())

  React.useEffect(() => {
    const initSession = async () => {
      // The password reset link from Supabase looks like:
      // /update-password#access_token=xxx&refresh_token=yyy&type=recovery
      // We must manually parse this hash and call setSession() to establish
      // a valid Supabase session. Without this, updateUser fails with "auth session missing".
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const params = new URLSearchParams(hash.replace('#', ''))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      const type = params.get('type')

      if (access_token && refresh_token && type === 'recovery') {
        // Explicitly establish the session from the URL tokens
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })

        if (error) {
          console.error('Failed to establish recovery session:', error.message)
          setStatus('invalid')
        } else {
          // Clean the tokens from the URL bar for security
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, window.location.pathname)
          }
          setStatus('idle')
        }
        return
      }

      // Fallback: maybe they refreshed the page after recovery was already established
      const { data: { session } } = await supabase.auth.getSession()
      setStatus(session ? 'idle' : 'invalid')
    }

    initSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !confirmPassword) return

    if (password !== confirmPassword) {
      setErrorMsg("كلمتي المرور غير متطابقتين، تأكد من كتابتهم بشكل صحيح.")
      return
    }

    const passwordValidationError = validateStrongPassword(password)
    if (passwordValidationError) {
      setErrorMsg(passwordValidationError)
      return
    }

    setStatus('loading')
    setErrorMsg("")

    const { error } = await updateAuthPassword(password)

    if (error) {
      setStatus('idle')
      setErrorMsg(error.message)
      return
    }

    // Clear forced-reset flags for the current user
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (userId) {
      await supabase.auth.updateUser({ data: { must_change_password: false } })
      await supabase.from('users').update({ must_change_password: false }).eq('id', userId)
    }

    setStatus('success')
    toast.success("تم تحديث كلمة المرور!", { description: "سجل دخولك بكلمة المرور الجديدة." })
    
    setTimeout(() => {
      router.push("/login")
    }, 2000)
  }

  if (status === 'checking') {
    return (
      <div className="w-full max-w-md bg-surface border border-surface-hover rounded-3xl p-10 shadow-premium flex flex-col items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-bold">بنتأكد من الرابط...</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="w-full max-w-md bg-surface border border-surface-hover rounded-3xl p-6 sm:p-10 shadow-premium text-center">
        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
          <AlertCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">رابط غير صالح أو منتهي! ⚠️</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          الرابط اللي دخلت عليه مش شغال أو عدى عليه وقت طويل. جرب تطلب رابط استعادة جديد من صفحة "نسيت الباسورد".
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/forgot-password" className="w-full h-12 rounded-xl font-bold bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors">
            اطلب رابط جديد
          </Link>
          <Link href="/" className="flex items-center justify-center gap-2 text-gray-500 font-bold hover:text-foreground">
            الرجوع للرئيسية
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-md bg-surface border border-surface-hover rounded-3xl p-6 sm:p-10 shadow-premium text-center animate-in zoom-in-95 duration-500">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
          <ShieldCheck className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">تم تغيير الباسورد! ✅</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          تم تحديث كلمة المرور الخاصة بك بنجاح. جاري تحويلك لحسابك...
        </p>
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md bg-surface border border-surface-hover rounded-3xl p-6 sm:p-10 shadow-premium">
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20">
        <KeyRound className="w-6 h-6 text-primary" />
      </div>
      <h1 className="text-3xl font-black text-foreground mb-2">كلمة مرور جديدة 🔒</h1>
      <p className="text-gray-500 mb-8 text-sm sm:text-base leading-relaxed">
        اكتب كلمة المرور الجديدة بتاعتك تحت وتأكد إنك تفتكرها المرة دي!
      </p>

      {errorMsg && (
        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl flex items-start gap-3 text-sm animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground px-1">كلمة المرور الجديدة</label>
          <PasswordInput
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 rounded-xl bg-background border-surface-hover focus-visible:border-primary text-start direction-ltr"
            required
            disabled={status === 'loading'}
            minLength={8}
          />
          <p className="px-1 text-xs text-gray-500">
            لازم تكون 8 حروف أو أكثر، وفيها حرف ورقم ورمز مميز زي @ أو $.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-foreground px-1">تأكيد كلمة المرور الجديدة</label>
          <PasswordInput
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="h-12 rounded-xl bg-background border-surface-hover focus-visible:border-primary text-start direction-ltr"
            required
            disabled={status === 'loading'}
            minLength={8}
          />
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
          <p className="text-xs font-bold text-foreground">مقترح كلمة مرور قوية</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <code className="rounded-xl bg-background px-3 py-2 text-sm font-bold text-primary direction-ltr break-all">
              {suggestedPassword}
            </code>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPassword(suggestedPassword)
                  setConfirmPassword(suggestedPassword)
                  setErrorMsg("")
                }}
                className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                استخدمها
              </button>
              <button
                type="button"
                onClick={() => setSuggestedPassword(generateStrongPassword())}
                className="rounded-xl border border-surface-hover bg-surface-hover px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary/30"
              >
                اقترح غيرها
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">لو عجبتك، احفظها في مكان آمن قبل ما تكمل.</p>
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
            "تحديث الحساب"
          )}
        </Button>
      </form>

      <div className="mt-8 text-center">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-foreground font-bold transition-colors">
          <ArrowRight className="w-4 h-4" />
          الرجوع لصفحة الدخول
        </Link>
      </div>
    </div>
  )
}
