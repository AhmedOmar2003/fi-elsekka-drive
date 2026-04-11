import { NextResponse } from "next/server";

import {
  normalizeAuthEmail,
  validateCustomerEmail,
  validateStrongPassword,
} from "@/lib/auth-validation";
import { createRideServiceClient } from "@/lib/ride-server-auth";
import { sendPushToUserDevices } from "@/lib/user-push-server";

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
    const role = "customer";

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

    const { data, error } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        full_name: fullName,
        phone,
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

    const { data: admins } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("account_status", "active")
      .limit(50);

    if (admins?.length) {
      await serviceClient.from("notifications").insert(
        admins.map((admin) => ({
          recipient_user_id: admin.id,
          type: "admin_message",
          title: "عميل جديد سجل في وصلني",
          body: `${fullName} أنشأ حساب جديد على المنصة.`,
          payload: {
            customer_id: data.user.id,
            customer_name: fullName,
            customer_email: email,
          },
        }))
      );

      await Promise.all(
        admins.map((admin) =>
          sendPushToUserDevices(serviceClient, admin.id, {
            title: "عميل جديد سجل في وصلني",
            message: `${fullName} فتح حساب جديد على المنصة.`,
            link: "/admin/users",
            requireInteraction: true,
            topic: "new-customer",
          })
        )
      );
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
