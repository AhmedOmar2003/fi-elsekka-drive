import { NextResponse } from "next/server";

import {
  normalizeAuthEmail,
  validateCustomerEmail,
  validateStrongPassword,
} from "@/lib/auth-validation";
import { createRideServiceClient } from "@/lib/ride-server-auth";

export async function POST(request: Request) {
  const serviceClient = createRideServiceClient();
  if (!serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: Supabase credentials are missing." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = normalizeAuthEmail(body.email || "");
    const password = String(body.password || "");
    const phone = String(body.phone || "").trim() || null;
    const role = body.role === "driver" ? "driver" : "customer";
    const nationalId = String(body.nationalId || "").trim();
    const workingCity = String(body.workingCity || "").trim();
    const vehicleType =
      body.vehicleType === "car" || body.vehicleType === "tuk_tuk"
        ? body.vehicleType
        : "car";

    if (!fullName) {
      return NextResponse.json(
        { error: "اكتب اسمك بالكامل الأول." },
        { status: 400 }
      );
    }

    const emailError = validateCustomerEmail(email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (role === "driver" && (!nationalId || !workingCity)) {
      return NextResponse.json(
        { error: "اكتب الرقم القومي والمدينة الأساسية للكابتن." },
        { status: 400 }
      );
    }

    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        full_name: fullName,
        phone,
        vehicle_type: role === "driver" ? vehicleType : null,
      },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "تعذر إنشاء الحساب." },
        { status: 400 }
      );
    }

    await serviceClient
      .from("profiles")
      .update({
        full_name: fullName,
        display_name: fullName.split(" ")[0] || fullName,
        email,
        phone,
      })
      .eq("id", data.user.id);

    if (role === "driver") {
      const { error: driverProfileError } = await serviceClient
        .from("driver_profiles")
        .insert({
          id: data.user.id,
          national_id: nationalId,
          working_city: workingCity,
          metadata: {
            preferred_vehicle_type: vehicleType,
          },
        });

      if (driverProfileError) {
        return NextResponse.json(
          { error: driverProfileError.message || "تعذر حفظ بيانات الكابتن." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      role,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "تعذر إنشاء الحساب." },
      { status: 500 }
    );
  }
}
