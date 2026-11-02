import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { HomeSectionType } from "@/features/storefront/api/layout"
import { HOME_TYPES } from "@/features/storefront/layout/sections"
import { SECTION_ICONS } from "./section-meta"

const A = "storefront.editor.add"

interface AddSectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (type: HomeSectionType) => void
}

/** The home page's section types, each with what it shows in one line. */
export function AddSectionDialog({ open, onOpenChange, onPick }: AddSectionDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(`${A}.title`)}</DialogTitle>
          <DialogDescription>{t(`${A}.description`)}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 sm:grid-cols-2">
          {HOME_TYPES.map((type) => {
            const Icon = SECTION_ICONS[type]
            return (
              <li key={type} className="flex">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/60"
                  onClick={() => {
                    onPick(type)
                  }}
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t(`storefront.editor.types.${type}.name`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`storefront.editor.types.${type}.description`)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
