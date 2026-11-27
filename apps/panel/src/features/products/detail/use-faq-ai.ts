import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { addFaqItems } from "@/features/ai/api/suggestions"
import { faqItemIssue } from "@/features/ai/faq"
import type { AiFaqItem } from "@/features/ai/faq"
import { hintClosed } from "@/features/ai/hint-state"
import { useAiSuggestion } from "@/features/ai/use-ai-suggestion"

const TASK = "product_faq"

/** One item as the person has it: edited in place, kept or left out. */
export interface FaqDraftItem extends AiFaqItem {
  kept: boolean
}

/**
 * A product's FAQ draft (adr/0074 §5 madde 4): one button asks; the items
 * come as a list, each editable and kept by default; "Seçilenleri ekle"
 * sends the kept ones, as edited, and the server gates them again and adds
 * them as the shop's questions on the product's page (published at once).
 * Closing with nothing added dismisses the draft.
 */
export function useFaqAi(productId: string) {
  const client = useQueryClient()
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === TASK)
  const usable = view?.usable ?? []
  const [picked, setPicked] = useState<string | null>(null)
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const [open, setOpen] = useState(false)
  const [hintGone, setHintGone] = useState(hintClosed)
  const suggestion = useAiSuggestion(TASK, { type: "product", id: productId })
  const { state } = suggestion
  // The items as edited, for the suggestion they came with
  const [edits, setEdits] = useState<{ id: string; items: FaqDraftItem[] } | null>(null)
  const [adding, setAdding] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const current = state.status === "suggestion" ? state.suggestion : null
  const items: FaqDraftItem[] =
    current === null
      ? []
      : edits?.id === current.id
        ? edits.items
        : (current.faq?.items ?? []).map((each) => ({ ...each, kept: true }))
  const kept = items.filter((each) => each.kept)

  const ask = (next: { service?: string } = {}) => {
    setEdits(null)
    setFailure(null)
    void suggestion.request(usable.length > 1 ? { service: next.service ?? service } : {})
  }

  const change = (index: number, patch: Partial<FaqDraftItem>) => {
    if (current === null) {
      return
    }
    setEdits({
      id: current.id,
      items: items.map((each, at) => (at === index ? { ...each, ...patch } : each)),
    })
  }

  return {
    state,
    usable,
    service,
    open,
    items,
    adding,
    failure,
    /** The kept items, none with an issue: what "Seçilenleri ekle" sends. */
    ready: kept.length > 0 && kept.every((each) => faqItemIssue(each) === null),
    keptCount: kept.length,
    /** The role may ask, and a service is usable or its connect hint not closed. */
    shown: view?.allowed === true && !(usable.length === 0 && hintGone),
    start: () => {
      setOpen(true)
      if (usable.length > 0) {
        ask()
      }
    },
    retry: () => {
      ask()
    },
    pick: (id: string) => {
      setPicked(id)
      ask({ service: id })
    },
    tryWith: (id: string) => {
      if (usable.includes(id)) {
        setPicked(id)
      }
      void suggestion.tryWith(id)
    },
    change,
    close: () => {
      setOpen(false)
      setEdits(null)
      setFailure(null)
      suggestion.dismiss()
    },
    hideHint: () => {
      setOpen(false)
      setHintGone(true)
    },
    /** Sends the kept items; resolves with how many were added (0 when refused). */
    add: async (): Promise<number> => {
      if (current === null || kept.length === 0) {
        return 0
      }
      setAdding(true)
      setFailure(null)
      try {
        const added = await addFaqItems(
          current.id,
          kept.map((each) => ({ question: each.question.trim(), answer: each.answer.trim() }))
        )
        setOpen(false)
        setEdits(null)
        suggestion.reset()
        // The product's list of questions shows them at once
        void client.invalidateQueries({ queryKey: ["questions"] })
        return added
      } catch (error) {
        setFailure(error)
        return 0
      } finally {
        setAdding(false)
      }
    },
  }
}

export type FaqAi = ReturnType<typeof useFaqAi>
