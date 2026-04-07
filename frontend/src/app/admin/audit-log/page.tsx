"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, History, Loader2, ArrowLeft, Search, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAdminAuditLogs, type AdminAuditLog } from "@/services/adminService";
import { hasFullAdminAccess } from "@/lib/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function severityMeta(severity: string) {
  switch (severity) {
    case "critical":
      return "text-rose-400 bg-rose-400/10 border-rose-400/20";
    case "warning":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    default:
      return "text-sky-400 bg-sky-400/10 border-sky-400/20";
  }
}

function formatAction(action: string) {
  return action
    .replaceAll(".", " / ")
    .replaceAll("_", " ");
}

export default function AdminAuditLogPage() {
  const router = useRouter();
  const { profile, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<"all" | "info" | "warning" | "critical">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!hasFullAdminAccess(profile)) {
      router.replace("/admin/orders?error=forbidden");
      return;
    }

    const loadLogs = async () => {
      setLoading(true);
      try {
        setLogs(await fetchAdminAuditLogs(100));
      } catch (error) {
        console.error(error);
        toast.error("تعذر تحميل سجل الإدارة");
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [authLoading, profile, router]);

  const filteredLogs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSeverity = severity === "all" || log.severity === severity;
      if (!matchesSeverity) return false;
      if (!term) return true;
      const haystack = [
        log.action,
        log.entity_type,
        log.entity_label,
        log.actor_email,
        log.actor_role,
        JSON.stringify(log.details || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [logs, query, severity]);

  const stats = useMemo(() => ({
    total: logs.length,
    critical: logs.filter((log) => log.severity === "critical").length,
    warnings: logs.filter((log) => log.severity === "warning").length,
    staffActions: logs.filter((log) => log.entity_type === "staff").length,
  }), [logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-black text-foreground">سجل الإدارة</h1>
          <p className="mt-1 text-sm text-gray-500">أثر واضح لكل إجراء إداري مهم: إنشاء، تعديل، حذف، تعيين، وتعطيل.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => location.reload()}>
            تحديث السجل
          </Button>
          <Link href="/admin/staff" className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-2.5 text-sm font-bold text-violet-400 transition-colors hover:bg-violet-500/15">
            فتح إدارة الطاقم
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الأحداث", value: stats.total, icon: History, tone: "text-sky-400 bg-sky-400/10" },
          { label: "أحداث حرجة", value: stats.critical, icon: AlertTriangle, tone: "text-rose-400 bg-rose-400/10" },
          { label: "تحذيرات", value: stats.warnings, icon: ShieldAlert, tone: "text-amber-400 bg-amber-400/10" },
          { label: "عمليات على الطاقم", value: stats.staffActions, icon: ShieldAlert, tone: "text-violet-400 bg-violet-400/10" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-surface-hover bg-surface p-4 shadow-sm">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${card.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-black text-foreground">{loading ? "..." : card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-surface-hover bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في الإجراء أو الجهة أو الموظف أو التفاصيل"
              className="pr-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "الكل" },
              { key: "info", label: "معلومات" },
              { key: "warning", label: "تحذيرات" },
              { key: "critical", label: "حرج" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setSeverity(option.key as any)}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                  severity === option.key ? "bg-primary/15 text-primary border border-primary/20" : "bg-background text-gray-500 border border-surface-hover hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-hover bg-surface shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">لا توجد أحداث مطابقة حاليًا</div>
        ) : (
          <div className="divide-y divide-surface-hover">
            {filteredLogs.map((log) => (
              <div key={log.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${severityMeta(log.severity)}`}>
                        {log.severity === "critical" ? "حرج" : log.severity === "warning" ? "تحذير" : "معلومة"}
                      </span>
                      <span className="text-xs font-bold text-foreground">{formatAction(log.action)}</span>
                      <span className="text-xs text-gray-500">على {log.entity_type}</span>
                    </div>
                    <p className="text-sm text-foreground">
                      <span className="font-bold">{log.actor_email || "نظام"}</span>
                      <span className="text-gray-500"> نفذ الإجراء على </span>
                      <span className="font-bold">{log.entity_label || log.entity_id || "عنصر غير مسمى"}</span>
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="rounded-xl bg-background px-3 py-2 text-[11px] text-gray-500">
                        {Object.entries(log.details).slice(0, 4).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between gap-3">
                            <span>{key}</span>
                            <span className="truncate text-left">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-primary">{log.actor_role || "admin"}</p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(log.created_at).toLocaleString("ar-EG")}
                    </p>
                    {log.entity_type === "staff" && (
                      <Link href="/admin/staff" className="mt-2 inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                        فتح إدارة الطاقم <ArrowLeft className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
