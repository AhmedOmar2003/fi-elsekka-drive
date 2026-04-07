import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';
import {
  BACKUP_RESTORE_ORDER,
  BACKUP_SCOPE_ORDER,
  BACKUP_SCOPES,
  BACKUP_TABLE_LABELS,
  BACKUP_TABLE_KEYS,
  type BackupScope,
  isBackupScope,
} from '@/lib/admin-backup';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

type BackupPayload = {
  exportedAt?: string;
  scope?: BackupScope;
  scopeLabel?: string;
  tables?: Record<string, any[]>;
  counts?: Record<string, number>;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parsePayload(text: string): BackupPayload {
  const parsed = JSON.parse(text);

  if (!isPlainObject(parsed) || !isPlainObject(parsed.tables)) {
    throw new Error('الملف ده مش باين إنه نسخة Backup صحيحة من في السكة');
  }

  const scope = isBackupScope(parsed.scope as string) ? (parsed.scope as BackupScope) : 'full';
  const tables = Object.fromEntries(
    Object.entries(parsed.tables).map(([tableName, rows]) => [tableName, Array.isArray(rows) ? rows : []])
  );

  return {
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
    scope,
    scopeLabel: typeof parsed.scopeLabel === 'string' ? parsed.scopeLabel : BACKUP_SCOPES[scope].label,
    tables,
    counts: isPlainObject(parsed.counts) ? (parsed.counts as Record<string, number>) : undefined,
  };
}

function getOrderedTables(tableMap: Record<string, any[]>) {
  const preferred = BACKUP_RESTORE_ORDER.filter((tableName) => tableName in tableMap);
  const remaining = Object.keys(tableMap).filter((tableName) => !preferred.includes(tableName as any));
  return [...preferred, ...remaining];
}

function getUpsertConflictColumn(rows: any[]) {
  const sample = rows.find((row) => isPlainObject(row));
  if (!sample) return null;
  if ('id' in sample) return 'id';
  if ('endpoint' in sample) return 'endpoint';
  return null;
}

async function upsertRows(tableName: string, rows: any[]) {
  if (!supabaseAdmin || rows.length === 0) {
    return 0;
  }

  const batchSize = 200;
  const onConflict = getUpsertConflictColumn(rows);
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const query = supabaseAdmin
      .from(tableName)
      .upsert(batch, onConflict ? { onConflict } : undefined as any);

    const { error } = await query;
    if (error) {
      throw new Error(`تعذر استرجاع جدول ${BACKUP_TABLE_LABELS[tableName] || tableName}: ${error.message}`);
    }

    processed += batch.length;
  }

  return processed;
}

async function insertRows(tableName: string, rows: any[]) {
  if (!supabaseAdmin || rows.length === 0) {
    return 0;
  }

  const batchSize = 200;
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabaseAdmin
      .from(tableName)
      .insert(batch);

    if (error) {
      throw new Error(`تعذر إدخال بيانات جدول ${BACKUP_TABLE_LABELS[tableName] || tableName}: ${error.message}`);
    }

    processed += batch.length;
  }

  return processed;
}

async function deleteTableRows(tableName: string) {
  if (!supabaseAdmin) return 0;

  const key = BACKUP_TABLE_KEYS[tableName];
  if (!key) {
    throw new Error(`جدول ${tableName} مش متجهز حاليًا للاسترجاع الكامل`);
  }

  const batchSize = 500;
  let deleted = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select(key)
      .limit(batchSize);

    if (error) {
      throw new Error(`تعذر قراءة جدول ${BACKUP_TABLE_LABELS[tableName] || tableName} قبل المسح: ${error.message}`);
    }

    const values = (data || [])
      .map((row: any) => row?.[key])
      .filter((value: any) => value !== null && value !== undefined);

    if (values.length === 0) {
      break;
    }

    const { error: deleteError } = await supabaseAdmin
      .from(tableName)
      .delete()
      .in(key, values);

    if (deleteError) {
      throw new Error(`تعذر مسح بيانات جدول ${BACKUP_TABLE_LABELS[tableName] || tableName}: ${deleteError.message}`);
    }

    deleted += values.length;

    if (values.length < batchSize) {
      break;
    }
  }

  return deleted;
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
  }

  const auth = await requireAdminApi(request, 'manage_settings');
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get('file');
  const mode = formData.get('mode');
  const confirmText = String(formData.get('confirm') || '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ارفع ملف الـ backup الأول' }, { status: 400 });
  }

  if (mode !== 'preview' && mode !== 'restore' && mode !== 'replace') {
    return NextResponse.json({ error: 'الوضع المطلوب غير معروف' }, { status: 400 });
  }

  try {
    const payload = parsePayload(await file.text());
    const tables = payload.tables || {};
    const orderedTables = getOrderedTables(tables);
    const summary = orderedTables.map((tableName) => ({
      table: tableName,
      label: BACKUP_TABLE_LABELS[tableName] || tableName,
      count: Array.isArray(tables[tableName]) ? tables[tableName].length : 0,
    }));

    if (mode === 'preview') {
      return NextResponse.json({
        scope: payload.scope || 'full',
        scopeLabel: payload.scopeLabel || BACKUP_SCOPES.full.label,
        exportedAt: payload.exportedAt || null,
        totalTables: summary.length,
        totalRows: summary.reduce((sum, row) => sum + row.count, 0),
        summary,
      });
    }

    const restored: Array<{ table: string; label: string; count: number }> = [];

    if (mode === 'replace') {
      if (confirmText.trim() !== 'استرجاع كامل') {
        return NextResponse.json(
          { error: 'اكتب "استرجاع كامل" الأول علشان نضمن إن القرار مقصود.' },
          { status: 400 }
        );
      }

      const deleteOrder = [...orderedTables].reverse();
      for (const tableName of deleteOrder) {
        await deleteTableRows(tableName);
      }

      for (const tableName of orderedTables) {
        const rows = Array.isArray(tables[tableName]) ? tables[tableName] : [];
        const count = await insertRows(tableName, rows);
        restored.push({
          table: tableName,
          label: BACKUP_TABLE_LABELS[tableName] || tableName,
          count,
        });
      }

      return NextResponse.json({
        ok: true,
        mode: 'replace',
        scope: payload.scope || 'full',
        scopeLabel: payload.scopeLabel || BACKUP_SCOPES.full.label,
        restoredAt: new Date().toISOString(),
        totalTables: restored.length,
        totalRows: restored.reduce((sum, row) => sum + row.count, 0),
        restored,
        note: 'الاسترجاع الكامل اشتغل: مسحنا الجداول اللي في النسخة وبعدين رجعنا بياناتها من جديد.',
      });
    }

    for (const tableName of orderedTables) {
      const rows = Array.isArray(tables[tableName]) ? tables[tableName] : [];
      const count = await upsertRows(tableName, rows);
      restored.push({
        table: tableName,
        label: BACKUP_TABLE_LABELS[tableName] || tableName,
        count,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: 'restore',
      scope: payload.scope || 'full',
      scopeLabel: payload.scopeLabel || BACKUP_SCOPES.full.label,
      restoredAt: new Date().toISOString(),
      totalTables: restored.length,
      totalRows: restored.reduce((sum, row) => sum + row.count, 0),
      restored,
      note: 'الاسترجاع ده بيعمل دمج وتحديث للبيانات الموجودة، مش مسح كامل للقاعدة.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر قراءة ملف النسخة الاحتياطية' },
      { status: 500 }
    );
  }
}
