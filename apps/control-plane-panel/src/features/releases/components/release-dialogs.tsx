import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { Facts } from "@/features/billing/components/facts"
import {
  RELEASE_COMMIT,
  RELEASE_NOTES_MAX,
  RELEASE_VERSION,
  useAddRelease,
  useSetReleaseNotes,
} from "@/features/releases/api"
import type { Release } from "@/features/releases/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

/** A field with its help, or its problem once typed (read with the field). */
function Field({
  id,
  label,
  help,
  problem,
  children,
}: {
  id: string
  label: string
  help: string
  problem: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p
        id={`${id}-help`}
        className={problem ? "text-[13px] text-destructive" : "text-[13px] text-muted-foreground"}
      >
        {problem ?? help}
      </p>
    </div>
  )
}

/** "Sürüm ekle" (owner, operator; step-up): version and commit fixed once made, a note. */
export function AddReleaseDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const add = useAddRelease()
  const [version, setVersion] = useState("")
  const [commit, setCommit] = useState("")
  const [notes, setNotes] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const versionOk = RELEASE_VERSION.test(version.trim())
  const commitOk = RELEASE_COMMIT.test(commit.trim())
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t("releases.add")}
      description={t("releases.addText")}
      dirty={version !== "" || commit !== "" || notes !== ""}
      saving={add.isPending}
      canSubmit={versionOk && commitOk}
      submitLabel={t("releases.add")}
      onSubmit={() => {
        setFailure(null)
        add.mutate(
          { version: version.trim(), commit: commit.trim().toLowerCase(), notes },
          {
            onSuccess: () => {
              toast.success(t("releases.added"))
              onClose()
            },
            onError: (error) => {
              if (!isStepUpCancelled(error)) {
                setFailure(errorText(t, error))
              }
            },
          }
        )
      }}
    >
      <DialogBody>
        <Field
          id="release-version"
          label={t("releases.version")}
          help={t("releases.versionHelp")}
          problem={version !== "" && !versionOk ? t("releases.versionInvalid") : null}
        >
          <Input
            id="release-version"
            value={version}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="release-version-help"
            aria-invalid={version !== "" && !versionOk}
            onChange={(event) => {
              setVersion(event.target.value)
            }}
          />
        </Field>
        <Field
          id="release-commit"
          label={t("releases.commit")}
          help={t("releases.commitHelp")}
          problem={commit !== "" && !commitOk ? t("releases.commitInvalid") : null}
        >
          <Input
            id="release-commit"
            value={commit}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            aria-describedby="release-commit-help"
            aria-invalid={commit !== "" && !commitOk}
            onChange={(event) => {
              setCommit(event.target.value)
            }}
          />
        </Field>
        <Field
          id="release-notes"
          label={t("releases.notes")}
          help={t("releases.notesHelp")}
          problem={null}
        >
          <Textarea
            id="release-notes"
            rows={4}
            maxLength={RELEASE_NOTES_MAX}
            value={notes}
            aria-describedby="release-notes-help"
            onChange={(event) => {
              setNotes(event.target.value)
            }}
          />
        </Field>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}

function releaseFacts(t: ReturnType<typeof useTranslation>["t"], release: Release) {
  return [
    [t("releases.columns.commit"), <span className="font-mono break-all">{release.commit}</span>],
    [
      t("releases.columns.created"),
      release.created_by
        ? t("releases.addedBy", {
            when: formatDateTime(release.created_at),
            by: release.created_by,
          })
        : formatDateTime(release.created_at),
    ],
    [
      t("releases.columns.reported"),
      t("releases.counts", { reported: release.reported_count, target: release.target_count }),
    ],
  ] as [string, ReactNode][]
}

/**
 * A release opened from its list (one standard dialog): its facts, and
 * its note, editable by who runs shops (step-up), read by the rest.
 */
export function ReleaseDialog({
  release,
  editable,
  onClose,
}: {
  release: Release
  editable: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useSetReleaseNotes(release.id)
  const [notes, setNotes] = useState(release.notes ?? "")
  const [failure, setFailure] = useState<string | null>(null)
  const title = t("releases.detailTitle", { version: release.version })
  const close = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }
  if (!editable) {
    return (
      <DetailDialog open onOpenChange={close} title={title} description={t("releases.detailText")}>
        <DialogBody>
          <Facts
            rows={[
              ...releaseFacts(t, release),
              [t("releases.columns.notes"), release.notes ?? t("releases.noNotes")],
            ]}
          />
        </DialogBody>
      </DetailDialog>
    )
  }
  return (
    <FormDialog
      open
      onOpenChange={close}
      title={title}
      description={t("releases.detailText")}
      dirty={notes !== (release.notes ?? "")}
      saving={save.isPending}
      onSubmit={() => {
        setFailure(null)
        save.mutate(notes, {
          onSuccess: () => {
            toast.success(t("releases.saved"))
            onClose()
          },
          onError: (error) => {
            if (!isStepUpCancelled(error)) {
              setFailure(errorText(t, error))
            }
          },
        })
      }}
    >
      <DialogBody>
        <Facts rows={releaseFacts(t, release)} />
        <Field
          id="release-edit-notes"
          label={t("releases.notes")}
          help={t("releases.notesHelp")}
          problem={null}
        >
          <Textarea
            id="release-edit-notes"
            rows={5}
            maxLength={RELEASE_NOTES_MAX}
            value={notes}
            aria-describedby="release-edit-notes-help"
            onChange={(event) => {
              setNotes(event.target.value)
            }}
          />
        </Field>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
