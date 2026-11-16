import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { STAFF_ROLES } from "../../staff/permissions"
import { ALERT_ACCESS, OPEN_ALERTS, visibleTriggers } from "../access"
import { ALERT_GROUPS, WHOLESALE_ORDER_TRIGGER } from "../feed"
import type { AlertGroup } from "../feed"

const SRC = join(__dirname, "../../..")

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === "__tests__" || name === "node_modules") {
      return []
    }
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".ts") ? [path] : []
  })
}

/**
 * What each writer of the feed sets as `trigger_type`: literal strings, a
 * constant's value, or a template's fixed start (`payments.${…}`). Files
 * that write to the feed only (`channel: "feed"` beside `createNotifications`).
 */
function feedTriggers(): { literal: string[]; templated: string[]; named: string[] } {
  const literal: string[] = []
  const templated: string[] = []
  const named: string[] = []
  for (const path of sources(SRC)) {
    const text = readFileSync(path, "utf8")
    if (!text.includes("createNotifications") || !text.includes('channel: "feed"')) {
      continue
    }
    for (const [, value] of text.matchAll(/trigger_type:\s*([^,\n]+)/g)) {
      const expression = (value ?? "").trim()
      // A read's filter (placed-alert looks for its own kinds), not a kind written
      if (expression.startsWith("Object.values(")) {
        continue
      }
      const quoted = /^"([^"]+)"$/.exec(expression)
      const template = /^`([^`$]*)\$\{/.exec(expression)
      if (quoted?.[1]) {
        literal.push(quoted[1])
      } else if (template?.[1] !== undefined) {
        templated.push(template[1])
      } else {
        named.push(expression)
      }
    }
  }
  return { literal, templated, named }
}

const KNOWN = [...OPEN_ALERTS, ...Object.keys(ALERT_ACCESS)]

describe("every alert kind is named, open or closed (adr/0020)", () => {
  const { literal, templated, named } = feedTriggers()

  it("finds the feed's writers", () => {
    expect(literal.length).toBeGreaterThan(10)
  })

  it("names every literal kind a writer sets", () => {
    expect(literal.filter((trigger) => !KNOWN.includes(trigger))).toEqual([])
  })

  it("names some kind for every templated writer's start", () => {
    expect(
      templated.filter((start) => !KNOWN.some((trigger) => trigger.startsWith(start)))
    ).toEqual([])
  })

  it("knows each kind set through a constant or a variable", () => {
    // placed-alert's `trigger` (its TRIGGERS: new order, bank transfer, wholesale);
    // a constant's values (contact, returns)
    expect([...new Set(named)].sort()).toEqual(
      ["CONTACT_MESSAGE_RECEIVED", "REFUND_DEADLINE_NEAR", "trigger"].sort()
    )
    expect(KNOWN).toEqual(
      expect.arrayContaining([
        "contact_message.received",
        "returns.refund_deadline_near",
        WHOLESALE_ORDER_TRIGGER,
        "orders.new_order",
        "orders.bank_transfer_pending",
      ])
    )
  })

  it("names no kind twice", () => {
    expect(new Set(KNOWN).size).toBe(KNOWN.length)
  })
})

describe("which roles get which alerts (adr/0040)", () => {
  const closedTo: Record<string, readonly string[]> = {
    owner: [],
    admin: ["migration.not_found_seen"],
    operations: Object.keys(ALERT_ACCESS),
    readonly: Object.keys(ALERT_ACCESS),
  }

  it.each(
    STAFF_ROLES.flatMap((role) => (Object.keys(ALERT_GROUPS) as AlertGroup[]).map((g) => [role, g]))
  )("%s × %s", (role, group) => {
    const visible = visibleTriggers(role as (typeof STAFF_ROLES)[number])
    const kinds = KNOWN.filter((trigger) =>
      ALERT_GROUPS[group as AlertGroup].some((prefix) => trigger.startsWith(prefix))
    )
    for (const trigger of kinds) {
      const gets = visible === null || visible.includes(trigger)
      expect([trigger, gets]).toEqual([trigger, !closedTo[role]?.includes(trigger)])
    }
  })

  it("gives the owner every kind, the unknown ones too, and anyone else no unknown one", () => {
    expect(visibleTriggers("owner")).toBeNull()
    for (const role of ["admin", "operations", "readonly"] as const) {
      expect(visibleTriggers(role)).not.toContain("new.kind_nobody_named")
    }
    expect(visibleTriggers(null)).toEqual([])
  })

  it("leaves operations payment trouble and customers' messages, not wholesale nor the accounts", () => {
    const operations = visibleTriggers("operations") ?? []
    expect(operations).toEqual(
      expect.arrayContaining(["payments.completion_stuck", "contact_message.received"])
    )
    expect(operations).not.toContain("payments.wholesale_price_check")
    expect(operations).not.toContain("integration_credentials.changed")
  })
})
