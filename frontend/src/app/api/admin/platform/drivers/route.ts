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

async function createDriverDocument({
    supabase,
    driverId,
    vehicleId = null,
    bucket,
    path,
    file,
    documentType,
    reviewedBy,
    now,
}: {
    supabase: NonNullable<ReturnType<typeof createAdminPlatformClient>>;
    driverId: string;
    vehicleId?: string | null;
    bucket: string;
    path: string;
    file: File;
    documentType:
        | "profile_photo"
        | "national_id"
        | "driver_license"
        | "vehicle_license"
        | "vehicle_photo"
        | "criminal_record"
        | "other";
    reviewedBy: string;
    now: string;
}) {
    await uploadStorageFile(supabase, bucket, path, file);

    const { error } = await supabase.from("driver_documents").insert({
        driver_id: driverId,
        vehicle_id: vehicleId,
        document_type: documentType,
        storage_bucket: bucket,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size || null,
        approval_status: "approved",
        reviewed_at: now,
        reviewed_by: reviewedBy,
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

    let createdUserId: string | null = null;

    try {
        const contentType = request.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await request.json() : Object.fromEntries((await request.formData()).entries());
        const fullName = String(payload.fullName || "").trim();
        const phone = String(payload.phone || "").trim();
        const email = normalizeAuthEmail(String(payload.email || ""));
        const password = String(payload.password || "");
        const nationalId = String(payload.nationalId || "").trim();
        const workingCity = String(payload.workingCity || "").trim();
        const workingArea = String(payload.workingArea || payload.operatingArea || "").trim() || null;
        const vehicleType = payload.vehicleType === "tuk_tuk" ? "tuk_tuk" : "car";
        const brand = String(payload.brand || "").trim();
        const model = String(payload.model || "").trim();
        const color = String(payload.color || "").trim();
        const manufacturingYear = Number(payload.manufacturingYear || 0);
        const plateNumber = String(payload.plateNumber || "").trim() || null;
        const seatCount = vehicleType === "car" ? Number(payload.seatCount || 0) : null;
        const operatingArea = String(payload.operatingArea || "").trim() || null;
        const vehicleCondition = String(payload.vehicleCondition || "").trim() || null;
        const adminNotes = String(payload.adminNotes || "").trim() || null;

        const profilePhoto = payload.profilePhoto;
        const nationalIdPhoto = payload.nationalIdPhoto;
        const driverLicensePhoto = payload.driverLicensePhoto;
        const vehicleLicensePhoto = payload.vehicleLicensePhoto;
        const vehiclePhoto = payload.vehiclePhoto;
        const criminalRecordPhoto = payload.criminalRecordPhoto;

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
        createdUserId = userId;
        const now = new Date().toISOString();

        const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
                {
                    id: userId,
                    full_name: fullName,
                    display_name: fullName.split(" ")[0] || fullName,
                    email,
                    phone,
                    avatar_bucket: null,
                    avatar_path: null,
                    metadata: {
                        auth_role: "driver",
                        created_via: "admin_dashboard",
                        admin_notes: adminNotes,
                    },
                    updated_at: now,
                },
                { onConflict: "id" }
            );

        if (profileError) throw profileError;

        const { error: driverProfileError } = await supabase.from("driver_profiles").insert({
            id: userId,
            application_status: "approved",
            verification_status: "approved",
            availability_status: "available",
            is_accepting_offers: true,
            national_id: nationalId,
            working_city: workingCity,
            working_area: workingArea,
            approved_at: now,
            approved_by: auth.profile.user.id,
            metadata: {
                created_via: "admin_dashboard",
                admin_notes: adminNotes,
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
                condition_notes: vehicleCondition,
                approval_status: "approved",
                approved_at: now,
                approved_by: auth.profile.user.id,
                is_primary: true,
                is_active: true,
                metadata: {
                    created_via: "admin_dashboard",
                    admin_notes: adminNotes,
                },
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
            await createDriverDocument({
                supabase,
                driverId: userId,
                bucket: "driver-documents",
                path: `drivers/${userId}/national-id-${Date.now()}.${fileExtension(nationalIdPhoto)}`,
                file: nationalIdPhoto,
                documentType: "national_id",
                reviewedBy: auth.profile.user.id,
                now,
            });
        }

        if (driverLicensePhoto instanceof File && driverLicensePhoto.size > 0) {
            await createDriverDocument({
                supabase,
                driverId: userId,
                bucket: "driver-documents",
                path: `drivers/${userId}/driver-license-${Date.now()}.${fileExtension(driverLicensePhoto)}`,
                file: driverLicensePhoto,
                documentType: "driver_license",
                reviewedBy: auth.profile.user.id,
                now,
            });
        }

        if (criminalRecordPhoto instanceof File && criminalRecordPhoto.size > 0) {
            await createDriverDocument({
                supabase,
                driverId: userId,
                bucket: "driver-documents",
                path: `drivers/${userId}/criminal-record-${Date.now()}.${fileExtension(criminalRecordPhoto)}`,
                file: criminalRecordPhoto,
                documentType: "criminal_record",
                reviewedBy: auth.profile.user.id,
                now,
            });
        }

        if (vehicleLicensePhoto instanceof File && vehicleLicensePhoto.size > 0) {
            await createDriverDocument({
                supabase,
                driverId: userId,
                vehicleId: vehicle.id,
                bucket: "vehicle-files",
                path: `vehicles/${vehicle.id}/license-${Date.now()}.${fileExtension(vehicleLicensePhoto)}`,
                file: vehicleLicensePhoto,
                documentType: "vehicle_license",
                reviewedBy: auth.profile.user.id,
                now,
            });
        }

        if (vehiclePhoto instanceof File && vehiclePhoto.size > 0) {
            await createDriverDocument({
                supabase,
                driverId: userId,
                vehicleId: vehicle.id,
                bucket: "vehicle-files",
                path: `vehicles/${vehicle.id}/photo-${Date.now()}.${fileExtension(vehiclePhoto)}`,
                file: vehiclePhoto,
                documentType: "vehicle_photo",
                reviewedBy: auth.profile.user.id,
                now,
            });
        }

        await supabase.from("notifications").insert({
            recipient_user_id: userId,
            type: "admin_message",
            title: "حسابك جاهز من إدارة وصلني",
            body: "تقدر تدخل دلوقتي من رابط دخول الكباتن وتشوف العروض اللي الإدارة هتبعتها لك.",
            payload: {
                login_link: "/captain/login",
                created_by_admin: true,
            },
        });

        return NextResponse.json({
            success: true,
            userId,
            vehicleId: vehicle.id,
            loginLink: "/captain/login",
        });
    } catch (error: any) {
        if (createdUserId) {
            await supabase.auth.admin.deleteUser(createdUserId).catch(() => null);
        }

        const errorMessage =
            error?.message ||
            error?.error_description ||
            (typeof error === "string" ? error : null) ||
            "تعذر إنشاء حساب الكابتن.";

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
