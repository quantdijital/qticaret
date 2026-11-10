import { ChevronDown, ChevronRight, ChevronUp, EyeOff, FolderTree, Lock } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useUpdateCategory } from "@/features/categories/api/categories"
import type { Category } from "@/features/categories/api/categories"
import { siblingFor, treeRows } from "@/features/categories/tree"
import { errorText } from "@/lib/errors"
import { cn } from "@qticaret/admin-ui/lib/utils"

interface CategoryTreeCardProps {
  categories: Category[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** The shop's categories as a tree: open and close branches, move within a level, pick one to edit. */
export function CategoryTreeCard({ categories, selectedId, onSelect }: CategoryTreeCardProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const update = useUpdateCategory()
  const rows = treeRows(categories, collapsed)

  const toggle = (id: string) => {
    setCollapsed((was) => {
      const next = new Set(was)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  // Taking the sibling's place; Medusa moves the others along
  const move = (category: Category, step: -1 | 1) => {
    const sibling = siblingFor(categories, category, step)
    if (!sibling) {
      return
    }
    update.mutate(
      { id: category.id, rank: sibling.rank ?? 0 },
      { onError: (failure) => toast.error(errorText(t, failure)) }
    )
  }

  return (
    <SectionCard title={t("categories.tree")} description={t("categories.treeHint")} flush>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 pt-4 pb-10 text-center">
          <FolderTree className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("categories.empty")}</p>
        </div>
      ) : (
        <ul role="tree" aria-label={t("categories.tree")} className="flex flex-col pb-2">
          {rows.map(({ category, depth, hasChildren }) => {
            const selected = category.id === selectedId
            const open = !collapsed.has(category.id)
            return (
              <li
                key={category.id}
                role="treeitem"
                aria-selected={selected}
                aria-expanded={hasChildren ? open : undefined}
                className={cn(
                  "group flex items-center gap-1 border-t pr-3 transition-colors",
                  selected ? "bg-accent" : "hover:bg-muted/60"
                )}
                style={{ paddingLeft: `${12 + depth * 20}px` }}
              >
                <button
                  type="button"
                  aria-label={t(open ? "categories.collapse" : "categories.expand", {
                    name: category.name,
                  })}
                  disabled={!hasChildren}
                  onClick={() => {
                    toggle(category.id)
                  }}
                  className="flex w-6 items-center justify-center self-stretch rounded text-muted-foreground hover:text-foreground disabled:invisible"
                >
                  {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(category.id)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left text-sm"
                >
                  <span className={cn("truncate", selected && "font-medium")}>{category.name}</span>
                  {category.is_active ? null : (
                    <EyeOff
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label={t("categories.hidden")}
                    />
                  )}
                  {category.is_internal ? (
                    <Lock
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label={t("categories.internal")}
                    />
                  ) : null}
                </button>
                <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={update.isPending || !siblingFor(categories, category, -1)}
                    aria-label={t("categories.moveUp", { name: category.name })}
                    onClick={() => {
                      move(category, -1)
                    }}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={update.isPending || !siblingFor(categories, category, 1)}
                    aria-label={t("categories.moveDown", { name: category.name })}
                    onClick={() => {
                      move(category, 1)
                    }}
                  >
                    <ChevronDown />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
