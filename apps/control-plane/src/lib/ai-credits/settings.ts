/**
 * The AI credits' platform values (adr/0085). Constants for now: P6 moves
 * the daily cap and the bought credits' life into the control plane's
 * settings (Ayarlar › Yapay zekâ), where the owner changes them.
 */

/** K7: credits a shop may spend in one Istanbul day, unless its wallet has its own cap. */
export const AI_DAILY_CAP_DEFAULT = 300

/** K6: bought credits last this many months from the last top-up (P6: a setting). */
export const AI_PURCHASED_LIFETIME_MONTHS = 12

/** §1: an operation still `open` this long after it began is released, in the shop's favour. */
export const AI_STALE_OPERATION_MINUTES = 15

/** At most this many stale operations are released in one reconcile run. */
export const AI_STALE_RELEASE_BATCH = 500
