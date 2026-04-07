export const BACKUP_SCOPES = {
  full: {
    label: 'نسخة كاملة',
    description: 'كل الجداول الأساسية اللي محتاجها لو حبيت ترجع الشغل أو تنقله.',
    tables: [
      'app_settings',
      'users',
      'categories',
      'restaurants',
      'products',
      'product_specifications',
      'promotions',
      'discount_codes',
      'orders',
      'order_items',
      'delivery_info',
      'reviews',
      'driver_reviews',
      'notifications',
      'favorites',
      'cart_items',
      'driver_subscriptions',
      'user_subscriptions',
      'site_visits',
      'site_page_views',
      'admin_audit_logs',
    ],
  },
  catalog: {
    label: 'المنتجات والأقسام',
    description: 'المنتجات، الأقسام، المواصفات، العروض، وأكواد الخصم.',
    tables: ['categories', 'restaurants', 'products', 'product_specifications', 'promotions', 'discount_codes'],
  },
  operations: {
    label: 'الطلبات والتشغيل',
    description: 'الطلبات، العناصر، الإشعارات، ومعلومات التوصيل.',
    tables: ['orders', 'order_items', 'delivery_info', 'notifications'],
  },
  users: {
    label: 'المستخدمين والتفاعل',
    description: 'المستخدمين، التقييمات، المفضلة، السلة، واشتراكات الإشعارات.',
    tables: ['users', 'reviews', 'driver_reviews', 'favorites', 'cart_items', 'driver_subscriptions', 'user_subscriptions'],
  },
} as const;

export type BackupScope = keyof typeof BACKUP_SCOPES;

export const BACKUP_SCOPE_ORDER: BackupScope[] = ['full', 'catalog', 'operations', 'users'];

export const BACKUP_TABLE_LABELS: Record<string, string> = {
  app_settings: 'إعدادات التطبيق',
  users: 'المستخدمين',
  categories: 'الأقسام',
  restaurants: 'المطاعم',
  products: 'المنتجات',
  product_specifications: 'مواصفات المنتجات',
  promotions: 'العروض الترويجية',
  discount_codes: 'أكواد الخصم',
  orders: 'الطلبات',
  order_items: 'عناصر الطلبات',
  delivery_info: 'بيانات التوصيل',
  reviews: 'تقييمات المنتجات',
  driver_reviews: 'تقييمات المندوبين',
  notifications: 'الإشعارات',
  favorites: 'المفضلة',
  cart_items: 'عناصر السلة',
  driver_subscriptions: 'اشتراكات المندوبين',
  user_subscriptions: 'اشتراكات العملاء',
  site_visits: 'الزيارات',
  site_page_views: 'مرات فتح الصفحات',
  admin_audit_logs: 'سجل الإدارة',
};

export const BACKUP_RESTORE_ORDER = [
  'app_settings',
  'users',
  'categories',
  'restaurants',
  'products',
  'product_specifications',
  'promotions',
  'discount_codes',
  'orders',
  'order_items',
  'delivery_info',
  'reviews',
  'driver_reviews',
  'notifications',
  'favorites',
  'cart_items',
  'driver_subscriptions',
  'user_subscriptions',
  'site_visits',
  'site_page_views',
  'admin_audit_logs',
] as const;

export const BACKUP_TABLE_KEYS: Record<string, string> = {
  app_settings: 'id',
  users: 'id',
  categories: 'id',
  restaurants: 'id',
  products: 'id',
  product_specifications: 'id',
  promotions: 'id',
  discount_codes: 'id',
  orders: 'id',
  order_items: 'id',
  delivery_info: 'id',
  reviews: 'id',
  driver_reviews: 'id',
  notifications: 'id',
  favorites: 'id',
  cart_items: 'id',
  driver_subscriptions: 'id',
  user_subscriptions: 'id',
  site_visits: 'id',
  site_page_views: 'id',
  admin_audit_logs: 'id',
};

export function isBackupScope(value: string | null | undefined): value is BackupScope {
  return !!value && value in BACKUP_SCOPES;
}

export function getBackupTables(scope: BackupScope) {
  return BACKUP_SCOPES[scope].tables;
}

export function getBackupFileBase(scope: BackupScope, exportedAt = new Date()) {
  const safe = exportedAt.toISOString().replace(/[:.]/g, '-');
  return `fi-elsekka-backup-${scope}-${safe}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function normalizeBackupCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function buildExcelBackupXml(payload: {
  scope: BackupScope;
  exportedAt: string;
  tables: Record<string, any[]>;
}) {
  const worksheetParts: string[] = [];

  const summaryRows = [
    ['نوع النسخة', BACKUP_SCOPES[payload.scope].label],
    ['وقت التصدير', payload.exportedAt],
    ['عدد الجداول', String(Object.keys(payload.tables).length)],
    ...Object.entries(payload.tables).map(([table, rows]) => [
      BACKUP_TABLE_LABELS[table] || table,
      String(rows.length),
    ]),
  ];

  worksheetParts.push(`
    <Worksheet ss:Name="ملخص">
      <Table>
        ${summaryRows
          .map(
            (row) => `
          <Row>
            ${row
              .map(
                (cell) => `<Cell><Data ss:Type="String">${escapeXml(normalizeBackupCell(cell))}</Data></Cell>`
              )
              .join('')}
          </Row>`
          )
          .join('')}
      </Table>
    </Worksheet>
  `);

  for (const [tableName, rows] of Object.entries(payload.tables)) {
    const headers = rows.length > 0
      ? Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))))
      : ['message'];

    const safeSheetName = (BACKUP_TABLE_LABELS[tableName] || tableName).slice(0, 31);

    worksheetParts.push(`
      <Worksheet ss:Name="${escapeXml(safeSheetName)}">
        <Table>
          <Row>
            ${headers
              .map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
              .join('')}
          </Row>
          ${
            rows.length > 0
              ? rows
                  .map(
                    (row) => `
                <Row>
                  ${headers
                    .map((header) => {
                      const value = normalizeBackupCell(row?.[header]);
                      return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
                    })
                    .join('')}
                </Row>`
                  )
                  .join('')
              : `<Row><Cell><Data ss:Type="String">لا توجد بيانات في الجدول ده حاليًا</Data></Cell></Row>`
          }
        </Table>
      </Worksheet>
    `);
  }

  return `<?xml version="1.0"?>
  <?mso-application progid="Excel.Sheet"?>
  <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:html="http://www.w3.org/TR/REC-html40">
    <Styles>
      <Style ss:ID="Default" ss:Name="Normal">
        <Alignment ss:Vertical="Bottom"/>
        <Font ss:FontName="Cairo" ss:Size="11"/>
      </Style>
    </Styles>
    ${worksheetParts.join('')}
  </Workbook>`;
}
