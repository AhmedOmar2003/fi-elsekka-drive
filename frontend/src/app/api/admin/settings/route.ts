import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';
import { APP_SETTINGS_ID, DEFAULT_APP_SETTINGS } from '@/services/appSettingsService';
import { createUserNotificationWithPush } from '@/lib/user-push-server';
import { sendPushToDriverDevices } from '@/lib/driver-push-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdminApi(request, 'manage_settings');
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: missing Supabase service credentials.' }, { status: 500 });
    }

    const body = await request.json();
    const { data: existingSettings } = await supabaseAdmin
      .from('app_settings')
      .select('maintenance_mode')
      .eq('id', APP_SETTINGS_ID)
      .maybeSingle();

    const previousMaintenanceMode = existingSettings?.maintenance_mode ?? DEFAULT_APP_SETTINGS.maintenanceMode;
    const nextMaintenanceMode = Boolean(body.maintenanceMode);

    const payload = {
      id: APP_SETTINGS_ID,
      site_name: String(body.siteName || DEFAULT_APP_SETTINGS.siteName).trim(),
      site_tagline: String(body.siteTagline || DEFAULT_APP_SETTINGS.siteTagline).trim(),
      support_phone: String(body.supportPhone || '').trim(),
      support_email: String(body.supportEmail || '').trim(),
      support_whatsapp_1: String(body.supportWhatsApp1 || '').trim(),
      support_whatsapp_2: String(body.supportWhatsApp2 || '').trim(),
      support_whatsapp_3: String(body.supportWhatsApp3 || '').trim(),
      free_shipping_threshold: Number(body.freeShippingThreshold || 0),
      default_shipping_cost: Number(body.defaultShippingCost || DEFAULT_APP_SETTINGS.defaultShippingCost),
      notify_new_orders: Boolean(body.notifyNewOrders),
      notify_new_users: Boolean(body.notifyNewUsers),
      maintenance_mode: nextMaintenanceMode,
      updated_at: new Date().toISOString(),
    };

    let saveResult = await supabaseAdmin
      .from('app_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (saveResult.error && saveResult.error.message.includes('support_whatsapp')) {
      const {
        support_whatsapp_1: _unused1,
        support_whatsapp_2: _unused2,
        support_whatsapp_3: _unused3,
        ...fallbackPayload
      } = payload;

      saveResult = await supabaseAdmin
        .from('app_settings')
        .upsert(fallbackPayload, { onConflict: 'id' })
        .select()
        .single();
    }

    const { data, error } = saveResult;

    if (error) {
      console.error('Failed to save app settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (previousMaintenanceMode !== nextMaintenanceMode) {
      const maintenanceEnabledPayload = {
        title: 'الموقع داخل على صيانة خفيفة',
        message: 'إحنا بنظبط شوية حاجات ونحسن الأداء. استنى علينا شوية وهنرجعلك أسرع وأظبط.',
      };

      const maintenanceDisabledPayload = {
        title: 'رجعنا تاني',
        message: 'الدنيا رجعت تمام. تقدر تكمل طلباتك وتستخدم وصلني بشكل طبيعي دلوقتي.',
      };

      const customerPayload = nextMaintenanceMode ? maintenanceEnabledPayload : maintenanceDisabledPayload;
      const driverPayload = nextMaintenanceMode
        ? {
            title: 'وصلني داخل على صيانة خفيفة',
            message: 'استنى علينا شوية يا بطل. بنظبط الشغل ونرجعلك الطلبات والدنيا ماشية تمام.',
          }
        : {
            title: 'وصلني رجع تمام',
            message: 'نقدر نكمل شغلنا عادي دلوقتي. افتح التطبيق وتابع طلباتك براحتك.',
          };

      const [{ data: customers }, { data: drivers }] = await Promise.all([
        supabaseAdmin
          .from('users')
          .select('id')
          .or('role.is.null,role.eq.user'),
        supabaseAdmin
          .from('users')
          .select('id')
          .eq('role', 'driver'),
      ]);

      await Promise.all([
        Promise.all(
          (customers || [])
            .map((customer: any) => customer.id)
            .filter(Boolean)
            .map((userId: string) =>
              createUserNotificationWithPush(supabaseAdmin, userId, {
                ...customerPayload,
                link: '/notifications',
                requireInteraction: nextMaintenanceMode,
              })
            )
        ),
        Promise.all(
          (drivers || [])
            .map((driver: any) => driver.id)
            .filter(Boolean)
            .map((driverId: string) =>
              sendPushToDriverDevices(supabaseAdmin, driverId, {
                ...driverPayload,
                link: '/driver',
                requireInteraction: nextMaintenanceMode,
              })
            )
        ),
      ]);
    }

    return NextResponse.json({
      success: true,
      settings: {
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
      },
    });
  } catch (error: any) {
    console.error('Admin settings API failed:', error);
    return NextResponse.json({ error: error?.message || 'فشل حفظ الإعدادات' }, { status: 500 });
  }
}
