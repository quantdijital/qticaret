import { BookmarkPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { useDeleteDesign, useRenameDesign } from "./api"
import type { DesignCard as Design } from "./api"
import { designName, sourceName } from "./design-name"
import { DesignThumb } from "./design-thumb"
import { LookFacts } from "./look-facts"
import { NameDialog } from "./name-dialog"

const G = "storefront.gallery"

interface DesignCardProps {
  design: Design
  /** No room for another named look: an automatic one cannot be kept by name. */
  savedFull: boolean
  busy: boolean
  onApply: (design: Design, name: string) => void
}

/**
 * A saved look (adr/0064): its sketch, name, date and state; "Taslağa al"
 * brings it into the draft. Its menu renames it (keeps an automatic one
 * by name) or deletes it for good, asked first (K2).
 */
export function DesignCard({ design, savedFull, busy, onApply }: DesignCardProps) {
  const { t } = useTranslation()
  const ids = useId()
  const rename = useRenameDesign()
  const remove = useDeleteDesign()
  const [naming, setNaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const name = designName(t, design)
  const auto = design.kind === "auto"
  const from = design.summary.source !== "own" ? sourceName(t, design.summary) : null
  return (
    <article
      aria-labelledby={`${ids}-title`}
      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3 shadow-card"
    >
      <DesignThumb summary={design.summary} />
      <div className="flex flex-1 flex-col gap-2 px-1">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 id={`${ids}-title`} className="text-[15px] leading-6 font-semibold break-words">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(design.created_at)}
              {from && design.name ? ` · ${t(`${G}.from`, { name: from })}` : null}
            </p>
          </div>
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
        </div>
        <div className="flex flex-wrap gap-1.5">
          {auto ? <StatusBadge tone="neutral">{t(`${G}.auto.badge`)}</StatusBadge> : null}
          {design.live ? <StatusBadge tone="success">{t(`${G}.badge.live`)}</StatusBadge> : null}
          {design.in_draft ? (
            <StatusBadge tone="info">
              {design.edited
                ? `${t(`${G}.badge.draft`)}, ${t(`${G}.badge.edited`)}`
                : t(`${G}.badge.draft`)}
            </StatusBadge>
          ) : null}
        </div>
        <LookFacts summary={design.summary} />
      </div>
      <div className="mt-auto flex px-1 pb-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          aria-label={t(`${G}.card.applyOf`, { name })}
          onClick={() => {
            onApply(design, name)
          }}
        >
          {t(`${G}.card.apply`)}
        </Button>
      </div>
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
    </article>
  )
}
