import { Loader2 } from "lucide-react"
import { useState } from "react"
import type { SyntheticEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ChipInput } from "@/components/patterns/chip-input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSaveSynonym } from "@/features/seo/api/synonyms"
import type { SynonymGroup } from "@/features/seo/api/synonyms"
import { useSynonymText } from "./synonym-text"
import { MAX_GROUP_TERMS, MIN_GROUP_TERMS, addTerms } from "./terms"

const S = "seo.siteSearch"
const FIELD = "synonym-terms"

interface SynonymDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The group being changed; none adds one. */
  group?: SynonymGroup | null | undefined
}

function SynonymForm({
  group,
  onDone,
}: {
  group?: SynonymGroup | null | undefined
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { problemText, failureText } = useSynonymText()
  const save = useSaveSynonym()
  const [terms, setTerms] = useState<string[]>(group?.terms ?? [])
  const [text, setText] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  // The typed text taken into the group; null when a term was refused
  const take = (): string[] | null => {
    const added = addTerms(text, terms)
    setTerms(added.group)
    setText(added.rest)
    setProblem(added.problem ? problemText(added.problem.problem, added.problem.term) : null)
    return added.problem ? null : added.group
  }

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFailure(null)
    const kept = take()
    if (!kept) {
      return
    }
    if (kept.length < MIN_GROUP_TERMS) {
      setProblem(problemText("tooFew"))
      return
    }
    save.mutate(
      { id: group?.id, terms: kept },
      {
        onSuccess: () => {
          toast.success(t(group ? `${S}.form.updated` : `${S}.form.created`))
          onDone()
        },
        onError: (error) => {
          setFailure(failureText(error))
        },
      }
    )
  }

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={submit}>
      <DialogBody>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={FIELD} className="text-sm font-medium">
              {t(`${S}.form.terms`)}
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t(`${S}.form.count`, { shown: terms.length, max: MAX_GROUP_TERMS })}
            </span>
          </div>
          <ChipInput
            id={FIELD}
            chips={terms.map((term) => ({ key: term, label: term }))}
            text={text}
            onTextChange={(next) => {
              setText(next)
              setProblem(null)
            }}
            onCommit={() => {
              take()
            }}
            onRemove={(index) => {
              setTerms(terms.filter((_, at) => at !== index))
              setProblem(null)
            }}
            removeLabel={(term) => t(`${S}.form.remove`, { term })}
            aria-describedby={`${FIELD}-note`}
            placeholder={t(`${S}.form.placeholder`)}
            invalid={problem !== null}
          />
          {problem ? (
            <p id={`${FIELD}-note`} role="alert" className="text-xs text-destructive-text">
              {problem}
            </p>
          ) : (
            <p id={`${FIELD}-note`} className="text-xs text-muted-foreground">
              {t(`${S}.form.hint`)}
            </p>
          )}
        </div>
        {failure ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive-text"
          >
            {failure}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(group ? "common.save" : `${S}.form.add`)}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Adds a synonym group or changes one (adr/0056): two to ten terms, each
 * one to three words, typed as chips. Each term is checked as the server
 * checks it; what the server still refuses is said in words.
 */
export function SynonymDialog({ open, onOpenChange, group }: SynonymDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t(group ? `${S}.form.editTitle` : `${S}.form.title`)}</DialogTitle>
          <DialogDescription>{t(`${S}.form.description`)}</DialogDescription>
        </DialogHeader>
        {/* Mounted per opening, so a closed dialog forgets what was typed */}
        {open ? (
          <SynonymForm
            group={group}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
