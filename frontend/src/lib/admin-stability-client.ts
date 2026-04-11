"use client";

export const ADMIN_LIGHT_MODE_STORAGE_KEY = "waslni:admin:light-mode";
export const ADMIN_LIGHT_MODE_EVENT = "waslni:admin:light-mode-updated";

export function readAdminLightMode(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ADMIN_LIGHT_MODE_STORAGE_KEY) === "1";
}

export function writeAdminLightMode(enabled: boolean) {
    if (typeof window === "undefined") return;
    if (enabled) {
        window.localStorage.setItem(ADMIN_LIGHT_MODE_STORAGE_KEY, "1");
    } else {
        window.localStorage.removeItem(ADMIN_LIGHT_MODE_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(ADMIN_LIGHT_MODE_EVENT, { detail: { enabled } }));
}
