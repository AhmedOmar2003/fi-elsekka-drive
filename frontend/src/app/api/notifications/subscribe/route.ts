import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: missing Supabase service credentials.' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();
    const endpoint = subscription?.endpoint;

    if (!subscription || !endpoint) {
      return NextResponse.json({ error: 'Missing subscription payload' }, { status: 400 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('user_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          subscription,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (dbError) {
      console.error('Failed to save user push subscription:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error /notifications/subscribe:', error);
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}
