import { createClient } from '@supabase/supabase-js';
import type { AdminProfile } from './admin-guard';

type ServerAuditPayload = {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  severity?: 'info' | 'warning' | 'critical';
  details?: Record<string, unknown>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export async function recordServerAdminAudit(actor: AdminProfile, payload: ServerAuditPayload) {
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin.from('admin_audit_logs').insert({
      actor_user_id: actor.user.id,
      actor_email: actor.user.email || null,
      actor_role: actor.role || null,
      action: payload.action,
      entity_type: payload.entityType,
      entity_id: payload.entityId || null,
      entity_label: payload.entityLabel || null,
      severity: payload.severity || 'info',
      details: payload.details || {},
    });
  } catch (error) {
    console.error('recordServerAdminAudit failed', error);
  }
}
