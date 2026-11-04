/**
 * What the fake PayTR's pages share: the shell, the look of PayTR's
 * hosted form (white, one column), the frame's resizing as PayTR's own
 * pages do it, and the Turkish formats.
 */

export const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`)

/** "1.234,50 TL" for 123450 kuruş. */
export const lira = (kurus: number): string =>
  `${(kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`

/** "03.11.2026 14:22" in Turkish time. */
export const turkishTime = (at: number): string =>
  new Date(at).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/** "0532 *** ** 67": the phone the bank's code goes to, as banks show it. */
export function maskedPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10)
  return digits.length === 10
    ? `0${digits.slice(0, 3)} *** ** ${digits.slice(8)}`
    : "kayıtlı telefonunuz"
}

/** JSON for a script block: nothing in it can close the block. */
export const scriptJson = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c")

const LOCK =
  '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'

export const lockIcon = (): string => LOCK

const STYLE = `
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.45 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2937;background:#fff}
  main{max-width:520px;margin:0 auto;padding:14px 16px 10px}
  .top{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding-bottom:10px;border-bottom:1px solid #e5e7eb;margin-bottom:12px}
  .top small{display:block;color:#6b7280;font-size:12px}
  .top strong{font-size:22px;font-weight:600;letter-spacing:-.01em}
  .secure{display:flex;align-items:center;gap:5px;color:#047857;font-size:12px;font-weight:600}
  label,legend{display:block;font-size:12px;font-weight:600;color:#374151;margin:0 0 4px}
  .field{margin:0 0 9px}
  input{width:100%;height:38px;padding:0 11px;font:inherit;font-size:15px;color:#111827;border:1px solid #d1d5db;border-radius:6px;background:#fff;outline:none}
  input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
  .number{position:relative}
  .program{position:absolute;right:8px;top:9px;font-size:11px;font-weight:700;padding:3px 7px;border-radius:4px;background:#eef2ff;color:#3730a3}
  .program:empty{display:none}
  .row{display:grid;grid-template-columns:1fr 110px;gap:10px}
  fieldset{border:0;padding:0;margin:2px 0 12px}
  .options{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:6px}
  .option{display:flex;gap:7px;align-items:flex-start;padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;font-weight:400;margin:0;line-height:1.3}
  .option:has(input:checked){border-color:#2563eb;background:#f5f8ff}
  .option input{width:auto;height:auto;margin:3px 0 0}
  .option b{display:block;font-size:13px;color:#111827;white-space:nowrap}
  .option small{display:block;font-size:11px;color:#6b7280;white-space:nowrap}
  .hint{font-size:12px;color:#6b7280;margin:6px 0 0}
  button{width:100%;height:44px;border:0;border-radius:6px;background:#1d4ed8;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#1e40af}
  .error{margin:0 0 12px;padding:9px 11px;border-radius:6px;background:#fef2f2;color:#b91c1c;font-size:13px}
  .notice{margin:0 0 12px;padding:9px 11px;border-radius:6px;background:#fffbeb;color:#92400e;font-size:13px}
  footer{margin-top:10px;font-size:11px;color:#6b7280;text-align:center}
  footer p{margin:3px 0}
  .brands{letter-spacing:.06em;font-weight:600;color:#9ca3af}
`

/**
 * What PayTR's own pages run for the shop's frame: iframe-resizer's
 * content script (docs/entegrasyonlar/paytr.md). It says nothing until
 * the shop's page sends `[iFrameSizer]<id>:…` (its third field a
 * boolean), then sends `[iFrameSizer]<id>:<height>:<width>:<type>` to it:
 * at once (`init`), when the page changes (`mutationObserver`) or its
 * width does (`resize`), and when the shop asks (`[iFrameSizer]resize` →
 * `resizeParent`). The height is the body's, margins included
 * (`bodyOffset`, the default). The bank's 3-D Secure page runs none.
 */
const RESIZER_CONTENT = `(function(){
  var P="[iFrameSizer]",id=null,host=null,last=-1;
  function height(){var b=document.body,s=getComputedStyle(b);return Math.ceil(b.offsetHeight+parseFloat(s.marginTop)+parseFloat(s.marginBottom))}
  function send(type){if(!host)return;var h=height();if(h===last&&type!=="init"&&type!=="resizeParent")return;last=h;host.postMessage(P+id+":"+h+":"+document.documentElement.scrollWidth+":"+type,"*")}
  addEventListener("message",function(e){var d=""+e.data;if(d.slice(0,P.length)!==P)return;var f=d.slice(P.length).split(":");
    if(id===null){if(f[2]!=="true"&&f[2]!=="false")return;id=f[0];host=e.source;send("init");
      new MutationObserver(function(){send("mutationObserver")}).observe(document.body,{attributes:true,childList:true,subtree:true,characterData:true});
      addEventListener("resize",function(){send("resize")});return}
    if(f[0]==="resize")send("resizeParent")});
})()`

export function page(title: string, body: string, script = ""): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>${STYLE}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`
}

/** One of PayTR's own pages (the form, a finished or missing payment): it tells the frame its height. */
export const paytrPage = (title: string, body: string, script = ""): string =>
  page(title, body, script ? `${script};\n${RESIZER_CONTENT}` : RESIZER_CONTENT)
