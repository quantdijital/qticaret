import type { Editor } from "@tiptap/react"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { errorText } from "@/lib/errors"
import { IMAGE_ACCEPT, uploadContentImage } from "./upload"

// Mounted on each opening: a selected image's own alt text, else a new image from scratch
function ImageForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const { t } = useTranslation()
  const selected = editor.isActive("image")
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState(selected ? String(editor.getAttributes("image")["alt"] ?? "") : "")
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (selected) {
      editor
        .chain()
        .focus()
        .updateAttributes("image", { alt: alt.trim() || null })
        .run()
      onDone()
      return
    }
    if (!file) {
      return
    }
    setBusy(true)
    try {
      const src = await uploadContentImage(file)
      editor.chain().focus().setImage({ src, alt: alt.trim() }).run()
      onDone()
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {t(selected ? "content.editor.image.editTitle" : "content.editor.image.title")}
        </DialogTitle>
        <DialogDescription>{t("content.editor.image.hint")}</DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {selected ? null : (
          <Field label={t("content.editor.image.file")} htmlFor="content-image-file" required>
            <Input
              id="content-image-file"
              type="file"
              accept={IMAGE_ACCEPT}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
              }}
            />
          </Field>
        )}
        <Field
          label={t("content.editor.image.alt")}
          htmlFor="content-image-alt"
          hint={t("content.editor.image.altHint")}
        >
          <Input
            id="content-image-alt"
            value={alt}
            maxLength={500}
            onChange={(event) => {
              setAlt(event.target.value)
            }}
          />
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={busy || (!selected && !file)}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t(selected ? "common.save" : "content.editor.image.insert")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

/**
 * Adds an image to the text, uploaded to the shop's media library, with
 * what it shows in words (alt text, docs/13 §8); on a selected image,
 * changes only its alt text.
 */
export function ImageDialog({
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
        <ImageForm
          editor={editor}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      ) : null}
    </Dialog>
  )
}
