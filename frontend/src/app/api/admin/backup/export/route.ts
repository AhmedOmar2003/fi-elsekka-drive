import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';
import {
  BACKUP_SCOPES,
  BACKUP_TABLE_KEYS,
  type BackupScope,
  buildExcelBackupXml,
  getBackupFileBase,
  getBackupTables,
  isBackupScope,
} from '@/lib/admin-backup';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

type ExportFormat = 'json' | 'excel';

function isExportFormat(value: string | null): value is ExportFormat {
  return value === 'json' || value === 'excel';
}

async function fetchTableRows(tableName: string) {
  if (!supabaseAdmin) {
    throw new Error('Missing service configuration');
  }

  const batchSize = 1000;
  let from = 0;
  const rows: any[] = [];
  const orderKey = BACKUP_TABLE_KEYS[tableName];

  while (true) {
    let query = supabaseAdmin
      .from(tableName)
      .select('*')
      .range(from, from + batchSize - 1);

    if (orderKey) {
      query = query.order(orderKey, { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`تعذر تحميل جدول ${tableName}: ${error.message}`);
    }

    rows.push(...(data || []));

    if (!data || data.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return rows;
}

async function fetchTableEntries(tables: readonly string[]) {
  const concurrency = 3;
  const entries: Array<readonly [string, any[]]> = [];

  for (let index = 0; index < tables.length; index += concurrency) {
    const chunk = tables.slice(index, index + concurrency);
    const chunkEntries = await Promise.all(
      chunk.map(async (tableName) => [tableName, await fetchTableRows(tableName)] as const)
    );
    entries.push(...chunkEntries);
  }

  return entries;
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
  }

  const auth = await requireAdminApi(request, 'manage_settings');
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const rawScope = searchParams.get('scope');
  const rawFormat = searchParams.get('format');

  const scope: BackupScope = isBackupScope(rawScope) ? rawScope : 'full';
  const format: ExportFormat = isExportFormat(rawFormat) ? rawFormat : 'json';
  const tables = getBackupTables(scope);

  try {
    const tableEntries = await fetchTableEntries(tables);

    const exportedAt = new Date().toISOString();
    const payload = {
      exportedAt,
      scope,
      scopeLabel: BACKUP_SCOPES[scope].label,
      tables: Object.fromEntries(tableEntries),
      counts: Object.fromEntries(tableEntries.map(([tableName, rows]) => [tableName, rows.length])),
    };

    const fileBase = getBackupFileBase(scope, new Date(exportedAt));

    if (format === 'excel') {
      const workbookXml = buildExcelBackupXml({
        scope,
        exportedAt,
        tables: payload.tables,
      });

      return new NextResponse(workbookXml, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileBase}.xls"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'تعذر تجهيز النسخة الاحتياطية دلوقتي' },
      { status: 500 }
    );
  }
}
