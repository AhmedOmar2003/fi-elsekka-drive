"use client";

type InstantDeviceNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function showInstantDeviceNotification(
  payload: InstantDeviceNotificationPayload
) {
  if (typeof window === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  if (document.visibilityState !== "visible") return false;

  const notificationUrl = payload.url || "/";
  const notificationTag = payload.tag || `${notificationUrl}::${payload.title}`;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/notification-icon-512.png",
        dir: "rtl",
        lang: "ar-EG",
        tag: notificationTag,
        data: { url: notificationUrl },
      });
      return true;
    }

    new Notification(payload.title, {
      body: payload.body,
      icon: "/notification-icon-512.png",
      tag: notificationTag,
    });
    return true;
  } catch (error) {
    console.error("Failed to show instant device notification:", error);
    return false;
  }
}
