"use client"

import * as React from "react"
import Link from "next/link"
import { Download, Share, PlusSquare, Smartphone, ArrowLeft, CheckCircle2, Copy, QrCode, Bike } from "lucide-react"

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white" />
    </span>
  )
}

export default function InstallAppPage() {
  const [isIOS, setIsIOS] = React.useState(false)
  const [isAndroid, setIsAndroid] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const [isStandalone, setIsStandalone] = React.useState(false)
  const [isInstallReady, setIsInstallReady] = React.useState(false)
  const [isInstalling, setIsInstalling] = React.useState(false)
  const [installSucceeded, setInstallSucceeded] = React.useState(false)
  const [installUrl, setInstallUrl] = React.useState("https://fi-elsekka.vercel.app/install-app")
  const [linkCopied, setLinkCopied] = React.useState(false)
  const deferredPrompt = React.useRef<DeferredInstallPrompt | null>(null)
  React.useEffect(() => {
    if (typeof window === "undefined") return

    const userAgent = window.navigator.userAgent.toLowerCase()
    const modeStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://")

    setIsStandalone(modeStandalone)
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))
    setIsAndroid(/android/.test(userAgent))
    setIsMobile(/iphone|ipad|ipod|android|mobile/.test(userAgent))
    setInstallUrl(`${window.location.origin}/install-app`)

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPrompt.current = event as DeferredInstallPrompt
      setIsInstallReady(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt.current) return

    setIsInstalling(true)
    try {
      await deferredPrompt.current.prompt()
      const choice = await deferredPrompt.current.userChoice
      if (choice.outcome === "accepted") {
        setInstallSucceeded(true)
        setIsInstallReady(false)
      }
    } finally {
      deferredPrompt.current = null
      setIsInstalling(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      setLinkCopied(false)
    }
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(installUrl)}`

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-6">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[32px] border border-surface-hover bg-surface/95 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary">تثبيت في السكة</p>
              <h1 className="mt-1 text-2xl font-heading font-black text-foreground">نزّل التطبيق على موبايلك</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-gray-500">
            علشان تفتحه بسرعة من وسط التطبيقات اللي عندك، وتستخدمه كتجربة أهدى وأسهل من المتصفح كل مرة.
          </p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-primary">
              <QrCode className="h-4 w-4" />
              <p className="text-sm font-black">لينك وQR للتثبيت</p>
            </div>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              افتح اللينك ده من الموبايل أو اعمل Scan للـQR من أي هاتف، وهيوديك مباشرة لصفحة تثبيت التطبيق.
            </p>

            <div className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1714] p-5">
              <div className="relative mx-auto max-w-[420px] overflow-hidden rounded-[32px] border border-white/5 bg-[radial-gradient(circle_at_top_right,rgba(45,161,124,0.14),transparent_28%),linear-gradient(180deg,#0f1f1a,#0c1613)] px-6 py-7 shadow-[0_0_80px_rgba(16,185,129,0.14)]">
                <div className="absolute -left-10 bottom-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
                <div className="absolute -right-8 top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

                <div className="relative rounded-full border border-primary/10 bg-[#10231d] px-4 py-2 text-center text-xs font-black text-primary">
                  في السكة | تحميل التطبيق
                </div>

                <div className="relative mt-6 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-primary text-white shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                    <Bike className="h-10 w-10" />
                  </div>
                </div>

                <div className="relative mt-5 text-center">
                  <p className="text-4xl font-black text-white">في السكة</p>
                  <p className="mt-3 text-sm font-bold text-white/80">تطبيق المشاوير لموبايلك</p>
                  <p className="mt-2 text-xs leading-6 text-white/50">
                    امسح الكود وابدأ التثبيت على موبايلك
                  </p>
                </div>

                <div className="relative mt-6 flex justify-center">
                  <div className="rounded-[24px] bg-white p-4 shadow-[0_0_50px_rgba(255,255,255,0.14)]">
                    <img
                      src={qrUrl}
                      alt="QR لتحميل تطبيق في السكة"
                      className="h-[220px] w-[220px] rounded-[12px] object-contain"
                    />
                  </div>
                </div>

                <p className="relative mt-5 text-center text-[11px] font-bold text-white/55">
                  {installUrl.replace(/^https?:\/\//, "")}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
              <p className="text-[11px] font-bold text-white/45">لينك التثبيت المباشر</p>
              <p className="mt-1 break-all text-sm font-black text-white">{installUrl}</p>
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
              >
                <Copy className="h-4 w-4" />
                {linkCopied ? "اتنسخ اللينك" : "انسخ لينك التثبيت"}
              </button>

              <Link
                href={installUrl}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-white transition hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                افتح صفحة التثبيت
              </Link>
            </div>
          </div>

          {isStandalone ? (
            <div className="mt-6 rounded-3xl border border-emerald-500/15 bg-emerald-500/5 p-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="mt-3 text-lg font-black text-foreground">التطبيق متثبت بالفعل</p>
              <p className="mt-1 text-sm text-gray-500">تقدر تفتحه دلوقتي من شاشة التطبيقات أو الشاشة الرئيسية.</p>
            </div>
          ) : isIOS ? (
            <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/5 p-5">
              <p className="text-lg font-black text-foreground">على iPhone أو iPad</p>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">1</span>
                  <span>
                    اضغط على <b>مشاركة</b> <Share className="mx-1 inline h-4 w-4" />
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">2</span>
                  <span>
                    اختَر <b>إضافة إلى الشاشة الرئيسية</b> <PlusSquare className="mx-1 inline h-4 w-4" />
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">3</span>
                  <span>هيظهر لك التطبيق وسط التطبيقات عندك بشكل طبيعي.</span>
                </li>
              </ol>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/5 p-5">
              <p className="text-lg font-black text-foreground">على Android</p>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                افتح الصفحة من Chrome أو متصفح يدعم التثبيت، واضغط الزر تحت. لو الزر مش ظاهر، افتح قائمة المتصفح واختر
                <b> تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.
              </p>

              {!isMobile && (
                <div className="mt-4 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-xs leading-6 text-amber-300">
                  افتح هذه الصفحة من موبايل Android أو اعمل Scan للـ QR من هاتفك، لأن التثبيت لا يظهر من الديسكتوب.
                </div>
              )}

              {isAndroid && !isInstallReady && (
                <div className="mt-4 rounded-2xl border border-surface-hover bg-background/60 px-4 py-3 text-xs leading-6 text-gray-500">
                  لو الزر تحت طالع معطّل، افتح قائمة المتصفح ثم اختر:
                  <b className="text-foreground"> تثبيت التطبيق</b>
                  {" "}أو
                  <b className="text-foreground"> إضافة إلى الشاشة الرئيسية</b>.
                </div>
              )}

              <button
                onClick={handleInstall}
                disabled={!isInstallReady || isInstalling || installSucceeded}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {installSucceeded
                  ? "تم تثبيت التطبيق"
                  : isInstalling
                    ? <span className="inline-flex items-center gap-2">جارٍ التثبيت <LoadingDots /></span>
                    : isInstallReady
                      ? "تثبيت التطبيق"
                      : isAndroid
                        ? "استخدم خيار تثبيت التطبيق من المتصفح"
                        : "التثبيت متاح من الهاتف فقط"}
              </button>
            </div>
          )}

          <div className="mt-6 border-t border-surface-hover pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80"
            >
              ارجع للموقع
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
