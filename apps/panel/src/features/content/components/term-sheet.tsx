import { useQuery } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { contentListQuery } from "@/features/content/api/content"
import { useDeleteTerm } from "@/features/content/api/terms"
import type { Term } from "@/features/content/api/terms"
import { TermForm } from "@/features/content/components/term-form"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"

const T = "content.terms"

/** The archive's description when it has none of its own: its newest posts' titles, as the storefront words it. */
function useFallbackDescription(term: Term): string {
  const { t } = useTranslation()
  const posts = useQuery({
    ...contentListQuery({ kind: "post", q: "", page: 0, termId: term.id }),
    enabled: !term.description,
  })
  if (term.description) {
    return excerpt(term.description, DESCRIPTION_EXCERPT)
  }
  const titles = (posts.data?.entries ?? [])
    .filter((entry) => entry.status === "published")
    .slice(0, 5)
    .map((entry) => entry.title)
  return titles.length > 0
    ? excerpt(
        t(`${T}.fallbackDescription`, { name: term.name, titles: titles.join(", ") }),
        DESCRIPTION_EXCERPT
      )
    : ""
}

/**
 * A blog category or tag in a side sheet (adr/0019 ek 2026-11-03): its
 * name, address, text and order, and on a tab of its own how its archive
 * shows in search results. Deleting it never touches the posts.
 */
export function TermSheet({ term, onClose }: { term: Term; onClose: () => void }) {
  const { t } = useTranslation()
  const remove = useDeleteTerm()
  const [asking, setAsking] = useState(false)
  const [tab, setTab] = useState("general")
  const fallback = useFallbackDescription(term)
  const kind = term.kind
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{term.name}</SheetTitle>
          <SheetDescription className="font-mono text-xs">{term.path}</SheetDescription>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
          <TabsList variant="line" className="w-full justify-start border-b px-4">
            <TabsTrigger value="general" className="flex-none">
              {t(`${T}.tabs.general`)}
            </TabsTrigger>
            <TabsTrigger value="seo" className="flex-none">
              {t(`${T}.tabs.seo`)}
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="general" className="px-6 py-5">
              <TermForm term={term} />
            </TabsContent>
            <TabsContent value="seo" className="px-6 py-5">
              <SeoCard
                type={kind === "category" ? "post_category" : "post_tag"}
                id={term.id}
                context={{
                  path: term.path,
                  tokens: { başlık: term.name },
                  fallbackDescription: fallback,
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
        <SheetFooter className="flex-row items-center justify-start border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive-text"
            disabled={remove.isPending}
            onClick={() => {
              setAsking(true)
            }}
          >
            <Trash2 />
            {t(`${T}.delete.${kind}`)}
          </Button>
        </SheetFooter>
      </SheetContent>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${T}.deleteTitle`, { name: term.name })}
        description={t(`${T}.deleteText.${kind}`, { count: term.post_count })}
        confirmLabel={t(`${T}.delete.${kind}`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          remove.mutate(term.id, {
            onSuccess: ({ unlinked }) => {
              toast.success(
                [
                  t(`${T}.deleted.${kind}`),
                  unlinked > 0 ? t(`${T}.unlinked.${kind}`, { count: unlinked }) : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              )
              onClose()
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </Sheet>
  )
}
