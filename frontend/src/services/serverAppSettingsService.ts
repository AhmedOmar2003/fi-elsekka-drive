import 'server-only'

import { createClient } from '@supabase/supabase-js'
import {
  APP_SETTINGS_ID,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from '@/services/appSettingsService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getPublicServerSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key are required.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizeServerSettings(data: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...(data || {}),
    defaultShippingCost: String(data?.defaultShippingCost ?? DEFAULT_APP_SETTINGS.defaultShippingCost),
    freeShippingThreshold: String(data?.freeShippingThreshold ?? DEFAULT_APP_SETTINGS.freeShippingThreshold),
  }
}

export async function fetchPublicAppSettingsServer(): Promise<AppSettings> {
  const supabase = getPublicServerSupabase()

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
    .maybeSingle()

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
      : withWhatsAppColumns

  const { data, error } = result

  if (error || !data) {
    return DEFAULT_APP_SETTINGS
  }

  return normalizeServerSettings({
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
  })
}
