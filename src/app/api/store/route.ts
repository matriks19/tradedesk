import { NextRequest, NextResponse } from "next/server";
import { patchDb, readDb } from "@/lib/store/fsdb";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = await patchDb(body);
  return NextResponse.json(db);
}
