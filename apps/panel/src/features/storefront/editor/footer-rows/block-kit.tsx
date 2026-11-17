import type { FooterBlock } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { TextField } from "../forms/fields"
import type { BlockField } from "./footer-rows-fields"
import { useBlockKit } from "./use-block-kit"
import type { BlockFormProps } from "./use-block-kit"

/** A block's optional title, typed in one step (`title` merges). */
export function BlockTitle<B extends FooterBlock & { title: string | null }>({
  max,
  placeholder,
  hint,
  ...props
}: BlockFormProps<B> & { max: number; placeholder?: string | undefined; hint?: string }) {
  const kit = useBlockKit(props)
  const { block, onChange } = props
  return (
    <TextField
      id={kit.id("title")}
      {...kit.names("title")}
      value={block.title}
      max={max}
      placeholder={placeholder}
      hint={hint}
      error={kit.error("title", max)}
      onChange={(title) => {
        onChange({ ...block, title }, "title")
      }}
    />
  )
}

/** One of a block's switches. */
export function BlockSwitch<B extends FooterBlock>({
  field,
  hint,
  ...props
}: BlockFormProps<B> & { field: BlockField & keyof B; hint?: string | undefined }) {
  const kit = useBlockKit(props)
  const { block, onChange } = props
  return (
    <SwitchRow
      id={kit.id(field)}
      {...kit.names(field)}
      hint={hint}
      checked={Boolean(block[field as keyof B])}
      onChange={(checked) => {
        onChange({ ...block, [field]: checked })
      }}
    />
  )
}
