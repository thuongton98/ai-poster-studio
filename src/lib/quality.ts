import { HEADLINE_MAX } from "./prompts";
import type { Brief, Issue, PosterCopy, RenderMetrics } from "./types";

/** Ngưỡng WCAG cho chữ lớn (headline ≥ 24px) là 3:1; đặt 4.5 để subline cũng đọc được. */
export const MIN_CONTRAST = 4.5;

export function checkPoster(copy: PosterCopy, m: RenderMetrics, b: Brief, usedFallbackImage: boolean): Issue[] {
  const issues: Issue[] = [];
  if (m.contrast < MIN_CONTRAST)
    issues.push({ code: "LOW_CONTRAST", severity: "error", message: `Tương phản chữ/nền ${m.contrast}:1 (cần ≥ ${MIN_CONTRAST}:1).` });
  if (m.overflow)
    issues.push({ code: "TEXT_OVERFLOW", severity: "error", message: "Chữ không vừa khung kể cả ở cỡ nhỏ nhất." });
  if (m.headlineFontPx < 64)
    issues.push({ code: "FONT_TOO_SMALL", severity: "warn", message: `Headline chỉ còn ${m.headlineFontPx}px, khó đọc trên điện thoại.` });
  if ([...copy.headline].length > HEADLINE_MAX[b.language])
    issues.push({ code: "HEADLINE_TOO_LONG", severity: "warn", message: `Headline ${[...copy.headline].length} ký tự, nên ≤ ${HEADLINE_MAX[b.language]}.` });
  if (usedFallbackImage)
    issues.push({ code: "IMAGE_FALLBACK", severity: "warn", message: "Không có ảnh AI, đang dùng nền gradient theo màu thương hiệu." });
  return issues;
}
