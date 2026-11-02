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
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type { CardKind } from "./card-nodes"
import { TableTools } from "./table-tools"
import { EditorTokenMenu } from "./token-menu"
import { ToolButton } from "./tool-button"

const BLOCKS = ["paragraph", "h2", "h3", "h4"] as const
type BlockKind = (typeof BLOCKS)[number]

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
  /** The shop's details menu (adr/0048): only texts the server fills them in. */
  tokens?: boolean
}

/** The editor's actions, each one the server allows (adr/0019). */
export function Toolbar({ editor, onLink, onImage, onCard, tokens = false }: ToolbarProps) {
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
      <Select
        value={state.block}
        onValueChange={(value) => {
          // Radix calls with "" while the value has no item yet
          if (BLOCKS.includes(value as BlockKind)) {
            setBlock(editor, value as BlockKind)
          }
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-32" aria-label={label("block")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLOCKS.map((block) => (
            <SelectItem key={block} value={block}>
              {t(`content.editor.blocks.${block}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="mx-1 h-5" />
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
      {tokens ? (
        <>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <EditorTokenMenu editor={editor} />
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
