import { Rows3 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FooterRowsSection, LayoutDocument } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { idsOf, newSectionId } from "@/features/storefront/layout/sections"
import type { FieldGroupName } from "../forms/field-registry"
import { Panel } from "../panel-header"
import { tabOfGroup } from "../panel-groups"
import { SectionActions } from "../section-actions"
import { kindOf } from "../section-meta"
import { SettingsLayout } from "../settings-layout"
import { FieldFocusContext } from "../use-field-focus"
import type { FieldFocus } from "../use-field-focus"
import { BlockForm } from "./block-form"
import { FR } from "./footer-rows-fields"
import type { FooterPart } from "./footer-rows-fields"
import { BLOCK_ICONS, rowName, useFooterMenus } from "./footer-rows-names"
import {
  blockRoom,
  duplicateBlock,
  duplicateRow,
  findBlock,
  removeBlock,
  removeRow,
  rowRoom,
  setLayout,
  updateBlock,
  updateRow,
} from "./footer-rows-ops"
import type { Rows } from "./footer-rows-ops"
import { RowForm } from "./row-form"

interface FooterPartPanelProps {
  section: FooterRowsSection
  part: FooterPart
  doc: LayoutDocument
  problems: SectionProblems
  /** The footer with its rows changed; `field` names what is being typed in. */
  onChange: (section: FooterRowsSection, field?: string) => void
  /** Back to the footer's own settings. */
  onBack: () => void
  /** The part is gone (removed, or undone away): back to the footer. */
  onGone: () => void
  focus: (FieldFocus & { group: FieldGroupName }) | null
}

/**
 * A free rows footer's row or block in its own panel (adr/0070 §7), as a
 * section's: its settings in "İçerik", "Stil" and "Gelişmiş", then copied
 * or taken off (both undone with "Geri al"). Its back button returns to
 * the footer's panel.
 */
export function FooterPartPanel({
  section,
  part,
  doc,
  problems,
  onChange,
  onBack,
  onGone,
  focus,
}: FooterPartPanelProps) {
  const { t } = useTranslation()
  const menus = useFooterMenus(doc)
  const { rows } = section
  const newId = () => newSectionId(idsOf(doc))
  const set = (next: Rows, field?: string) => {
    if (next !== rows) {
      onChange({ ...section, rows: [...next] }, field)
    }
  }
  const row = part.kind === "row" ? rows.find((each) => each.id === part.id) : undefined
  const found = part.kind === "block" ? findBlock(rows, part.id) : null
  if (!row && !found) {
    return null
  }
  const title = row
    ? rowName(t, row, rows.indexOf(row))
    : t(`${FR}.types.${found?.block.type ?? "text"}.name`)
  return (
    <FieldFocusContext.Provider value={focus}>
      <Panel
        icon={found ? BLOCK_ICONS[found.block.type] : Rows3}
        title={title}
        onBack={onBack}
        back={t(`${FR}.backToFooter`)}
        trail={[
          { label: t(`storefront.editor.types.${kindOf(section, true)}.name`), onSelect: onBack },
        ]}
      >
        <p className="border-b px-5 py-4 text-[13px] leading-5 text-muted-foreground">
          {found ? t(`${FR}.types.${found.block.type}.description`) : t(`${FR}.row.description`)}
        </p>
        <SettingsLayout
          scope={found ? `footer-block:${found.block.type}` : "footer-row"}
          resetKey={part.id}
          tabOf={tabOfGroup}
          focus={focus}
        >
          {row ? (
            <RowForm
              row={row}
              onChange={(next) => {
                set(updateRow(rows, next))
              }}
              onLayout={(layout) => {
                const changed = setLayout(rows, row.id, layout)
                set(changed.rows)
                return changed.merged
              }}
            />
          ) : null}
          {found ? (
            <BlockForm
              block={found.block}
              problems={problems}
              menus={menus}
              onChange={(block, field) => {
                set(updateBlock(rows, block), field ? `${block.id}.${field}` : undefined)
              }}
            />
          ) : null}
        </SettingsLayout>
        <SectionActions
          canCopy
          canDuplicate={
            row
              ? rowRoom(rows, row)
              : found
                ? blockRoom(rows, found.block.type, { row: found.row, column: found.column }) ===
                  null
                : false
          }
          onDuplicate={() => {
            set(row ? duplicateRow(rows, row.id, newId) : duplicateBlock(rows, part.id, newId))
          }}
          removeLabel={t(row ? `${FR}.actions.removeRow` : `${FR}.actions.remove`)}
          canRemove={!row || rows.length > 1}
          onRemove={() => {
            const next = row ? removeRow(rows, row.id) : removeBlock(rows, part.id)
            if (next !== rows) {
              set(next)
              onGone()
            }
          }}
        />
      </Panel>
    </FieldFocusContext.Provider>
  )
}
