import { NextRequest, NextResponse } from 'next/server';
import { extractAccessToken, verifyAdminToken } from './lib/admin-guard';
import { getFirstAccessibleAdminPath, requiredPermissionForPath } from './lib/permissions';

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

    const { isAdmin, role, disabled, permissions } = await verifyAdminToken(token);

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
