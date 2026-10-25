import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ ok:true, service:"renzyhub-key-system", version:"2.0.0" });
  } catch {
    return NextResponse.json({ ok:false, error:"Database unavailable" }, { status:503 });
  }
}
