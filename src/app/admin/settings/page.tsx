import { MetricPanel, SectionCard } from "@/components/admin-dashboard/primitives";

export default function AdminSettingsPage() {
    const envHealth = {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "موجود" : "ناقص",
        serviceRole: process.env.SUPABASE_SERVICE_KEY ? "موجود" : "ناقص",
    };

    return (
        <div className="space-y-6">
            <SectionCard title="إعدادات المنصة" subtitle="جاهزية التشغيل والتكاملات الأساسية">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricPanel label="مصدر الدخول" value="Supabase Auth" sublabel="البروفايلات متزامنة من auth.users" />
                    <MetricPanel label="قاعدة البيانات" value="PostgreSQL" sublabel="public schema مع RLS شغال" />
                    <MetricPanel label="الملفات" value="Supabase Storage" sublabel="ملفات الكباتن والمركبات الخاصة" />
                    <MetricPanel label="الجاهزية اللحظية" value="جاهز للخريطة" sublabel="مستعد للتوزيع والتتبع" />
                </div>
            </SectionCard>

            <section className="grid gap-6 xl:grid-cols-2">
                <SectionCard title="حالة البيئة" subtitle="مفاتيح السيرفر المطلوبة لتشغيل لوحة الإدارة">
                    <div className="space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">NEXT_PUBLIC_SUPABASE_URL</p>
                            <p className="mt-3 text-sm text-white/75">{envHealth.supabaseUrl}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs tracking-[0.2em] text-white/40">SUPABASE_SERVICE_KEY</p>
                            <p className="mt-3 text-sm text-white/75">{envHealth.serviceRole}</p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="قائمة التشغيل القادمة" subtitle="أهم الخطوات المقترحة بعد كده">
                    <div className="space-y-3 text-sm leading-7 text-white/70">
                        <p>1. وصل الـ map SDK و Realtime بلوحة التوزيع.</p>
                        <p>2. انقل صلاحيات فريق التشغيل من الجدول القديم للـ schema الجديدة وقت ما تبقى جاهز.</p>
                        <p>3. أضف viewers بروابط موقعة لملفات الكباتن والمركبات الخاصة.</p>
                        <p>4. وصل push وواتساب مع `admin_announcements` و `notifications`.</p>
                        <p>5. أضف مؤشرات SLA وإنذارات لقوايم الدعم والتوزيع.</p>
                    </div>
                </SectionCard>
            </section>
        </div>
    );
}
