import webpush from 'web-push';
import { sendMobilePushToUserDevices } from './mobile-push-server';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';
const contactEmail = 'mailto:admin@fielsekka.com';

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(contactEmail, publicVapidKey, privateVapidKey);
}

type PushNotificationPayload = {
  title: string;
  message: string;
  link?: string;
  requireInteraction?: boolean;
  topic?: string;
};

function buildPushPayload(payload: PushNotificationPayload) {
  const title = payload.title.startsWith('وصلني')
    ? payload.title
    : `وصلني | ${payload.title}`;
  const notificationLink = payload.link || '/notifications';

  return JSON.stringify({
    title,
    body: payload.message,
    icon: '/notification-icon-512.png',
    image: '/notification-icon-512.png',
    silent: false,
    requireInteraction: payload.requireInteraction ?? true,
    renotify: true,
    dir: 'rtl',
    lang: 'ar-EG',
    vibrate: [180, 80, 220, 80, 320],
    tag: `${notificationLink}::${payload.title}`,
    timestamp: Date.now(),
    data: {
      url: notificationLink,
      allowWhileVisible: false,
    },
  });
}

export async function sendPushToUserDevices(
  supabaseAdmin: any,
  userId: string,
  payload: PushNotificationPayload
) {
  if (!supabaseAdmin || !userId || !publicVapidKey || !privateVapidKey) {
    const mobileResult = await sendMobilePushToUserDevices(
      supabaseAdmin,
      userId,
      payload
    );
    return {
      success: mobileResult.success,
      skipped: mobileResult.skipped,
      devicesNotified: mobileResult.devicesNotified,
      failedDevices: 0,
    };
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from('user_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to fetch user push subscriptions:', error);
    return { success: false, skipped: false, devicesNotified: 0, failedDevices: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, skipped: true, devicesNotified: 0, failedDevices: 0 };
  }

  const uniqueSubscriptions = subscriptions.filter((record: any, index: number, all: any[]) => {
    const endpoint = record.endpoint || record.subscription?.endpoint;
    return !!endpoint && all.findIndex((item: any) => (item.endpoint || item.subscription?.endpoint) === endpoint) === index;
  });

  const pushPayload = buildPushPayload(payload);
  let devicesNotified = 0;
  let failedDevices = 0;

  await Promise.all(
    uniqueSubscriptions.map(async (subscriptionRecord: any) => {
      try {
        await webpush.sendNotification(subscriptionRecord.subscription, pushPayload, {
          TTL: 30,
          urgency: 'high',
          topic: payload.topic || 'customer-notification',
        });
        devicesNotified += 1;
      } catch (pushError: any) {
        failedDevices += 1;
        if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
          await supabaseAdmin
            .from('user_subscriptions')
            .delete()
            .eq('endpoint', subscriptionRecord.endpoint);
        } else {
          console.error('Failed to send user push notification:', pushError);
        }
      }
    })
  );

  const mobileResult = await sendMobilePushToUserDevices(
    supabaseAdmin,
    userId,
    payload
  );

  return {
    success: devicesNotified > 0 || mobileResult.success,
    skipped:
      devicesNotified === 0 &&
      failedDevices === 0 &&
      mobileResult.skipped === true,
    devicesNotified: devicesNotified + mobileResult.devicesNotified,
    failedDevices,
  };
}

export async function createUserNotificationWithPush(
  supabaseAdmin: any,
  userId: string,
  payload: PushNotificationPayload
) {
  const { error } = await supabaseAdmin.from('notifications').insert([
    {
      user_id: userId,
      title: payload.title,
      message: payload.message,
      link: payload.link || '/notifications',
      is_read: false,
    },
  ]);

  if (error) {
    console.error('Failed to create in-app notification:', error);
    return { success: false, error, notificationCreated: false, push: null };
  }

  const pushResult = await sendPushToUserDevices(supabaseAdmin, userId, payload);

  return {
    success: true,
    notificationCreated: true,
    push: pushResult,
  };
}

type OrderAwareAdminProfile = {
  id: string;
  role?: string | null;
  permissions?: string[] | null;
  disabled?: boolean | null;
};

function canReceiveOrderAdminNotification(profile: OrderAwareAdminProfile) {
  if (!profile || profile.disabled === true) return false;
  if (profile.role === 'super_admin' || profile.role === 'admin') return true;
  return Array.isArray(profile.permissions) && profile.permissions.includes('view_orders');
}

export async function createOrderAdminNotificationsWithPush(
  supabaseAdmin: any,
  payload: PushNotificationPayload
) {
  const { data: adminUsers, error } = await supabaseAdmin
    .from('users')
    .select('id, role, permissions, disabled')
    .in('role', ['super_admin', 'admin', 'operations_manager', 'catalog_manager', 'support_agent']);

  if (error) {
    console.error('Failed to fetch admin notification recipients:', error);
    return { success: false, recipients: 0, sent: 0 };
  }

  const recipients = ((adminUsers || []) as OrderAwareAdminProfile[]).filter(canReceiveOrderAdminNotification);
  if (recipients.length === 0) {
    return { success: true, recipients: 0, sent: 0 };
  }

  let sent = 0;
  await Promise.all(
    recipients.map(async (recipient) => {
      const result = await createUserNotificationWithPush(supabaseAdmin, recipient.id, payload);
      if (result.success) sent += 1;
    })
  );

  return {
    success: true,
    recipients: recipients.length,
    sent,
  };
}

export async function createRestaurantNotificationsWithPush(
  supabaseAdmin: any,
  restaurantId: string,
  payload: PushNotificationPayload
) {
  if (!supabaseAdmin || !restaurantId) {
    return { success: false, recipients: 0, sent: 0 };
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .select('manager_email')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) {
    console.error('Failed to fetch restaurant notification recipients:', restaurantError);
    return { success: false, recipients: 0, sent: 0 };
  }

  const managerEmail = String(restaurant?.manager_email || '').trim().toLowerCase();
  if (!managerEmail) {
    return { success: true, recipients: 0, sent: 0 };
  }

  const { data: managers, error: managersError } = await supabaseAdmin
    .from('users')
    .select('id, disabled, role, email')
    .eq('role', 'restaurant_manager')
    .ilike('email', managerEmail);

  if (managersError) {
    console.error('Failed to load restaurant manager accounts for notifications:', managersError);
    return { success: false, recipients: 0, sent: 0 };
  }

  const recipients = (managers || []).filter((entry: any) => entry?.disabled !== true && entry?.id);
  if (recipients.length === 0) {
    return { success: true, recipients: 0, sent: 0 };
  }

  let sent = 0;
  await Promise.all(
    recipients.map(async (recipient: any) => {
      const result = await createUserNotificationWithPush(supabaseAdmin, recipient.id, payload);
      if (result.success) sent += 1;
    })
  );

  return {
    success: true,
    recipients: recipients.length,
    sent,
  };
}
