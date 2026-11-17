import { Pencil } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { FOOTER_ROWS_LIMITS as L } from "@qticaret/types"
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
import type { FooterTextBlock } from "@/features/storefront/api/layout"
import { FieldGroup } from "../forms/fields"
import { useBlockKit } from "./use-block-kit"
import type { BlockFormProps } from "./use-block-kit"
import { FR } from "./footer-rows-fields"

// The panel shows the text's start; the editor holds the whole
const EXCERPT = 160

/**
 * A text block's words (adr/0070 §2): the content editor, wide in a
 * dialog as the rich text section's, with paragraphs, lists, bold, italic
 * and links only (no headings: the block's title is the footer's heading
 * level), within the footer's character limit.
 */
export function BlockTextBody(props: BlockFormProps<FooterTextBlock>) {
  const kit = useBlockKit(props)
  const { t } = kit
  const { block, onChange } = props
  const [editing, setEditing] = useState(false)
  // The editor keeps the callback it was made with: the block is read as it is now
  const latest = useRef(block)
  useEffect(() => {
    latest.current = block
  })
  const text = docText(block.body)
  const error = kit.error("body", L.textChars)
  const { label } = kit.names("body")
  return (
    <FieldGroup title={label} hint={t(`${FR}.fields.body.hint`)}>
      <p className="line-clamp-4 rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
        {text === "" ? t(`${FR}.fields.body.empty`) : text.slice(0, EXCERPT)}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
      <Button
        id={kit.id("body")}
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => {
          setEditing(true)
        }}
      >
        <Pencil />
        {t(`${FR}.fields.body.edit`)}
      </Button>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{t(`${FR}.fields.body.edit`)}</DialogTitle>
            <DialogDescription>{t(`${FR}.fields.body.description`)}</DialogDescription>
          </DialogHeader>
          <RichEditor
            bare
            value={block.body}
            label={label}
            maxChars={L.textChars}
            onChange={(body) => {
              onChange({ ...latest.current, body }, "body")
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setEditing(false)
              }}
            >
              {t(`${FR}.fields.body.done`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FieldGroup>
  )
}
