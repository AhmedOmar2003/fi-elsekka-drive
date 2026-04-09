import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "fi-elsekka-drive",
    routeVersion: "trip-status-v3-2026-04-09",
    ok: true,
  });
}
