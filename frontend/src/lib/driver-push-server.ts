import webpush from 'web-push';
import { sendMobilePushToDriverDevices } from './mobile-push-server';

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';
const contactEmail = 'mailto:admin@fielsekka.com';

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(contactEmail, publicVapidKey, privateVapidKey);
}

type DriverPushPayload = {
  title: string;
  message: string;
  link?: string;
  requireInteraction?: boolean;
  topic?: string;
};

function buildDriverPushPayload(payload: DriverPushPayload) {
  const notificationLink = payload.link || '/driver';

  return JSON.stringify({
    title: payload.title.startsWith('في السكة') ? payload.title : `في السكة | ${payload.title}`,
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

export async function sendPushToDriverDevices(
  supabaseAdmin: any,
  driverId: string,
  payload: DriverPushPayload
) {
  if (!supabaseAdmin || !driverId || !publicVapidKey || !privateVapidKey) {
    return sendMobilePushToDriverDevices(supabaseAdmin, driverId, payload);
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from('driver_subscriptions')
    .select('subscription')
    .eq('driver_id', driverId);

  if (error) {
    console.error('Failed to fetch driver push subscriptions:', error);
    return { success: false, skipped: false, devicesNotified: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, skipped: true, devicesNotified: 0 };
  }

  const uniqueSubscriptions = subscriptions.filter((record: any, index: number, all: any[]) => {
    const endpoint = record.subscription?.endpoint;
    return !!endpoint && all.findIndex((item: any) => item.subscription?.endpoint === endpoint) === index;
  });

  const pushPayload = buildDriverPushPayload(payload);

  await Promise.all(
    uniqueSubscriptions.map(async (subscriptionRecord: any) => {
      try {
        await webpush.sendNotification(subscriptionRecord.subscription, pushPayload, {
          TTL: 30,
          urgency: 'high',
          topic: payload.topic || 'driver-assignment'
        });
      } catch (pushError: any) {
        if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
          await supabaseAdmin
            .from('driver_subscriptions')
            .delete()
            .eq('subscription->>endpoint', subscriptionRecord.subscription?.endpoint || '');
        } else {
          console.error('Failed to send driver push notification:', pushError);
        }
      }
    })
  );

  const mobileResult = await sendMobilePushToDriverDevices(
    supabaseAdmin,
    driverId,
    payload
  );

  return {
    success: true,
    skipped: false,
    devicesNotified:
      uniqueSubscriptions.length + mobileResult.devicesNotified,
  };
}
