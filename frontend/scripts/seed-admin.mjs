import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_KEY;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@fi-elsekka.com';
const adminUsername = process.env.ADMIN_USERNAME || 'fi-admin';
const adminPassword = process.env.ADMIN_TEMP_PASSWORD;

if (!url || !serviceRole) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

if (!adminPassword) {
  throw new Error('Set ADMIN_TEMP_PASSWORD before running the seed script.');
}

const client = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAdmin() {
  const { data: list } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());

  if (existing) {
    await client.auth.admin.updateUserById(existing.id, {
      password: adminPassword,
      user_metadata: {
        role: 'admin',
        username: adminUsername,
        must_change_password: true,
      },
    });
    await client
      .from('users')
      .upsert(
        { id: existing.id, email: adminEmail, full_name: adminUsername, role: 'admin', must_change_password: true },
        { onConflict: 'id' }
      );
    console.log('Updated existing admin user.');
    return;
  }

  const { data, error } = await client.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: 'admin', username: adminUsername, must_change_password: true },
  });
  if (error || !data?.user) {
    throw new Error(error?.message || 'Failed to create admin user');
  }

  await client
    .from('users')
    .upsert(
      { id: data.user.id, email: adminEmail, full_name: adminUsername, role: 'admin', must_change_password: true },
      { onConflict: 'id' }
    );

  console.log('Seeded admin user:', adminEmail);
}

ensureAdmin().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
