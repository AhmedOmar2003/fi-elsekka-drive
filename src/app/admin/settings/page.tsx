import { MetricPanel, SectionCard } from "@/components/admin-dashboard/primitives";

export default function AdminSettingsPage() {
    const envHealth = {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configured" : "Missing",
        serviceRole: process.env.SUPABASE_SERVICE_KEY ? "Configured" : "Missing",
    };

    return (
        <div className="space-y-6">
            <SectionCard title="Platform settings" subtitle="Operational configuration and integration readiness">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricPanel label="Auth source" value="Supabase Auth" sublabel="Profiles synced from auth.users" />
                    <MetricPanel label="Primary DB" value="PostgreSQL" sublabel="Public schema with RLS enabled" />
                    <MetricPanel label="Storage" value="Supabase Storage" sublabel="Private driver and vehicle files" />
                    <MetricPanel label="Realtime readiness" value="Map-ready" sublabel="Prepared for dispatch + tracking events" />
                </div>
            </SectionCard>

            <section className="grid gap-6 xl:grid-cols-2">
                <SectionCard title="Environment health" subtitle="Server-side credentials required by admin tooling">
                    <div className="space-y-4">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">NEXT_PUBLIC_SUPABASE_URL</p>
                            <p className="mt-3 text-sm text-white/75">{envHealth.supabaseUrl}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">SUPABASE_SERVICE_KEY</p>
                            <p className="mt-3 text-sm text-white/75">{envHealth.serviceRole}</p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Operational checklist" subtitle="Recommended next integration steps">
                    <div className="space-y-3 text-sm leading-7 text-white/70">
                        <p>1. Connect map SDK and Realtime channels to the dispatch board placeholder.</p>
                        <p>2. Move staff roles from the legacy admin table into the new operational schema when ready.</p>
                        <p>3. Add signed URL viewers for private driver and vehicle documents.</p>
                        <p>4. Wire push / WhatsApp notification providers to `admin_announcements` and `notifications`.</p>
                        <p>5. Add SLA metrics and queue alarms for support and dispatch workloads.</p>
                    </div>
                </SectionCard>
            </section>
        </div>
    );
}
