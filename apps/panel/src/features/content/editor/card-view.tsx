import { useQuery } from "@tanstack/react-query"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import { FolderTree, Package, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { sdk } from "@/lib/sdk"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { CARD_ID } from "./card-nodes"

// The card's record by id, for its name; one gone since shows as missing
const cardQuery = (kind: "product" | "category", id: string) => ({
  queryKey: ["content", "card", kind, id],
  queryFn: async () => {
    if (kind === "product") {
      const { product } = await sdk.admin.product.retrieve(id, { fields: "id,title" })
      return product.title
    }
    const { product_category } = await sdk.admin.productCategory.retrieve(id, {
      fields: "id,name",
    })
    return product_category.name
  },
  retry: false,
  staleTime: 60_000,
})

/** A card in the editor: what it shows, and a way to take it out. */
export function CardView({ node, deleteNode, selected }: ReactNodeViewProps) {
  const { t } = useTranslation()
  const kind = node.type.name === "categoryCard" ? "category" : "product"
  const id = String(node.attrs["id"] ?? "")
  const valid = CARD_ID.test(id)
  const name = useQuery({ ...cardQuery(kind, id), enabled: valid })
  const missing = name.isError || !valid
  const Icon = kind === "product" ? Package : FolderTree
  return (
    <NodeViewWrapper
      className={cn(
        "my-3 flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5",
        selected && "ring-2 ring-ring"
      )}
      contentEditable={false}
      data-drag-handle=""
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
          {t(`content.editor.card.${kind}`)}
        </span>
        <span className={cn("truncate text-sm font-medium", missing && "text-destructive-text")}>
          {name.data ?? (missing ? t("content.editor.card.missing") : "…")}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={t("content.editor.card.remove")}
        onClick={deleteNode}
      >
        <X />
      </Button>
    </NodeViewWrapper>
  )
}
