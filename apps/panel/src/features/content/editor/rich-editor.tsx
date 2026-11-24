import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import type { Editor, JSONContent } from "@tiptap/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ExtraToken } from "@/features/settings/components/shop-token-menu"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { CardDialog } from "./card-dialog"
import type { CardKind } from "./card-nodes"
import { contentExtensions } from "./extensions"
import { ImageDialog } from "./image-dialog"
import { LinkDialog } from "./link-dialog"
import { normalizeDoc, sameDoc } from "./normalize"
import { Toolbar } from "./toolbar"

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

/** Characters of text, line breaks and blocks not counted: what the server's cap counts. */
function textLength(editor: Editor): number {
  let length = 0
  editor.state.doc.descendants((node) => {
    length += node.isText ? (node.text?.length ?? 0) : 0
  })
  return length
}

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
  media = true,
  shopTokens = false,
  extraTokens,
  short = false,
  maxChars,
  placeholder,
  bare = false,
}: {
  value: JSONContent
  onChange: (doc: JSONContent) => void
  label: string
  /** Pictures and cards; off for a product's description (ADR-0055), whose server takes neither. */
  media?: boolean
  /** Offer the shop's details (`{telefon}`), for a text the server fills them in (adr/0048). */
  shopTokens?: boolean
  /** Tokens besides the shop's details, with `shopTokens` (a campaign's `{ad}`). */
  extraTokens?: readonly ExtraToken[] | undefined
  /**
   * A short text (a product's short description, ADR-0055 Ek 2026-11-06):
   * a few lines high and growing with its text, h3–h4, no quotes, tables,
   * pictures or cards, links to the shop or https only.
   */
  short?: boolean
  /** Count characters of text against this cap instead of words (the server counts the same). */
  maxChars?: number | undefined
  /** The empty editor's hint; the content editor's own by default. */
  placeholder?: string | undefined
  /** Paragraphs, lists, bold, italic and links only (a footer block's text, adr/0070 §2). */
  bare?: boolean
}) {
  const { t } = useTranslation()
  const [linking, setLinking] = useState(false)
  const [imaging, setImaging] = useState(false)
  const [carding, setCarding] = useState<CardKind | null>(null)
  // The last document the editor itself gave or was given: only another one (a reset, a save) is put in
  const seen = useRef(value)
  const editor = useEditor({
    extensions: contentExtensions(placeholder ?? t("content.editor.placeholder"), {
      media: media && !short && !bare,
      short,
      bare,
    }),
    content: value,
    editorProps: {
      attributes: {
        class: cn("qt-prose px-5 py-4 focus:outline-none", short ? "min-h-32" : "min-h-80"),
        "aria-label": label,
      },
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
  const chars = useEditorState({ editor, selector: ({ editor: current }) => textLength(current) })
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
    <div className="rounded-md border">
      <Toolbar
        editor={editor}
        onLink={() => {
          setLinking(true)
        }}
        onImage={() => {
          setImaging(true)
        }}
        onCard={setCarding}
        media={media && !short && !bare}
        tokens={shopTokens}
        extraTokens={extraTokens}
        short={short}
        bare={bare}
      />
      {/* A long text scrolls inside, under a toolbar that stays in reach; the page beside keeps its height */}
      <EditorContent
        editor={editor}
        data-scroll-area="y"
        className="max-h-[min(70vh,48rem)] overflow-y-auto"
      />
      <div
        className={cn(
          "flex justify-end border-t px-3 py-1.5 text-xs text-muted-foreground tabular-nums",
          maxChars !== undefined && chars > maxChars && "text-destructive-text"
        )}
      >
        {maxChars === undefined
          ? t("content.editor.words", { count: words, words: formatCount(words) })
          : t("content.editor.chars", { count: formatCount(chars), max: formatCount(maxChars) })}
      </div>
      <LinkDialog editor={editor} open={linking} onOpenChange={setLinking} short={short} />
      {media && !short && !bare ? (
        <>
          <ImageDialog editor={editor} open={imaging} onOpenChange={setImaging} />
          <CardDialog
            editor={editor}
            kind={carding}
            onClose={() => {
              setCarding(null)
            }}
          />
        </>
      ) : null}
    </div>
  )
}
