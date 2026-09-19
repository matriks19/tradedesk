import { NextRequest, NextResponse } from "next/server";
import { getFallbackDb, patchDb, readDb } from "@/lib/store/fsdb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    return NextResponse.json(db);
  } catch {
    // Never bare 500 — clients hydrate from this payload
    return NextResponse.json(getFallbackDb());
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await patchDb(body);
    return NextResponse.json(db);
  } catch {
    return NextResponse.json(getFallbackDb());
  }
}
