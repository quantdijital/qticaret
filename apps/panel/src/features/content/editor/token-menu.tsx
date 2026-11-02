import type { Editor } from "@tiptap/react"
import { useRef } from "react"
import { ShopTokenMenu } from "@/features/settings/components/shop-token-menu"

/**
 * "Bilgi ekle" in the editor (adr/0048): `{telefon}` and the like at the
 * caret, as plain text the server fills with the shop's details when the
 * page is shown, so a page never keeps an old number.
 */
export function EditorTokenMenu({ editor }: { editor: Editor }) {
  // The editor takes the focus back only after a pick; Escape returns it to the button
  const picked = useRef(false)
  return (
    <ShopTokenMenu
      variant="toolbar"
      onPick={(name) => {
        picked.current = true
        editor
          .chain()
          .focus()
          .insertContent({ type: "text", text: `{${name}}` })
          .run()
      }}
      onClosed={() => {
        const moved = picked.current
        picked.current = false
        if (moved) {
          editor.commands.focus()
        }
        return moved
      }}
    />
  )
}
