import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { CopySchema, type Brief, type Layout, type PosterCopy } from "./types";
import { copyPrompt, finalImagePrompt } from "./prompts";

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/** Có model tạo ảnh (chỉ Gemini). */
export const hasKey = () => Boolean(process.env.GEMINI_API_KEY);
/** Có model viết nội dung: ưu tiên Groq (nhanh, rẻ), không có thì dùng Gemini. */
export const textProvider = (): "groq" | "gemini" | null =>
  process.env.GROQ_API_KEY ? "groq" : process.env.GEMINI_API_KEY ? "gemini" : null;

let client: GoogleGenAI | null = null;
function ai() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const CopyListSchema = z.object({ variants: z.array(CopySchema).min(1).max(3) });

const copyJsonSchema = {
  type: "object",
  properties: {
    variants: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          headline: { type: "string" },
          subline: { type: "string" },
          cta: { type: "string" },
          layout: { type: "string", enum: ["top", "center", "bottom"] },
          imagePrompt: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["headline", "subline", "cta", "layout", "imagePrompt", "rationale"],
      },
    },
  },
  required: ["variants"],
};

/**
 * Gọi LLM lấy 3 phương án. Structured output giảm lỗi JSON nhưng không đảm bảo
 * đúng luật nghiệp vụ, nên vẫn validate lại bằng zod và sửa layout trùng.
 */
export async function generateCopy(brief: Brief): Promise<PosterCopy[]> {
  const provider = textProvider();
  if (!provider) return demoCopy(brief);
  const ask = async (prompt: string) => {
    if (provider === "groq") return CopyListSchema.parse(await groqJson(prompt)).variants;
    const res = await ai().models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json", responseJsonSchema: copyJsonSchema, temperature: 0.9 },
    });
    return CopyListSchema.parse(JSON.parse(res.text ?? "{}")).variants;
  };
  // Lỗi đã gặp thật: schema ghi minItems 3 nhưng model đôi khi chỉ trả 2 phương án.
  // Không tin vào schema: đếm lại, thiếu thì gọi bù một lần, bỏ phương án trùng headline.
  let list = await ask(copyPrompt(brief));
  if (list.length < 3) {
    const have = list.map((c) => `"${c.headline}" (layout ${c.layout})`).join(", ");
    const more = await ask(`${copyPrompt(brief)}\n\nĐã có các phương án: ${have}. Viết thêm phương án MỚI, khác hẳn các phương án trên, dùng layout chưa có.`);
    const seen = new Set(list.map((c) => c.headline.trim().toLowerCase()));
    list = [...list, ...more.filter((c) => !seen.has(c.headline.trim().toLowerCase()))];
  }
  if (list.length < 3) throw new Error(`Model chỉ trả ${list.length}/3 phương án sau khi gọi bù`);
  return dedupeLayouts(list.slice(0, 3));
}

/** Groq dùng API tương thích OpenAI; structured output (json_schema) với gpt-oss. */
async function groqJson(prompt: string): Promise<unknown> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.9,
      messages: [
        { role: "system", content: "Bạn chỉ trả về JSON đúng schema được yêu cầu." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: "poster_variants", schema: copyJsonSchema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Groq ${res.status}: ${data?.error?.message ?? "lỗi không rõ"}`);
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

export function dedupeLayouts(list: PosterCopy[]): PosterCopy[] {
  const order: Layout[] = ["top", "bottom", "center"];
  const used = new Set<Layout>();
  return list.map((c) => {
    if (!used.has(c.layout)) {
      used.add(c.layout);
      return c;
    }
    const free = order.find((l) => !used.has(l)) ?? c.layout;
    used.add(free);
    return { ...c, layout: free };
  });
}

/** Tạo ảnh nền. Trả về data URL; null nếu model không trả ảnh (bị chặn an toàn, hết quota…). */
export async function generateBackground(prompt: string, layout: Layout, aspect: Brief["aspect"]): Promise<string | null> {
  if (!hasKey()) return null;
  const res = await ai().models.generateContent({
    model: IMAGE_MODEL,
    contents: finalImagePrompt(prompt, layout),
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
  });
  for (const part of res.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
  }
  return null;
}

/* ---------- Chế độ demo: chạy được khi chưa có API key ---------- */

function demoCopy(b: Brief): PosterCopy[] {
  const T = {
    vi: [
      [`${b.product} cho ngày mới`, b.message, "Mua ngay"],
      [`Đậm vị ${b.brandName}`, b.message, "Khám phá"],
      [`Ưu đãi tuần này`, `${b.product} — ${b.message}`, "Đặt hàng"],
    ],
    ko: [
      [`새로운 ${b.product}`, b.message, "지금 구매"],
      [`${b.brandName}의 맛`, b.message, "자세히 보기"],
      [`이번 주 특가`, `${b.product} — ${b.message}`, "주문하기"],
    ],
    en: [
      [`${b.product}, made for mornings`, b.message, "Shop now"],
      [`Taste ${b.brandName}`, b.message, "Discover"],
      [`This week only`, `${b.product} — ${b.message}`, "Order now"],
    ],
  }[b.language];
  const layouts: Layout[] = ["top", "bottom", "center"];
  return T.map(([headline, subline, cta], i) => ({
    headline,
    subline,
    cta,
    layout: layouts[i],
    imagePrompt: `demo background for ${b.product}`,
    rationale: "Chế độ demo: nội dung mẫu, chưa gọi AI.",
  }));
}

/** Nền gradient + hình khối từ màu thương hiệu, thay cho ảnh AI ở chế độ demo hoặc khi AI lỗi. */
export function fallbackBackground(b: Brief, seed: number): string {
  const [w, h] = b.aspect === "1:1" ? [1080, 1080] : b.aspect === "3:4" ? [1080, 1440] : [1080, 1920];
  const cx = [0.75, 0.25, 0.5][seed % 3] * w;
  const cy = [0.7, 0.3, 0.5][seed % 3] * h;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${b.primaryColor}"/><stop offset="1" stop-color="${b.accentColor}"/></linearGradient>
  <radialGradient id="r"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${cx}" cy="${cy}" r="${w * 0.42}" fill="url(#r)"/>
  <circle cx="${w - cx}" cy="${h - cy}" r="${w * 0.18}" fill="#000" fill-opacity=".12"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
