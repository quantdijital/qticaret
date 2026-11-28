import { BookmarkPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { errorText } from "@/lib/errors"
import { useDeleteDesign, useRenameDesign } from "./api"
import type { DesignCard as Design } from "./api"
import { NameDialog } from "./name-dialog"

const G = "storefront.gallery"

/**
 * A saved look's "⋯" (adr/0064 K2): rename it, or keep an automatic one
 * by name (not while the named ones are full); delete it for good, asked
 * first. The same on a card and on an automatic save's row.
 */
export function DesignMenu({
  design,
  name,
  savedFull,
}: {
  design: Design
  /** As the gallery shows it. */
  name: string
  savedFull: boolean
}) {
  const { t } = useTranslation()
  const rename = useRenameDesign()
  const remove = useDeleteDesign()
  const [naming, setNaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const auto = design.kind === "auto"
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t(`${G}.card.actions`, { name })}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={auto && savedFull}
            onSelect={() => {
              setNaming(true)
            }}
          >
            {auto ? <BookmarkPlus /> : <Pencil />}
            {t(auto ? `${G}.card.keep` : `${G}.card.rename`)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleting(true)
            }}
          >
            <Trash2 />
            {t(`${G}.card.delete`)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog
        open={naming}
        onOpenChange={setNaming}
        title={t(auto ? `${G}.rename.keepTitle` : `${G}.rename.title`)}
        description={auto ? t(`${G}.rename.keepText`) : undefined}
        initial={design.name ?? name}
        submitLabel={t("common.save")}
        renaming={!auto}
        saving={rename.isPending}
        onSubmit={(next) => {
          rename.mutate(
            { design: design.id, name: next },
            {
              onSuccess: () => {
                setNaming(false)
                toast.success(t(`${G}.save.done`, { name: next }))
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t(`${G}.delete.title`, { name })}
        description={t(`${G}.delete.text`)}
        confirmLabel={t(`${G}.delete.confirm`)}
        destructive
        onConfirm={() => {
          setDeleting(false)
          remove.mutate(design.id, {
            onSuccess: () => toast.success(t(`${G}.delete.done`, { name })),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}
