import { chromium, type Browser } from "playwright-core";
import type { Brief, PosterCopy, RenderMetrics } from "./types";

export const SIZE: Record<Brief["aspect"], [number, number]> = {
  "1:1": [1080, 1080],
  "3:4": [1080, 1440],
  "9:16": [1080, 1920],
};

let browserPromise: Promise<Browser> | null = null;
function browser() {
  if (!browserPromise) {
    const executablePath = process.env.CHROMIUM_PATH || undefined;
    browserPromise = chromium.launch({ headless: true, executablePath, channel: executablePath ? undefined : "chrome" });
    browserPromise.catch(() => (browserPromise = null));
  }
  return browserPromise;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type RenderInput = {
  copy: PosterCopy;
  background: string;
  brief: Pick<Brief, "language" | "aspect" | "accentColor" | "brandName">;
  scrim: boolean;
};

/**
 * Ghép chữ lên ảnh nền bằng Chromium headless: trình duyệt xử lý font, ngắt dòng
 * tiếng Việt/Hàn đúng hơn tự đo chữ trong Node. Script trong trang tự thu nhỏ cỡ chữ
 * cho vừa khung và đo độ tương phản thật dưới vùng chữ.
 */
export async function renderPoster(input: RenderInput): Promise<{ png: string; metrics: RenderMetrics }> {
  const [w, h] = SIZE[input.brief.aspect];
  const page = await (await browser()).newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html(input, w, h), { waitUntil: "load" });
    const metrics = (await page.evaluate("window.__layout()")) as RenderMetrics;
    const buf = await page.screenshot({ type: "jpeg", quality: 90 });
    return { png: `data:image/jpeg;base64,${buf.toString("base64")}`, metrics };
  } finally {
    await page.close();
  }
}

function html({ copy, background, brief, scrim }: RenderInput, w: number, h: number) {
  const pad = Math.round(w * 0.075);
  const font =
    brief.language === "ko"
      ? "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif"
      : "'Be Vietnam Pro', 'Helvetica Neue', Arial, sans-serif";
  const pos = { top: `top:${pad}px`, center: `top:50%;transform:translateY(-50%)`, bottom: `bottom:${pad}px` }[copy.layout];
  return `<!doctype html><html lang="${brief.language}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;800&family=Noto+Sans+KR:wght@500;800&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:${font}}
#bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#scrim{position:absolute;inset:0;display:${scrim ? "block" : "none"}}
#box{position:absolute;left:${pad}px;right:${pad}px;${pos};max-height:${Math.round(h * 0.46)}px;
  ${copy.layout === "center" ? "text-align:center" : ""}}
h1{font-weight:800;line-height:1.12;letter-spacing:-.01em;text-wrap:balance;word-break:${brief.language === "ko" ? "keep-all" : "normal"};overflow-wrap:anywhere}
p{font-weight:500;line-height:1.4;margin-top:.7em;text-wrap:pretty;word-break:${brief.language === "ko" ? "keep-all" : "normal"}}
.cta{display:inline-block;margin-top:1.1em;padding:.55em 1.3em;border-radius:999px;background:${brief.accentColor};color:#fff;font-weight:800}
.brand{position:absolute;right:${pad}px;${copy.layout === "bottom" ? `top:${pad}px` : `bottom:${pad}px`};font-weight:800;font-size:${Math.round(w * 0.03)}px;letter-spacing:.12em;text-transform:uppercase}
</style></head><body>
<img id="bg" src="${background}">
<div id="scrim"></div>
<div id="box"><h1 id="hl">${esc(copy.headline)}</h1>${copy.subline ? `<p id="sub">${esc(copy.subline)}</p>` : ""}${copy.cta ? `<div class="cta" id="cta">${esc(copy.cta)}</div>` : ""}</div>
<div class="brand" id="brand">${esc(brief.brandName)}</div>
<script>
const W=${w},H=${h},LAYOUT=${JSON.stringify(copy.layout)},SCRIM=${scrim};
const lum=(r,g,b)=>{const f=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
window.__layout=async()=>{
  await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,4000))]);
  const img=document.getElementById('bg'); if(!img.complete) await new Promise(r=>img.onload=img.onerror=r);
  const box=document.getElementById('box'),hl=document.getElementById('hl'),sub=document.getElementById('sub'),cta=document.getElementById('cta');
  // 1) Thu nhỏ chữ tới khi vừa khung (không tràn ngang, không vượt chiều cao tối đa).
  let size=Math.round(W*.105); const MIN=Math.round(W*.045); let overflow=false;
  const apply=s=>{hl.style.fontSize=s+'px'; if(sub) sub.style.fontSize=Math.max(Math.round(s*.42),26)+'px'; if(cta) cta.style.fontSize=Math.max(Math.round(s*.36),24)+'px';};
  apply(size);
  while(size>MIN && (box.scrollHeight>box.clientHeight+1 || hl.scrollWidth>hl.clientWidth+1)){size-=2;apply(size);}
  if(box.scrollHeight>box.clientHeight+1 || hl.scrollWidth>hl.clientWidth+1) overflow=true;
  // 2) Đọc điểm ảnh nền ngay dưới khối chữ (vẽ lại ảnh theo object-fit:cover lên canvas).
  const r=box.getBoundingClientRect(); const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const ctx=cv.getContext('2d');
  const s=Math.max(W/img.naturalWidth,H/img.naturalHeight); const dw=img.naturalWidth*s, dh=img.naturalHeight*s;
  ctx.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);
  const sample=()=>{const d=ctx.getImageData(Math.max(0,r.left),Math.max(0,r.top),Math.min(W,r.width),Math.min(H,r.height)).data;const L=[];for(let i=0;i<d.length;i+=4*37)L.push(lum(d[i],d[i+1],d[i+2]));return L.sort((a,b)=>a-b);};
  let L=sample(); const avg=L.reduce((a,b)=>a+b,0)/L.length;
  const light=avg<0.4; // nền tối -> chữ trắng
  const textL=light?1:lum(17,17,17);
  const color=light?'#ffffff':'#111111';
  // 3) Nếu bật scrim: phủ dải màu sau chữ và đo lại trên canvas với đúng dải đó.
  if(SCRIM){
    const dir=LAYOUT==='bottom'?'to top':'to bottom';
    const c=light?'0,0,0':'255,255,255';
    const css=LAYOUT==='center'
      ? 'radial-gradient(ellipse at center, rgba('+c+',.62) 0%, rgba('+c+',.38) 45%, rgba('+c+',0) 75%)'
      : 'linear-gradient('+dir+', rgba('+c+',.72) 0%, rgba('+c+',.45) 45%, rgba('+c+',0) 70%)';
    document.getElementById('scrim').style.background=css;
    let g;
    if(LAYOUT==='center'){g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.75);g.addColorStop(0,'rgba('+c+',.62)');g.addColorStop(.45,'rgba('+c+',.38)');g.addColorStop(.75,'rgba('+c+',0)');}
    else {g=LAYOUT==='bottom'?ctx.createLinearGradient(0,H,0,0):ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba('+c+',.72)');g.addColorStop(.45,'rgba('+c+',.45)');g.addColorStop(.7,'rgba('+c+',0)');}
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); L=sample();
  }
  // Lấy pixel "tệ nhất" (phân vị 10%) thay vì trung bình: nền loang lổ có chỗ rất sáng sẽ làm chữ khó đọc.
  const worst=light?L[Math.floor(L.length*.9)]:L[Math.floor(L.length*.1)];
  const contrast=Math.round(ratio(textL,worst)*100)/100;
  for(const el of [hl,sub,document.getElementById('brand')]) if(el) el.style.color=color;
  hl.style.textShadow=light?'0 2px 18px rgba(0,0,0,.25)':'none';
  return {headlineFontPx:size,overflow,contrast,scrim:SCRIM};
};
</script></body></html>`;
}
