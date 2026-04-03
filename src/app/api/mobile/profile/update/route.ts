import { NextResponse } from "next/server";
import { createRideAuthedClient, createRideServiceClient, requireRideUser } from "@/lib/ride-server-auth";

export async function POST(request: Request) {
  const auth = await requireRideUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const newFullName = body.fullName?.trim();
    const newPassword = body.password?.trim();

    const authedClient = createRideAuthedClient(auth.token);
    const serviceClient = createRideServiceClient();

    if (!authedClient || !serviceClient) {
      return NextResponse.json(
        { error: "Server misconfiguration." },
        { status: 500 }
      );
    }

    const userId = auth.profile.user.id;
    let profilesUpdated = false;

    // Update the password if provided
    if (newPassword && newPassword.length >= 6) {
      // Use service client to update user's auth password directly (Admin power)
      const { error: authError } = await serviceClient.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );
      
      if (authError) {
        return NextResponse.json(
          { error: "تعذر تحديث كلمة المرور." },
          { status: 400 }
        );
      }
    } else if (newPassword) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." },
        { status: 400 }
      );
    }

    // Update full name if provided
    if (newFullName && newFullName.length > 2) {
      // First, update in generic profiles
      const { error: profileError } = await serviceClient
        .from("profiles")
        .update({ full_name: newFullName, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (profileError) {
        return NextResponse.json({ error: "تعذر تحديث الاسم الأساسي." }, { status: 400 });
      }

      // If user is a driver, update driver_profiles as well safely
      if (auth.profile.role === "driver") {
        await serviceClient
          .from("driver_profiles")
          .update({ full_name: newFullName, updated_at: new Date().toISOString() })
          .eq("id", userId);
      }

      profilesUpdated = true;
    } else if (newFullName) {
        return NextResponse.json(
            { error: "يرجى كتابة الاسم بشكل صحيح." },
            { status: 400 }
          );
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث البيانات بنجاح.",
      fullNameUpdated: profilesUpdated
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "حصلت مشكلة في الخادم أثناء تحديث البيانات." },
      { status: 500 }
    );
  }
}
