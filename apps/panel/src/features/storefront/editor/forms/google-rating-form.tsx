import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { GoogleRatingSection } from "@/features/storefront/api/layout"
import { GOOGLE_RATING_LIMITS } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { CountField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { TitleField } from "./simple-forms"

const G = "storefront.editor.googleRating"

/**
 * The home page's Google rating badge (adr/0058 Ek 2026-11-06): its title,
 * excerpts from recent 4–5 star reviews on or off and how many (1–3), the
 * link to the shop's page on Google. The rating itself is Google's: a
 * line says so and where Google reviews are connected.
 */
export function GoogleRatingForm({
  section,
  problems,
  onChange,
}: SectionFormProps<GoogleRatingSection>) {
  const { t } = useTranslation()
  const { max, on } = GOOGLE_RATING_LIMITS.excerpts
  const set = (next: Partial<GoogleRatingSection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t("storefront.editor.defaults.google_rating")}
        problem={problems["title"]}
        onChange={(title) => {
          set({ title }, "title")
        }}
      />
      <SwitchRow
        id={`${section.id}-excerpts`}
        label={t(`${G}.excerpts`)}
        hint={t(`${G}.excerptsHint`)}
        checked={section.excerpts > 0}
        onChange={(checked) => {
          set({ excerpts: checked ? on : 0 })
        }}
      />
      {section.excerpts > 0 ? (
        <CountField
          id={`${section.id}-count`}
          label={t(`${G}.count`)}
          hint={t(`${G}.countHint`, { max })}
          max={max}
          value={section.excerpts}
          onChange={(excerpts) => {
            set({ excerpts }, "excerpts")
          }}
        />
      ) : null}
      <SwitchRow
        id={`${section.id}-profile`}
        label={t(`${G}.profileLink`)}
        hint={t(`${G}.profileLinkHint`)}
        checked={section.profile_link}
        onChange={(profile_link) => {
          set({ profile_link })
        }}
      />
      <p className="text-[13px] text-muted-foreground">
        {t(`${G}.source`)}{" "}
        <Link to="/reviews/google" className="font-medium text-foreground underline">
          {t(`${G}.sourceLink`)}
        </Link>
      </p>
    </div>
  )
}
