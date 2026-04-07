import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordServerAdminAudit } from '@/lib/admin-audit-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

export async function POST(request: Request) {
    // Updating drivers should be limited to assign_driver-capable staff
    const auth = await requireAdminApi(request, 'assign_driver');
    if (!auth.ok) return auth.response;

    try {
        if (!serviceRoleKey || !supabaseUrl) {
            return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { driverId, full_name, phone, email, password } = await request.json();

        if (!driverId) {
            return NextResponse.json({ error: 'Missing driverId' }, { status: 400 });
        }

        // Build auth update payload
        const authUpdatePayload: any = {
            user_metadata: { role: 'driver', full_name, phone }
        };
        if (email) authUpdatePayload.email = email;
        if (password) authUpdatePayload.password = password;

        // 1. Update auth user (metadata + optional email/password)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(driverId, authUpdatePayload);
        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        // 2. Sync public.users table
        const publicUpdate: any = { full_name, phone };
        if (email) publicUpdate.email = email;

        const { error: dbError } = await supabaseAdmin
            .from('users')
            .update(publicUpdate)
            .eq('id', driverId);

        if (dbError) {
            console.error('Failed to sync public.users:', dbError);
            // Don't fail — auth was updated which is the source of truth
        }

        await recordServerAdminAudit(auth.profile, {
            action: 'driver.update',
            entityType: 'driver',
            entityId: driverId,
            entityLabel: full_name || email || driverId,
            details: { full_name, phone, email, password_changed: Boolean(password) },
        });

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('API Error /update-driver:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
