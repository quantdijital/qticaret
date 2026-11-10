import { useQuery } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { RecordStepper } from "@qticaret/admin-ui/patterns/record-stepper"
import type { RecordSteps } from "@qticaret/admin-ui/patterns/record-stepper"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@qticaret/admin-ui/ui/tabs"
import { contentListQuery } from "@/features/content/api/content"
import { useDeleteTerm } from "@/features/content/api/terms"
import type { Term } from "@/features/content/api/terms"
import { TermForm } from "@/features/content/components/term-form"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"

const T = "content.terms"

const TAB_BODY = "flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"

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

/** The general tab's form and the search result tab's card, for one term. */
function TermParts({
  term,
  onDirtyChange,
}: {
  term: Term
  onDirtyChange: (dirty: boolean) => void
}) {
  const fallback = useFallbackDescription(term)
  return (
    <>
      {/* Kept while the other tab shows: what is typed stays */}
      <TabsContent value="general" forceMount className={TAB_BODY}>
        <DialogBody>
          <TermForm term={term} onDirtyChange={onDirtyChange} />
        </DialogBody>
      </TabsContent>
      {/* Read once the tab opens, as before */}
      <TabsContent value="seo" className={TAB_BODY}>
        <DialogBody>
          <SeoCard
            type={term.kind === "category" ? "post_category" : "post_tag"}
            id={term.id}
            context={{
              path: term.path,
              tokens: { başlık: term.name },
              fallbackDescription: fallback,
            }}
          />
        </DialogBody>
      </TabsContent>
    </>
  )
}

interface TermDialogProps {
  term: Term
  /** The term's place on the list's page: ‹ n / m › walks it. */
  steps: RecordSteps
  onClose: () => void
}

/**
 * A blog category or tag in one dialog (adr/0019 ek 2026-11-03): its
 * name, address, text and order, and on a tab of its own how its archive
 * shows in search results; the arrows go to the list's next one, asking
 * first when the form holds something unsaved. Deleting it never touches
 * the posts. The size of the variant dialog: the tabs never make it jump.
 */
export function TermDialog({ term, steps, onClose }: TermDialogProps) {
  const { t } = useTranslation()
  const remove = useDeleteTerm()
  const [asking, setAsking] = useState(false)
  const [tab, setTab] = useState("general")
  const [dirty, setDirty] = useState(false)
  const { guard, confirm } = useDiscardGuard(dirty)
  const kind = term.kind
  return (
    <>
      <DetailDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        onCloseRequest={guard}
        size="lg"
        pane="fixed"
        className="sm:h-[min(var(--dialog-max-height),40rem)]"
        title={term.name}
        description={term.path}
        descriptionClassName="font-mono text-xs"
        headerAction={
          <RecordStepper
            {...steps}
            previousLabel={t(`${T}.previous.${kind}`)}
            nextLabel={t(`${T}.next.${kind}`)}
            onGo={(to) => {
              guard(() => {
                setDirty(false)
                steps.onGo(to)
              })
            }}
          />
        }
        footer={
          <Button
            type="button"
            variant="ghost"
            className="text-destructive-text sm:mr-auto"
            disabled={remove.isPending}
            onClick={() => {
              setAsking(true)
            }}
          >
            <Trash2 />
            {t(`${T}.delete.${kind}`)}
          </Button>
        }
      >
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-5">
          <TabsList className="w-full shrink-0 sm:w-fit">
            <TabsTrigger value="general">{t(`${T}.tabs.general`)}</TabsTrigger>
            <TabsTrigger value="seo">{t(`${T}.tabs.seo`)}</TabsTrigger>
          </TabsList>
          <TermParts key={term.id} term={term} onDirtyChange={setDirty} />
        </Tabs>
      </DetailDialog>
      {confirm}
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
    </>
  )
}
