import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SearchPicker } from "@/components/patterns/search-picker"
import type { PickerOption } from "@/components/patterns/search-picker"
import { Button } from "@/components/ui/button"
import { searchAuthors } from "@/features/content/api/authors"
import { AuthorDialog } from "./author-dialog"

const A = "content.authors"

const optionsOf = async (q: string): Promise<PickerOption[]> =>
  (await searchAuthors(q)).map((author) => ({
    id: author.id,
    label: author.job_title ? `${author.name} · ${author.job_title}` : author.name,
  }))

/**
 * A post's author, chosen from the blog's authors by name (each has a page
 * of their own), or made on the spot with "Yeni yazar" in the author's
 * standard dialog and chosen at once. A post still carrying the old
 * typed-in author says so under the field, with that name one click from
 * becoming an author.
 */
export function AuthorSelect({
  id,
  value,
  onChange,
  legacyName,
}: {
  id: string
  value: PickerOption | null
  onChange: (value: PickerOption | null) => void
  /** The post's old free-text author, while no author is chosen. */
  legacyName: string | null
}) {
  const { t } = useTranslation()
  // The new author's dialog, with the name it starts from
  const [making, setMaking] = useState<string | null>(null)
  const legacy = !value && legacyName?.trim() ? legacyName.trim() : null
  return (
    <div className="flex flex-col gap-2">
      <SearchPicker
        id={id}
        value={value}
        onChange={onChange}
        search={optionsOf}
        queryKey={["content-authors", "options"]}
        placeholder={t(`${A}.choose`)}
        empty={t(`${A}.noneFound`)}
        className="sm:max-w-none"
      />
      {legacy ? (
        <p className="text-xs text-muted-foreground">
          {t(`${A}.legacy`, { name: legacy })}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4"
            onClick={() => {
              setMaking(legacy)
            }}
          >
            {t(`${A}.legacyAdd`)}
          </button>
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setMaking("")
          }}
        >
          <Plus />
          {t(`${A}.new`)}
        </Button>
      </div>
      {making !== null ? (
        // The dialog's form sits (through its portal) inside the card's: its submit stops here
        <div
          className="contents"
          onSubmit={(event) => {
            event.stopPropagation()
          }}
        >
          <AuthorDialog
            author={null}
            initialName={making}
            onClose={() => {
              setMaking(null)
            }}
            onSaved={(author) => {
              onChange({ id: author.id, label: author.name })
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
