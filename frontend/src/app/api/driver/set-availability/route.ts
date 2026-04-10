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

        const nextAvailability = isAvailable ? 'available' : 'offline';
        const { error: updateErr } = await driverSupabaseAdmin
            .from('driver_profiles')
            .update({ availability_status: nextAvailability, last_seen_at: new Date().toISOString() })
            .eq('id', user.id);

        if (updateErr) throw updateErr;

        // Broadcast the availability change to the admin dashboard instantly
        await driverSupabaseAdmin.channel('admin-notifications').send({
            type: 'broadcast',
            event: 'driver-availability-changed',
            payload: { 
                driverId: user.id, 
                isAvailable,
                availabilityStatus: nextAvailability,
                driverName: auth.profile.fullName || 'مندوب'
            }
        });

        return NextResponse.json({ success: true, isAvailable, availabilityStatus: nextAvailability });

    } catch (err: any) {
        console.error('API Error /driver/set-availability:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
