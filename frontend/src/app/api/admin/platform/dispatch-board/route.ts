import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-guard";
import { fetchDispatchBoard } from "@/lib/admin-dashboard-data";

export async function GET(request: Request) {
    const admin = await requireAdminApi(request);
    if (!admin.ok) return admin.response;

    try {
        const board = await fetchDispatchBoard();
        return NextResponse.json(board);
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || "تعذر تحميل لوحة التوزيع الحية." },
            { status: 500 }
        );
    }
}
