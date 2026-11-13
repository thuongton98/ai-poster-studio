import { NextResponse } from "next/server";
import { z } from "zod";
import { composeVariant } from "@/lib/pipeline";
import { BriefSchema, CopySchema } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({
  id: z.string(),
  brief: BriefSchema,
  copy: CopySchema,
  background: z.string().startsWith("data:image/"),
});

/** Sửa chữ: chỉ ghép lại chữ trên ảnh nền cũ, không gọi AI tạo ảnh lần nữa. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dữ liệu chưa hợp lệ" }, { status: 400 });
  const { id, brief, copy, background } = parsed.data;
  try {
    return NextResponse.json(await composeVariant(id, copy, background, brief, false));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
