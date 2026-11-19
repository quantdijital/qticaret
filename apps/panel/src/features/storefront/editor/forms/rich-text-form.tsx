import { Pencil } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
import type { RichTextSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, FieldGroup, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"
import { RichTextPicture } from "./rich-text-picture"

const T = "storefront.editor.richText"
// The panel shows the text's start; the editor holds the whole
const EXCERPT = 160

/**
 * A title and a text written in the content editor (adr/0019), which may
 * hold product and category cards and the shop's details. The editor
 * opens wide in a dialog: the side panel is too narrow for its toolbar.
 * "Görselli metin" (adr/0073 §3) adds its picture and side under the title.
 */
export function RichTextForm({ section, problems, onChange }: SectionFormProps<RichTextSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const [editing, setEditing] = useState(false)
  // The editor keeps the callback it was made with: the section is read as it is now
  const latest = useRef(section)
  useEffect(() => {
    latest.current = section
  })
  const text = docText(section.body)
  const title = t(`${T}.edit`)
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        value={section.title}
        max={L.title}
        hint={t(`${F}.titleOptional`)}
        error={problem(problems["title"], L.title)}
        onChange={(next) => {
          onChange({ ...section, title: next }, "title")
        }}
      />
      {section.variant === "with_image" ? (
        <RichTextPicture section={section} problems={problems} onChange={onChange} />
      ) : null}
      <FieldGroup title={t(`${T}.body`)}>
        <p className="line-clamp-4 rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
          {text === "" ? t(`${T}.empty`) : text.slice(0, EXCERPT)}
        </p>
        <Button
          id={PREVIEW_IDS.text(section.id, "body")}
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => {
            setEditing(true)
          }}
        >
          <Pencil />
          {title}
        </Button>
      </FieldGroup>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t(`${T}.description`)}</DialogDescription>
          </DialogHeader>
          <RichEditor
            value={section.body}
            label={t(`${T}.body`)}
            shopTokens
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
              {t(`${T}.done`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
