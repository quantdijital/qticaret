import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { FormDialog } from "@/components/patterns/form-dialog"
import { Button } from "@/components/ui/button"
import { DialogBody } from "@/components/ui/dialog"
import { useCreateAuthor, useDeleteAuthor, useUpdateAuthor } from "@/features/content/api/authors"
import type { Author } from "@/features/content/api/authors"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { AuthorFields } from "./author-fields"
import { EMPTY_AUTHOR, authorBodyOf, authorValuesOf } from "./author-values"
import type { AuthorValues } from "./author-values"

const A = "content.authors"

/** "Yazarı sil", after asking: the author's posts stay, without an author. */
function DeleteAuthor({
  author,
  busy,
  onDeleted,
}: {
  author: Author
  busy: boolean
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const remove = useDeleteAuthor()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive-text"
        disabled={busy || remove.isPending}
        onClick={() => {
          setAsking(true)
        }}
      >
        <Trash2 />
        {t(`${A}.delete`)}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${A}.deleteTitle`, { name: author.name })}
        description={t(`${A}.deleteText`, { count: author.post_count })}
        confirmLabel={t(`${A}.delete`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          remove.mutate(author.id, {
            onSuccess: ({ unlinked }) => {
              toast.success(
                [t(`${A}.deleted`), unlinked > 0 ? t(`${A}.unlinked`, { count: unlinked }) : ""]
                  .filter(Boolean)
                  .join(" ")
              )
              onDeleted()
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

/**
 * One author in the standard dialog (docs/18 §7): photo, name, page
 * address, title, biography, links and the staff account they are, all
 * saved with "Kaydet". With no author it makes a new one (`initialName`
 * filled in, a post's old author text) and hands it to `onSaved`.
 */
export function AuthorDialog({
  author,
  initialName = "",
  onClose,
  onSaved,
}: {
  author: Author | null
  initialName?: string
  onClose: () => void
  onSaved?: (author: Author) => void
}) {
  const { t } = useTranslation()
  const create = useCreateAuthor()
  const update = useUpdateAuthor(author?.id ?? "")
  const saved = author ? authorValuesOf(author) : { ...EMPTY_AUTHOR, name: initialName }
  const form = useForm<AuthorValues>({
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })
  const saving = create.isPending || update.isPending
  const done = (result: { author: Author }) => {
    form.reset(authorValuesOf(result.author), FULL_RESET)
    toast.success(t(author ? "content.saved" : `${A}.created`, { name: result.author.name }))
    onSaved?.(result.author)
    onClose()
  }
  const submit = form.handleSubmit((values) => {
    if (values.name.trim() === "") {
      form.setError("name", { message: t(`${A}.nameRequired`) })
      return
    }
    const failed = (failure: unknown) => toast.error(errorText(t, failure))
    if (author) {
      update.mutate(authorBodyOf(values, form.formState.dirtyFields), {
        onSuccess: done,
        onError: failed,
      })
      return
    }
    create.mutate(
      { ...authorBodyOf(values, null), name: values.name.trim() },
      { onSuccess: done, onError: failed }
    )
  })
  const idPrefix = `author-${author?.id ?? "new"}`
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      size="lg"
      pane="fixed"
      title={author ? author.name : t(`${A}.new`)}
      description={author ? <span className="font-mono text-xs">{author.path}</span> : undefined}
      // A new author with a name given (a post's old text) may be saved as it is
      dirty={form.formState.isDirty || (!author && initialName.trim() !== "")}
      saving={saving}
      initialFocus={`${idPrefix}-name`}
      onSubmit={() => void submit()}
      footerStart={
        author ? <DeleteAuthor author={author} busy={saving} onDeleted={onClose} /> : null
      }
    >
      <DialogBody>
        <AuthorFields form={form} idPrefix={idPrefix} author={author} />
      </DialogBody>
    </FormDialog>
  )
}
