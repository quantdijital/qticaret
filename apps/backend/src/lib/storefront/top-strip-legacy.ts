/**
 * The top strip as its own section (owner's decision 2026-11-27, adr/0066
 * Ek): the header's variants draw only their own rows; whatever is drawn
 * above them is the header group's strip section (`announcement_bar`, its
 * variant `graphite` or `light`) and its scrolling strip. Before it the
 * header drew a strip of its own: the bar above it took the top links and
 * the phone whenever the header left them (no announcement needed), and
 * the catalog header drew its thin light strip (`utility_bar`).
 *
 * A design stored before the decision (its header bar without
 * `top_strip: "separate"`) is read once into the new shape, so it draws as
 * it did: the strip section is written out with the variant and the parts
 * it showed, and the header bar is marked. The stored fields keep their
 * meaning; the catalog's `utility_bar`, `strip_note`, `strip_note_link` and
 * `account_text` are read here and nowhere else. The one look that cannot be
 * kept whole is a catalog header with its strip on beside an announcement
 * bar (two strips): the announcement bar stays, taking the top links.
 */

export const TOP_STRIP_SEPARATE = "separate"

/** The strip section written for a design that had none (its id among the panel's). */
const STRIP_ID = "ustserit"

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw =>
  value !== null && typeof value === "object" && !Array.isArray(value)

/** A stored catalog field as its schema reads it: the default when absent. */
const field = (bar: Raw, key: string, fallback: unknown): unknown => bar[key] ?? fallback

/**
 * Every id the stored design holds, at any depth: its groups' sections,
 * its content pages' sections, a free rows footer's rows and blocks
 * (`sectionIds`' whole id space, read here from the raw document before
 * the schema: a superset of it).
 */
function idsIn(value: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    for (const each of value) {
      idsIn(each, into)
    }
  } else if (isRecord(value)) {
    if (typeof value["id"] === "string") {
      into.add(value["id"])
    }
    for (const each of Object.values(value)) {
      idsIn(each, into)
    }
  }
  return into
}

/** An id the design does not hold anywhere, the strip's name first. */
function freshId(stored: Raw): string {
  const ids = idsIn(stored, new Set())
  let id = STRIP_ID
  for (let n = 2; ids.has(id); n += 1) {
    id = `${STRIP_ID}${String(n)}`
  }
  return id
}

/** The strip's parts left off (absent: shown), as the old drawing left them off. */
const offParts = (parts: Record<string, boolean>): Raw =>
  Object.fromEntries(
    Object.entries(parts)
      .filter(([, shown]) => !shown)
      .map(([key]) => [key, false])
  )

/**
 * What the old drawing put above the header, as the new strip section:
 * null when nothing was drawn there.
 */
function oldStrip(bar: Raw | undefined, announcement: Raw | undefined): Raw | null {
  const variant = typeof bar?.["variant"] === "string" ? bar["variant"] : "standard"
  if (variant === "inline") {
    // The one-row header kept the links and the phone in its menu sheet: the lines alone
    return announcement
      ? { variant: "graphite", ...offParts({ links: false, phone: false }) }
      : null
  }
  if (variant !== "catalog" || !bar) {
    // The standard and centred headers: the bar above with the links and the phone, lines or not
    return { variant: "graphite" }
  }
  const utility = field(bar, "utility_bar", true) === true
  const linksInStrip = field(bar, "top_links", "strip") !== "bar"
  // The bar above took what the catalog header did not show: its links once its strip was off
  // (or always, beside an announcement: two strips cannot be one), its phone once off by the search
  const graphite = {
    variant: "graphite",
    ...offParts({
      links: linksInStrip && (!utility || announcement !== undefined),
      phone: field(bar, "phone", true) !== true,
    }),
  }
  if (announcement) {
    return graphite
  }
  if (utility) {
    const note = typeof bar["strip_note"] === "string" ? bar["strip_note"].trim() : ""
    const account =
      field(bar, "account_text", true) === true && field(bar, "tools_place", "bar") !== "row"
    return {
      variant: "light",
      lines: note === "" ? [] : [note],
      ...(isRecord(bar["strip_note_link"]) ? { link: bar["strip_note_link"] } : {}),
      ...offParts({ links: linksInStrip }),
      ...(account ? { account: true } : {}),
    }
  }
  // No strip of its own and nothing left for the bar above: nothing was drawn
  return linksInStrip || field(bar, "phone", true) !== true ? graphite : null
}

/**
 * A stored design read into the separate top strip; one already marked, or
 * not a design at all, as it is.
 */
export function withSeparateTopStrip(stored: Raw): Raw {
  const header: unknown[] = Array.isArray(stored["header"]) ? stored["header"] : []
  const bar = header.find(
    (section): section is Raw => isRecord(section) && section["type"] === "header_bar"
  )
  if (bar?.["top_strip"] === TOP_STRIP_SEPARATE) {
    return stored
  }
  const announcement = header.find(
    (section): section is Raw => isRecord(section) && section["type"] === "announcement_bar"
  )
  const strip = oldStrip(bar, announcement)
  const next = header.flatMap((section): unknown[] => {
    if (section === bar) {
      return [{ ...bar, top_strip: TOP_STRIP_SEPARATE }]
    }
    if (section === announcement) {
      // The old drawing drew it whatever the header: `strip` is never null beside it
      return [{ ...announcement, ...strip }]
    }
    return [section]
  })
  if (!announcement && strip) {
    next.unshift({
      id: freshId(stored),
      type: "announcement_bar",
      visible: true,
      starts_at: null,
      ends_at: null,
      lines: [],
      ...strip,
    })
  }
  return { ...stored, header: next }
}
