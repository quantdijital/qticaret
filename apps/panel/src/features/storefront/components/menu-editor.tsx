import { CircleAlert, Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Field } from "@/components/patterns/form-section"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { SectionCard } from "@/components/patterns/section-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyLine } from "@/features/settings/components/storefront-rows"
import { MENU_LIMITS, useDeleteMenu, useSaveMenu } from "@/features/storefront/api/menus"
import type { Menu } from "@/features/storefront/api/menus"
import {
  draftOf,
  fits,
  itemsOf,
  labelProblem,
  newKey,
  sameDraft,
  titleProblem,
} from "@/features/storefront/menu-rows"
import type { MenuDraft, MenuRow } from "@/features/storefront/menu-rows"
import { errorText } from "@/lib/errors"
import { LinkPickerDialog } from "./link-picker-dialog"
import type { LinkPick } from "./link-picker-panes"
import { MenuLinkList } from "./menu-link-list"

const M = "storefront.menus"
const E = `${M}.editor`

/**
 * One menu: its title and its links, changed here and saved together
 * (adr/0049). Until then nothing reaches the storefront; a saved menu
 * shows there within a minute.
 */
export function MenuEditor({ menu, onDeleted }: { menu: Menu; onDeleted: () => void }) {
  const { t } = useTranslation()
  const save = useSaveMenu()
  const remove = useDeleteMenu()
  const saved = draftOf(menu)
  // None until something changes: the saved menu, as the server last gave it, shows meanwhile
  const [draft, setDraft] = useState<MenuDraft | null>(null)
  const [tried, setTried] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // The picker for a new link (row null) or for a row's new target
  const [picking, setPicking] = useState<{ row: MenuRow | null } | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Each save or discard draws the links afresh (folded again, as a menu opens)
  const [round, setRound] = useState(0)
  const shown = draft ?? saved
  const dirty = draft !== null && !sameDraft(draft, saved)
  const nested = menu.location === "main"
  const busy = save.isPending || remove.isPending

  const edit = (change: (was: MenuDraft) => MenuDraft) => {
    setDraft((was) => change(was ?? saved))
    setFailure(null)
  }
  const setRows = (rows: MenuRow[]) => {
    edit((was) => ({ ...was, rows }))
  }
  const discard = () => {
    setDraft(null)
    setRound((was) => was + 1)
    setTried(false)
    setFailure(null)
  }
  const pick = (choice: LinkPick) => {
    const row = picking?.row
    const target = { to: choice.to, name: choice.name, path: choice.path, broken: choice.broken }
    edit((was) => ({
      ...was,
      rows: row
        ? was.rows.map((each) =>
            each.key === row.key ? { ...each, ...target, label: choice.label ?? each.label } : each
          )
        : [...was.rows, { key: newKey(), depth: 0, label: choice.label ?? "", ...target }],
    }))
    setPicking(null)
  }
  const submit = () => {
    setTried(true)
    if (titleProblem(shown.title) || shown.rows.some((row) => labelProblem(row))) {
      setFailure(t(`${E}.invalid`))
      return
    }
    const body = {
      title: shown.title.trim(),
      location: menu.location,
      rank: menu.rank,
      items: itemsOf(shown.rows),
    }
    save.mutate(
      { id: menu.id, body },
      {
        onSuccess: () => {
          discard()
          toast.success(t(`${E}.saved`))
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      }
    )
  }
  const titleIssue = tried ? titleProblem(shown.title) : null
  const canAdd = fits([...shown.rows, { ...(shown.rows[0] ?? placeholderRow), depth: 0 }])

  return (
    <SectionCard
      title={menu.title}
      description={t(`${M}.place.${menu.location}`)}
      action={
        <>
          <Button variant="outline" disabled={!dirty || busy} onClick={discard}>
            {t(`${E}.discard`)}
          </Button>
          <Button disabled={!dirty || busy} onClick={submit}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-1 flex-col gap-5">
        {failure ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}
        <Field
          label={t(`${E}.title`)}
          htmlFor="menu-title"
          hint={t(`${E}.titleHint.${menu.location}`)}
          error={
            titleIssue ? t(`${M}.errors.${titleIssue}`, { max: MENU_LIMITS.title }) : undefined
          }
          required
        >
          <Input
            id="menu-title"
            value={shown.title}
            maxLength={200}
            aria-invalid={Boolean(titleIssue)}
            onChange={(event) => {
              const title = event.target.value
              edit((was) => ({ ...was, title }))
            }}
          />
        </Field>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">{t(`${E}.links`)}</h3>
            <p className="text-[13px] text-muted-foreground">
              {t(`${E}.linksHint.${nested ? "nested" : "flat"}`)}
            </p>
          </div>
          {shown.rows.length === 0 ? (
            <EmptyLine text={t(`${E}.empty.${menu.location}`)} />
          ) : (
            <MenuLinkList
              key={round}
              rows={shown.rows}
              nested={nested}
              tried={tried}
              onRows={setRows}
              onChangeTarget={(row) => {
                setPicking({ row })
              }}
            />
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canAdd}
              onClick={() => {
                setPicking({ row: null })
              }}
            >
              <Plus />
              {t(`${E}.addLink`)}
            </Button>
            <span className="text-xs text-muted-foreground">
              {nested
                ? t(`${E}.limitNested`, {
                    links: MENU_LIMITS.links,
                    children: MENU_LIMITS.children,
                  })
                : t(`${E}.limit`, { links: MENU_LIMITS.links })}
            </span>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-[13px] text-muted-foreground">{t(`${E}.delay`)}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive-text"
            disabled={busy}
            onClick={() => {
              setDeleting(true)
            }}
          >
            <Trash2 />
            {t(`${E}.delete`)}
          </Button>
        </div>
      </div>
      {picking ? (
        <LinkPickerDialog
          row={picking.row}
          onClose={() => {
            setPicking(null)
          }}
          onPick={pick}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t(`${E}.deleteTitle`)}
        description={t(`${E}.deleteText`, { title: menu.title })}
        confirmLabel={t(`${E}.delete`)}
        destructive
        onConfirm={() => {
          remove.mutate(menu.id, {
            onSuccess: () => {
              toast.success(t(`${E}.deleted`))
              onDeleted()
            },
            onError: (error) => toast.error(errorText(t, error)),
          })
        }}
      />
      <LeaveGuard when={dirty} />
    </SectionCard>
  )
}

// What a new link would add, to ask whether one more fits
const placeholderRow: MenuRow = {
  key: "",
  depth: 0,
  to: { kind: "system", target: "home" },
  label: "",
  name: null,
  path: null,
  broken: false,
}
