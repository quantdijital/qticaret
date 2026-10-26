import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import type { JSONContent } from "@tiptap/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { formatCount } from "@/lib/format"
import { CardDialog } from "./card-dialog"
import type { CardKind } from "./card-nodes"
import { contentExtensions } from "./extensions"
import { ImageDialog } from "./image-dialog"
import { LinkDialog } from "./link-dialog"
import { normalizeDoc, sameDoc } from "./normalize"
import { Toolbar } from "./toolbar"

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

// Pasted images point elsewhere: the server takes only the media library's (adr/0019)
function withoutImages(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html")
  parsed.querySelectorAll("img, picture, video, iframe, script, style").forEach((element) => {
    element.remove()
  })
  return parsed.body.innerHTML
}

/**
 * The page's text (adr/0019): what is written is a document the server
 * checks against its allowlist, never HTML. `value` follows the stored text
 * (a reset puts it back); `onChange` gets every edit, as the server keeps it.
 */
export function RichEditor({
  value,
  onChange,
  label,
}: {
  value: JSONContent
  onChange: (doc: JSONContent) => void
  label: string
}) {
  const { t } = useTranslation()
  const [linking, setLinking] = useState(false)
  const [imaging, setImaging] = useState(false)
  const [carding, setCarding] = useState<CardKind | null>(null)
  // The last document the editor itself gave or was given: only another one (a reset, a save) is put in
  const seen = useRef(value)
  const editor = useEditor({
    extensions: contentExtensions(t("content.editor.placeholder")),
    content: value,
    editorProps: {
      attributes: { class: "qt-prose min-h-80 px-5 py-4 focus:outline-none", "aria-label": label },
      transformPastedHTML: withoutImages,
    },
    onUpdate: ({ editor: changed }) => {
      const doc = normalizeDoc(changed.getJSON())
      seen.current = doc
      onChange(doc)
    },
  })
  const words = useEditorState({
    editor,
    selector: ({ editor: current }) => current.getText().match(WORD)?.length ?? 0,
  })
  // A reset (or a save from elsewhere) puts the stored text back
  useEffect(() => {
    if (value === seen.current) {
      return
    }
    seen.current = value
    if (!sameDoc(editor.getJSON(), value)) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <div className="rounded-md border focus-within:ring-2 focus-within:ring-ring/50">
      <Toolbar
        editor={editor}
        onLink={() => {
          setLinking(true)
        }}
        onImage={() => {
          setImaging(true)
        }}
        onCard={setCarding}
      />
      <EditorContent editor={editor} />
      <div className="flex justify-end border-t px-3 py-1.5 text-xs text-muted-foreground tabular-nums">
        {t("content.editor.words", { count: words, words: formatCount(words) })}
      </div>
      <LinkDialog editor={editor} open={linking} onOpenChange={setLinking} />
      <ImageDialog editor={editor} open={imaging} onOpenChange={setImaging} />
      <CardDialog
        editor={editor}
        kind={carding}
        onClose={() => {
          setCarding(null)
        }}
      />
    </div>
  )
}
