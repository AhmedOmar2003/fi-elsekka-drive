import { NextResponse } from 'next/server';
import { driverSupabaseAdmin, requireDriverApi } from '@/lib/driver-guard';

export async function POST(request: Request) {
    try {
        if (!driverSupabaseAdmin) {
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }
        const auth = await requireDriverApi(request);
        if (!auth.ok) {
            return auth.response;
        }
        const user = auth.profile.user;

        const { isAvailable } = await request.json();
        
        if (typeof isAvailable !== 'boolean') {
            return NextResponse.json({ error: 'Invalid availability status' }, { status: 400 });
        }

        // Update the driver's availability in the users table
        const { error: updateErr } = await driverSupabaseAdmin
            .from('users')
            .update({ is_available: isAvailable })
            .eq('id', user.id)
            .eq('role', 'driver');

        if (updateErr) throw updateErr;

        // Broadcast the availability change to the admin dashboard instantly
        await driverSupabaseAdmin.channel('admin-notifications').send({
            type: 'broadcast',
            event: 'driver-availability-changed',
            payload: { 
                driverId: user.id, 
                isAvailable,
                driverName: auth.profile.fullName || 'مندوب'
            }
        });

        return NextResponse.json({ success: true, isAvailable });

    } catch (err: any) {
        console.error('API Error /driver/set-availability:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
