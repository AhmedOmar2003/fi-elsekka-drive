import { NextResponse } from 'next/server';
import { driverSupabaseAdmin, requireDriverApi } from '@/lib/driver-guard';

export async function GET(request: Request) {
    try {
        if (!driverSupabaseAdmin) {
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }
        const auth = await requireDriverApi(request);
        if (!auth.ok) {
            return auth.response;
        }
        const driverId = auth.profile.user.id;

        // 2. Fetch ALL orders (bypass RLS with service role), filter by driver in shipping_address
        const { data: allOrders, error: ordersError } = await driverSupabaseAdmin
            .from('orders')
            .select('id, total_amount, created_at, status, shipping_address')
            .eq('status', 'delivered')
            .order('created_at', { ascending: false });

        if (ordersError) {
            return NextResponse.json({ error: ordersError.message }, { status: 500 });
        }

        // Filter delivered orders assigned to this driver
        const deliveredOrders = (allOrders || []).filter(
            (o: any) => o.shipping_address?.driver?.id === driverId
        );

        if (deliveredOrders.length === 0) {
            return NextResponse.json({ orders: [], totalCount: 0, avgRating: null });
        }

        // 3. Fetch reviews for these orders
        const orderIds = deliveredOrders.map((o: any) => o.id);
        const { data: reviews } = await driverSupabaseAdmin
            .from('driver_reviews')
            .select('order_id, rating, comment')
            .in('order_id', orderIds);

        const reviewMap: Record<string, { rating: number; comment: string | null }> = {};
        for (const rev of (reviews || [])) {
            reviewMap[rev.order_id] = { rating: rev.rating, comment: rev.comment };
        }

        const enriched = deliveredOrders.map((o: any) => ({
            ...o,
            review: reviewMap[o.id] || null
        }));

        // 4. Calculate average rating
        const ratedOrders = enriched.filter(o => o.review);
        const avgRating = ratedOrders.length > 0
            ? parseFloat((ratedOrders.reduce((s, o) => s + o.review!.rating, 0) / ratedOrders.length).toFixed(1))
            : null;

        return NextResponse.json({
            orders: enriched,
            totalCount: enriched.length,
            avgRating
        });

    } catch (err: any) {
        console.error('API Error /driver/history:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
