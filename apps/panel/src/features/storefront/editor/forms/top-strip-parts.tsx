import { useTranslation } from "react-i18next"
import type { AnnouncementBar } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"

const S = "storefront.editor.topStrip"

/** A part off is written `false`, on is left out: the strip as it was drawn before the switch. */
const shownOrOff = (section: AnnouncementBar, key: "links" | "phone", on: boolean) => {
  const next: AnnouncementBar = { ...section, [key]: false }
  if (on) {
    if (key === "links") {
      delete next.links
    } else {
      delete next.phone
    }
  }
  return next
}

/**
 * What the top strip carries beside its lines (owner's decision
 * 2026-11-27): the shop's top links on both designs, the phone on the dark
 * bar, "Hesabım" on the light strip. The links come from the "Üst" menu,
 * the phone from the store profile.
 */
export function TopStripParts({
  section,
  onChange,
}: {
  section: AnnouncementBar
  onChange: (next: AnnouncementBar) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <SwitchRow
        id={`${section.id}-links`}
        label={t(`${S}.linksLabel`)}
        hint={t(`${S}.linksHint`)}
        checked={section.links !== false}
        onChange={(on) => {
          onChange(shownOrOff(section, "links", on))
        }}
      />
      {section.variant === "light" ? (
        <SwitchRow
          id={`${section.id}-account`}
          label={t(`${S}.accountLabel`)}
          checked={section.account === true}
          onChange={(on) => {
            const next = { ...section }
            if (on) {
              next.account = true
            } else {
              delete next.account
            }
            onChange(next)
          }}
        />
      ) : (
        <SwitchRow
          id={`${section.id}-phone`}
          label={t(`${S}.phoneLabel`)}
          hint={t(`${S}.phoneHint`)}
          checked={section.phone !== false}
          onChange={(on) => {
            onChange(shownOrOff(section, "phone", on))
          }}
        />
      )}
    </div>
  )
}
