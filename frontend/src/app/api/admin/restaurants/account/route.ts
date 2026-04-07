import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';
import { recordServerAdminAudit } from '@/lib/admin-audit-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function isFullAdmin(role?: string | null) {
  return role === 'super_admin' || role === 'admin';
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing service role key' }, { status: 500 });
  }

  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;

  if (!isFullAdmin(auth.profile.role)) {
    return NextResponse.json({ error: 'حسابات دخول المطاعم متاحة فقط للسوبر أدمن أو الأدمن الكامل' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      restaurantId,
      restaurantName,
      managerName,
      managerEmail,
      previousManagerEmail,
      password,
      disabled = false,
    } = body || {};

    if (!restaurantId || !restaurantName || !managerEmail) {
      return NextResponse.json({ error: 'بيانات المطعم أو الإيميل ناقصة' }, { status: 400 });
    }

    const normalizedEmail = String(managerEmail).trim().toLowerCase();
    const previousEmail = String(previousManagerEmail || '').trim().toLowerCase();
    const displayName = String(managerName || restaurantName).trim();

    let existingUser =
      (await supabaseAdmin.from('users').select('id, email, role').eq('email', normalizedEmail).maybeSingle()).data ||
      null;

    if (!existingUser && previousEmail && previousEmail !== normalizedEmail) {
      existingUser =
        (await supabaseAdmin.from('users').select('id, email, role').eq('email', previousEmail).maybeSingle()).data ||
        null;
    }

    let userId: string | null = existingUser?.id || null;

    if (existingUser && existingUser.role && existingUser.role !== 'restaurant_manager') {
      return NextResponse.json({ error: 'الإيميل ده مستخدم بالفعل لحساب من نوع مختلف، اختار إيميل مخصص للمطعم' }, { status: 409 });
    }

    if (userId) {
      const updatePayload: Record<string, unknown> = {
        email: normalizedEmail,
        user_metadata: {
          full_name: displayName,
          role: 'restaurant_manager',
          restaurant_name: restaurantName,
          restaurant_id: restaurantId,
        },
      };

      if (password) {
        updatePayload.password = password;
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updatePayload);
      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message || 'فشل تحديث حساب المطعم' }, { status: 500 });
      }
    } else {
      if (!password) {
        return NextResponse.json({ error: 'أول مرة لازم تكتب باسورد للمطعم علشان نفتح له حساب دخول' }, { status: 400 });
      }

      const { data: created, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: displayName,
          role: 'restaurant_manager',
          restaurant_name: restaurantName,
          restaurant_id: restaurantId,
        },
      });

      if (authCreateError || !created?.user) {
        return NextResponse.json({ error: authCreateError?.message || 'فشل إنشاء حساب المطعم' }, { status: 500 });
      }

      userId = created.user.id;
    }

    const { error: upsertError } = await supabaseAdmin.from('users').upsert({
      id: userId,
      full_name: displayName,
      email: normalizedEmail,
      role: 'restaurant_manager',
      permissions: [],
      disabled,
      must_change_password: false,
    });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message || 'فشل حفظ بيانات حساب المطعم' }, { status: 500 });
    }

    const { error: restaurantUpdateError } = await supabaseAdmin
      .from('restaurants')
      .update({
        manager_name: displayName,
        manager_email: normalizedEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', restaurantId);

    if (restaurantUpdateError) {
      return NextResponse.json({ error: restaurantUpdateError.message || 'اتعمل الحساب لكن ما قدرناش نربطه بالمطعم' }, { status: 500 });
    }

    await recordServerAdminAudit(auth.profile, {
      action: existingUser ? 'restaurant.account_update' : 'restaurant.account_create',
      entityType: 'restaurant',
      entityId: restaurantId,
      entityLabel: restaurantName,
      details: {
        manager_email: normalizedEmail,
        has_password_update: Boolean(password),
      },
    });

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
