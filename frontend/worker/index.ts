/// <reference lib="webworker" />

// To disable all workbox logging during development, you can set self.__WB_DISABLE_DEV_LOGS to true
// https://developers.google.com/web/tools/workbox/guides/configure-workbox#disable_logging

self.addEventListener('push', (event: any) => {
  const data = JSON.parse(event?.data?.text() || '{}');

  event.waitUntil(
    (async () => {
      const clientList = await (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasVisibleClient = clientList.some((client: any) => client.visibilityState === 'visible' || client.focused);

      if (hasVisibleClient && data.data?.allowWhileVisible !== true) {
        return;
      }

      const notificationOptions: Record<string, any> = {
        body: data.body || "لديك إشعار جديد",
        icon: data.icon || '/notification-icon-192.png',
        image: data.image || '/notification-icon-512.png',
        vibrate: data.vibrate || [180, 80, 220, 80, 320],
        requireInteraction: data.requireInteraction ?? true,
        renotify: data.renotify ?? true,
        silent: data.silent ?? false,
        dir: data.dir || 'rtl',
        lang: data.lang || 'ar-EG',
        tag: data.tag || 'fi-elsekka-notification',
        data: data.data || {},
        actions: data.data?.url ? [
          { action: 'open', title: 'افتح دلوقتي' }
        ] : undefined
      };

      if (data.badge) {
        notificationOptions.badge = data.badge;
      }

      return (self as any).registration.showNotification(data.title || "في السكة", notificationOptions);
    })()
  );
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        if ('navigate' in client) {
          client.navigate(targetUrl);
        }
        return client.focus();
      }
      return (self as any).clients.openWindow(targetUrl);
    })
  );
});
