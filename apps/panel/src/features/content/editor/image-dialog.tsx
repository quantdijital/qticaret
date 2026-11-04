import type { Editor } from "@tiptap/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { MediaField } from "@/components/patterns/media-field"
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

// Mounted on each opening: a selected image's own alt text, else a new image from scratch
function ImageForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const { t } = useTranslation()
  const selected = editor.isActive("image")
  const [src, setSrc] = useState<string | null>(null)
  const [alt, setAlt] = useState(selected ? String(editor.getAttributes("image")["alt"] ?? "") : "")
  const submit = () => {
    if (selected) {
      editor
        .chain()
        .focus()
        .updateAttributes("image", { alt: alt.trim() || null })
        .run()
      onDone()
      return
    }
    if (!src) {
      return
    }
    editor.chain().focus().setImage({ src, alt: alt.trim() }).run()
    onDone()
  }
  const altField = (
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
  )
  return (
    <DialogContent size="md">
      <DialogHeader>
        <DialogTitle>
          {t(selected ? "content.editor.image.editTitle" : "content.editor.image.title")}
        </DialogTitle>
        <DialogDescription>{t("content.editor.image.hint")}</DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <DialogBody>
          {selected ? (
            altField
          ) : (
            <MediaField
              id="content-image"
              label={t("content.editor.image.file")}
              value={src}
              onChange={(asset) => {
                setSrc(asset?.url ?? null)
                // A library image's own alt text fills an empty one
                if (asset?.alt && !alt.trim()) {
                  setAlt(asset.alt)
                }
              }}
            >
              {altField}
            </MediaField>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="submit" disabled={!selected && !src}>
            {t(selected ? "common.save" : "content.editor.image.insert")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

/**
 * Adds an image to the text from the shop's media library (chosen there,
 * uploaded from this computer or brought in from an address), with what it
 * shows in words (alt text, docs/13 §8); on a selected image, changes only
 * its alt text.
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
