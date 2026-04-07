import { NextResponse } from 'next/server';

// Temporary: allow unlimited attempts but keep endpoint for future hardening.
export async function POST() {
  return NextResponse.json({ ok: true, remaining: null });
}
