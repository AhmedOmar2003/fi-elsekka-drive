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

        const { orderId } = await request.json();
        if (!orderId) {
            return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }

        // 1. Fetch current order to get existing shipping_address
        const { data: order, error: fetchErr } = await driverSupabaseAdmin
            .from('orders')
            .select('shipping_address')
            .eq('id', orderId)
            .single();

        if (fetchErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const shipping = order.shipping_address || {};
        
        // Security check: ensure this driver is the one assigned
        if (shipping.driver?.id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Update acceptance_status to 'accepted'
        const updatedShipping = {
            ...shipping,
            driver: {
                ...shipping.driver,
                acceptance_status: 'accepted',
                accepted_at: new Date().toISOString(),
            },
        };

        const { error: updateErr } = await driverSupabaseAdmin
            .from('orders')
            .update({ shipping_address: updatedShipping })
            .eq('id', orderId);

        if (updateErr) throw updateErr;

        // Notify Admin Dashboard
        await driverSupabaseAdmin.channel('admin-notifications').send({
            type: 'broadcast',
            event: 'driver-response',
            payload: { 
                orderId, 
                status: 'accepted', 
                driverName: auth.profile.fullName || 'مندوب' 
            }
        });

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('API Error /driver/accept-order:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
