import { fallbackBackground, generateBackground, generateCopy, hasKey, textProvider } from "./ai";
import { checkPoster } from "./quality";
import { renderPoster } from "./render";
import type { Brief, GenerateResult, PosterCopy, Variant } from "./types";

async function withRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

/**
 * Ghép chữ + kiểm tra + tự sửa theo luật xác định:
 * tương phản thấp -> bật lớp phủ (scrim) rồi đo lại. Không gọi lại AI tạo ảnh,
 * vì sửa chữ/nền bằng code rẻ và ổn định hơn sinh lại cả ảnh.
 */
export async function composeVariant(id: string, copy: PosterCopy, background: string, brief: Brief, fallback: boolean): Promise<Variant> {
  const autoFixes: string[] = [];
  let out = await renderPoster({ copy, background, brief, scrim: false });
  let issues = checkPoster(copy, out.metrics, brief, fallback);
  if (issues.some((i) => i.code === "LOW_CONTRAST")) {
    const before = out.metrics.contrast;
    out = await renderPoster({ copy, background, brief, scrim: true });
    issues = checkPoster(copy, out.metrics, brief, fallback);
    autoFixes.push(`Tương phản ${before}:1 thấp → thêm lớp phủ sau chữ, còn ${out.metrics.contrast}:1.`);
  }
  return { id, copy, background, poster: out.png, metrics: out.metrics, issues, autoFixes };
}

export async function generate(brief: Brief): Promise<GenerateResult> {
  const t0 = Date.now();
  const notes: string[] = [];
  let aiCalls = 0;

  const provider = textProvider();
  const copies = await withRetry(() => {
    aiCalls += provider ? 1 : 0;
    return generateCopy(brief);
  });
  if (!hasKey()) notes.push("Chưa có GEMINI_API_KEY: ảnh nền dùng gradient theo màu thương hiệu.");

  const variants = await Promise.all(
    copies.map(async (copy, i) => {
      let bg: string | null = null;
      try {
        bg = await withRetry(() => {
          aiCalls += hasKey() ? 1 : 0;
          return generateBackground(copy.imagePrompt, copy.layout, brief.aspect);
        });
      } catch (e) {
        notes.push(`Phương án ${i + 1}: tạo ảnh lỗi (${(e as Error).message.slice(0, 120)}), dùng nền dự phòng.`);
      }
      const fallback = !bg;
      return composeVariant(`v${i + 1}`, copy, bg ?? fallbackBackground(brief, i), brief, fallback && hasKey());
    }),
  );

  const mode = hasKey() ? (provider === "groq" ? "groq+gemini" : "gemini") : provider === "groq" ? "groq" : "demo";
  return { mode, variants, stats: { aiCalls, ms: Date.now() - t0, notes } };
}
