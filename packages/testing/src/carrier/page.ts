import type { IncomingMessage, ServerResponse } from "node:http"
import { STAGES, maskedName, nextStage, stageIndex, stageNamed } from "./tracking"
import type { Stage, StageMove } from "./tracking"

/**
 * A fake carrier's public tracking page, at `<fake>/takip/<number>`, as a
 * carrier shows a parcel to the shopper: the stages with their dates, the
 * moves with the unit that made them, the masked receiver, where it goes.
 * Below it, on this machine only, buttons move the parcel on by hand
 * (`POST /takip/<number>/ilerle`, `adim` = kurye-aldi, transfer,
 * dagitimda or teslim-edildi; none means the next stage); the same state
 * is JSON at `/takip/<number>.json`. A carrier's own query address with
 * `?code=<number>` leads to the page.
 */

export interface TrackingPlace {
  town: string
  city: string
}

export interface TrackingView {
  number: string
  stage: Stage
  /** Every stage reached, the first ("created") included. */
  moves: StageMove[]
  canceled: boolean
  /** A line under the status ("İade isteği alındı"). */
  note: string | null
  receiverName: string
  destination: TrackingPlace
  origin: TrackingPlace | null
  pieces: number
  desi: string | null
}

export interface TrackedParcel {
  view: () => TrackingView
  /** Moves the parcel on to `stage`; false when it cannot (cancelled, or there already). */
  advance: (stage: Stage) => boolean
}

export interface TrackingSource {
  carrier: string
  /** The page's accent colour. */
  color: string
  find: (number: string) => TrackedParcel | null
  /** The carrier's own words for a move, where they differ from the usual. */
  words?: Partial<Record<Stage, string>>
}

const WORDS: Record<Stage, string> = {
  created: "Gönderi kaydı oluşturuldu",
  picked_up: "Kargo teslim alındı",
  in_transit: "Transfer merkezinde",
  out_for_delivery: "Dağıtıma çıkarıldı",
  delivered: "Teslim edildi",
}
const STEP_NAMES: Record<Stage, string> = {
  created: "Kayıt",
  picked_up: "Teslim alındı",
  in_transit: "Yolda",
  out_for_delivery: "Dağıtımda",
  delivered: "Teslim edildi",
}
const BUTTONS: readonly [string, Stage, string][] = [
  ["kurye-aldi", "picked_up", "Kurye aldı"],
  ["transfer", "in_transit", "Transfer"],
  ["dagitimda", "out_for_delivery", "Dağıtımda"],
  ["teslim-edildi", "delivered", "Teslim edildi"],
]

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char
  )

const when = (at: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(at))

const placeName = (place: TrackingPlace) => `${place.town} / ${place.city}`

/** The unit a move happened at, as carriers name them. */
function unitOf(stage: Stage, view: TrackingView): string {
  switch (stage) {
    case "created":
      return "İnternet şubesi"
    case "picked_up":
      return view.origin ? `${view.origin.town} Şube` : "Çıkış şubesi"
    case "in_transit":
      return view.origin ? `${view.origin.city} Transfer Merkezi` : "Transfer Merkezi"
    case "out_for_delivery":
    case "delivered":
      return `${view.destination.town} Şube`
  }
}

/** The state as JSON: what the page shows, for a script or a test. */
export function trackingJson(source: TrackingSource, view: TrackingView) {
  const words = { ...WORDS, ...source.words }
  return {
    carrier: source.carrier,
    trackingNumber: view.number,
    status: view.canceled ? "canceled" : view.stage,
    statusText: view.canceled ? "İptal edildi" : words[view.stage],
    events: view.moves.map((move) => ({
      status: move.stage,
      text: words[move.stage],
      unit: unitOf(move.stage, view),
      at: move.at,
    })),
  }
}

function page(source: TrackingSource, view: TrackingView | null, number: string): string {
  const words = { ...WORDS, ...source.words }
  const carrier = source.carrier
  const head = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(carrier)} Gönderi Takip</title><style>
:root{--accent:${source.color};--line:#e3e6ea;--muted:#5d6670}
body{margin:0;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f5f7;color:#1c2127}
header{background:var(--accent);color:#fff;padding:14px 16px}header b{font-size:20px;letter-spacing:.5px}header span{display:block;opacity:.85;font-size:13px}
main{max-width:760px;margin:0 auto;padding:16px}.card{background:#fff;border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:14px}
.num{color:var(--muted);font-size:13px}.num b{display:block;color:#1c2127;font-size:22px;letter-spacing:1px}.status{font-size:18px;font-weight:600;margin-top:8px}
ol{display:flex;list-style:none;padding:0;margin:16px 0 0;gap:4px}ol li{flex:1;font-size:12px;color:var(--muted);border-top:4px solid var(--line);padding-top:6px}
ol li.done{border-color:var(--accent);color:#1c2127}ol li small{display:block}dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0}
dt{font-size:12px;color:var(--muted)}dd{margin:0;font-weight:600}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)}th{font-size:12px;color:var(--muted)}
.dev{border-style:dashed}.dev p{color:var(--muted);font-size:13px;margin:4px 0 12px}.dev form{display:flex;flex-wrap:wrap;gap:8px}.dev button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid var(--accent);background:#fff;color:var(--accent);cursor:pointer}.dev button:disabled{opacity:.4;cursor:default}
.note{color:#9a3412;margin-top:4px}</style></head><body><header><b>${escape(carrier.toLocaleUpperCase("tr"))}</b><span>Gönderi Takip</span></header><main>`
  if (!view) {
    return `${head}<section class="card"><div class="num">Takip No<b>${escape(number)}</b></div><p>Bu numarayla kayıtlı bir gönderi bulunamadı.</p></section></main></body></html>`
  }
  const reached = new Map(view.moves.map((move) => [move.stage, move.at]))
  const steps = STAGES.map((stage) => {
    const at = reached.get(stage)
    return `<li class="${at ? "done" : ""}">${STEP_NAMES[stage]}${at ? `<small>${when(at)}</small>` : ""}</li>`
  }).join("")
  const rows = [...view.moves]
    .reverse()
    .map(
      (move) =>
        `<tr><td>${when(move.at)}</td><td>${escape(words[move.stage])}</td><td>${escape(unitOf(move.stage, view))}</td></tr>`
    )
    .join("")
  const details = [
    ["Gönderi tarihi", view.moves[0] ? when(view.moves[0].at) : "-"],
    ["Çıkış", view.origin ? placeName(view.origin) : "-"],
    ["Varış", placeName(view.destination)],
    ["Alıcı", maskedName(view.receiverName)],
    ["Parça", String(view.pieces)],
    ...(view.desi ? [["Desi", view.desi]] : []),
  ]
    .map(([name = "", value = ""]) => `<div><dt>${name}</dt><dd>${escape(value)}</dd></div>`)
    .join("")
  const at = stageIndex(view.stage)
  const buttons = BUTTONS.map(
    ([slug, stage, label]) =>
      `<button name="adim" value="${slug}"${view.canceled || stageIndex(stage) <= at ? " disabled" : ""}>${label}</button>`
  ).join("")
  return `${head}<section class="card"><div class="num">Takip No<b>${escape(view.number)}</b></div>
<div class="status">${view.canceled ? "İptal edildi" : escape(words[view.stage])}</div>${view.note ? `<div class="note">${escape(view.note)}</div>` : ""}
<ol>${steps}</ol></section>
<section class="card"><dl>${details}</dl></section>
<section class="card"><table><thead><tr><th>Tarih</th><th>İşlem</th><th>Birim</th></tr></thead><tbody>${rows}</tbody></table></section>
<section class="card dev"><b>Geliştirme ortamı: gönderiyi ilerlet</b><p>Bu düğmeler yalnızca bu bilgisayardaki kargo servisinde var; canlıda durumu kargo firması günceller.</p>
<form method="post" action="/takip/${encodeURIComponent(view.number)}/ilerle">${buttons}</form></section></main></body></html>`
}

// The carriers' public query addresses (`?code=<number>`): Aras's, Yurtiçi's, and ours
const QUERY_PATHS = ["/mainpage.aspx", "/tr/online-servisler/gonderi-sorgula", "/takip"]

const TRACKING_PATH = /^\/takip\/([A-Za-z0-9-]{1,40})(\.json|\/ilerle)?\/?$/

/**
 * Answers the tracking page's requests; false for any other request, left
 * to the fake. `body` is the request's text, read already.
 */
export function serveTracking(
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
  source: TrackingSource
): boolean {
  const url = new URL(req.url ?? "/", "http://fake")
  const method = req.method ?? "GET"
  const code = url.searchParams.get("code")
  if (method === "GET" && code && QUERY_PATHS.includes(url.pathname)) {
    res.writeHead(302, { location: `/takip/${encodeURIComponent(code)}` }).end()
    return true
  }
  const match = TRACKING_PATH.exec(url.pathname)
  if (!match) {
    return false
  }
  const number = match[1] ?? ""
  const parcel = source.find(number)
  const json = (status: number, value: unknown) =>
    res
      .writeHead(status, { "content-type": "application/json; charset=utf-8" })
      .end(JSON.stringify(value))
  if (match[2] === "/ilerle" && method === "POST") {
    const form = (req.headers["content-type"] ?? "").startsWith("application/x-www-form-urlencoded")
    let asked = url.searchParams.get("adim")
    if (form) {
      asked = new URLSearchParams(body).get("adim") ?? asked
    } else if (body.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(body) as { adim?: unknown }
        asked = typeof parsed.adim === "string" ? parsed.adim : asked
      } catch {
        json(400, { error: "invalid_json" })
        return true
      }
    }
    const view = parcel?.view()
    const stage = asked ? stageNamed(asked) : view ? nextStage(view.stage) : null
    const moved = Boolean(parcel && stage && parcel.advance(stage))
    if (form) {
      res.writeHead(303, { location: `/takip/${encodeURIComponent(number)}` }).end()
    } else if (!parcel) {
      json(404, { error: "not_found" })
    } else {
      json(moved ? 200 : 409, { moved, ...trackingJson(source, parcel.view()) })
    }
    return true
  }
  if (method !== "GET") {
    json(405, { error: "method_not_allowed" })
    return true
  }
  if (match[2] === ".json") {
    if (parcel) {
      json(200, trackingJson(source, parcel.view()))
    } else {
      json(404, { error: "not_found" })
    }
    return true
  }
  res
    .writeHead(parcel ? 200 : 404, { "content-type": "text/html; charset=utf-8" })
    .end(page(source, parcel?.view() ?? null, number))
  return true
}
