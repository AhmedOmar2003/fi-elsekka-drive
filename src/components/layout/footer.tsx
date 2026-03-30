"use client";

import Link from "next/link";
import { ArrowLeft, MapPinned, ShieldCheck, Smartphone } from "lucide-react";
import { BrandLogo } from "@/components/ride/brand-logo";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { getSupportWhatsAppEntries } from "@/services/appSettingsService";

export function Footer() {
  const { settings } = useAppSettings();
  const whatsappEntries = getSupportWhatsAppEntries(settings);

  return (
    <footer className="mt-auto px-4 pb-24 pt-16 md:px-6 md:pb-10">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-[#101816] px-6 py-8 text-white shadow-[var(--shadow-material-3)] sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <div>
              <BrandLogo className="[&_span]:text-white [&_.text-primary]:!text-primary" tagline={settings.siteTagline || "رايح فين؟ إحنا معاك"} />
              <p className="mt-4 max-w-md text-sm leading-7 text-white/65">
                في السكة بقت منصة مشاوير عربية مصممة لمصر. نفس الروح القريبة، لكن بتجربة حجز وتتبّع أذكى وأسهل على الموبايل.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-xs font-black text-white/85">
                  <MapPinned className="h-4 w-4 text-primary" />
                  عربي + RTL
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-xs font-black text-white/85">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  تتبع وحالة رحلة
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-xs font-black text-white/85">
                  <Smartphone className="h-4 w-4 text-primary" />
                  موبايل أولًا
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-black text-white">روابط سريعة</h3>
              <div className="mt-4 grid gap-3 text-sm text-white/70">
                {[
                  { href: "/book", label: "ابدأ مشوار" },
                  { href: "/book/airport", label: "مشوار المطار" },
                  { href: "/trips", label: "رحلاتي" },
                  { href: "/captain/login", label: "دخول الكباتن" },
                  { href: "/support", label: "الدعم والمساعدة" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="inline-flex items-center gap-2 transition-colors hover:text-white">
                    <ArrowLeft className="h-4 w-4 text-primary" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-black text-white">تواصل معانا</h3>
              <div className="mt-4 space-y-3 text-sm text-white/70">
                {settings.supportPhone ? <p>اتصل بينا: {settings.supportPhone}</p> : <p>رقم الدعم هيتضاف هنا مع الربط الفعلي.</p>}
                {settings.supportEmail ? <p>الإيميل: {settings.supportEmail}</p> : <p>بريد الدعم هيتوصل بعد ربط الإعدادات.</p>}
                {whatsappEntries.length > 0 ? (
                  whatsappEntries.map((entry) => (
                    <a
                      key={entry.id}
                      href={entry.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/12 px-4 py-2 text-xs font-black text-emerald-200 transition-colors hover:bg-emerald-500/20"
                    >
                      {entry.label}
                    </a>
                  ))
                ) : (
                  <p>واتساب الدعم placeholder لحد ما يتربط من الإعدادات.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-5 text-xs text-white/45">
            © {new Date().getFullYear()} في السكة. تجربة مشاوير عربية جاهزة للتوسع وربط Supabase والخرائط والتنبيهات.
          </div>
        </div>
      </div>
    </footer>
  );
}
