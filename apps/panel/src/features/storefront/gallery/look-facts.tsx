import { useTranslation } from "react-i18next"
import type { DesignSummary } from "./api"

const G = "storefront.gallery"

/**
 * A look's faces and size in one quiet line: "Aa Manrope · 5 bölüm"; the
 * body face too when it is another one.
 */
export function LookFacts({ summary }: { summary: Pick<DesignSummary, "fonts" | "sections"> }) {
  const { t } = useTranslation()
  const face = (key: string | null) =>
    key ? t(`storefront.editor.theme.fonts.${key}`, { defaultValue: key }) : null
  const heading = face(summary.fonts.heading)
  const body = face(summary.fonts.body)
  const faces = heading && body && heading !== body ? `${heading} / ${body}` : (heading ?? body)
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      {faces ? (
        <>
          <span aria-hidden className="font-semibold text-foreground">
            Aa
          </span>
          <span>{faces}</span>
          <span aria-hidden>·</span>
        </>
      ) : null}
      <span>{t(`${G}.sections`, { count: summary.sections.home })}</span>
    </p>
  )
}
