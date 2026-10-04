import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { generateSlots } from "@/lib/scheduling";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (actor.kind === "guest") {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const providerId = req.nextUrl.searchParams.get("providerId") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!providerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "providerId and date (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }
  const db = readDb();
  return NextResponse.json({ slots: generateSlots(db, providerId, date) });
}
