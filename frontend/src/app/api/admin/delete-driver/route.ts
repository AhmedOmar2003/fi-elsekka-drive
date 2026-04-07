import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordServerAdminAudit } from '@/lib/admin-audit-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || ''; // Must be in .env.local

export async function DELETE(request: Request) {
    // Only admins or staff with assign_driver can remove drivers
    const auth = await requireAdminApi(request, 'assign_driver');
    if (!auth.ok) return auth.response;

    try {
        if (!serviceRoleKey || !supabaseUrl) {
            return NextResponse.json({ error: 'Server misconfiguration: missing service role key.' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        const { searchParams } = new URL(request.url);
        const driverId = searchParams.get('id');

        if (!driverId) {
            return NextResponse.json({ error: 'Missing driver ID' }, { status: 400 });
        }

        // Safety check: confirm the user is a driver via auth metadata (more reliable than public.users)
        const { data: { user: userToDelete }, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(driverId);

        if (fetchError || !userToDelete) {
            return NextResponse.json({ error: 'Driver not found in auth' }, { status: 404 });
        }

        if (userToDelete.user_metadata?.role !== 'driver') {
            return NextResponse.json({ error: 'Can only delete drivers' }, { status: 403 });
        }

        // 1. Delete from public.users (cascade may handle this, but explicit is safer)
        await supabaseAdmin.from('users').delete().eq('id', driverId);
        
        // 2. Delete from auth.users (removes login access entirely)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(driverId);

        if (authError) {
             console.error('Failed to delete auth user:', authError);
             return NextResponse.json({ error: 'Failed to delete driver authentication: ' + authError.message }, { status: 500 });
        }

        await recordServerAdminAudit(auth.profile, {
            action: 'driver.delete',
            entityType: 'driver',
            entityId: driverId,
            entityLabel: userToDelete.email || driverId,
            severity: 'critical',
            details: {
                email: userToDelete.email || null,
                full_name: userToDelete.user_metadata?.full_name || null,
            },
        });

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('API Error /delete-driver:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
