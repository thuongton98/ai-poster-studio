import { z } from "zod";

export const LANGS = ["vi", "ko", "en"] as const;
export const ASPECTS = ["1:1", "3:4", "9:16"] as const;
export const TONES = ["thân thiện", "sang trọng", "năng động", "tối giản"] as const;

export const BriefSchema = z.object({
  brandName: z.string().trim().min(1).max(60),
  product: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(240),
  audience: z.string().trim().max(120).default(""),
  tone: z.enum(TONES),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  language: z.enum(LANGS),
  aspect: z.enum(ASPECTS),
});
export type Brief = z.infer<typeof BriefSchema>;

export const LAYOUTS = ["top", "center", "bottom"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** Một phương án nội dung do LLM đề xuất (chưa có ảnh). */
export const CopySchema = z.object({
  headline: z.string().min(1).max(80),
  subline: z.string().max(140),
  cta: z.string().max(40),
  layout: z.enum(LAYOUTS),
  imagePrompt: z.string().min(10).max(800),
  rationale: z.string().max(300),
});
export type PosterCopy = z.infer<typeof CopySchema>;

export type Issue = {
  code: "LOW_CONTRAST" | "TEXT_OVERFLOW" | "FONT_TOO_SMALL" | "HEADLINE_TOO_LONG" | "IMAGE_FALLBACK";
  severity: "error" | "warn";
  message: string;
};

export type RenderMetrics = {
  headlineFontPx: number;
  overflow: boolean;
  /** Tỉ lệ tương phản WCAG giữa chữ và nền ảnh ngay dưới vùng chữ. */
  contrast: number;
  scrim: boolean;
};

export type Variant = {
  id: string;
  copy: PosterCopy;
  /** Ảnh nền (data URL), giữ lại để sửa chữ mà không phải gọi AI tạo ảnh lần nữa. */
  background: string;
  poster: string;
  metrics: RenderMetrics;
  issues: Issue[];
  autoFixes: string[];
};

export type GenerateResult = {
  mode: "gemini" | "groq" | "groq+gemini" | "demo";
  variants: Variant[];
  stats: { aiCalls: number; ms: number; notes: string[] };
};
