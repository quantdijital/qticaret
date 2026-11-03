import { randomInt } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

/**
 * What the fake carriers share about a parcel's way: the five stages a
 * carrier's tracking page shows, the moves recorded with their time, how
 * a parcel moves on (by hand from the tracking page, or a step on each
 * read for the tests), tracking numbers in each carrier's shape, and the
 * state kept on disk between runs of a developer's fake.
 */

export const STAGES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const
export type Stage = (typeof STAGES)[number]

/** A move as the fake recorded it: the stage reached and when. */
export interface StageMove {
  stage: Stage
  at: string
}

/**
 * How parcels move on: `on-read`, a step each time the shop reads the
 * parcel (the tests' default, so a polling job drives it to delivered);
 * `manual`, only from the tracking page's buttons (a developer's fake).
 */
export type AdvanceMode = "on-read" | "manual"

/** The dev runners' choice: by hand unless `FAKE_CARRIER_AUTO_ADVANCE=1`. */
export const advanceModeFromEnv = (): AdvanceMode =>
  process.env["FAKE_CARRIER_AUTO_ADVANCE"] === "1" ? "on-read" : "manual"

/** The stage `name` as a request names it: an English key or the button's slug. */
export function stageNamed(name: string | null | undefined): Stage | null {
  const aliases: Readonly<Record<string, Stage>> = {
    "kurye-aldi": "picked_up",
    transfer: "in_transit",
    dagitimda: "out_for_delivery",
    "teslim-edildi": "delivered",
  }
  const key = (name ?? "").trim().toLowerCase()
  return aliases[key] ?? STAGES.find((stage) => stage === key) ?? null
}

export const stageIndex = (stage: Stage): number => STAGES.indexOf(stage)

/** The stage after `stage`, or null at the end. */
export const nextStage = (stage: Stage): Stage | null => STAGES[stageIndex(stage) + 1] ?? null

/** Moves to `to` recorded, with the stages skipped on the way stamped at the same time. */
export function movesTo(from: Stage, to: Stage, at = new Date()): StageMove[] {
  return STAGES.slice(stageIndex(from) + 1, stageIndex(to) + 1).map((stage) => ({
    stage,
    at: at.toISOString(),
  }))
}

/**
 * A tracking number in a carrier's shape, unique among `taken`: `prefix`
 * then digits, the first not a zero.
 */
export function trackingNumber(
  shape: { digits: number; prefix?: string },
  taken: (candidate: string) => boolean
): string {
  for (;;) {
    let digits = String(randomInt(1, 10))
    while (digits.length < shape.digits) {
      digits += String(randomInt(0, 10))
    }
    const candidate = `${shape.prefix ?? ""}${digits}`
    if (!taken(candidate)) {
      return candidate
    }
  }
}

/** A name as carriers show it on a public page: "AY** YI****". */
export const maskedName = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const letters = Array.from(part.toLocaleUpperCase("tr"))
      return letters.slice(0, 2).join("") + "*".repeat(Math.max(0, letters.length - 2))
    })
    .join(" ")

/** Where a developer's fake keeps its parcels between runs: the OS temp folder, by port. */
export const stateFileFor = (carrier: string, port: number): string =>
  join(tmpdir(), "qticaret-fakes", `${carrier}-${String(port)}.json`)

/**
 * A fake's parcels on disk: read once at start (nothing when the file is
 * missing or unreadable), written whole after each change. Without a
 * file (the tests) both do nothing.
 */
export function stateStore<T>(file: string | null) {
  return {
    load(): T | null {
      if (!file) {
        return null
      }
      try {
        return JSON.parse(readFileSync(file, "utf8")) as T
      } catch {
        return null
      }
    },
    save(state: T) {
      if (!file) {
        return
      }
      mkdirSync(dirname(file), { recursive: true })
      // Written aside and moved, so a stop mid-write leaves the last good file
      writeFileSync(`${file}.tmp`, JSON.stringify(state))
      renameSync(`${file}.tmp`, file)
    },
  }
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
}

/** An XML element's text as a SOAP request writes it, its entities read. */
export const xmlText = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    const lower = entity.toLowerCase()
    if (!lower.startsWith("#")) {
      return ENTITIES[lower] ?? ""
    }
    const code = lower.startsWith("#x") ? parseInt(lower.slice(2), 16) : Number(lower.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""
  })
