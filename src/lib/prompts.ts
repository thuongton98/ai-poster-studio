import type { Brief, Layout } from "./types";

const LANG_NAME = { vi: "tiếng Việt", ko: "tiếng Hàn (한국어)", en: "English" } as const;

/** Giới hạn độ dài theo ngôn ngữ: tiếng Hàn đặc hơn nên ít ký tự hơn. */
export const HEADLINE_MAX = { vi: 42, ko: 18, en: 40 } as const;

export function copyPrompt(b: Brief): string {
  return [
    `Bạn là copywriter quảng cáo mạng xã hội. Viết 3 phương án poster KHÁC NHAU cho thương hiệu sau.`,
    `Thương hiệu: ${b.brandName}`,
    `Sản phẩm: ${b.product}`,
    `Thông điệp chính: ${b.message}`,
    b.audience ? `Khách hàng mục tiêu: ${b.audience}` : "",
    `Giọng văn: ${b.tone}`,
    `Ngôn ngữ của headline, subline, cta: ${LANG_NAME[b.language]}.`,
    ``,
    `Quy tắc:`,
    `- headline tối đa ${HEADLINE_MAX[b.language]} ký tự, không dùng emoji, không dùng dấu chấm than liên tiếp.`,
    `- subline tối đa 90 ký tự; cta tối đa 18 ký tự (động từ hành động).`,
    `- Mỗi phương án dùng một layout khác nhau trong: top, center, bottom (vị trí khối chữ).`,
    `- imagePrompt viết bằng tiếng Anh, mô tả ẢNH NỀN không có chữ: chủ thể, ánh sáng, chất liệu, bảng màu gần ${b.primaryColor} và ${b.accentColor}.`,
    `  imagePrompt PHẢI chừa khoảng trống sạch, ít chi tiết ở đúng vùng đặt chữ của layout đã chọn, và PHẢI ghi rõ "no text, no letters, no logos, no watermark".`,
    `- rationale: 1 câu tiếng Việt giải thích vì sao phương án này hợp thương hiệu (để người dùng quyết định nhanh).`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SPACE: Record<Layout, string> = {
  top: "keep the top 40% of the frame as clean, low-detail negative space",
  center: "keep a soft, low-detail area in the center of the frame",
  bottom: "keep the bottom 40% of the frame as clean, low-detail negative space",
};

/**
 * LLM hay quên luật "không chữ" hoặc vùng trống, nên server luôn tự nối thêm
 * ràng buộc thay vì tin hoàn toàn vào imagePrompt của LLM.
 */
export function finalImagePrompt(raw: string, layout: Layout): string {
  return `${raw.trim().replace(/\.$/, "")}. Composition: ${SPACE[layout]}. Advertising photography, high quality. Strictly no text, no letters, no typography, no logos, no watermark.`;
}
