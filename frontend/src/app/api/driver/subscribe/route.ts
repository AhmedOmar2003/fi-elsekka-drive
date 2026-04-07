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

        const { subscription } = await request.json();
        const endpoint = subscription?.endpoint;

        if (!subscription || !endpoint) {
            return NextResponse.json({ error: 'Missing subscription payload' }, { status: 400 });
        }

        // Production-safe manual upsert:
        // some projects do not have a matching unique constraint for
        // `onConflict: driver_id, subscription`, which causes the exact
        // "no unique or exclusion constraint" error the driver sees.
        // We update by subscription endpoint first, then insert if needed.
        const { data: updatedRows, error: updateError } = await driverSupabaseAdmin
            .from('driver_subscriptions')
            .update({ driver_id: user.id, subscription })
            .eq('subscription->>endpoint', endpoint)
            .select('id');

        if (updateError) {
            console.error('Failed to update driver push subscription:', updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        if (!updatedRows || updatedRows.length === 0) {
            const { error: insertError } = await driverSupabaseAdmin
                .from('driver_subscriptions')
                .insert({ driver_id: user.id, subscription });

            if (insertError) {
                console.error('Failed to insert driver push subscription:', insertError);
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('API Error /driver/subscribe:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
