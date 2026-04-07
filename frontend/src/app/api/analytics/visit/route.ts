import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const EXCLUDED_PREFIXES = ['/admin', '/driver', '/system-access', '/api', '/_next'];

function isMissingRelationError(message?: string) {
    const text = String(message || '').toLowerCase();
    return text.includes('does not exist') || text.includes('relation') || text.includes('schema cache');
}

function startOfTodayIso() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
}

export async function POST(request: Request) {
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const path = typeof body?.path === 'string' ? body.path.trim() : '';
        const visitorId = typeof body?.visitorId === 'string' ? body.visitorId.trim() : '';
        const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
        const previousPath = typeof body?.previousPath === 'string' ? body.previousPath.trim() : null;

        if (!path.startsWith('/') || !visitorId || !sessionId) {
            return NextResponse.json({ error: 'Invalid visit payload' }, { status: 400 });
        }

        if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
            return NextResponse.json({ ok: true, skipped: true });
        }

        const { error: pageViewError } = await supabaseAdmin.from('site_page_views').insert({
            visitor_id: visitorId.slice(0, 120),
            session_id: sessionId.slice(0, 120),
            path: path.slice(0, 240),
            previous_path: previousPath?.startsWith('/') ? previousPath.slice(0, 240) : null,
        });

        if (pageViewError && !isMissingRelationError(pageViewError.message)) {
            return NextResponse.json({ error: pageViewError.message }, { status: 500 });
        }

        const todayStart = startOfTodayIso();
        const { count: existingCount, error: existingError } = await supabaseAdmin
            .from('site_visits')
            .select('id', { count: 'exact', head: true })
            .eq('visitor_id', visitorId.slice(0, 120))
            .gte('created_at', todayStart);

        if (existingError) {
            return NextResponse.json({ error: existingError.message }, { status: 500 });
        }

        if ((existingCount || 0) > 0) {
            return NextResponse.json({
                ok: true,
                visitorSkipped: true,
                pageViewTracked: !pageViewError,
                reason: 'already-counted-today',
            });
        }

        const { error } = await supabaseAdmin.from('site_visits').insert({
            visitor_id: visitorId.slice(0, 120),
            path: path.slice(0, 240),
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            pageViewTracked: !pageViewError,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
    }
}
