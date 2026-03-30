import { Bike } from "lucide-react";

const FALLBACK_SITE_URL = "https://fi-elsekka.vercel.app";

export default function InstallPosterPage() {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || FALLBACK_SITE_URL;
  const installUrl = `${origin}/install-app`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=${encodeURIComponent(installUrl)}`;

  return (
    <main className="min-h-screen bg-[#08100e] p-4 md:p-10">
      <div className="mx-auto max-w-[560px] overflow-hidden rounded-[36px] border border-white/5 bg-[radial-gradient(circle_at_top_right,rgba(45,161,124,0.14),transparent_28%),linear-gradient(180deg,#0f1f1a,#0c1613)] px-6 py-8 shadow-[0_0_80px_rgba(16,185,129,0.14)] md:px-8">
        <div className="absolute" />

        <div className="rounded-full border border-primary/10 bg-[#10231d] px-4 py-2 text-center text-xs font-black text-primary">
          في السكة | تحميل التطبيق
        </div>

        <div className="mt-6 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary text-white shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <Bike className="h-12 w-12" />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-5xl font-black text-white">في السكة</p>
          <p className="mt-4 text-base font-bold text-white/80">تطبيق المشاوير لموبايلك</p>
          <p className="mt-2 text-sm leading-7 text-white/55">
            امسح الكود وابدأ التثبيت على موبايلك
          </p>
          <p className="mt-1 text-sm leading-7 text-white/45">
            افتح صفحة التثبيت من الرابط الجديد الخاص بالمشاوير
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="rounded-[28px] bg-white p-5 shadow-[0_0_60px_rgba(255,255,255,0.14)]">
            <img
              src={qrUrl}
              alt="QR لتحميل تطبيق في السكة"
              className="h-[280px] w-[280px] rounded-[16px] object-contain"
            />
          </div>
        </div>

        <p className="mt-6 text-center text-sm font-bold text-white/65">
          {installUrl.replace(/^https?:\/\//, "")}
        </p>
      </div>
    </main>
  );
}
