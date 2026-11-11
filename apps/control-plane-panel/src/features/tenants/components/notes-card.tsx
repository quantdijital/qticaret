import { Pin } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { useMe } from "@/features/auth/api"
import type { Note, TenantDetail } from "@/features/tenants/api"
import { useRemoveNote, useSaveNote } from "@/features/tenants/mutations"
import { canManageShops } from "@/features/tenants/permissions"
import { errorText } from "@/lib/errors"

const SHOWN = 3
const NOTE_MAX = 2000

/**
 * Staff notes on the shop, in their own tab: the one being written on
 * top, then pinned first, the newest three, "Tümünü göster" for the rest. Written by owner and operator; a
 * note is pinned, unpinned or removed by its author or an owner.
 */
export function NotesCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const me = useMe()
  const id = shop.tenant.id
  const save = useSaveNote(id)
  const remove = useRemoveNote(id)
  const [body, setBody] = useState("")
  const [all, setAll] = useState(false)
  const [removing, setRemoving] = useState<Note | null>(null)
  const writable = canManageShops(me?.role)
  const mine = (note: Note) => writable && (me?.role === "owner" || note.author_id === me?.id)
  const fail = (error: unknown) => toast.error(errorText(t, error))
  const notes = all ? shop.notes : shop.notes.slice(0, SHOWN)
  return (
    <SectionCard title={t("notes.title")}>
      <div className="flex flex-1 flex-col gap-4">
        {writable ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate(
                { noteId: null, body: body.trim() },
                {
                  onSuccess: () => {
                    setBody("")
                    toast.success(t("notes.saved"))
                  },
                  onError: fail,
                }
              )
            }}
          >
            <Textarea
              aria-label={t("notes.new")}
              placeholder={t("notes.placeholder")}
              maxLength={NOTE_MAX}
              rows={3}
              value={body}
              onChange={(event) => {
                setBody(event.target.value)
              }}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="self-end"
              disabled={body.trim() === "" || save.isPending}
            >
              {t("notes.add")}
            </Button>
          </form>
        ) : null}
        {shop.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("notes.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {notes.map((note) => (
              <li key={note.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
                <p className="text-sm whitespace-pre-line wrap-break-word">{note.body}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    {note.pinned ? (
                      <Pin aria-label={t("notes.pinned")} className="size-3.5 text-foreground" />
                    ) : null}
                    {t("notes.by", {
                      author: note.author ?? t("activity.system"),
                      date: formatDateTime(note.created_at),
                    })}
                  </span>
                  {mine(note) ? (
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={save.isPending}
                        onClick={() => {
                          save.mutate({ noteId: note.id, pinned: !note.pinned }, { onError: fail })
                        }}
                      >
                        {t(note.pinned ? "notes.unpin" : "notes.pin")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setRemoving(note)
                        }}
                      >
                        {t("notes.remove")}
                      </Button>
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {shop.notes.length > SHOWN ? (
          <Button
            variant="link"
            size="sm"
            className="self-start px-0"
            onClick={() => {
              setAll((current) => !current)
            }}
          >
            {all ? t("notes.showLess") : t("notes.showAll", { count: shop.notes.length })}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={t("notes.confirm.title")}
        description={t("notes.confirm.text")}
        confirmLabel={t("notes.confirm.action")}
        destructive
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id, {
              onSuccess: () => toast.success(t("notes.removed")),
              onError: fail,
            })
          }
        }}
      />
    </SectionCard>
  )
}
