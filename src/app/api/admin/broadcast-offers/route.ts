import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-guard';
import { createUserNotificationWithPush } from '@/lib/user-push-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request, 'manage_offers');
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: missing Supabase service credentials.' }, { status: 500 });
    }

    const { title, message, link } = await request.json();

    if (!title || !message || !link) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: users, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, role, disabled')
      .or('role.is.null,role.eq.user');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const recipientIds = (users || [])
      .filter((user: any) => user?.disabled !== true)
      .map((user: any) => user.id)
      .filter(Boolean);

    const results = await Promise.all(
      recipientIds.map((userId) =>
        createUserNotificationWithPush(supabaseAdmin, userId, {
          title,
          message,
          link,
          requireInteraction: false,
          topic: 'offers-broadcast',
        })
      )
    );

    const inAppCount = results.filter((result: any) => result?.notificationCreated).length;
    const pushUsersCount = results.filter((result: any) => (result as any)?.push?.devicesNotified > 0).length;
    const pushDevicesCount = results.reduce((sum: number, result: any) => sum + ((result?.push?.devicesNotified as number) || 0), 0);
    const skippedPushCount = results.filter((result: any) => result?.push?.skipped).length;
    const failedPushCount = results.reduce((sum: number, result: any) => sum + ((result?.push?.failedDevices as number) || 0), 0);

    return NextResponse.json({
      success: true,
      count: inAppCount,
      requested: recipientIds.length,
      pushUsersCount,
      pushDevicesCount,
      skippedPushCount,
      failedPushCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}
