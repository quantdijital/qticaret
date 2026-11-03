import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { isStorefrontHref } from "@/features/settings/storefront"
import { MENU_LIMITS, RECORD_KINDS } from "@/features/storefront/api/menus"
import type { RecordKind } from "@/features/storefront/api/menus"
import { labelProblem } from "@/features/storefront/menu-rows"
import type { MenuRow } from "@/features/storefront/menu-rows"
import { LegalPane, RecordPane, SystemPane } from "./link-picker-panes"
import type { LinkPick } from "./link-picker-panes"

const P = "storefront.menus.picker"
const K = "storefront.menus.kinds"

type PickerKind = RecordKind | "legal" | "system" | "url"

// Ten kinds read as three short groups, not one long row (docs/18 §2)
const GROUPS: { key: string; kinds: readonly PickerKind[] }[] = [
  { key: "catalog", kinds: ["category", "product", "collection", "brand"] },
  { key: "content", kinds: ["page", "post", "landing"] },
  { key: "shop", kinds: ["legal", "system", "url"] },
]

const isRecordKind = (kind: PickerKind): kind is RecordKind =>
  (RECORD_KINDS as readonly string[]).includes(kind)

/** An address and its name, checked as the server checks them. */
function UrlPane({ row, onPick }: { row: MenuRow | null; onPick: (pick: LinkPick) => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState(row?.to.kind === "url" ? row.to.url : "")
  const [label, setLabel] = useState(row?.to.kind === "url" ? row.label : "")
  const [tried, setTried] = useState(false)
  const address = url.trim()
  const urlError = tried && !isStorefrontHref(address) ? t(`${P}.url.invalid`) : undefined
  const problem = labelProblem({
    key: "",
    depth: 0,
    to: { kind: "url", url: address },
    label,
    name: null,
    path: null,
    broken: false,
  })
  const labelError =
    tried && problem
      ? t(`storefront.menus.errors.${problem}`, { max: MENU_LIMITS.label })
      : undefined
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setTried(true)
        if (isStorefrontHref(address) && !problem) {
          onPick({
            to: { kind: "url", url: address },
            name: null,
            path: address,
            broken: false,
            label: label.trim(),
          })
        }
      }}
    >
      <Field
        label={t(`${P}.url.address`)}
        htmlFor="menu-link-url"
        hint={t(`${P}.url.addressHint`)}
        error={urlError}
        required
      >
        <Input
          id="menu-link-url"
          value={url}
          placeholder="/kampanyalar"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(urlError)}
          onChange={(event) => {
            setUrl(event.target.value)
          }}
        />
      </Field>
      <Field label={t(`${P}.url.name`)} htmlFor="menu-link-url-name" error={labelError} required>
        <Input
          id="menu-link-url-name"
          value={label}
          placeholder={t(`${P}.url.namePlaceholder`)}
          aria-invalid={Boolean(labelError)}
          onChange={(event) => {
            setLabel(event.target.value)
          }}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit">{t(row ? `${P}.url.change` : `${P}.url.add`)}</Button>
      </div>
    </form>
  )
}

interface LinkPickerDialogProps {
  /** The row whose target changes; none: a new link. */
  row: MenuRow | null
  onClose: () => void
  onPick: (pick: LinkPick) => void
}

/**
 * Where a link points (adr/0049): a record, a legal text, one of the
 * storefront's own pages, or an address. Each kind on its own tab, records
 * searched by name; picking one closes the dialog.
 */
export function LinkPickerDialog({ row, onClose, onPick }: LinkPickerDialogProps) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<PickerKind>(row?.to.kind ?? "category")
  // The kinds beside the results on a wide screen; above them, side by side, on a narrow one
  const narrow = useIsMobile()
  const to = row?.to
  const current = to?.kind === kind && to.kind !== "url" ? to.target : null
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t(row ? `${P}.change` : `${P}.add`)}</DialogTitle>
          <DialogDescription>{t(`${P}.description`)}</DialogDescription>
        </DialogHeader>
        <Tabs
          orientation={narrow ? "horizontal" : "vertical"}
          value={kind}
          onValueChange={(value) => {
            setKind(value as PickerKind)
          }}
          className="grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-3">
            {GROUPS.map((group) => (
              <div key={group.key} className="flex flex-col gap-1">
                <p
                  id={`menu-picker-${group.key}`}
                  className="px-2 text-xs font-medium text-muted-foreground"
                >
                  {t(`${P}.groups.${group.key}`)}
                </p>
                <TabsList
                  aria-labelledby={`menu-picker-${group.key}`}
                  className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto md:items-stretch"
                >
                  {group.kinds.map((each) => (
                    <TabsTrigger
                      key={each}
                      value={each}
                      className="h-8 flex-none justify-start px-2.5 data-[state=active]:bg-accent data-[state=active]:shadow-none"
                    >
                      {t(`${K}.${each}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            ))}
          </div>
          {GROUPS.flatMap((group) => group.kinds).map((each) => (
            <TabsContent key={each} value={each} className="min-w-0">
              {isRecordKind(each) ? (
                <RecordPane kind={each} current={current} onPick={onPick} />
              ) : each === "legal" ? (
                <LegalPane current={current} onPick={onPick} />
              ) : each === "system" ? (
                <SystemPane current={current} onPick={onPick} />
              ) : (
                <UrlPane row={row} onPick={onPick} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
