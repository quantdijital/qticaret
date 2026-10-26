import { useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { Columns3, Rows3, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Separator } from "@/components/ui/separator"
import { ToolButton } from "./tool-button"

// The server's bound for a table row's cells (adr/0019)
const MAX_COLUMNS = 30

/** The table under the cursor: its columns now, for the server's bound. */
function columnsOf(editor: Editor): number {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === "table") {
      return node.firstChild?.childCount ?? 0
    }
  }
  return 0
}

/** Row, column and delete actions while the cursor is in a table. */
export function TableTools({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  const columns = useEditorState({ editor, selector: ({ editor: current }) => columnsOf(current) })
  const label = (key: string) => t(`content.editor.tools.${key}`)
  return (
    <>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton
        icon={Rows3}
        label={label("addRow")}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      />
      <ToolButton
        icon={Columns3}
        label={label("addColumn")}
        disabled={columns >= MAX_COLUMNS}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      />
      <ToolButton
        icon={Trash2}
        label={label("deleteTable")}
        onClick={() => editor.chain().focus().deleteTable().run()}
      />
    </>
  )
}
