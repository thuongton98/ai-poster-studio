import { NextResponse } from "next/server";
import { generate } from "@/lib/pipeline";
import { BriefSchema } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = BriefSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin chưa hợp lệ", details: parsed.error.issues }, { status: 400 });
  try {
    return NextResponse.json(await generate(parsed.data));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Không tạo được poster: " + (e as Error).message }, { status: 500 });
  }
}
