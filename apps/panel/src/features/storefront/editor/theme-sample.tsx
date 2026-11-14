import { Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ThemeValues } from "@/features/storefront/theme-settings"
import { ATOLYE_COLORS } from "@/theme/atolye"
import { sampleLook } from "./theme-sample-look"
import type { SampleLook } from "./theme-sample-look"

const C = "storefront.editor.theme"
const S = `${C}.sampleParts`

const CONTROL = "inline-flex h-9 items-center px-4 text-[13px]"
const CHIP = "inline-flex h-7 items-center px-3 text-xs font-semibold"

/** A product card: the picture in its well at the chosen shape, then brand, name, rating, price. */
function SampleCard({ look }: { look: SampleLook }) {
  const { t } = useTranslation()
  return (
    <div className="flex w-32 shrink-0 flex-col gap-2">
      <div
        data-sample="picture"
        className="w-full"
        style={{
          backgroundColor: look.well,
          borderRadius: look.corners.media,
          aspectRatio: look.ratio,
        }}
      />
      <div className="flex flex-col gap-0.5">
        {look.showBrand ? (
          <span data-sample="brand" className="text-[11px]" style={{ color: ATOLYE_COLORS.text3 }}>
            {t(`${S}.brand`)}
          </span>
        ) : null}
        <span className="text-[13px] leading-snug font-semibold">{t(`${S}.product`)}</span>
        {look.showRating ? (
          <span
            data-sample="rating"
            className="flex items-center gap-1 text-[11px]"
            style={{ color: ATOLYE_COLORS.text2 }}
          >
            <Star
              aria-hidden="true"
              className="size-3"
              fill={ATOLYE_COLORS.star}
              stroke={ATOLYE_COLORS.star}
            />
            {t(`${S}.rating`)}
          </span>
        ) : null}
        {/* Prices are drawn in the body face whatever the heading's is (adr/0062 §7) */}
        <span className="text-[13px] font-bold tabular-nums">{t(`${S}.price`)}</span>
      </div>
    </div>
  )
}

/** The chosen faces by name, and which of them the panel draws in a system face instead. */
function FacesLine({ look }: { look: SampleLook }) {
  const { t } = useTranslation()
  const name = (font: SampleLook["unloaded"][number]): string => t(`${C}.fonts.${font}`)
  const parts: string[] = [
    t(`${S}.faces`, { heading: name(look.heading.font), body: name(look.body.font) }),
  ]
  if (look.unloaded.length > 0) {
    parts.push(t(`${S}.facesNote`, { names: look.unloaded.map(name).join(", ") }))
  }
  if (look.ownPrimary) {
    parts.push(t(`${S}.ownPrimary`))
  }
  return (
    <p data-sample="notes" className="text-xs text-muted-foreground">
      {parts.join(" ")}
    </p>
  )
}

/**
 * A corner of the storefront as the Atölye theme paints it with the form's
 * choices, saved or not (adr/0062 §12): the announcement bar on graphite,
 * a box with a heading, a line of text and a link, a field and a button, a
 * product card, two chips and a note. Its colours and sizes are the
 * theme's own (`sampleLook`), not the panel's tokens: it shows another
 * product's look. Nothing in it is a control.
 */
export function ThemeSample({
  values,
  announcement,
}: {
  values: ThemeValues
  /** The shop's first announcement line, else a stand-in. */
  announcement: string
}) {
  const { t } = useTranslation()
  const look = sampleLook(values)
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {t(`${C}.sample`)}
      </figcaption>
      <div
        data-sample="page"
        className="flex flex-col overflow-hidden rounded-md border"
        style={{
          backgroundColor: look.page,
          color: ATOLYE_COLORS.text,
          fontFamily: look.body.family,
        }}
      >
        <p
          data-sample="bar"
          style={{ backgroundColor: look.bar.background, color: look.bar.color }}
          className="truncate px-4 py-2 text-center text-xs font-semibold"
        >
          {announcement}
        </p>
        <div className="flex flex-col gap-3 p-3">
          <div
            data-sample="box"
            className="flex flex-col gap-2 p-3"
            style={{ backgroundColor: look.well, borderRadius: look.corners.tile }}
          >
            <p
              data-sample="heading"
              className="text-lg leading-tight"
              style={{ fontFamily: look.heading.family, fontWeight: look.headingWeight }}
            >
              {t(`${S}.heading`)}
            </p>
            <p className="text-[13px] leading-5">
              {t(`${S}.text`)}{" "}
              <span data-sample="link" className="font-semibold" style={{ color: look.primary }}>
                {t(`${S}.link`)}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-sample="field"
                className={`${CONTROL} min-w-0 flex-1 border`}
                style={{
                  backgroundColor: look.field,
                  borderColor: ATOLYE_COLORS.edge,
                  color: ATOLYE_COLORS.placeholder,
                  borderRadius: look.control,
                }}
              >
                <span className="truncate">{t(`${S}.search`)}</span>
              </span>
              <span
                data-sample="button"
                className={`${CONTROL} font-semibold`}
                style={{
                  backgroundColor: look.primary,
                  color: look.primaryText,
                  borderRadius: look.control,
                }}
              >
                {t(`${C}.button`)}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <SampleCard look={look} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <span
                  data-sample="chip-selected"
                  className={CHIP}
                  style={{
                    backgroundColor: look.mark,
                    color: look.markText,
                    borderRadius: look.pill,
                  }}
                >
                  {t(`${S}.chipSelected`)}
                </span>
                <span
                  data-sample="chip"
                  className={CHIP}
                  style={{ backgroundColor: look.well, borderRadius: look.pill }}
                >
                  {t(`${S}.chip`)}
                </span>
              </div>
              <p
                data-sample="note"
                className="p-2 text-xs font-semibold"
                style={{ backgroundColor: look.note, borderRadius: look.corners.media }}
              >
                {t(`${S}.note`)}
              </p>
            </div>
          </div>
        </div>
      </div>
      <FacesLine look={look} />
    </figure>
  )
}
