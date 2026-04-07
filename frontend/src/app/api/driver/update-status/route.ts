import { NextResponse } from 'next/server';
import { createOrderAdminNotificationsWithPush, createRestaurantNotificationsWithPush, createUserNotificationWithPush } from '@/lib/user-push-server';
import { getRestaurantOrderSnapshot } from '@/lib/restaurant-order';
import { driverSupabaseAdmin, requireDriverApi } from '@/lib/driver-guard';

export async function POST(request: Request) {
    if (!driverSupabaseAdmin) {
        return NextResponse.json({ error: 'Missing service configuration' }, { status: 500 });
    }

    try {
        const auth = await requireDriverApi(request);
        if (!auth.ok) {
            return auth.response;
        }
        const user = auth.profile.user;

        const body = await request.json();
        const { orderId, status } = body;

        if (!orderId || !status) {
            return NextResponse.json({ error: 'Missing orderId or status' }, { status: 400 });
        }

        // Verify the order actually belongs to this driver
        const { data: order, error: orderError } = await driverSupabaseAdmin
            .from('orders')
      .select('user_id, shipping_address, status')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // The stored ID inside JSON might be typed slightly differently, so use generic check
        if (order.shipping_address?.driver?.id !== user.id) {
            return NextResponse.json({ error: 'You are not assigned to this order' }, { status: 403 });
        }
        
        // Update order status securely
        const { error: updateError } = await driverSupabaseAdmin
            .from('orders')
      .update({
        status,
        shipping_address: {
          ...(order.shipping_address || {}),
          ...(status === 'shipped'
            ? {
                driver_picked_up_at: new Date().toISOString(),
                driver_delivery_state: 'on_the_way_to_customer'
              }
            : {}),
          ...(status === 'delivered'
            ? {
                driver_delivered_at: new Date().toISOString(),
                driver_delivery_state: 'delivered',
              }
            : {})
        }
      })
            .eq('id', orderId);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Notify Admin Dashboard immediately so they see the status change live
    if (status === 'shipped') {
      await driverSupabaseAdmin.channel('admin-notifications').send({
        type: 'broadcast',
        event: 'order-shipped',
        payload: {
          orderId,
          driverName: auth.profile.fullName || user.email || 'المندوب'
        }
      })

      if (order.user_id) {
        await createUserNotificationWithPush(driverSupabaseAdmin, order.user_id, {
          title: 'طلبك بقى في الطريق 🛵',
          message: 'المندوب استلم طلبك من المكان وخرج بالفعل علشان يوصلهولك. تابع الطلب وشوف هو وصل لفين.',
          link: '/orders'
        })
      }
    }

    if (status === 'delivered') {
            await driverSupabaseAdmin.channel('admin-notifications').send({
                type: 'broadcast',
                event: 'order-delivered',
                payload: { 
                    orderId, 
                    driverName: auth.profile.fullName || 'مندوب' 
                }
            });

            const customerName =
                order.shipping_address?.recipient ||
                order.shipping_address?.recipientName ||
                order.shipping_address?.full_name ||
                'العميل';

            await createOrderAdminNotificationsWithPush(driverSupabaseAdmin, {
                title: 'تم توصيل الطلب بنجاح',
                message: `تم توصيل طلب ${customerName} بنجاح بواسطة ${auth.profile.fullName || 'المندوب'}.`,
                link: `/admin/orders?order=${orderId}`,
                topic: 'admin-order-delivered',
            });

            const restaurantOrder = getRestaurantOrderSnapshot(order.shipping_address);
            if (restaurantOrder.isRestaurantOrder && restaurantOrder.restaurantId) {
                await createRestaurantNotificationsWithPush(driverSupabaseAdmin, restaurantOrder.restaurantId, {
                    title: 'تم توصيل الطلب بنجاح',
                    message: `شكرًا لكم، تم توصيل طلب العميل ${customerName} بنجاح.`,
                    link: '/restaurant',
                    topic: 'restaurant-order-delivered',
                });
            }

            // CREATE IN-APP NOTIFICATION FOR THE CUSTOMER
            if (order.user_id) {
                await createUserNotificationWithPush(driverSupabaseAdmin, order.user_id, {
                    title: 'تم توصيل طلبك! 📦',
                    message: `تم تسليم طلبك رقم #${orderId.substring(0,6)} بنجاح. نتمنى لك تجربة سعيدة!`,
                    link: '/orders',
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('API Error /driver/update-status:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
