import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { createAdminPlatformClient } from "@/lib/admin-platform-server";
import { hasPermission } from "@/lib/permissions";

type Context = { params: Promise<{ id: string }> };

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

export async function POST(request: NextRequest, context: Context) {
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
        const { id: driverId } = await context.params;
        const formData = await request.formData();
        const documentType = String(formData.get("documentType") || "").trim();
        const vehicleIdValue = String(formData.get("vehicleId") || "").trim();
        const file = formData.get("file");

        if (!(file instanceof File) || file.size <= 0) {
            return NextResponse.json({ error: "اختر ملف صالح قبل الرفع." }, { status: 400 });
        }

        const now = new Date().toISOString();
        const knownDocumentType = [
            "profile_photo",
            "national_id",
            "driver_license",
            "vehicle_license",
            "vehicle_photo",
            "criminal_record",
            "other",
        ].includes(documentType)
            ? documentType
            : "other";

        const requiresVehicle = knownDocumentType === "vehicle_license" || knownDocumentType === "vehicle_photo";
        let vehicleId = vehicleIdValue || null;

        if (requiresVehicle && !vehicleId) {
            const { data: primaryVehicle } = await supabase
                .from("vehicles")
                .select("id")
                .eq("driver_id", driverId)
                .eq("is_primary", true)
                .maybeSingle();

            vehicleId = primaryVehicle?.id || null;
        }

        if (requiresVehicle && !vehicleId) {
            return NextResponse.json({ error: "لازم يتحدد المركبة قبل رفع مستنداتها." }, { status: 400 });
        }

        const bucket = knownDocumentType === "profile_photo"
            ? "profile-images"
            : requiresVehicle
                ? "vehicle-files"
                : "driver-documents";

        const baseFolder = knownDocumentType === "profile_photo"
            ? `drivers/${driverId}`
            : requiresVehicle
                ? `vehicles/${vehicleId}`
                : `drivers/${driverId}`;

        const path = `${baseFolder}/${knownDocumentType}-${Date.now()}.${fileExtension(file)}`;
        await uploadStorageFile(supabase, bucket, path, file);

        if (knownDocumentType === "profile_photo") {
            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    avatar_bucket: bucket,
                    avatar_path: path,
                    updated_at: now,
                })
                .eq("id", driverId);

            if (profileError) throw profileError;
        }

        const { error: documentError } = await supabase.from("driver_documents").insert({
            driver_id: driverId,
            vehicle_id: vehicleId,
            document_type: knownDocumentType,
            storage_bucket: bucket,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            file_size_bytes: file.size || null,
            approval_status: "approved",
            reviewed_at: now,
            reviewed_by: auth.profile.user.id,
        });

        if (documentError) throw documentError;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "تعذر رفع المستند." }, { status: 500 });
    }
}
