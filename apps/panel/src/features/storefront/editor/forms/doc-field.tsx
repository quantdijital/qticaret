import { Pencil } from "lucide-react"
import type { JSONContent } from "@tiptap/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { FieldGroup } from "./fields"

const T = "storefront.editor.richText"
// The panel shows the text's start; the editor holds the whole
const EXCERPT = 160

/**
 * A section's text written in the content editor (adr/0019), which may
 * hold product and category cards and the shop's details: its start in
 * the panel, the editor wide in a dialog (the side panel is too narrow for
 * its toolbar).
 */
export function DocField({
  id,
  label,
  body,
  onChange,
}: {
  /** The button's id: the preview's text label lands on it. */
  id: string
  label: string
  body: JSONContent
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
  const title = t(`${T}.edit`)
  return (
    <>
      <FieldGroup title={label}>
        <p className="line-clamp-4 rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
          {text === "" ? t(`${T}.empty`) : text.slice(0, EXCERPT)}
        </p>
        <Button
          id={id}
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => {
            setEditing(true)
          }}
        >
          <Pencil />
          {title}
        </Button>
      </FieldGroup>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t(`${T}.description`)}</DialogDescription>
          </DialogHeader>
          <RichEditor
            value={body}
            label={label}
            shopTokens
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
              {t(`${T}.done`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
