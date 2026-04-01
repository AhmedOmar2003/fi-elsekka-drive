import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "تم إيقاف الطلب اليدوي. استخدم تحديد نقطة التحرك والوجهة من الخريطة أو من البحث داخل التطبيق.",
    },
    { status: 410 }
  );
}
