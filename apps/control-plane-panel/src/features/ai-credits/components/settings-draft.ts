import type { TFunction } from "i18next"
import { useState } from "react"
import type { AiSettings } from "@/features/ai-credits/api/schemas"
import { errorText } from "@/lib/errors"

/** Thrown before a save whose part of the settings someone else changed since the draft began. */
export class SettingsMoved extends Error {
  constructor() {
    super("ai_settings_moved")
    this.name = "SettingsMoved"
  }
}

export const isSettingsMoved = (error: unknown): error is SettingsMoved =>
  error instanceof SettingsMoved

/** A settings save's failure in words: the moved settings' own, else the control plane's. */
export const settingsErrorText = (t: TFunction, error: unknown): string =>
  isSettingsMoved(error) ? t("aiCredits.settings.moved") : errorText(t, error)

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * One settings card's draft, kept across the page's reads (no remount on
 * every save, so another card's unsaved draft stays). The card's part of
 * the settings (`partOf`, a value built in a fixed key order) is what the
 * draft began from:
 * - a change elsewhere on the settings moves nothing here;
 * - a change to this part replaces an untouched draft (or one already
 *   equal to it, as after this card's own save);
 * - a change to this part under a touched draft keeps the draft, and the
 *   save stops with `SettingsMoved` (`guard`, run on the settings read
 *   again just before saving) instead of silently writing over it.
 */
export function useSettingsDraft<P, D>(
  settings: AiSettings,
  partOf: (settings: AiSettings) => P,
  toDraft: (part: P) => D
) {
  const part = partOf(settings)
  const [base, setBase] = useState<P>(part)
  const [draft, setDraft] = useState<D>(() => toDraft(part))
  // Touched and changed underneath: neither moves, and the save says so
  if (!same(base, part) && (same(draft, toDraft(base)) || same(draft, toDraft(part)))) {
    setBase(part)
    setDraft(toDraft(part))
  }
  const guard = (fresh: AiSettings) => {
    if (!same(partOf(fresh), base)) {
      throw new SettingsMoved()
    }
  }
  return { draft, setDraft, base, guard }
}
