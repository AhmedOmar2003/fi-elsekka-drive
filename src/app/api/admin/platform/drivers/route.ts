import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { normalizeAuthEmail, validateCustomerEmail, validateStrongPassword } from "@/lib/auth-validation";
import { hasPermission } from "@/lib/permissions";

function fileExtension(file: File) {
    const direct = file.name.split(".").pop()?.trim();
    if (direct) return direct.toLowerCase();
    const mime = file.type.split("/").pop()?.trim();
    return mime || "bin";
}

async function uploadStorageFile(
    supabase: NonNullable<ReturnType<typeof createAdminPlatformClient>>,
    bucket: string,
    path: string,
    file: File
) {
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
    });

    if (error) throw error;
}

export async function POST(request: NextRequest) {
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

    try {
        const formData = await request.formData();
        const fullName = String(formData.get("fullName") || "").trim();
        const phone = String(formData.get("phone") || "").trim();
        const email = normalizeAuthEmail(String(formData.get("email") || ""));
        const password = String(formData.get("password") || "");
        const nationalId = String(formData.get("nationalId") || "").trim();
        const workingCity = String(formData.get("workingCity") || "").trim();
        const vehicleType =
            formData.get("vehicleType") === "tuk_tuk" ? "tuk_tuk" : "car";
        const brand = String(formData.get("brand") || "").trim();
        const model = String(formData.get("model") || "").trim();
        const color = String(formData.get("color") || "").trim();
        const manufacturingYear = Number(formData.get("manufacturingYear") || 0);
        const plateNumber = String(formData.get("plateNumber") || "").trim() || null;
        const seatCount =
            vehicleType === "car" ? Number(formData.get("seatCount") || 0) : null;
        const operatingArea = String(formData.get("operatingArea") || "").trim() || null;
        const profilePhoto = formData.get("profilePhoto");
        const nationalIdPhoto = formData.get("nationalIdPhoto");

        if (!fullName || !phone || !email || !password || !nationalId || !workingCity) {
            return NextResponse.json({ error: "اكتب كل البيانات الأساسية للكابتن." }, { status: 400 });
        }

        const emailError = validateCustomerEmail(email);
        if (emailError) {
            return NextResponse.json({ error: emailError }, { status: 400 });
        }

        const passwordError = validateStrongPassword(password);
        if (passwordError) {
            return NextResponse.json({ error: passwordError }, { status: 400 });
        }

        if (!brand || !model || !color || !Number.isFinite(manufacturingYear) || manufacturingYear < 1970) {
            return NextResponse.json({ error: "اكتب بيانات المركبة الأساسية بشكل صحيح." }, { status: 400 });
        }

        if (vehicleType === "car" && (!plateNumber || !seatCount || seatCount < 1)) {
            return NextResponse.json({ error: "العربية لازم يكون لها رقم لوحة وعدد مقاعد صحيح." }, { status: 400 });
        }

        const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: "driver",
                full_name: fullName,
                phone,
            },
            app_metadata: {
                role: "driver",
            },
        });

        if (createError || !createdUser.user) {
            return NextResponse.json({ error: createError?.message || "تعذر إنشاء حساب الكابتن." }, { status: 400 });
        }

        const userId = createdUser.user.id;
        const now = new Date().toISOString();

        const { error: profileError } = await supabase
            .from("profiles")
            .update({
                full_name: fullName,
                display_name: fullName.split(" ")[0] || fullName,
                email,
                phone,
                account_status: "active",
                updated_at: now,
                metadata: {
                    auth_role: "driver",
                    created_via: "admin_dashboard",
                },
            })
            .eq("id", userId);

        if (profileError) throw profileError;

        const { error: driverProfileError } = await supabase.from("driver_profiles").insert({
            id: userId,
            application_status: "approved",
            verification_status: "approved",
            availability_status: "offline",
            is_accepting_offers: true,
            national_id: nationalId,
            working_city: workingCity,
            working_area: operatingArea,
            approved_at: now,
            approved_by: auth.profile.user.id,
            metadata: {
                created_via: "admin_dashboard",
            },
        });

        if (driverProfileError) throw driverProfileError;

        const { data: vehicle, error: vehicleError } = await supabase
            .from("vehicles")
            .insert({
                driver_id: userId,
                vehicle_type: vehicleType,
                brand,
                model,
                color,
                manufacturing_year: manufacturingYear,
                plate_number: plateNumber,
                seat_count: vehicleType === "car" ? seatCount : null,
                operating_area: operatingArea,
                approval_status: "approved",
                approved_at: now,
                approved_by: auth.profile.user.id,
                is_primary: true,
                is_active: true,
            })
            .select("id")
            .single();

        if (vehicleError || !vehicle) throw vehicleError || new Error("تعذر حفظ المركبة.");

        if (profilePhoto instanceof File && profilePhoto.size > 0) {
            const profilePath = `drivers/${userId}/profile-${Date.now()}.${fileExtension(profilePhoto)}`;
            await uploadStorageFile(supabase, "profile-images", profilePath, profilePhoto);

            await supabase.from("profiles").update({
                avatar_bucket: "profile-images",
                avatar_path: profilePath,
                updated_at: now,
            }).eq("id", userId);

            await supabase.from("driver_documents").insert({
                driver_id: userId,
                document_type: "profile_photo",
                storage_bucket: "profile-images",
                storage_path: profilePath,
                file_name: profilePhoto.name,
                mime_type: profilePhoto.type || null,
                file_size_bytes: profilePhoto.size || null,
                approval_status: "approved",
                reviewed_at: now,
                reviewed_by: auth.profile.user.id,
            });
        }

        if (nationalIdPhoto instanceof File && nationalIdPhoto.size > 0) {
            const nationalIdPath = `drivers/${userId}/national-id-${Date.now()}.${fileExtension(nationalIdPhoto)}`;
            await uploadStorageFile(supabase, "driver-documents", nationalIdPath, nationalIdPhoto);

            await supabase.from("driver_documents").insert({
                driver_id: userId,
                document_type: "national_id",
                storage_bucket: "driver-documents",
                storage_path: nationalIdPath,
                file_name: nationalIdPhoto.name,
                mime_type: nationalIdPhoto.type || null,
                file_size_bytes: nationalIdPhoto.size || null,
                approval_status: "approved",
                reviewed_at: now,
                reviewed_by: auth.profile.user.id,
            });
        }

        await supabase.from("notifications").insert({
            recipient_user_id: userId,
            type: "admin_message",
            title: "حسابك جاهز من إدارة في السكة",
            body: "تقدر تدخل دلوقتي من رابط دخول الكباتن وتشوف العروض اللي الإدارة هتبعتها لك.",
            payload: {
                login_link: "/captain/login",
                created_by_admin: true,
            },
        });

        return NextResponse.json({
            success: true,
            userId,
            loginLink: "/captain/login",
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "تعذر إنشاء حساب الكابتن." }, { status: 500 });
    }
}
