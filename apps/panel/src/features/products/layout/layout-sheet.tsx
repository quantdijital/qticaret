import { Loader2, RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@qticaret/admin-ui/ui/sheet"
import { errorText } from "@/lib/errors"
import { useSaveProductLayout } from "./api"
import { LayoutList } from "./layout-list"
import { DEFAULT_LAYOUT, sameLayout } from "./parts"
import { PresetPicker, ShortcutsHint } from "./preset-picker"
import type { PartKey, ProductLayout } from "./parts"

const L = "products.layout"

/**
 * "Sayfayı düzenle" (docs/06 "Ürün sayfası"): the product page's parts,
 * each column in its order, to hide or move; the page behind follows the
 * draft as it changes. "Kaydet" keeps it for the whole team; closing
 * without saving asks first when something changed, then puts the page
 * back as it was.
 */
export function LayoutSheet({
  saved,
  draft,
  onDraft,
}: {
  saved: ProductLayout
  /** Null: closed. */
  draft: ProductLayout | null
  onDraft: (draft: ProductLayout | null) => void
}) {
  const { t } = useTranslation()
  const save = useSaveProductLayout()
  const changed = draft !== null && !sameLayout(draft, saved)
  const { guard, confirm } = useDiscardGuard(changed)
  const close = () => {
    guard(() => {
      onDraft(null)
    })
  }
  const layout = draft ?? saved
  const hidden = new Set<PartKey>(layout.hidden)
  const toggle = (key: PartKey) => {
    onDraft({
      ...layout,
      hidden: hidden.has(key)
        ? layout.hidden.filter((each) => each !== key)
        : [...layout.hidden, key],
    })
  }
  return (
    <>
      <Sheet
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) {
            close()
          }
        }}
      >
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t(`${L}.title`)}</SheetTitle>
            <SheetDescription>{t(`${L}.description`)}</SheetDescription>
          </SheetHeader>
          <div
            data-scroll-area="y"
            className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6"
          >
            <PresetPicker layout={layout} onDraft={onDraft} />
            <LayoutList
              title={t(`${L}.main`)}
              order={layout.main}
              hidden={hidden}
              onOrder={(main) => {
                onDraft({ ...layout, main })
              }}
              onToggle={toggle}
            />
            <LayoutList
              title={t(`${L}.side`)}
              order={layout.side}
              hidden={hidden}
              onOrder={(side) => {
                onDraft({ ...layout, side })
              }}
              onToggle={toggle}
            />
            <ShortcutsHint />
          </div>
          <SheetFooter className="mt-0 flex-row items-center justify-between gap-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={sameLayout(layout, DEFAULT_LAYOUT)}
              onClick={() => {
                onDraft(DEFAULT_LAYOUT)
              }}
            >
              <RotateCcw />
              {t(`${L}.reset`)}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="cancel" size="sm" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  save.saveLayout(layout, {
                    onSuccess: () => {
                      toast.success(t(`${L}.saved`))
                      onDraft(null)
                    },
                    onError: (failure) => toast.error(errorText(t, failure)),
                  })
                }}
              >
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                {t("common.save")}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {confirm}
    </>
  )
}
