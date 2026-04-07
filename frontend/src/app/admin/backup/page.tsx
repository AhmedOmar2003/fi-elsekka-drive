'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { BACKUP_SCOPES, BACKUP_SCOPE_ORDER, BACKUP_TABLE_LABELS, type BackupScope } from '@/lib/admin-backup';
import { Database, Download, FileJson2, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck, Upload } from 'lucide-react';

type DownloadKey = `${BackupScope}:json` | `${BackupScope}:excel`;
type RestoreSummaryRow = { table: string; label: string; count: number };

async function downloadBackup(scope: BackupScope, format: 'json' | 'excel') {
  const response = await fetch(`/api/admin/backup/export?scope=${scope}&format=${format}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'تعذر تنزيل النسخة الاحتياطية دلوقتي');
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || `fi-elsekka-backup-${scope}.${format === 'excel' ? 'xls' : 'json'}`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function AdminBackupPage() {
  const { user, profile, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<DownloadKey | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<RestoreSummaryRow[]>([]);
  const [previewMeta, setPreviewMeta] = useState<{ scopeLabel: string; totalTables: number; totalRows: number; exportedAt: string | null } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace('/admin/login');
      return;
    }

    if (!hasPermission(profile, 'manage_settings')) {
      router.replace('/admin');
    }
  }, [isAuthLoading, profile, router, user]);

  const scopeEntries = useMemo(
    () => BACKUP_SCOPE_ORDER.map((scope) => [scope, BACKUP_SCOPES[scope]] as const),
    []
  );

  const handleDownload = async (scope: BackupScope, format: 'json' | 'excel') => {
    const key = `${scope}:${format}` as DownloadKey;
    setLoadingKey(key);
    try {
      await downloadBackup(scope, format);
      toast.success(
        format === 'excel' ? 'نزلنا نسخة Excel جاهزة ✅' : 'نزلنا نسخة JSON كاملة ✅',
        {
          description:
            format === 'excel'
              ? 'تقدر تفتحها في Excel وتراجع كل الجداول بسهولة.'
              : 'دي النسخة الأشمل للطوارئ أو لو حبيت تنقل البيانات في أي مكان تاني.',
        }
      );
    } catch (error: any) {
      toast.error('حصلت مشكلة وإحنا بنجهز النسخة', {
        description: error?.message || 'جرب تاني بعد شوية',
      });
    } finally {
      setLoadingKey(null);
    }
  };

  const previewRestoreFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'preview');

    const response = await fetch('/api/admin/backup/restore', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || 'تعذر قراءة ملف النسخة الاحتياطية');
    }

    return data as {
      scopeLabel: string;
      totalTables: number;
      totalRows: number;
      exportedAt: string | null;
      summary: RestoreSummaryRow[];
    };
  };

  const applyRestore = async (file: File, mode: 'restore' | 'replace', confirm = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (confirm) {
      formData.append('confirm', confirm);
    }

    const response = await fetch('/api/admin/backup/restore', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || 'تعذر استرجاع النسخة الاحتياطية');
    }

    return data as {
      scopeLabel: string;
      totalTables: number;
      totalRows: number;
      note?: string;
    };
  };

  const handlePickRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setRestoreFile(file);
    setPreviewRows([]);
    setPreviewMeta(null);

    if (!file) return;

    setIsPreviewLoading(true);
    try {
      const preview = await previewRestoreFile(file);
      setPreviewRows(preview.summary);
      setPreviewMeta({
        scopeLabel: preview.scopeLabel,
        totalTables: preview.totalTables,
        totalRows: preview.totalRows,
        exportedAt: preview.exportedAt,
      });
      toast.success('قرأنا الملف بنجاح ✅', {
        description: 'دلوقتي تقدر تراجع الجداول الأول وبعدها تبدأ الاسترجاع.',
      });
    } catch (error: any) {
      setRestoreFile(null);
      toast.error('الملف ده مش واضح أو فيه مشكلة', {
        description: error?.message || 'اتأكد إنك رافع نسخة JSON طالعة من مركز الـ Backup.',
      });
    } finally {
      setIsPreviewLoading(false);
      event.target.value = '';
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      toast.error('اختار ملف النسخة الأول');
      return;
    }

    setIsRestoring(true);
    try {
      const result = await applyRestore(restoreFile, 'restore');
      toast.success('الاسترجاع تم بنجاح ✅', {
        description: `رجعنا ${result.totalRows.toLocaleString()} صف من ${result.totalTables} جدول. ${result.note || ''}`.trim(),
      });
    } catch (error: any) {
      toast.error('الاسترجاع وقف في النص', {
        description: error?.message || 'جرب تاني بعد شوية',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleReplaceRestore = async () => {
    if (!restoreFile) {
      toast.error('اختار ملف النسخة الأول');
      return;
    }

    if (replaceConfirm.trim() !== 'استرجاع كامل') {
      toast.error('اكتب جملة التأكيد الأول');
      return;
    }

    setIsReplacing(true);
    try {
      const result = await applyRestore(restoreFile, 'replace', replaceConfirm);
      toast.success('الاسترجاع الكامل تم ✅', {
        description: `رجعنا ${result.totalRows.toLocaleString()} صف بعد ما مسحنا البيانات الحالية للجداول الموجودة في النسخة.`,
      });
    } catch (error: any) {
      toast.error('الاسترجاع الكامل وقف', {
        description: error?.message || 'جرب تاني بعد شوية',
      });
    } finally {
      setIsReplacing(false);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-surface-hover bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-black text-primary">
              <Database className="w-4 h-4" />
              Backup Center
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white">النسخ الاحتياطي</h1>
              <p className="mt-2 text-sm md:text-base text-gray-400 leading-relaxed max-w-3xl">
                من هنا تقدر تنزل نسخة كاملة من الداتا لو حبيت تحتفظ بيها، تراجعها في Excel، أو تنقلها لأي مكان تاني وقت الطوارئ.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 max-w-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-gray-300 leading-relaxed">
                النسخة دي مخصصة للإدارة فقط، وبتشمل بيانات حساسة. حمّلها على جهاز آمن واحتفظ بيها بعيد عن أي مشاركة عامة.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {scopeEntries.map(([scope, config]) => (
          <div key={scope} className="rounded-[2rem] border border-surface-hover bg-surface p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-black text-white mb-2">{config.label}</h2>
                <p className="text-sm text-gray-400 leading-relaxed">{config.description}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary shrink-0">
                <Database className="w-5 h-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-surface-hover bg-background/40 p-4 mb-5">
              <p className="text-xs font-black text-gray-400 mb-3">الجداول اللي هتنزل</p>
              <div className="flex flex-wrap gap-2">
                {config.tables.map((tableName) => (
                  <span
                    key={tableName}
                    className="rounded-full border border-surface-hover bg-surface px-3 py-1.5 text-xs font-bold text-gray-300"
                  >
                    {BACKUP_TABLE_LABELS[tableName] || tableName}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleDownload(scope, 'excel')}
                disabled={loadingKey !== null}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingKey === `${scope}:excel` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                نسخة Excel
              </button>

              <button
                type="button"
                onClick={() => handleDownload(scope, 'json')}
                disabled={loadingKey !== null}
                className="flex items-center justify-center gap-2 rounded-2xl border border-surface-hover bg-surface px-4 py-3 font-black text-white transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingKey === `${scope}:json` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileJson2 className="w-4 h-4" />
                )}
                نسخة JSON
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-surface-hover bg-surface p-6">
        <div className="flex items-center gap-3 mb-4">
          <Download className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-black text-white">أفضل استخدام للنسخة</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-2xl border border-surface-hover bg-background/40 p-4 text-gray-300 leading-relaxed">
            <p className="font-black text-white mb-2">نسخة Excel</p>
            افتحها بسرعة في Excel وراجع أي جدول أو ابعته للمحاسب أو لفريق المتابعة بسهولة.
          </div>
          <div className="rounded-2xl border border-surface-hover bg-background/40 p-4 text-gray-300 leading-relaxed">
            <p className="font-black text-white mb-2">نسخة JSON</p>
            دي الأفضل للطوارئ أو لو هتنقل الداتا لمكان تاني وتحتاج نسخة كاملة منظمة لكل الجداول.
          </div>
          <div className="rounded-2xl border border-surface-hover bg-background/40 p-4 text-gray-300 leading-relaxed">
            <p className="font-black text-white mb-2">نصيحة أمان</p>
            خزن النسخة على جهاز موثوق أو مساحة آمنة، وما تبعتهاش لأي حد مش محتاج يشوف البيانات دي.
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-surface-hover bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-white">Restore Center</h2>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              ارفع نسخة JSON من اللي نزلتها من هنا، راجعها الأول، وبعدها ابدأ الاسترجاع. الاسترجاع الحالي بيعمل دمج وتحديث للبيانات الموجودة، مش مسح كامل للقاعدة.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            استخدمه وقت الحاجة فقط، وعلى نسخة موثوق فيها.
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="rounded-[1.5rem] border border-surface-hover bg-background/40 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">ارفع ملف الاسترجاع</h3>
                <p className="text-sm text-gray-400">الأفضل يكون ملف JSON نازل من مركز النسخ الاحتياطي نفسه.</p>
              </div>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-surface-hover bg-surface/70 px-5 py-8 text-center hover:border-primary/40 transition">
              <FileJson2 className="w-8 h-8 text-primary mb-3" />
              <p className="text-sm font-black text-white mb-1">
                {restoreFile ? restoreFile.name : 'اختار ملف النسخة الاحتياطية'}
              </p>
              <p className="text-xs text-gray-400">ارفع الملف هنا أو دوس علشان تختاره</p>
              <input type="file" accept=".json,application/json" className="hidden" onChange={handlePickRestoreFile} />
            </label>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={handleRestore}
                disabled={!restoreFile || isPreviewLoading || isRestoring || isReplacing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                استرجاع آمن
              </button>

              <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 p-4 space-y-3">
                <p className="text-sm font-black text-rose-100">استرجاع كامل</p>
                <p className="text-xs leading-relaxed text-rose-200/90">
                  ده بيمسح الجداول الموجودة في النسخة وبعدين يرجّعها من الملف من أول وجديد. استخدمه بس لو عاوز ترجع snapshot شبه مطابقة.
                </p>
                <input
                  value={replaceConfirm}
                  onChange={(event) => setReplaceConfirm(event.target.value)}
                  placeholder='اكتب: استرجاع كامل'
                  className="w-full rounded-2xl border border-rose-500/20 bg-[#0a0d14] px-4 py-3 text-sm text-white placeholder:text-rose-200/50 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
                <button
                  type="button"
                  onClick={handleReplaceRestore}
                  disabled={!restoreFile || isPreviewLoading || isRestoring || isReplacing}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-3 font-black text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReplacing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  استرجاع كامل
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-surface-hover bg-background/40 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-white">معاينة الملف</h3>
                <p className="text-sm text-gray-400">راجع الجداول وعدد الصفوف قبل ما تبدأ.</p>
              </div>
              {isPreviewLoading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            </div>

            {previewMeta ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-3">
                    <p className="text-xs text-gray-400 mb-1">نوع النسخة</p>
                    <p className="font-black text-white">{previewMeta.scopeLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-3">
                    <p className="text-xs text-gray-400 mb-1">إجمالي الصفوف</p>
                    <p className="font-black text-white">{previewMeta.totalRows.toLocaleString()}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm text-gray-300">
                  <p className="mb-1">عدد الجداول: <span className="font-black text-white">{previewMeta.totalTables}</span></p>
                  <p>
                    وقت التصدير:{' '}
                    <span className="font-black text-white">
                      {previewMeta.exportedAt ? new Date(previewMeta.exportedAt).toLocaleString('ar-EG') : 'غير متوفر'}
                    </span>
                  </p>
                </div>

                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {previewRows.map((row) => (
                    <div key={row.table} className="flex items-center justify-between rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-sm">
                      <span className="font-bold text-white">{row.label}</span>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                        {row.count.toLocaleString()} صف
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-surface-hover bg-surface/50 p-8 text-center text-sm text-gray-400 leading-relaxed">
                ارفع ملف JSON الأول، وإحنا هنطلع لك ملخص كامل قبل ما تدوس استرجاع.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
