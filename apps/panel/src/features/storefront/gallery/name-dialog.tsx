import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Input } from "@qticaret/admin-ui/ui/input"
import { errorText } from "@/lib/errors"
import { useSaveDesign } from "./api"
import { NAME_MAX } from "./design-name"

const G = "storefront.gallery"

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | undefined
  /** The name it opens with. */
  initial: string
  submitLabel: string
  saving: boolean
  onSubmit: (name: string) => void
  /** A rename: "Kaydet" lights once the name differs from the one it has. */
  renaming?: boolean
}

/** A saved look's name (1–60 characters): saving one, renaming one or keeping an automatic one. */
export function NameDialog({ open, onOpenChange, initial, ...props }: NameDialogProps) {
  return (
    <>
      {/* Opened afresh each time: the field starts from the name offered then */}
      {open ? (
        <NameForm key={initial} open onOpenChange={onOpenChange} initial={initial} {...props} />
      ) : null}
    </>
  )
}

function NameForm({
  open,
  onOpenChange,
  title,
  description,
  initial,
  submitLabel,
  saving,
  onSubmit,
  renaming = false,
}: NameDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial)
  const trimmed = name.trim()
  const valid = trimmed.length > 0 && trimmed.length <= NAME_MAX
  // Closing asks only once something was typed; the name offered may be saved as it is
  const guard = useDiscardGuard(trimmed !== initial.trim())
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      dirty={renaming ? trimmed !== initial.trim() : trimmed !== ""}
      guard={guard}
      canSubmit={valid}
      saving={saving}
      submitLabel={submitLabel}
      initialFocus="design-name"
      onSubmit={() => {
        if (valid) {
          onSubmit(trimmed)
        }
      }}
    >
      <Field label={t(`${G}.save.name`)} htmlFor="design-name" hint={t(`${G}.save.nameHint`)}>
        <Input
          placeholder={t("storefront.placeholders.designName")}
          id="design-name"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          onChange={(event) => {
            setName(event.target.value)
          }}
        />
      </Field>
    </FormDialog>
  )
}

interface SaveDesignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The name offered. */
  initial: string
  /** A kept publication saved instead of the draft. */
  revision?: number
  /** Before saving: what waits in the editor is stored first; false: it could not be. */
  before?: () => Promise<boolean>
}

/** "Bu görünümü kaydet": the draft (or a publication) kept under a name, read on the server. */
export function SaveDesignDialog({
  open,
  onOpenChange,
  initial,
  revision,
  before,
}: SaveDesignDialogProps) {
  const { t } = useTranslation()
  const save = useSaveDesign()
  return (
    <NameDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`${G}.save.title`)}
      description={t(revision ? `${G}.save.textRevision` : `${G}.save.text`, { revision })}
      initial={initial}
      submitLabel={t(`${G}.save.confirm`)}
      saving={save.isPending}
      onSubmit={(name) => {
        void (async () => {
          if (before && !(await before())) {
            toast.error(t("storefront.editor.unsaved"))
            return
          }
          save.mutate(revision ? { name, revision } : { name }, {
            onSuccess: () => {
              onOpenChange(false)
              toast.success(t(`${G}.save.done`, { name }))
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        })()
      }}
    />
  )
}
