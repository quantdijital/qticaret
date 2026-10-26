/**
 * Reading a robots.txt as a crawler does (RFC 9309): the groups that name
 * the crawler, merged, or else the `*` groups; of the rules that match a
 * path the longest wins, Allow on a tie. `*` stands for any run of
 * characters and a final `$` for the end of the path.
 */

interface RobotsRule {
  isAllow: boolean
  pattern: RegExp
  length: number
}

export interface RobotsGroup {
  /** Lower-case product tokens (`googlebot`, `*`). */
  agents: string[]
  rules: RobotsRule[]
}

function compile(pattern: string): RegExp {
  const anchored = pattern.endsWith("$")
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return new RegExp(`^${body}${anchored ? "$" : ""}`)
}

// A user-agent line may carry a version (`Googlebot/2.1`); the token is before it
const tokenOf = (value: string): string => value.split("/")[0]?.trim().toLowerCase() ?? ""

/** The file's groups; consecutive User-agent lines share the rules after them (§2.1). */
export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup | null = null
  let isCollectingAgents = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim()
    const colon = line.indexOf(":")
    if (colon === -1) {
      continue
    }
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (field === "user-agent") {
      if (!current || !isCollectingAgents) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(tokenOf(value))
      isCollectingAgents = true
      continue
    }
    isCollectingAgents = false
    // An empty Disallow allows everything: no rule at all
    if (current && value && (field === "allow" || field === "disallow")) {
      current.rules.push({
        isAllow: field === "allow",
        pattern: compile(value),
        length: value.length,
      })
    }
  }
  return groups
}

/** Whether the file has groups of the crawler's own (else it follows `*`). */
export const hasOwnGroup = (groups: readonly RobotsGroup[], agent: string): boolean =>
  agent !== "*" && groups.some((group) => group.agents.includes(agent))

/** Whether `agent` (a lower-case product token, or `*`) may crawl `path`. */
export function isCrawlable(groups: readonly RobotsGroup[], agent: string, path: string): boolean {
  const own = hasOwnGroup(groups, agent) ? agent : "*"
  let best: RobotsRule | null = null
  for (const group of groups) {
    if (!group.agents.includes(own)) {
      continue
    }
    for (const rule of group.rules) {
      if (
        rule.pattern.test(path) &&
        (!best || rule.length > best.length || (rule.length === best.length && rule.isAllow))
      ) {
        best = rule
      }
    }
  }
  return best?.isAllow ?? true
}
