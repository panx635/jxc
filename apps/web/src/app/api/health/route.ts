import { NextResponse } from "next/server";
import { query } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await query("select 1");
    return NextResponse.json({ status: "ok", checks: { database: "ok" } });
  } catch (error) {
    console.error("[health] database check failed", error);
    return NextResponse.json(
      { status: "error", checks: { database: "error" } },
      { status: 503 },
    );
  }
}
