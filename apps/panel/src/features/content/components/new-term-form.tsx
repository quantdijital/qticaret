import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { TERM_PREFIX, useCreateTerm } from "@/features/content/api/terms"
import type { TermKind } from "@/features/content/api/terms"
import { errorText } from "@/lib/errors"
import { toSlug } from "@/lib/slug"

const T = "content.terms"

/**
 * A new category or tag by its name, right above the list: the address it
 * will get shows as it is typed (the server makes the handle the same way).
 */
export function NewTermForm({ kind }: { kind: TermKind }) {
  const { t } = useTranslation()
  const create = useCreateTerm()
  const [name, setName] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const handle = toSlug(name)
  const submit = () => {
    if (name.trim() === "") {
      return
    }
    setFailure(null)
    create.mutate(
      { kind, name: name.trim() },
      {
        onSuccess: ({ term }) => {
          toast.success(t(`${T}.created.${kind}`, { name: term.name }))
          setName("")
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      }
    )
  }
  const hintId = `new-term-${kind}-hint`
  return (
    <form
      noValidate
      className="flex w-full flex-col gap-1.5 sm:ml-auto sm:w-auto"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex gap-2">
        <Input
          id={`new-term-${kind}`}
          value={name}
          maxLength={120}
          aria-label={t(`${T}.newName.${kind}`)}
          aria-describedby={hintId}
          aria-invalid={Boolean(failure)}
          placeholder={t(`${T}.newName.${kind}`)}
          className="min-w-0 flex-1 sm:w-64"
          onChange={(event) => {
            setName(event.target.value)
            setFailure(null)
          }}
        />
        <Button type="submit" disabled={create.isPending || name.trim() === ""}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {t(`${T}.add`)}
        </Button>
      </div>
      <p
        id={hintId}
        role={failure ? "alert" : undefined}
        className={failure ? "text-xs text-destructive-text" : "text-xs text-muted-foreground"}
      >
        {failure ??
          (handle
            ? t(`${T}.addressPreview`, { path: `${TERM_PREFIX[kind]}${handle}` })
            : t(`${T}.addressHint`))}
      </p>
    </form>
  )
}
