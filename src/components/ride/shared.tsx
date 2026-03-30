import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, cn } from "@/components/ui/button";
import {
  ArrowLeft,
  BellRing,
  CarTaxiFront,
  CheckCircle2,
  Clock3,
  Dot,
  MapPinned,
  ShieldCheck,
  Star,
  TimerReset,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { NotificationTone, TripStatus } from "@/lib/ride-content";

export function SectionHeading({
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-2 text-sm font-black text-primary">{eyebrow}</p> : null}
        <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-7 text-gray-500 sm:text-base">{description}</p> : null}
      </div>
      {actionLabel && actionHref ? (
        <Button asChild variant="outline" className="w-fit rounded-full px-5">
          <Link href={actionHref}>
            {actionLabel}
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: TripStatus | "upcoming" }) {
  const styles: Record<string, { label: string; className: string }> = {
    pending: { label: "قيد المراجعة", className: "border-amber-500/20 bg-amber-500/10 text-amber-700" },
    accepted: { label: "تم القبول", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" },
    arriving: { label: "في الطريق", className: "border-sky-500/20 bg-sky-500/10 text-sky-700" },
    arrived: { label: "وصل", className: "border-primary/20 bg-primary/10 text-primary" },
    started: { label: "بدأ المشوار", className: "border-violet-500/20 bg-violet-500/10 text-violet-700" },
    completed: { label: "مكتمل", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" },
    cancelled: { label: "ملغي", className: "border-rose-500/20 bg-rose-500/10 text-rose-600" },
    upcoming: { label: "جاية", className: "border-primary/20 bg-primary/10 text-primary" },
  };

  const current = styles[status];
  return <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-black", current.className)}>{current.label}</span>;
}

export function TripTypeSelector() {
  const items = [
    {
      title: "مشوار للمطار",
      description: "استقبال أو توصيل مع تفاصيل الرحلة والشنط",
      href: "/book/airport",
      icon: <CarTaxiFront className="h-5 w-5" />,
      accent: "from-primary/16 to-transparent",
    },
    {
      title: "مشوار عادي",
      description: "من أي نقطة لنقطة تانية مع تقدير وقت ومسافة",
      href: "/book/ride",
      icon: <MapPinned className="h-5 w-5" />,
      accent: "from-secondary/16 to-transparent",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "ride-panel group relative overflow-hidden rounded-[28px] p-6 transition-all duration-300 hover:-translate-y-1",
            `bg-gradient-to-br ${item.accent}`,
          )}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-primary shadow-[var(--shadow-material-1)]">
            {item.icon}
          </span>
          <h3 className="text-xl font-black text-foreground">{item.title}</h3>
          <p className="mt-2 text-sm leading-7 text-gray-500">{item.description}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-primary">
            ابدأ من هنا
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function MapPreview({
  title = "معاينة المسار",
  subtitle = "مكان الخريطة والتتبع هيتركب هنا لاحقًا",
  variant = "route",
}: {
  title?: string;
  subtitle?: string;
  variant?: "route" | "tracking";
}) {
  const topBadge = variant === "tracking" ? "تتبع مباشر" : "جاهز للخرائط";
  const meta = variant === "tracking" ? "ETA 6 دقايق" : "12.4 كم تقريبي";

  return (
    <div className="ride-map relative overflow-hidden rounded-[32px] border border-surface-border bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(239,243,239,0.95))] p-5 shadow-[var(--shadow-material-2)]">
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(29,39,35,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(29,39,35,0.05)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative flex items-center justify-between">
        <Badge variant="success" className="rounded-full px-3 py-1">
          {topBadge}
        </Badge>
        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-gray-500 shadow-[var(--shadow-material-1)]">
          {meta}
        </span>
      </div>
      <div className="relative mt-8 flex min-h-[240px] items-center justify-center overflow-hidden rounded-[26px] border border-dashed border-primary/15 bg-[radial-gradient(circle_at_top_right,rgba(35,130,103,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(182,106,123,0.16),transparent_30%),linear-gradient(180deg,#ffffff,#eef2ee)]">
        <div className="absolute start-8 top-8 rounded-full bg-white px-4 py-2 text-xs font-black text-primary shadow-[var(--shadow-material-1)]">
          نقطة التحرك
        </div>
        <div className="absolute bottom-8 end-8 rounded-full bg-white px-4 py-2 text-xs font-black text-secondary shadow-[var(--shadow-material-1)]">
          نقطة الوصول
        </div>
        <div className="absolute inset-x-[18%] top-[28%] h-[2px] rotate-6 bg-[linear-gradient(90deg,rgba(35,130,103,0.35),rgba(182,106,123,0.42))]" />
        <div className="absolute inset-x-[22%] top-[46%] h-[2px] -rotate-6 bg-[linear-gradient(90deg,rgba(35,130,103,0.25),rgba(182,106,123,0.32))]" />
        <div className="absolute start-[18%] top-[26%] h-4 w-4 rounded-full border-[5px] border-primary bg-white shadow-[0_0_0_8px_rgba(35,130,103,0.12)]" />
        <div className="absolute end-[17%] bottom-[22%] h-4 w-4 rounded-full border-[5px] border-secondary bg-white shadow-[0_0_0_8px_rgba(182,106,123,0.12)]" />
        <div className="rounded-[28px] border border-white/90 bg-white/90 p-6 text-center shadow-[var(--shadow-material-2)]">
          <MapPinned className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-4 text-lg font-black text-foreground">{title}</p>
          <p className="mt-2 max-w-[280px] text-sm leading-6 text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export function DriverCard({
  name,
  rating,
  phone,
  eta,
}: {
  name: string;
  rating: string;
  phone: string;
  eta: string;
}) {
  return (
    <div className="ride-panel rounded-[28px] p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-2xl font-black text-primary">
          ك
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-foreground">{name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-black text-amber-700">
              <Star className="h-3.5 w-3.5 fill-current" />
              {rating}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">الهاتف: {phone}</p>
        </div>
        <span className="rounded-2xl bg-primary/10 px-3 py-2 text-sm font-black text-primary">{eta}</span>
      </div>
    </div>
  );
}

export function VehicleCard({
  title,
  subtitle,
  plate,
}: {
  title: string;
  subtitle: string;
  plate: string;
}) {
  return (
    <div className="ride-panel rounded-[28px] p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-secondary/10 text-secondary">
          <CarTaxiFront className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <span className="rounded-2xl border border-surface-border bg-white/70 px-3 py-2 text-xs font-black text-foreground">
          {plate}
        </span>
      </div>
    </div>
  );
}

export function NotificationItem({
  title,
  body,
  time,
  tone,
}: {
  title: string;
  body: string;
  time: string;
  tone: NotificationTone;
}) {
  const toneStyles = {
    success: {
      wrapper: "border-emerald-500/15 bg-emerald-500/[0.05]",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    },
    info: {
      wrapper: "border-primary/15 bg-primary/[0.05]",
      icon: <BellRing className="h-5 w-5 text-primary" />,
    },
    warning: {
      wrapper: "border-amber-500/15 bg-amber-500/[0.05]",
      icon: <TriangleAlert className="h-5 w-5 text-amber-600" />,
    },
    danger: {
      wrapper: "border-rose-500/15 bg-rose-500/[0.05]",
      icon: <XCircle className="h-5 w-5 text-rose-600" />,
    },
  };

  const current = toneStyles[tone];

  return (
    <div className={cn("flex gap-4 rounded-[24px] border p-4 shadow-[var(--shadow-material-1)]", current.wrapper)}>
      <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-[var(--shadow-material-1)]">
        {current.icon}
      </span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-black text-foreground">{title}</h3>
          <span className="text-xs font-bold text-gray-500">{time}</span>
        </div>
        <p className="mt-2 text-sm leading-7 text-gray-500">{body}</p>
      </div>
    </div>
  );
}

export function TripTimeline({
  active,
  steps,
}: {
  active: string;
  steps: readonly { key: string; label: string }[];
}) {
  const activeIndex = steps.findIndex((step) => step.key === active);

  return (
    <div className="ride-panel rounded-[28px] p-5">
      <h3 className="text-lg font-black text-foreground">وصلنا لحد فين؟</h3>
      <div className="mt-5 space-y-4">
        {steps.map((step, index) => {
          const done = index <= activeIndex;
          const current = index === activeIndex;

          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black",
                    done ? "border-primary bg-primary text-white" : "border-surface-border bg-white text-gray-400",
                  )}
                >
                  {done ? "✓" : index + 1}
                </span>
                {index < steps.length - 1 ? <span className={cn("mt-1 h-7 w-px", done ? "bg-primary/40" : "bg-surface-border")} /> : null}
              </div>
              <div className="pt-1">
                <p className={cn("text-sm font-black", current ? "text-foreground" : "text-gray-500")}>{step.label}</p>
                {current ? <p className="mt-1 text-xs text-primary">الحالة الحالية</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="ride-panel flex flex-col items-center justify-center rounded-[32px] px-6 py-14 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary">
        <TimerReset className="h-10 w-10" />
      </div>
      <h3 className="mt-5 text-2xl font-black text-foreground">{title}</h3>
      <p className="mt-3 max-w-lg text-sm leading-7 text-gray-500">{description}</p>
      {actionLabel && actionHref ? (
        <Button asChild className="mt-6 rounded-full px-6">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function TrustStrip({ items }: { items: readonly string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item} className="ride-panel flex items-center gap-3 rounded-[24px] p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="text-sm font-bold leading-6 text-foreground">{item}</p>
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="ride-panel rounded-[28px] p-5">
      <p className="text-sm font-bold text-gray-500">{title}</p>
      <p className="mt-3 text-3xl font-black text-foreground">{value}</p>
      <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
        <Dot className="h-5 w-5" />
        {hint}
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[24px] bg-[linear-gradient(90deg,rgba(35,130,103,0.05),rgba(35,130,103,0.12),rgba(35,130,103,0.05))]", className)} />;
}

export function FaqSection({
  items,
}: {
  items: readonly { question: string; answer: string }[];
}) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <details key={item.question} className="ride-panel group rounded-[24px] p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black text-foreground">
            {item.question}
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary transition-transform group-open:rotate-180">
              +
            </span>
          </summary>
          <p className="mt-4 text-sm leading-7 text-gray-500">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
