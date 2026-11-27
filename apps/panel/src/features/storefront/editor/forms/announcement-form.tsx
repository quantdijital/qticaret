import { useTranslation } from "react-i18next"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ShopTokenPreview, TokenSlot } from "@/features/settings/components/shop-token-menu"
import { ListFooter, RowActions, RowCell } from "@/features/settings/components/storefront-rows"
import type { AnnouncementBar, LayoutLink } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { AnnouncementMode } from "./announcement-settings"
import { LinkField } from "./link-field"
import { TopStripParts } from "./top-strip-parts"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"

const A = "storefront.editor.announcement"

/** The bar with these lines and no line links left (none written, as a bar saved before them). */
function withoutLinks(section: AnnouncementBar, lines: string[]): AnnouncementBar {
  const next: AnnouncementBar = { ...section, lines }
  delete next.line_links
  return next
}

/**
 * The thin bar on top of every page: its lines, each may hold the shop's
 * details, and once there are several how they show (only the first, taking
 * turns, side by side; docs/tema/bilesen-denetimi (b) 6). How they turn
 * stands in the open "Hareket" group (`AnnouncementMotion`).
 */
export function AnnouncementForm({
  section,
  problems,
  onChange,
}: SectionFormProps<AnnouncementBar>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  // The dark bar's lines may each link somewhere (owner 2026-11-27); the light strip's note has `link`
  const linked = section.variant !== "light"
  const links = section.line_links ?? []
  const linkAt = (index: number) => links[index] ?? null
  /** The lines in a new order or count, each line's link going with it (`order`: old places). */
  const setLines = (lines: string[], field?: string, order?: number[]) => {
    if (!order || !section.line_links) {
      onChange({ ...section, lines }, field)
      return
    }
    const moved = order.map(linkAt)
    onChange(
      moved.some(Boolean) ? { ...section, lines, line_links: moved } : withoutLinks(section, lines),
      field
    )
  }
  const setLink = (index: number, link: LayoutLink | null, field?: "label") => {
    const next = section.lines.map((_, at) => (at === index ? link : linkAt(at)))
    onChange(
      next.some(Boolean) ? { ...section, line_links: next } : withoutLinks(section, section.lines),
      field && `line_links.${String(index)}.label`
    )
  }
  const setLine = (index: number, text: string) => {
    setLines(
      section.lines.map((line, at) => (at === index ? text : line)),
      `lines.${String(index)}`
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {section.lines.map((line, index) => {
          const number = index + 1
          const id = PREVIEW_IDS.text(section.id, `lines.${String(index)}`)
          const error = problem(problems[`lines.${String(index)}`], L.line)
          return (
            <li key={index} className="flex flex-col gap-2">
              <div className="flex items-start gap-1">
                <RowCell error={error} errorId={`${id}-error`} className="flex-1">
                  <TokenSlot
                    fieldId={id}
                    onInsert={(text) => {
                      setLine(index, text)
                    }}
                  >
                    <Input
                      id={id}
                      value={line}
                      maxLength={L.line}
                      aria-label={t(`${A}.line`, { number })}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${id}-error` : undefined}
                      placeholder={t(`${A}.placeholder`)}
                      className="pr-9"
                      onChange={(event) => {
                        setLine(index, event.target.value)
                      }}
                    />
                  </TokenSlot>
                  <ShopTokenPreview text={line} />
                </RowCell>
                <RowActions
                  index={index}
                  count={section.lines.length}
                  item={t(`${A}.line`, { number })}
                  removable
                  onMove={(to) => {
                    const order = section.lines.map((_, at) => at).filter((at) => at !== index)
                    order.splice(to, 0, index)
                    setLines(
                      order.map((at) => section.lines[at] ?? ""),
                      undefined,
                      order
                    )
                  }}
                  onRemove={() => {
                    const order = section.lines.map((_, at) => at).filter((at) => at !== index)
                    setLines(
                      order.map((at) => section.lines[at] ?? ""),
                      undefined,
                      order
                    )
                  }}
                />
              </div>
              {linked && (
                <LinkField
                  id={`${id}-link`}
                  label={t(`${A}.lineLink`, { number })}
                  link={linkAt(index)}
                  error={problem(problems[`line_links.${String(index)}`])}
                  onChange={(link, field) => {
                    setLink(index, link, field)
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>
      <ListFooter
        label={t(`${A}.add`)}
        hint={t(`${A}.hint`, { max: L.lines, length: L.line })}
        full={section.lines.length >= L.lines}
        onAdd={() => {
          setLines([...section.lines, ""])
        }}
      />
      {section.variant === "light" ? (
        <p className="text-xs text-muted-foreground">{t("storefront.editor.topStrip.lightNote")}</p>
      ) : (
        <AnnouncementMode section={section} onChange={onChange} />
      )}
      <TopStripParts
        section={section}
        onChange={(next) => {
          onChange(next)
        }}
      />
    </div>
  )
}
