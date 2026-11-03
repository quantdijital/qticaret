import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { SearchPicker } from "@/components/patterns/search-picker"
import type { PickerOption } from "@/components/patterns/search-picker"
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
import { facetCatalogQuery, useCreateLanding } from "@/features/content/api/landings"
import { FacetSelect } from "@/features/content/components/facet-select"
import { decodeFacet } from "@/features/content/facet-value"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

const searchCategories = async (q: string): Promise<PickerOption[]> =>
  (
    await sdk.admin.productCategory.list({ limit: 20, fields: "id,name", ...(q ? { q } : {}) })
  ).product_categories.map((category) => ({ id: category.id, label: category.name }))

/** A new landing page: its category and facet (fixed after), a title; written on its own page next. */
export function NewLandingDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateLanding()
  const catalog = useQuery({ ...facetCatalogQuery(), enabled: open })
  const [category, setCategory] = useState<PickerOption | null>(null)
  const [facet, setFacet] = useState("")
  const [title, setTitle] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  const close = () => {
    onOpenChange(false)
    setCategory(null)
    setFacet("")
    setTitle("")
    setFailure(null)
  }
  const chosen = decodeFacet(facet)
  const submit = () => {
    if (!category || !chosen) {
      return
    }
    setFailure(null)
    create.mutate(
      { category_id: category.id, facet: chosen, title: title.trim() },
      {
        onSuccess: ({ landing }) => {
          toast.success(t("content.created.landing"))
          close()
          void navigate({ to: "/content/landings/$id", params: { id: landing.id } })
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      }
    )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("content.add.landing")}</DialogTitle>
          <DialogDescription>{t("content.landing.addHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogBody>
            <Field label={t("content.landing.category")} htmlFor="landing-category" required>
              <SearchPicker
                id="landing-category"
                value={category}
                onChange={setCategory}
                search={searchCategories}
                queryKey={["landings", "category-options"]}
                placeholder={t("content.landing.pickCategory")}
                empty={t("content.editor.card.none")}
              />
            </Field>
            <Field label={t("content.landing.facet")} htmlFor="landing-facet" required>
              <FacetSelect
                id="landing-facet"
                value={facet}
                onChange={setFacet}
                catalog={catalog.data}
              />
            </Field>
            <Field
              label={t("content.fields.title")}
              htmlFor="landing-title"
              error={failure ?? undefined}
              required
            >
              <Input
                id="landing-title"
                value={title}
                maxLength={200}
                onChange={(event) => {
                  setTitle(event.target.value)
                }}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !category || !chosen || title.trim() === ""}
            >
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("content.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
