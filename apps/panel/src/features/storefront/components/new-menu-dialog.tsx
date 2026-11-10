import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { MENU_LIMITS, MENU_LOCATIONS, useCreateMenu } from "@/features/storefront/api/menus"
import type { Menu, MenuLocation } from "@/features/storefront/api/menus"
import { titleProblem } from "@/features/storefront/menu-rows"
import { errorText } from "@/lib/errors"

const M = "storefront.menus"
const N = `${M}.new`

interface NewMenuDialogProps {
  menus: readonly Menu[]
  onClose: () => void
  onCreated: (id: string) => void
}

/**
 * A new menu by where it shows and its name; its links are added next. The
 * header's menu and the top links are one each, so a place taken is offered
 * no more; footer columns go after the last.
 */
export function NewMenuDialog({ menus, onClose, onCreated }: NewMenuDialogProps) {
  const { t } = useTranslation()
  const create = useCreateMenu()
  // Footer columns are never taken: there may be any number
  const taken = new Set<MenuLocation>(
    menus.map((menu) => menu.location).filter((place) => place !== "footer")
  )
  const [location, setLocation] = useState<MenuLocation>(
    MENU_LOCATIONS.find((place) => !taken.has(place)) ?? "footer"
  )
  // The place's own name until one is written
  const [title, setTitle] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const written = title ?? t(`${N}.defaults.${location}`)
  const problem = tried ? titleProblem(written) : null
  const columns = menus.filter((menu) => menu.location === "footer")
  const rank =
    location === "footer" && columns.length > 0
      ? Math.min(MENU_LIMITS.rank, Math.max(...columns.map((menu) => menu.rank)) + 1)
      : 0

  const submit = () => {
    setTried(true)
    setFailure(null)
    if (titleProblem(written)) {
      return
    }
    create.mutate(
      { title: written.trim(), location, rank, items: [] },
      {
        onSuccess: (menu) => {
          toast.success(t(`${N}.created`))
          onCreated(menu.id)
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      }
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${N}.title`)}</DialogTitle>
          <DialogDescription>{t(`${N}.description`)}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogBody>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm font-medium">{t(`${N}.place`)}</legend>
              <RadioGroup
                value={location}
                onValueChange={(value) => {
                  setLocation(value as MenuLocation)
                }}
              >
                {MENU_LOCATIONS.map((place) => (
                  <label
                    key={place}
                    htmlFor={`new-menu-${place}`}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[[data-state=checked]]:border-primary"
                  >
                    <RadioGroupItem
                      id={`new-menu-${place}`}
                      value={place}
                      disabled={taken.has(place)}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {t(`${M}.place.${place}`)}
                        {taken.has(place) ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {t(`${N}.taken`)}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {t(`${N}.hints.${place}`)}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
            <Field
              label={t(`${M}.editor.title`)}
              htmlFor="new-menu-title"
              hint={t(`${M}.editor.titleHint.${location}`)}
              error={
                failure ??
                (problem ? t(`${M}.errors.${problem}`, { max: MENU_LIMITS.title }) : undefined)
              }
              required
            >
              <Input
                id="new-menu-title"
                value={written}
                placeholder={t(`${N}.placeholder`)}
                maxLength={200}
                aria-invalid={Boolean(problem)}
                onChange={(event) => {
                  setTitle(event.target.value)
                }}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${N}.create`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
