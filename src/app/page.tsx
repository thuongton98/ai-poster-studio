"use client";

import { useState } from "react";
import type { Brief, GenerateResult, Variant } from "@/lib/types";
import { ASPECTS, LANGS, TONES } from "@/lib/types";

const LANG_LABEL = { vi: "Tiếng Việt", ko: "한국어", en: "English" } as const;

const DEFAULT: Brief = {
  brandName: "Mộc Coffee",
  product: "Cà phê muối đóng chai",
  message: "Vị mặn nhẹ, béo thơm — mang Huế về bàn làm việc của bạn",
  audience: "Dân văn phòng 22–35 tuổi",
  tone: "năng động",
  primaryColor: "#3b2a20",
  accentColor: "#d9822b",
  language: "vi",
  aspect: "3:4",
};

type Decision = "applied" | "skipped" | undefined;

export default function Home() {
  const [brief, setBrief] = useState<Brief>(DEFAULT);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => ({ ...b, [k]: v }));

  async function run() {
    setLoading(true);
    setError("");
    setDecisions({});
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi không xác định");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(v: Variant, headline: string, subline: string, cta: string) {
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, brief, background: v.background, copy: { ...v.copy, headline, subline, cta } }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setResult((r) => r && { ...r, variants: r.variants.map((x) => (x.id === v.id ? data : x)) });
    setEditing(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">AI Poster Studio</h1>
        <p className="text-sm text-neutral-600">
          Nhập thông tin thương hiệu → AI đề xuất 3 phương án kèm lý do và bản xem trước → bạn chọn <b>Áp dụng</b>, <b>Bỏ qua</b> hoặc <b>Sửa chữ</b>.
        </p>
      </header>

      <section className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <Field label="Tên thương hiệu"><input className="inp" value={brief.brandName} onChange={(e) => set("brandName", e.target.value)} /></Field>
        <Field label="Sản phẩm"><input className="inp" value={brief.product} onChange={(e) => set("product", e.target.value)} /></Field>
        <Field label="Thông điệp chính" wide><textarea className="inp" rows={2} value={brief.message} onChange={(e) => set("message", e.target.value)} /></Field>
        <Field label="Khách hàng mục tiêu"><input className="inp" value={brief.audience} onChange={(e) => set("audience", e.target.value)} /></Field>
        <Field label="Giọng văn">
          <select className="inp" value={brief.tone} onChange={(e) => set("tone", e.target.value as Brief["tone"])}>
            {TONES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Ngôn ngữ">
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button key={l} type="button" onClick={() => set("language", l)} className={`chip ${brief.language === l ? "chip-on" : ""}`}>{LANG_LABEL[l]}</button>
            ))}
          </div>
        </Field>
        <Field label="Tỉ lệ">
          <div className="flex gap-2">
            {ASPECTS.map((a) => (
              <button key={a} type="button" onClick={() => set("aspect", a)} className={`chip ${brief.aspect === a ? "chip-on" : ""}`}>{a}</button>
            ))}
          </div>
        </Field>
        <Field label="Màu thương hiệu">
          <div className="flex items-center gap-3">
            <input type="color" value={brief.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} />
            <input type="color" value={brief.accentColor} onChange={(e) => set("accentColor", e.target.value)} />
            <span className="text-xs text-neutral-500">chính · nhấn (nút CTA)</span>
          </div>
        </Field>
        <div className="sm:col-span-2">
          <button onClick={run} disabled={loading} className="rounded-lg bg-neutral-900 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
            {loading ? "Đang tạo… (AI viết nội dung, tạo ảnh, ghép chữ)" : "Tạo 3 phương án"}
          </button>
        </div>
      </section>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${result.mode === "demo" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              {{ demo: "Chế độ demo (chưa có API key)", gemini: "Gemini: nội dung + ảnh", groq: "Groq: nội dung · nền gradient", "groq+gemini": "Groq: nội dung · Gemini: ảnh" }[result.mode]}
            </span>
            <span>{result.stats.aiCalls} lần gọi AI · {(result.stats.ms / 1000).toFixed(1)} giây</span>
            {result.stats.notes.map((n) => <span key={n} className="text-amber-700">{n}</span>)}
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {result.variants.map((v) => (
              <Card key={v.id} v={v} decision={decisions[v.id]} editing={editing === v.id}
                onDecide={(d) => setDecisions((s) => ({ ...s, [v.id]: d }))}
                onEdit={() => setEditing(v.id)} onCancel={() => setEditing(null)} onSave={saveEdit} brand={brief.brandName} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function Card(props: {
  v: Variant; decision: Decision; editing: boolean; brand: string;
  onDecide: (d: Decision) => void; onEdit: () => void; onCancel: () => void;
  onSave: (v: Variant, h: string, s: string, c: string) => Promise<void>;
}) {
  const { v, decision } = props;
  const [h, setH] = useState(v.copy.headline);
  const [s, setS] = useState(v.copy.subline);
  const [c, setC] = useState(v.copy.cta);
  const [saving, setSaving] = useState(false);
  const errors = v.issues.filter((i) => i.severity === "error");

  return (
    <article className={`overflow-hidden rounded-xl border bg-white transition ${decision === "skipped" ? "opacity-40" : ""} ${decision === "applied" ? "ring-2 ring-emerald-500" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={v.poster} alt={v.copy.headline} className="w-full" />
      <div className="space-y-2 p-3 text-sm">
        <p><span className="font-semibold">Vì sao đề xuất:</span> {v.copy.rationale}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge ok={v.metrics.contrast >= 4.5}>Tương phản {v.metrics.contrast}:1</Badge>
          <Badge ok={!v.metrics.overflow}>{v.metrics.overflow ? "Tràn chữ" : "Vừa khung"}</Badge>
          <Badge ok>{v.copy.layout}</Badge>
        </div>
        {v.autoFixes.map((f) => <p key={f} className="text-xs text-emerald-700">Tự sửa: {f}</p>)}
        {v.issues.map((i) => <p key={i.code} className={`text-xs ${i.severity === "error" ? "text-red-600" : "text-amber-700"}`}>{i.message}</p>)}

        {props.editing ? (
          <div className="space-y-2">
            <input className="inp" value={h} onChange={(e) => setH(e.target.value)} />
            <input className="inp" value={s} onChange={(e) => setS(e.target.value)} />
            <input className="inp" value={c} onChange={(e) => setC(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-dark" disabled={saving} onClick={async () => { setSaving(true); await props.onSave(v, h, s, c); setSaving(false); }}>{saving ? "Đang ghép…" : "Ghép lại chữ"}</button>
              <button className="btn" onClick={props.onCancel}>Huỷ</button>
            </div>
            <p className="text-xs text-neutral-500">Chỉ ghép lại chữ trên ảnh nền cũ, không tốn thêm lượt gọi AI.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-dark" disabled={errors.length > 0} title={errors.length ? "Còn lỗi cần sửa trước khi áp dụng" : ""} onClick={() => props.onDecide("applied")}>Áp dụng</button>
            <button className="btn" onClick={() => props.onDecide("skipped")}>Bỏ qua</button>
            <button className="btn" onClick={props.onEdit}>Sửa chữ</button>
            {decision === "applied" && (
              <a className="btn" href={v.poster} download={`${props.brand}-${v.id}.jpg`}>Tải ảnh</a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${ok ? "bg-neutral-100 text-neutral-700" : "bg-red-100 text-red-700"}`}>{children}</span>;
}
