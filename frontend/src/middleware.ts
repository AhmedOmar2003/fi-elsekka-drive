import { NextRequest, NextResponse } from 'next/server';
import { getFirstAccessibleAdminPath, requiredPermissionForPath } from './lib/permissions';

type TokenClaims = {
    role: string | null;
    permissions: string[];
    disabled: boolean;
    exp: number | null;
};

const ALLOWED_ROLES = ['super_admin', 'operations_manager', 'catalog_manager', 'support_agent', 'admin'];

function parseSupabaseCookieValue(rawValue: string): string | null {
    try {
        const decoded = decodeURIComponent(rawValue);
        const parsed = JSON.parse(decoded);
        if (typeof parsed === 'string') return parsed;
        if (Array.isArray(parsed) && typeof parsed[0] === 'string') return parsed[0];
        if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
            const token = (parsed as { access_token?: unknown }).access_token;
            return typeof token === 'string' ? token : null;
        }
        return decoded || null;
    } catch {
        try {
            return decodeURIComponent(rawValue);
        } catch {
            return rawValue || null;
        }
    }
}

function extractTokenFromCookieHeader(cookie: string): string | null {
    const cookieEntries = cookie
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex === -1) return [part, ''] as const;
            return [
                part.slice(0, separatorIndex).trim(),
                part.slice(separatorIndex + 1).trim(),
            ] as const;
        });

    const directCookie = cookieEntries.find(([name]) =>
        name === 'sb-access-token' || /(^sb-.*-auth-token$)/.test(name)
    );
    if (directCookie) {
        return parseSupabaseCookieValue(directCookie[1]);
    }

    const chunked = cookieEntries
        .map(([name, value]) => {
            const match = name.match(/^(sb-.*-auth-token)\.(\d+)$/);
            if (!match) return null;
            return {
                index: Number(match[2]),
                value,
            };
        })
        .filter((item): item is { index: number; value: string } => item !== null)
        .sort((left, right) => left.index - right.index);

    if (chunked.length > 0) {
        const merged = chunked.map((item) => item.value).join('');
        return parseSupabaseCookieValue(merged);
    }

    return null;
}

function extractAccessToken(request: NextRequest): string | null {
    const header = request.headers.get('authorization');
    if (header?.startsWith('Bearer ')) {
        return header.slice('Bearer '.length);
    }
    return extractTokenFromCookieHeader(request.headers.get('cookie') || '');
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const normalized = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const json = atob(normalized);
        return JSON.parse(json) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function parseTokenClaims(token: string): TokenClaims {
    const payload = decodeJwtPayload(token);
    if (!payload) {
        return { role: null, permissions: [], disabled: true, exp: null };
    }

    const userMetadata = (payload.user_metadata as Record<string, unknown> | undefined) || {};
    const appMetadata = (payload.app_metadata as Record<string, unknown> | undefined) || {};

    const payloadRole = typeof payload.role === 'string' ? payload.role : null;
    const metaRole = typeof userMetadata.role === 'string'
        ? userMetadata.role
        : typeof appMetadata.role === 'string'
            ? appMetadata.role
            : payloadRole;

    const permissionsRaw = [
        ...(Array.isArray(userMetadata.permissions) ? userMetadata.permissions : []),
        ...(Array.isArray(appMetadata.permissions) ? appMetadata.permissions : []),
        ...(Array.isArray(payload.permissions) ? payload.permissions : []),
    ];
    const permissions = permissionsRaw
        .filter((item): item is string => typeof item === 'string')
        .filter((item, index, arr) => arr.indexOf(item) === index);

    const disabled = userMetadata.disabled === true || appMetadata.disabled === true;
    const exp = typeof payload.exp === 'number' ? payload.exp : null;

    return { role: metaRole, permissions, disabled, exp };
}

function isTokenExpired(exp: number | null): boolean {
    if (!exp) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return exp <= nowSeconds;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isAdminPage = pathname.startsWith('/admin');
    const isAdminApi  = pathname.startsWith('/api/admin');

    // Skip the secure admin access pages themselves
    if (pathname.startsWith('/system-access')) {
        return NextResponse.next();
    }

    // Allow password reset/update flow
    if (pathname.startsWith('/update-password')) {
        return NextResponse.next();
    }

    if (!isAdminPage && !isAdminApi) {
        return NextResponse.next();
    }

    // Allow the login page redirect target (internal admin/login was removed,
    // but keep this guard for safety so we don't redirect-loop)
    if (pathname === '/admin/login') {
        return NextResponse.redirect(new URL('/system-access/login', request.url));
    }

    const token = extractAccessToken(request);

    if (!token) {
        if (isAdminApi) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const loginUrl = new URL('/system-access/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    const { role, disabled, permissions, exp } = parseTokenClaims(token);
    const hasValidRole = !!role && ALLOWED_ROLES.includes(role);
    const isAdmin = hasValidRole && !disabled && !isTokenExpired(exp);

    if (!isAdmin || (disabled && role !== 'super_admin')) {
        if (isAdminApi) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }
        const loginUrl = new URL('/system-access/login', request.url);
        loginUrl.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(loginUrl);
    }

    const requiredPerm = requiredPermissionForPath(pathname);
    const hasManageAdmins = permissions?.includes?.('manage_admins');
    const hasFullAdmin = role === 'super_admin' || role === 'admin';

    // Staff page needs manage_admins (or admin/super_admin)
    if (pathname.startsWith('/admin/staff') && !(role === 'super_admin' || role === 'admin' || hasManageAdmins)) {
        if (isAdminApi) {
            return NextResponse.json({ error: 'Forbidden: super admin only' }, { status: 403 });
        }
        const loginUrl = new URL('/admin', request.url);
        loginUrl.searchParams.set('error', 'forbidden');
        return NextResponse.redirect(loginUrl);
    }

    if ((pathname.startsWith('/admin/audit-log') || pathname.startsWith('/admin/search') || pathname.startsWith('/admin/operations')) && !hasFullAdmin) {
        if (isAdminApi) {
            return NextResponse.json({ error: 'Forbidden: full admin access required' }, { status: 403 });
        }
        const redirectUrl = new URL(getFirstAccessibleAdminPath({ role, permissions }), request.url);
        redirectUrl.searchParams.set('error', 'forbidden');
        return NextResponse.redirect(redirectUrl);
    }

    // Per-route permission guard
    if (requiredPerm && !(role === 'super_admin' || role === 'admin' || permissions?.includes(requiredPerm))) {
        if (isAdminApi) {
            return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
        }
        const redirectUrl = pathname.startsWith('/admin')
            ? new URL(getFirstAccessibleAdminPath({ role, permissions }), request.url)
            : new URL('/system-access/login', request.url);
        redirectUrl.searchParams.set('error', 'forbidden');
        return NextResponse.redirect(redirectUrl);
    }

    // If a restricted operator hits /admin root, sendه لأول صفحة مسموح بها له
    if (pathname === '/admin' && !hasFullAdmin) {
        return NextResponse.redirect(new URL(getFirstAccessibleAdminPath({ role, permissions }), request.url));
    }

    // Admin verified — pass through
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/api/admin/:path*',
    ],
};
