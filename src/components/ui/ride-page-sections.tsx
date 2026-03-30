import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ArrowLeft,
  CarTaxiFront,
  ChevronLeft,
  MapPin,
  Plane,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
  Users,
} from "lucide-react";
import { faqItems, howItWorksSteps, serviceAreas, tripTypeCards, valueProps } from "@/lib/ride-content";
import { FaqSection, MapPreview, SectionHeading, TrustStrip } from "@/components/ride/shared";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-6 sm:pt-10">
      <div className="absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(circle_at_top_right,rgba(35,130,103,0.12),transparent_35%),radial-gradient(circle_at_top_left,rgba(182,106,123,0.12),transparent_28%)]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="ride-hero-grid grid items-center gap-8 overflow-hidden rounded-[36px] border border-white/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(239,244,240,0.92))] p-6 shadow-[var(--shadow-material-3)] sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
          <div className="relative z-10">
            <Badge variant="success" className="rounded-full px-4 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              في السكة بشكلها الجديد
            </Badge>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-7xl">
              رايح فين؟
              <span className="mt-2 block text-primary">احجز مشوارك بسهولة.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-gray-500 sm:text-lg">
              نفس روح "في السكة" القريبة والسهلة، لكن بشكل أبسط شبه تطبيقات الطلب السريع على الموبايل:
              من وإلى، تبعت الطلب، الأدمن يشوفه، وبعدها يوصله للكباتن المناسبين.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link href="/book">
                  ابدأ الحجز
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-7">
                <Link href="/captain/login">دخول الكباتن</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="ride-panel rounded-[24px] p-4">
                <p className="text-xs font-black text-gray-500">شكل التشغيل</p>
                <p className="mt-2 text-xl font-black text-foreground">أدمن ثم كابتن</p>
              </div>
              <div className="ride-panel rounded-[24px] p-4">
                <p className="text-xs font-black text-gray-500">الاستخدام الأساسي</p>
                <p className="mt-2 text-xl font-black text-foreground">PWA على الموبايل</p>
              </div>
              <div className="ride-panel rounded-[24px] p-4">
                <p className="text-xs font-black text-gray-500">نوع المركبات</p>
                <p className="mt-2 text-xl font-black text-foreground">عربية / توك توك</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="ride-panel relative rounded-[32px] p-5 shadow-[var(--shadow-material-3)]">
              <div className="rounded-full bg-primary/10 px-4 py-2 text-xs font-black text-primary shadow-[var(--shadow-material-2)] w-fit">
                اطلب في أقل من دقيقة
              </div>
              <div className="mt-5 space-y-4">
                <div className="relative">
                  <MapPin className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  <Input placeholder="من فين؟" className="pe-10 h-13 rounded-[22px]" />
                </div>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                  <Input placeholder="إلى فين؟" className="pe-10 h-13 rounded-[22px]" />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <Select defaultValue="normal">
                    <option value="normal">مشوار عادي</option>
                    <option value="airport">مشوار مطار</option>
                  </Select>
                  <Button asChild className="h-12 rounded-[22px] text-base">
                    <Link href="/book">اطلب دلوقتي</Link>
                  </Button>
                </div>
              </div>
              <div className="mt-5 rounded-[24px] border border-surface-border bg-white/75 p-4">
                <p className="text-sm font-black text-foreground">الخطوة اللي بعد كده</p>
                <p className="mt-2 text-sm leading-7 text-gray-500">
                  الطلب يروح للأدمن، والأدمن يبعته للمندوبين أو الكباتن. أول موافقة ترجعلك على طول.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeTripTypesSection() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="واضحة من أولها"
          title="اختيار بسيط قبل الإرسال"
          description="الأساس هو من وإلى. ولو المشوار مطار، تقدر تحدده عشان الأدمن يرشحه للكباتن المناسبين."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {tripTypeCards.map((item) => (
            <div key={item.id} className="ride-panel rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-gray-500">{item.subtitle}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">{item.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="بيشتغل إزاي؟" title="Flow بسيط وواضح من أول ضغطه" description="الخطوات معمولة للموبايل وللمستخدم اللي عاوز يخلص بسرعة ومن غير لخبطة." />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {howItWorksSteps.map((step, index) => (
            <div key={step.title} className="ride-panel rounded-[28px] p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-black text-primary">
                0{index + 1}
              </span>
              <h3 className="mt-5 text-xl font-black text-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-gray-500">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhyChooseUsSection() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="ليه الشكل ده مناسب؟" title="مبني على طريقة التشغيل الفعلية" description="بدل تعقيد زيادة، الواجهة معمولة على نفس المنطق اللي وصفته: طلب بسيط، أدمن يراجع، وكباتن تختار." />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {valueProps.map((item, index) => {
            const icons = [<Smartphone key="smart" className="h-5 w-5" />, <Users key="users" className="h-5 w-5" />, <ShieldCheck key="shield" className="h-5 w-5" />];
            return (
              <div key={item.title} className="ride-panel rounded-[28px] p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  {icons[index]}
                </span>
                <h3 className="mt-5 text-xl font-black text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-500">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function AppTeaserSection() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-[36px] border border-primary/10 bg-[linear-gradient(135deg,rgba(35,130,103,0.08),rgba(182,106,123,0.08))] p-6 shadow-[var(--shadow-material-2)] lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
          <div>
            <Badge variant="default" className="rounded-full px-4 py-1.5 text-xs">
              PWA-ready
            </Badge>
            <h2 className="mt-4 text-3xl font-black text-foreground">تجربة أخف وأقرب لتطبيقات المشاوير</h2>
            <p className="mt-4 text-sm leading-7 text-gray-500">
              الشاشة الأساسية معمولة للموبايل من الأول: حقول قليلة، CTA واضح، وشرح بسيط يفهم المستخدم من أول مرة.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="ride-panel rounded-[24px] p-4">
                <p className="text-sm font-black text-foreground">واجهة قصيرة</p>
                <p className="mt-2 text-xs leading-6 text-gray-500">من - إلى - اطلب. ده هو المركز الأساسي للتجربة.</p>
              </div>
              <div className="ride-panel rounded-[24px] p-4">
                <p className="text-sm font-black text-foreground">تشغيل بالأدمن</p>
                <p className="mt-2 text-xs leading-6 text-gray-500">الـUX متفصل على إن القرار النهائي والتوزيع بيعدي على الأدمن.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="ride-panel rounded-[28px] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UsersRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-black text-foreground">الطلب عند الأدمن</p>
                  <p className="text-sm text-gray-500">مراجعة ثم توزيع</p>
                </div>
              </div>
              <div className="mt-5 h-28 rounded-[24px] bg-[linear-gradient(135deg,rgba(35,130,103,0.08),rgba(255,255,255,0.8))]" />
            </div>
            <div className="ride-panel rounded-[28px] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                  <CarTaxiFront className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-black text-foreground">الكباتن تختار</p>
                  <p className="text-sm text-gray-500">أول موافقة ترجع للمستخدم</p>
                </div>
              </div>
              <div className="mt-5 h-28 rounded-[24px] bg-[linear-gradient(135deg,rgba(182,106,123,0.08),rgba(255,255,255,0.8))]" />
            </div>
            <div className="ride-panel rounded-[28px] p-5 sm:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="rounded-full px-4 py-1.5 text-xs">
                  مناطق الخدمة الحالية
                </Badge>
                <p className="text-sm font-bold text-gray-500">Placeholder جاهز للربط الفعلي حسب المدينة لاحقًا.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {serviceAreas.map((area) => (
                  <span key={area} className="inline-flex rounded-full border border-surface-border bg-white/75 px-4 py-2 text-xs font-black text-foreground">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="أمان وثقة"
          title="الطلب واضح من أول لحظة"
          description="المستخدم لازم يبقى فاهم إن طلبه فين، مين شافه، ومين قبله. علشان كده حافظنا على states بسيطة وصريحة."
        />
        <div className="mt-8">
          <TrustStrip items={["الطلب يوصل للأدمن الأول", "الموافقة تظهر للمستخدم بشكل مباشر", "الدعم موجود من أي شاشة مهمة", "تصميم نظيف وسهل على الموبايل"]} />
        </div>
      </div>
    </section>
  );
}

export function FaqHomeSection() {
  return (
    <section className="pb-20 pt-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="أسئلة شائعة" title="لو لسه عندك سؤال" description="سيبنا لك أهم الأسئلة في صيغة بسيطة بالمصري، والباقي تكمله من صفحة الدعم." />
        <div className="mt-8">
          <FaqSection items={faqItems} />
        </div>
      </div>
    </section>
  );
}
