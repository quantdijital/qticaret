import { useRouterState } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useCurrentUser } from "@/features/auth/api/me"
import { useFeature } from "@/features/settings/api/features"
import { deleteAssistantConversation, postAssistantTurn } from "./api"
import type { AssistantMessage } from "./api"
import { openScreenOf } from "./open-screen"
import { AI_ASSISTANT_FLAG, ASSISTANT_OFF, AssistantContext } from "./assistant-state"
import type { AssistantState } from "./assistant-state"
import { loadSession, saveSession } from "./storage"
import type { AssistantSession } from "./storage"

/**
 * The panel assistant's state for the whole shell (adr/0079 §9): open or
 * closed across pages, the conversation of the tab, ⌘J / Ctrl+J. With
 * the shop's flag off it adds nothing: no key, no button, no panel.
 *
 * A conversation is its asker's alone (review O1): another staff member
 * signed in starts afresh, nothing of the last one's state carried over.
 * Signed out (no user read for now) keeps the last one until the sign-in
 * page takes over, so the page below is not remounted for nothing.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const id = useCurrentUser()?.id
  const [owner, setOwner] = useState<string | null>(id ?? null)
  if (id !== undefined && id !== owner) {
    setOwner(id)
  }
  return (
    <AssistantOf key={owner ?? ""} owner={owner}>
      {children}
    </AssistantOf>
  )
}

function AssistantOf({ owner, children }: { owner: string | null; children: ReactNode }) {
  // Its state is kept either way: the flag read late must not remount the page below
  const enabled = useFeature(AI_ASSISTANT_FLAG)
  const { i18n } = useTranslation()
  const location = useRouterState({ select: (state) => state.location })
  const screen = openScreenOf(location.pathname, location.search)
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<AssistantSession>(() => loadSession(owner))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [draft, setDraft] = useState("")
  // A turn answered after "Yeni sohbet" belongs to the dropped conversation
  const generation = useRef(0)

  useEffect(() => {
    saveSession(session, owner)
  }, [session, owner])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }
    const onKey = (event: KeyboardEvent) => {
      if (typeof event.key !== "string") {
        return
      }
      if (event.key.toLowerCase() === "j" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault()
        setOpen((now) => !now)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [enabled])

  const send = (raw: string) => {
    const text = raw.trim().slice(0, 2000)
    if (text === "" || pending) {
      return
    }
    const turn = generation.current
    const mine: AssistantMessage = { role: "user", text }
    setError(null)
    setDraft("")
    setPending(true)
    setSession((now) => ({ ...now, messages: [...now.messages, mine] }))
    postAssistantTurn({
      conversationId: session.conversationId,
      message: text,
      screen,
      locale: i18n.language.startsWith("en") ? "en" : "tr",
    })
      .then((answer) => {
        if (generation.current !== turn) {
          // "Yeni sohbet" came first, maybe before the server named the conversation (review D1)
          deleteAssistantConversation(answer.conversation_id).catch(() => undefined)
          return
        }
        // The server's copy of the person's words (personal data patterns taken out) replaces ours
        setSession((now) => ({
          conversationId: answer.conversation_id,
          messages: [...now.messages.filter((each) => each !== mine), ...answer.messages],
        }))
      })
      .catch((failure: unknown) => {
        if (generation.current !== turn) {
          return
        }
        setError(failure)
        setDraft(text)
        setSession((now) => ({ ...now, messages: now.messages.filter((each) => each !== mine) }))
      })
      .finally(() => {
        if (generation.current === turn) {
          setPending(false)
        }
      })
  }

  const reset = () => {
    generation.current += 1
    const id = session.conversationId
    setSession({ conversationId: null, messages: [] })
    setPending(false)
    setError(null)
    if (id !== null) {
      // Gone from the tab at once; the server's copy lapses by itself should this fail
      deleteAssistantConversation(id).catch(() => undefined)
    }
  }

  const state: AssistantState = {
    enabled: true,
    open,
    setOpen,
    toggle: () => {
      setOpen((now) => !now)
    },
    // Only into the box, never sent (review O2): ⌘K is where names and phones are typed
    ask: (text) => {
      setOpen(true)
      setDraft(text.slice(0, 2000))
    },
    send,
    reset,
    messages: session.messages,
    pending,
    error,
    draft,
    setDraft,
    screen,
  }
  return (
    <AssistantContext.Provider value={enabled ? state : ASSISTANT_OFF}>
      {children}
    </AssistantContext.Provider>
  )
}
