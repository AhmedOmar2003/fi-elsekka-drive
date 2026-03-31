import { supabase } from '@/lib/supabase';

export type AppSettings = {
  siteName: string;
  siteTagline: string;
  supportPhone: string;
  supportEmail: string;
  supportWhatsApp1: string;
  supportWhatsApp2: string;
  supportWhatsApp3: string;
  freeShippingThreshold: string;
  defaultShippingCost: string;
  notifyNewOrders: boolean;
  notifyNewUsers: boolean;
  maintenanceMode: boolean;
};

export const APP_SETTINGS_ID = 'global';
export const APP_SETTINGS_STORAGE_KEY = 'fi-elsekka:public-app-settings';
export const APP_SETTINGS_UPDATED_EVENT = 'fi-elsekka:app-settings-updated';
let appSettingsTableUnavailable = false;
let appSettingsInflight: Promise<AppSettings> | null = null;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  siteName: 'في السكة',
  siteTagline: 'طلباتك ماشية معاك من غير لف',
  supportPhone: '',
  supportEmail: '',
  supportWhatsApp1: '',
  supportWhatsApp2: '',
  supportWhatsApp3: '',
  freeShippingThreshold: '0',
  defaultShippingCost: '20',
  notifyNewOrders: true,
  notifyNewUsers: true,
  maintenanceMode: false,
};

function normalizeSettings(data: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...(data || {}),
    defaultShippingCost: String(data?.defaultShippingCost ?? DEFAULT_APP_SETTINGS.defaultShippingCost),
    freeShippingThreshold: String(data?.freeShippingThreshold ?? DEFAULT_APP_SETTINGS.freeShippingThreshold),
  };
}

export type SupportWhatsAppEntry = {
  id: string;
  label: string;
  value: string;
  href: string;
};

function toWhatsAppHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/[^\d+]/g, '');
  if (!normalized) return '';
  if (normalized.startsWith('+')) return `https://wa.me/${normalized.slice(1)}`;
  if (normalized.startsWith('00')) return `https://wa.me/${normalized.slice(2)}`;
  return `https://wa.me/${normalized}`;
}

function toWhatsAppDisplayValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return 'رابط واتساب مباشر';
  return trimmed;
}

export function getSupportWhatsAppEntries(settings?: Partial<AppSettings> | null): SupportWhatsAppEntry[] {
  const values = [
    settings?.supportWhatsApp1 || '',
    settings?.supportWhatsApp2 || '',
    settings?.supportWhatsApp3 || '',
  ];

  return values
    .map((value, index) => {
      const trimmed = value.trim();
      if (!trimmed) return null;

      return {
        id: `whatsapp-${index + 1}`,
        label: index === 0 ? 'كلمنا على الواتساب' : `واتساب إضافي ${index}`,
        value: toWhatsAppDisplayValue(trimmed),
        href: toWhatsAppHref(trimmed),
      };
    })
    .filter((entry): entry is SupportWhatsAppEntry => Boolean(entry?.href));
}

export function readCachedAppSettings(): AppSettings | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function emitAppSettingsUpdate(settings: AppSettings) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(
      new CustomEvent(APP_SETTINGS_UPDATED_EVENT, {
        detail: settings,
      })
    );
  } catch {
    // Ignore local persistence errors and keep UI functional.
  }
}

export async function fetchPublicAppSettings(): Promise<AppSettings> {
  if (appSettingsTableUnavailable) {
    return DEFAULT_APP_SETTINGS;
  }

  if (appSettingsInflight) {
    return appSettingsInflight;
  }

  appSettingsInflight = (async () => {
    const withWhatsAppColumns = await supabase
      .from('app_settings')
      .select(`
        site_name,
        site_tagline,
        support_phone,
        support_email,
        support_whatsapp_1,
        support_whatsapp_2,
        support_whatsapp_3,
        free_shipping_threshold,
        default_shipping_cost,
        notify_new_orders,
        notify_new_users,
        maintenance_mode
      `)
      .eq('id', APP_SETTINGS_ID)
      .maybeSingle();

    const result =
      withWhatsAppColumns.error && withWhatsAppColumns.error.message.includes('support_whatsapp')
        ? await supabase
            .from('app_settings')
            .select(`
              site_name,
              site_tagline,
              support_phone,
              support_email,
              free_shipping_threshold,
              default_shipping_cost,
              notify_new_orders,
              notify_new_users,
              maintenance_mode
            `)
            .eq('id', APP_SETTINGS_ID)
            .maybeSingle()
        : withWhatsAppColumns;

    const { data, error } = result;

    if (error || !data) {
      const errorMessage = error?.message || '';
      if (
        error?.code === 'PGRST205' ||
        error?.code == '42P01' ||
        errorMessage.includes("Could not find the table 'public.app_settings'") ||
        errorMessage.toLowerCase().includes('not found')
      ) {
        appSettingsTableUnavailable = true;
      }
      return DEFAULT_APP_SETTINGS;
    }

    const normalized = normalizeSettings({
      siteName: data.site_name,
      siteTagline: data.site_tagline,
      supportPhone: data.support_phone,
      supportEmail: data.support_email,
      supportWhatsApp1: 'support_whatsapp_1' in data ? (data as any).support_whatsapp_1 : '',
      supportWhatsApp2: 'support_whatsapp_2' in data ? (data as any).support_whatsapp_2 : '',
      supportWhatsApp3: 'support_whatsapp_3' in data ? (data as any).support_whatsapp_3 : '',
      freeShippingThreshold: String(data.free_shipping_threshold ?? DEFAULT_APP_SETTINGS.freeShippingThreshold),
      defaultShippingCost: String(data.default_shipping_cost ?? DEFAULT_APP_SETTINGS.defaultShippingCost),
      notifyNewOrders: data.notify_new_orders ?? DEFAULT_APP_SETTINGS.notifyNewOrders,
      notifyNewUsers: data.notify_new_users ?? DEFAULT_APP_SETTINGS.notifyNewUsers,
      maintenanceMode: data.maintenance_mode ?? DEFAULT_APP_SETTINGS.maintenanceMode,
    });

    emitAppSettingsUpdate(normalized);
    return normalized;
  })();

  try {
    return await appSettingsInflight;
  } finally {
    appSettingsInflight = null;
  }
}

export async function saveAdminAppSettings(settings: AppSettings) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('الجلسة غير متاحة حالياً');
  }

  const response = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(settings),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'فشل حفظ الإعدادات');
  }

  const normalized = normalizeSettings(payload?.settings);
  emitAppSettingsUpdate(normalized);
  return normalized;
}
