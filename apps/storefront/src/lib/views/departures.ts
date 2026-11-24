import "server-only"
import type { StoreDeparturesSection, StoreUpcomingDeparture } from "@qticaret/types"
import { departuresSettingsOf, FEW_PLACES_LEFT } from "@qticaret/types/section-departures"
import { formatLira } from "@qticaret/ui"
import type { DepartureDateView, DeparturesSectionView, Translate } from "@qticaret/ui"
import { upcomingDepartures } from "@/lib/store-api/extras"
import { pathsOf } from "@/lib/store-api/requests"

// The zone a departure is said in when the product's is not one the runtime knows
const DEFAULT_ZONE = "Europe/Istanbul"

/** A departure's date in its product's zone (the default zone's if that one is not known). */
export function departureDate(startsAt: string, zone: string): DepartureDateView | null {
  const at = new Date(startsAt)
  if (Number.isNaN(at.getTime())) {
    return null
  }
  const parts = (timeZone: string) => {
    const part = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat("tr-TR", { timeZone, ...options }).format(at)
    return {
      iso: at.toISOString(),
      day: part({ day: "numeric" }),
      month: part({ month: "short" }),
      weekday: part({ weekday: "short" }),
      full: part({
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }
  }
  try {
    return parts(zone)
  } catch {
    return parts(DEFAULT_ZONE)
  }
}

/**
 * The rows the theme draws: each departure whose product has a page now,
 * its date in its zone, "Son N yer" only when few are left (the backend
 * says them only then; checked again here) and its price as a "from" price.
 */
export function departureRows(
  departures: readonly StoreUpcomingDeparture[],
  paths: Readonly<Record<string, string>>,
  t: Translate
): DeparturesSectionView["rows"] {
  return departures.flatMap((departure) => {
    const path = paths[departure.product.id]
    const date = departureDate(departure.starts_at, departure.timezone)
    if (!path || !date) {
      return []
    }
    const { left } = departure
    return [
      {
        key: departure.slot_id,
        path,
        title: departure.product.title,
        image: departure.product.thumbnail
          ? {
              src: departure.product.thumbnail,
              // The tour's name stands beside it
              alt: "",
              width: null,
              height: null,
              sources: { avif: null, webp: null },
            }
          : null,
        date,
        left:
          left !== null && left > 0 && left <= FEW_PLACES_LEFT
            ? t("booking.few_left", { count: left })
            : null,
        price:
          departure.from_price === null
            ? null
            : {
                // The card's words ("…'den itibaren"), one phrase for a dated price
                current: t("booking.card_from", { price: formatLira(departure.from_price) }),
                before: null,
                from: false,
                discount: null,
              },
      },
    ]
  })
}

/**
 * Upcoming departures as the theme draws them (adr/0077 §10): the shop's
 * heading, else the storefront's words; the nearest departures read live
 * from the backend (behind `catalog.booking`), each linked to its
 * product's page. No departure (or the flag off): no section.
 */
export async function departuresView(
  section: StoreDeparturesSection,
  t: Translate
): Promise<DeparturesSectionView | null> {
  const { source } = section
  const departures = await upcomingDepartures(
    section.limit,
    source.kind,
    source.kind === "category"
      ? source.category_id
      : source.kind === "collection"
        ? source.collection_id
        : null
  )
  if (departures.length === 0) {
    return null
  }
  const paths = await pathsOf("product", [
    ...new Set(departures.map((departure) => departure.product.id)),
  ])
  const rows = departureRows(departures, paths, t)
  return rows.length > 0
    ? {
        id: section.id,
        type: "departures",
        title: section.title ?? t("home.departures"),
        intro: section.intro,
        rows,
        open: t("home.departures_open"),
        ...departuresSettingsOf(section),
      }
    : null
}
