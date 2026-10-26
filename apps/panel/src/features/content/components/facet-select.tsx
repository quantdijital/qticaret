import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FacetCatalog } from "@/features/content/api/landings"
import { encodeFacet } from "@/features/content/facet-value"

/** The brands, then each filterable attribute's options, grouped; the value is `encodeFacet`'s. */
export function FacetSelect({
  id,
  value,
  onChange,
  catalog,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  catalog: FacetCatalog | undefined
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        // Radix calls with "" while the value has no item yet
        if (next) {
          onChange(next)
        }
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("content.landing.pickFacet")} />
      </SelectTrigger>
      <SelectContent>
        {catalog?.brand.options.length ? (
          <SelectGroup>
            <SelectLabel>{t("content.landing.brand")}</SelectLabel>
            {catalog.brand.options.map((option) => (
              <SelectItem
                key={option.value}
                value={encodeFacet({ kind: "brand", key: catalog.brand.key, value: option.value })}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {catalog?.attributes.map((attribute) => (
          <SelectGroup key={attribute.key}>
            <SelectLabel>{attribute.label}</SelectLabel>
            {attribute.options.map((option) => (
              <SelectItem
                key={option.value}
                value={encodeFacet({ kind: "attribute", key: attribute.key, value: option.value })}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
