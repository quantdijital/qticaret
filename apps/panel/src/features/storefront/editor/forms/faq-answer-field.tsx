import { Pencil } from "lucide-react"
import type { JSONContent } from "@tiptap/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { FAQ_LIMITS } from "@qticaret/types"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { docText } from "@/features/content/doc-text"
import { RichEditor } from "@/features/content/editor/rich-editor"

const Q = "storefront.editor.faq"
// The panel shows the answer's start; the dialog holds the whole
const EXCERPT = 140

/**
 * A question's answer (adr/0073 Ek 2026-11-24 (2)): its start in the
 * panel, the content editor in a dialog as a footer text block's
 * (paragraphs, lists, bold, italic and links; the shop's details), within
 * the answer's characters.
 */
export function FaqAnswerField({
  id,
  label,
  question,
  body,
  error,
  onChange,
}: {
  /** The button's id: the preview's answer lands on it. */
  id: string
  label: string
  /** The question, named in the dialog's title. */
  question: string
  body: JSONContent
  error: string | undefined
  onChange: (body: JSONContent) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  // The editor keeps the callback it was made with: the change is read as it is now
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  })
  const text = docText(body)
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <button
        id={id}
        type="button"
        aria-labelledby={`${id}-label ${id}`}
        aria-invalid={Boolean(error)}
        className="group/answer flex items-start gap-2 rounded-md border px-3 py-2 text-left text-[13px] hover:bg-muted/60 aria-invalid:border-destructive"
        onClick={() => {
          setEditing(true)
        }}
      >
        <span className={text === "" ? "flex-1 text-muted-foreground" : "line-clamp-3 flex-1"}>
          {text === "" ? t(`${Q}.answerEmpty`) : text.slice(0, EXCERPT)}
        </span>
        <Pencil className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t(`${Q}.answerEdit`)}</span>
      </button>
      {error ? (
        <p role="alert" className="text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{question.trim() === "" ? label : question}</DialogTitle>
            <DialogDescription>{t(`${Q}.answerDescription`)}</DialogDescription>
          </DialogHeader>
          <RichEditor
            bare
            short
            shopTokens
            value={body}
            label={label}
            maxChars={FAQ_LIMITS.answerChars}
            placeholder={t(`${Q}.answerPlaceholder`)}
            onChange={(next) => {
              latest.current(next)
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setEditing(false)
              }}
            >
              {t(`${Q}.done`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
