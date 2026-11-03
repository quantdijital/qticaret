import type { Editor } from "@tiptap/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { SearchPicker } from "@/components/patterns/search-picker"
import type { PickerOption } from "@/components/patterns/search-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { sdk } from "@/lib/sdk"
import type { CardKind } from "./card-nodes"

const SEARCH: Record<CardKind, (q: string) => Promise<PickerOption[]>> = {
  product: async (q) =>
    (
      await sdk.admin.product.list({ limit: 20, fields: "id,title,status", ...(q ? { q } : {}) })
    ).products.map((product) => ({
      id: product.id,
      label: product.title,
      inactive: product.status !== "published",
    })),
  category: async (q) =>
    (
      await sdk.admin.productCategory.list({
        limit: 20,
        fields: "id,name,is_active,is_internal",
        ...(q ? { q } : {}),
      })
    ).product_categories.map((category) => ({
      id: category.id,
      label: category.name,
      // Hidden from the shop: its card would not show
      inactive: !category.is_active || category.is_internal,
    })),
}

/** Puts a product's or category's card in the text; the storefront shows it as it is then. */
export function CardDialog({
  editor,
  kind,
  onClose,
}: {
  editor: Editor
  kind: CardKind | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<PickerOption | null>(null)
  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(next) => {
        if (!next) {
          setChoice(null)
          onClose()
        }
      }}
    >
      {kind ? (
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t(`content.editor.card.add.${kind}`)}</DialogTitle>
            <DialogDescription>{t("content.editor.card.hint")}</DialogDescription>
          </DialogHeader>
          <Field label={t(`content.editor.card.${kind}`)} htmlFor="content-card-pick">
            <SearchPicker
              id="content-card-pick"
              value={choice}
              onChange={setChoice}
              search={SEARCH[kind]}
              queryKey={["content", "card-options", kind]}
              placeholder={t("content.editor.card.pick")}
              empty={t("content.editor.card.none")}
              inactiveNote={t("content.editor.card.draft")}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              disabled={!choice}
              onClick={() => {
                if (choice) {
                  editor
                    .chain()
                    .focus()
                    .insertContent({ type: `${kind}Card`, attrs: { id: choice.id } })
                    .run()
                }
                setChoice(null)
                onClose()
              }}
            >
              {t("content.editor.card.insert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
