import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { normalizeAuthEmail, validateCustomerEmail, validateStrongPassword } from "@/lib/auth-validation";
import { hasPermission } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return auth.response;

    const adminProfile = { role: auth.profile.role, permissions: auth.profile.permissions };
    if (!hasPermission(adminProfile, "view_drivers")) {
        return NextResponse.json({ error: "Forbidden: view_drivers permission required" }, { status: 403 });
    }

    const supabase = createAdminPlatformClient();
    if (!supabase) {
        return NextResponse.json({ error: "Server misconfigured: missing Supabase service role key" }, { status: 500 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action || "");
    const note = body.note ? String(body.note) : null;
    const now = new Date().toISOString();

    try {
        if (action === "approve") {
            await supabase.from("profiles").update({ account_status: "active", updated_at: now }).eq("id", id);
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "approved",
                    verification_status: "approved",
                    is_accepting_offers: true,
                    availability_status: "available",
                    approved_at: now,
                    approved_by: auth.profile.user.id,
                    suspension_reason: null,
                    suspended_at: null,
                    suspended_by: null,
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        if (action === "reject") {
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "rejected",
                    verification_status: "rejected",
                    is_accepting_offers: false,
                    availability_status: "busy",
                    suspension_reason: note,
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        if (action === "suspend") {
            await supabase.from("profiles").update({ account_status: "suspended", updated_at: now }).eq("id", id);
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "suspended",
                    suspension_reason: note || "Suspended from admin dashboard",
                    suspended_at: now,
                    suspended_by: auth.profile.user.id,
                    is_accepting_offers: false,
                    availability_status: "busy",
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        if (action === "reactivate") {
            await supabase.from("profiles").update({ account_status: "active", updated_at: now }).eq("id", id);
            await supabase
                .from("driver_profiles")
                .update({
                    application_status: "approved",
                    verification_status: "approved",
                    suspension_reason: null,
                    suspended_at: null,
                    suspended_by: null,
                    is_accepting_offers: true,
                    availability_status: "available",
                    updated_at: now,
                })
                .eq("id", id);

            return NextResponse.json({ success: true });
        }

        if (action === "update_credentials") {
            const email = normalizeAuthEmail(String(body.email || ""));
            const password = String(body.password || "");
            const phone = String(body.phone || "").trim() || null;

            const emailError = validateCustomerEmail(email);
            if (emailError) {
                return NextResponse.json({ error: emailError }, { status: 400 });
            }

            if (password) {
                const passwordError = validateStrongPassword(password);
                if (passwordError) {
                    return NextResponse.json({ error: passwordError }, { status: 400 });
                }
            }

            const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(id);
            if (authUserError || !authUserData.user) {
                return NextResponse.json(
                    { error: "حساب الدخول للكابتن مش موجود في Auth. أنشئ كابتن جديد أو راجع إنشاء الحساب من الإدارة." },
                    { status: 404 }
                );
            }

            const updatePayload: {
                email: string;
                password?: string;
                email_confirm: true;
                user_metadata: Record<string, unknown>;
                app_metadata: Record<string, unknown>;
            } = {
                email,
                email_confirm: true,
                user_metadata: {
                    ...(authUserData.user.user_metadata || {}),
                    role: "driver",
                    phone,
                },
                app_metadata: {
                    ...(authUserData.user.app_metadata || {}),
                    role: "driver",
                },
            };

            if (password) {
                updatePayload.password = password;
            }

            const { error: updateAuthError } = await supabase.auth.admin.updateUserById(id, updatePayload);
            if (updateAuthError) {
                return NextResponse.json({ error: updateAuthError.message || "تعذر تحديث بيانات دخول الكابتن." }, { status: 400 });
            }

            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    email,
                    phone,
                    updated_at: now,
                    metadata: {
                        credentials_updated_by_admin: true,
                        credentials_updated_at: now,
                    },
                })
                .eq("id", id);

            if (profileError) {
                return NextResponse.json({ error: profileError.message || "اتحدثت بيانات Auth لكن فشل تحديث البروفايل." }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Unexpected driver action failure" }, { status: 500 });
    }
}
