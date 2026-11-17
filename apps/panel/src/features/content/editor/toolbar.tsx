import { useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import {
  Bold,
  FolderTree,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Package,
  Quote,
  Redo2,
  Table2,
  Undo2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Separator } from "@qticaret/admin-ui/ui/separator"
import type { ExtraToken } from "@/features/settings/components/shop-token-menu"
import type { CardKind } from "./card-nodes"
import { TableTools } from "./table-tools"
import { EditorTokenMenu } from "./token-menu"
import { ToolButton } from "./tool-button"

const BLOCKS = ["paragraph", "h2", "h3", "h4"] as const
type BlockKind = (typeof BLOCKS)[number]
// A short text's (ADR-0055 Ek 2026-11-06): no h2
const SHORT_BLOCKS: readonly BlockKind[] = ["paragraph", "h3", "h4"]

const blockOf = (editor: Editor): BlockKind =>
  editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : editor.isActive("heading", { level: 4 })
        ? "h4"
        : "paragraph"

function setBlock(editor: Editor, kind: BlockKind) {
  const chain = editor.chain().focus()
  if (kind === "paragraph") {
    chain.setParagraph().run()
  } else {
    chain.setHeading({ level: Number(kind.slice(1)) as 2 | 3 | 4 }).run()
  }
}

interface ToolbarProps {
  editor: Editor
  onLink: () => void
  onImage: () => void
  onCard: (kind: CardKind) => void
  /** Pictures and cards: off for a text that takes neither (a product's description, ADR-0055). */
  media?: boolean
  /** The shop's details menu (adr/0048): only texts the server fills them in. */
  tokens?: boolean
  /** Tokens the menu offers besides the shop's details. */
  extraTokens?: readonly ExtraToken[] | undefined
  /** A short text (a product's short description): h3–h4, no quotes or tables. */
  short?: boolean
  /** A bare text (a footer block's): no headings, quotes or tables either. */
  bare?: boolean
}

/** The editor's actions, each one the server allows (adr/0019). */
export function Toolbar({
  editor,
  onLink,
  onImage,
  onCard,
  media = true,
  tokens = false,
  extraTokens,
  short = false,
  bare = false,
}: ToolbarProps) {
  const blocks = short ? SHORT_BLOCKS : BLOCKS
  const { t } = useTranslation()
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      block: blockOf(current),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      link: current.isActive("link"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      table: current.isActive("table"),
      image: current.isActive("image"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  })
  const label = (key: string) => t(`content.editor.tools.${key}`)
  const run = (action: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => () =>
    action(editor.chain().focus()).run()
  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card px-2 py-1.5">
      {bare ? null : (
        <Select
          value={state.block}
          onValueChange={(value) => {
            // Radix calls with "" while the value has no item yet
            if (blocks.includes(value as BlockKind)) {
              setBlock(editor, value as BlockKind)
            }
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-32" aria-label={label("block")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {blocks.map((block) => (
              <SelectItem key={block} value={block}>
                {t(`content.editor.blocks.${block}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {bare ? null : <Separator orientation="vertical" className="mx-1 h-5" />}
      <ToolButton
        icon={Bold}
        label={label("bold")}
        active={state.bold}
        onClick={run((c) => c.toggleBold())}
      />
      <ToolButton
        icon={Italic}
        label={label("italic")}
        active={state.italic}
        onClick={run((c) => c.toggleItalic())}
      />
      <ToolButton icon={Link2} label={label("link")} active={state.link} onClick={onLink} />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton
        icon={List}
        label={label("bulletList")}
        active={state.bulletList}
        onClick={run((c) => c.toggleBulletList())}
      />
      <ToolButton
        icon={ListOrdered}
        label={label("orderedList")}
        active={state.orderedList}
        onClick={run((c) => c.toggleOrderedList())}
      />
      {short || bare ? null : (
        <>
          <ToolButton
            icon={Quote}
            label={label("quote")}
            active={state.quote}
            onClick={run((c) => c.toggleBlockquote())}
          />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolButton
            icon={Table2}
            label={label("table")}
            active={state.table}
            onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
          />
        </>
      )}
      {media && !short ? (
        <>
          <ToolButton
            icon={ImagePlus}
            label={label(state.image ? "imageAlt" : "image")}
            active={state.image}
            onClick={onImage}
          />
          <ToolButton
            icon={Package}
            label={label("productCard")}
            onClick={() => {
              onCard("product")
            }}
          />
          <ToolButton
            icon={FolderTree}
            label={label("categoryCard")}
            onClick={() => {
              onCard("category")
            }}
          />
        </>
      ) : null}
      {tokens ? (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <EditorTokenMenu editor={editor} extra={extraTokens} />
        </>
      ) : null}
      {state.table ? <TableTools editor={editor} /> : null}
      <div className="ml-auto flex items-center gap-0.5">
        <ToolButton
          icon={Undo2}
          label={label("undo")}
          disabled={!state.canUndo}
          onClick={run((c) => c.undo())}
        />
        <ToolButton
          icon={Redo2}
          label={label("redo")}
          disabled={!state.canRedo}
          onClick={run((c) => c.redo())}
        />
      </div>
    </div>
  )
}
