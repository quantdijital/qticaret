import type { DemoStage } from "./advance"

/**
 * A believable 90 days of demo orders, the same on every run (a fixed
 * seed): more orders lately, more at weekends and in the evening, some
 * products more popular than others, and the older an order the further
 * along it is. Pure, so the shape is unit-tested without a database.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000

export interface PlannedOrder {
  at: Date
  stage: DemoStage
  lines: { variant: number; quantity: number }[]
  customer: { first_name: string; last_name: string }
  /** Index into the places the caller has; null for none. */
  place: number
  express: boolean
}

export interface PlanInput {
  now: Date
  days: number
  /** Relative popularity of each variant the caller offers. */
  weights: number[]
  places: number
}

const FIRST_NAMES = [
  "Ayşe",
  "Mehmet",
  "Zeynep",
  "Emre",
  "Elif",
  "Can",
  "Deniz",
  "Burak",
  "Selin",
  "Mert",
  "Ece",
  "Kerem",
  "Defne",
  "Oğuz",
  "İrem",
  "Barış",
  "Sude",
  "Tolga",
  "Nehir",
  "Umut",
]
const LAST_NAMES = [
  "Yılmaz",
  "Kaya",
  "Demir",
  "Şahin",
  "Çelik",
  "Yıldız",
  "Aydın",
  "Öztürk",
  "Arslan",
  "Doğan",
  "Kılıç",
  "Aslan",
  "Koç",
  "Kurt",
  "Özdemir",
  "Erdem",
  "Güneş",
  "Polat",
  "Aksoy",
  "Tekin",
]

// Mulberry32: tiny, seeded, good enough for demo data
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function poisson(rand: () => number, mean: number): number {
  const limit = Math.exp(-mean)
  let product = rand()
  let count = 0
  while (product > limit) {
    product *= rand()
    count += 1
  }
  return count
}

function weighted(rand: () => number, weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let pick = rand() * total
  for (const [index, weight] of weights.entries()) {
    pick -= weight
    if (pick < 0) {
      return index
    }
  }
  return weights.length - 1
}

// Older orders are further along; a few are canceled at every age
function stageFor(rand: () => number, daysAgo: number): DemoStage {
  const roll = rand()
  if (daysAgo >= 8) {
    return roll < 0.08 ? "canceled" : roll < 0.14 ? "shipped" : "delivered"
  }
  if (daysAgo >= 3) {
    return roll < 0.08
      ? "canceled"
      : roll < 0.15
        ? "to_ship"
        : roll < 0.55
          ? "shipped"
          : "delivered"
  }
  if (daysAgo >= 1) {
    return roll < 0.1 ? "canceled" : roll < 0.55 ? "to_ship" : "shipped"
  }
  return roll < 0.85 ? "to_ship" : "shipped"
}

// Weekends sell more (Saturday, Sunday); the evening more than the morning
const WEEKDAY_FACTOR = [1.3, 1.05, 0.95, 0.95, 1.0, 1.1, 1.35]
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
const HOUR_WEIGHTS = [0.5, 0.7, 0.8, 1, 1.1, 0.9, 0.9, 1, 1.1, 1.3, 1.6, 1.9, 2, 1.6, 0.9]

function linesFor(rand: () => number, weights: number[]): PlannedOrder["lines"] {
  const count = 1 + (rand() < 0.35 ? 1 : 0) + (rand() < 0.12 ? 1 : 0)
  const variants = new Set<number>()
  while (variants.size < Math.min(count, weights.length)) {
    variants.add(weighted(rand, weights))
  }
  return [...variants].map((variant) => ({ variant, quantity: rand() < 0.2 ? 2 : 1 }))
}

export function planDemoOrders(input: PlanInput, seed = 20261026): PlannedOrder[] {
  const rand = random(seed)
  const startOfToday = new Date(
    Math.floor((input.now.getTime() + TURKEY_OFFSET_MS) / DAY_MS) * DAY_MS - TURKEY_OFFSET_MS
  )
  const orders: PlannedOrder[] = []
  for (let daysAgo = input.days - 1; daysAgo >= 0; daysAgo -= 1) {
    const day = new Date(startOfToday.getTime() - daysAgo * DAY_MS)
    const weekday = new Date(day.getTime() + TURKEY_OFFSET_MS).getUTCDay()
    // Growth over the period: about 1.2 orders a day then, 3 now
    const mean = (1.2 + 1.8 * (1 - daysAgo / input.days)) * (WEEKDAY_FACTOR[weekday] ?? 1)
    for (let count = poisson(rand, mean); count > 0; count -= 1) {
      const hour = HOURS[weighted(rand, HOUR_WEIGHTS)] ?? 12
      const at = new Date(day.getTime() + hour * 3_600_000 + Math.floor(rand() * 3_600_000))
      if (at >= input.now) {
        continue
      }
      orders.push({
        at,
        stage: stageFor(rand, daysAgo),
        lines: linesFor(rand, input.weights),
        customer: {
          first_name: FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)] ?? "Ayşe",
          last_name: LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)] ?? "Yılmaz",
        },
        place: Math.floor(rand() * Math.max(input.places, 1)),
        express: rand() < 0.2,
      })
    }
  }
  return orders.sort((a, b) => a.at.getTime() - b.at.getTime())
}
