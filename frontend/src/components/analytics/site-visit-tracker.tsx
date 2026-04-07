"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const VISITOR_ID_KEY = 'fi-elsekka-visitor-id';
const SESSION_ID_KEY = 'fi-elsekka-session-id';
const LAST_PATH_KEY = 'fi-elsekka-last-path';
const EXCLUDED_PREFIXES = ['/admin', '/driver', '/system-access', '/api', '/_next'];
const PAGE_VIEW_DEBOUNCE_MS = 5000;

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function getVisitorId() {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const next = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(VISITOR_ID_KEY, next);
    return next;
}

function getSessionId() {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;

    const next = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.sessionStorage.setItem(SESSION_ID_KEY, next);
    return next;
}

export function SiteVisitTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname || EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
            return;
        }

        const visitKey = `fi-elsekka-site-visit:${todayKey()}`;
        const visitorId = getVisitorId();
        const sessionId = getSessionId();
        const previousPath = window.sessionStorage.getItem(LAST_PATH_KEY) || null;
        const pageViewKey = `fi-elsekka-page-view:${pathname}`;
        const lastPageViewAt = Number(window.sessionStorage.getItem(pageViewKey) || 0);
        const now = Date.now();
        if (now - lastPageViewAt < PAGE_VIEW_DEBOUNCE_MS) {
            return;
        }

        window.sessionStorage.setItem(pageViewKey, String(now));
        window.sessionStorage.setItem(LAST_PATH_KEY, pathname);
        const shouldCountVisitor = window.localStorage.getItem(visitKey) !== '1';
        if (shouldCountVisitor) {
            window.localStorage.setItem(visitKey, '1');
        }

        fetch('/api/analytics/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: pathname,
                visitorId,
                sessionId,
                previousPath,
            }),
            keepalive: true,
        }).then(async (res) => {
            if (!res.ok && shouldCountVisitor) {
                window.localStorage.removeItem(visitKey);
            }
        }).catch(() => {
            if (shouldCountVisitor) {
                window.localStorage.removeItem(visitKey);
            }
            // Ignore transient visit tracking failures so navigation stays smooth.
        });
    }, [pathname]);

    return null;
}
