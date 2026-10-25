import { Button, Input, Label, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ProductRef } from "../../lib/catalog"
import { errorText } from "../../lib/errors"
import { sdk } from "../../lib/sdk"

interface SuccessorPickerProps {
  productId: string
  value: ProductRef | null
  onChange: (value: ProductRef | null) => void
}

const MIN_QUERY = 2
// Search once typing pauses, not on every key
const SEARCH_DELAY_MS = 300

function useSettledText(text: string): string {
  const [settled, setSettled] = useState(text)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(text)
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [text])
  return settled
}

/**
 * The product that takes this one's URL once it is no longer sold (docs/13
 * §2.4): search by name, pick one, or clear it. The server refuses the
 * product itself and successor loops.
 */
export function SuccessorPicker({ productId, value, onChange }: SuccessorPickerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const term = useSettledText(search.trim())
  const results = useQuery({
    queryKey: ["qticaret", "successor-search", term],
    enabled: term.length >= MIN_QUERY,
    queryFn: () =>
      sdk.client.fetch<{ products: ProductRef[] }>("/admin/products", {
        query: { q: term, fields: "id,title,handle", limit: 10 },
      }),
  })
  const options = (results.data?.products ?? []).filter((product) => product.id !== productId)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="catalog-successor" size="small" weight="plus">
        {t("qticaret.catalog.successor.label")}
      </Label>
      {value ? (
        <div className="flex items-center justify-between gap-2">
          <Text size="small">
            {value.title} <span className="text-ui-fg-subtle">({value.handle})</span>
          </Text>
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => {
              onChange(null)
            }}
          >
            {t("qticaret.catalog.successor.clear")}
          </Button>
        </div>
      ) : (
        <>
          <Input
            id="catalog-successor"
            type="search"
            placeholder={t("qticaret.catalog.successor.search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
          />
          {results.isError ? (
            <Text size="xsmall" className="text-ui-fg-error">
              {errorText(t, results.error)}
            </Text>
          ) : null}
          {term.length >= MIN_QUERY && results.isSuccess && options.length === 0 ? (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t("qticaret.catalog.successor.noResults")}
            </Text>
          ) : null}
          <ul className="flex flex-col gap-1">
            {options.map((product) => (
              <li key={product.id}>
                <Button
                  type="button"
                  size="small"
                  variant="transparent"
                  onClick={() => {
                    onChange(product)
                    setSearch("")
                  }}
                >
                  {product.title}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Text size="xsmall" className="text-ui-fg-subtle">
        {t("qticaret.catalog.successor.hint")}
      </Text>
    </div>
  )
}
