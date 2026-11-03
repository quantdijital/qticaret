import type { Editor } from "@tiptap/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
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
import { Input } from "@/components/ui/input"
import { isSafeHref } from "./href"

// Mounted on each opening: it starts from the link under the cursor
function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const { t } = useTranslation()
  const current = String(editor.getAttributes("link")["href"] ?? "")
  const [href, setHref] = useState(current)
  const valid = isSafeHref(href)
  return (
    <DialogContent size="sm">
      <DialogHeader>
        <DialogTitle>{t("content.editor.link.title")}</DialogTitle>
        <DialogDescription>{t("content.editor.link.hint")}</DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) {
            editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run()
            onDone()
          }
        }}
      >
        <DialogBody>
          <Field
            label={t("content.editor.link.address")}
            htmlFor="content-link"
            error={href.trim() && !valid ? t("content.editor.link.invalid") : undefined}
          >
            <Input
              id="content-link"
              value={href}
              autoFocus
              spellCheck={false}
              placeholder="/kategori/…"
              className="font-mono text-[13px]"
              onChange={(event) => {
                setHref(event.target.value)
              }}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          {current ? (
            <Button
              type="button"
              variant="outline"
              className="sm:mr-auto"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run()
                onDone()
              }}
            >
              {t("content.editor.link.remove")}
            </Button>
          ) : null}
          <Button type="submit" disabled={!valid}>
            {t("content.editor.link.apply")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

/** Links the selected text to a page of the shop (`/kategori/kupa`) or an http(s) address. */
export function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <LinkForm
          editor={editor}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}
