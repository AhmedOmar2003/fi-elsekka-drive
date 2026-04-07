import { NextResponse } from 'next/server';
import { driverSupabaseAdmin, requireDriverApi } from '@/lib/driver-guard';

export async function GET(request: Request) {
    if (!driverSupabaseAdmin) {
        return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
    }

    const auth = await requireDriverApi(request);
    if (!auth.ok) {
        return auth.response;
    }

    const driverId = auth.profile.user.id;
    
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const baseSelect = '*, users!user_id(full_name, phone, email)';

        const [activeResult, deliveredResult] = await Promise.all([
            driverSupabaseAdmin
                .from('orders')
                .select(baseSelect)
                .contains('shipping_address', { driver: { id: driverId } })
                .neq('status', 'delivered')
                .order('created_at', { ascending: false }),
            driverSupabaseAdmin
                .from('orders')
                .select(baseSelect)
                .contains('shipping_address', { driver: { id: driverId } })
                .eq('status', 'delivered')
                .gte('created_at', yesterday)
                .order('created_at', { ascending: false }),
        ]);

        if (activeResult.error) {
            console.error('Fetch active driver orders DB error:', activeResult.error);
            return NextResponse.json({ error: activeResult.error.message }, { status: 500 });
        }

        if (deliveredResult.error) {
            console.error('Fetch delivered driver orders DB error:', deliveredResult.error);
        }

        return NextResponse.json({
            orders: activeResult.data || [],
            deliveredOrders: deliveredResult.data || [],
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
