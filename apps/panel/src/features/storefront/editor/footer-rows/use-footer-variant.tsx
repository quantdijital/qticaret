import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import type { FooterBarVariant } from "@qticaret/types"
import type { FooterBarSection, LayoutDocument } from "@/features/storefront/api/layout"
import { menusQuery } from "@/features/storefront/api/menus"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { idsOf, newSectionId } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { FR } from "./footer-rows-fields"
import { footerTitles } from "./footer-rows-names"
import { seedFooter } from "./footer-rows-seed"

/**
 * The footer's "Biçim" with free rows (adr/0070 §2.4): picking "Serbest
 * düzen" fills the rows from what the footer showed (`seedFooter`, the
 * newsletter box taken into a block) in one step; leaving it asks first,
 * the rows being dropped (the revisions keep them, "Geri al" too).
 */
export function useFooterVariant(doc: LayoutDocument, dispatch: Dispatch<EditorAction>) {
  const { t } = useTranslation()
  const pending = doc.settings.menus
  const saved = useQuery({ ...menusQuery(), enabled: pending === null })
  const client = useQueryClient()
  const [leaving, setLeaving] = useState<{
    section: FooterBarSection
    next: FooterBarVariant
  } | null>(null)
  // Picked before the menus came: they are fetched first, so the seed holds them
  const menus = async () =>
    pending ??
    saved.data ??
    (await client.query({ ...menusQuery(), staleTime: "static" }).catch(() => []))
  const leave = (section: FooterBarSection, next: FooterBarVariant) => {
    dispatch({ type: "update", section: switchVariant(section, next) })
  }
  return {
    switchFooter: (section: FooterBarSection, next: FooterBarVariant) => {
      if (next === "free_rows") {
        const taken = idsOf(doc)
        const newId = () => {
          const id = newSectionId(taken)
          taken.add(id)
          return id
        }
        void menus().then((list) => {
          const count = footerTitles(list).length
          dispatch({ type: "footer", sections: seedFooter(doc.footer, count, newId) })
        })
      } else if (section.variant === "free_rows") {
        setLeaving({ section, next })
      } else {
        leave(section, next)
      }
    },
    dialog: (
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => {
          if (!open) setLeaving(null)
        }}
        title={t(`${FR}.leave.title`)}
        description={t(`${FR}.leave.description`)}
        confirmLabel={t(`${FR}.leave.confirm`)}
        destructive
        onConfirm={() => {
          if (leaving) leave(leaving.section, leaving.next)
          setLeaving(null)
        }}
      />
    ),
  }
}
