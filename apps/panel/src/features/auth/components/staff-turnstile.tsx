import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { TurnstileGate, TurnstilePublic } from "@qticaret/types"
import { TurnstileWidget, loadTurnstile } from "@/lib/turnstile"
import type { StaffGate } from "../api/gated-post"

/** The sign-in pages' public settings, asked before a session (adr/0044 Ek 2026-11-24). */
export const publicConfigQuery = () =>
  queryOptions({
    queryKey: ["public-config"],
    queryFn: async (): Promise<{ turnstile: TurnstilePublic }> => {
      const response = await fetch("/admin/public-config", {
        headers: { accept: "application/json" },
      })
      if (!response.ok) {
        throw Object.assign(new Error(`public-config ${String(response.status)}`), {
          status: response.status,
        })
      }
      return (await response.json()) as { turnstile: TurnstilePublic }
    },
    staleTime: Infinity,
    retry: 1,
  })

export interface StaffTurnstile {
  /** For `postGated`; its token is null when the backend gave no site key. */
  gate: StaffGate
  /** Starts the widget ahead of the send (the form's first touch). */
  warm: () => void
  /** The widget's place in the form: nothing until it is wanted, room only for an interaction. */
  slot: ReactNode
}

/**
 * A sign-in page's Turnstile widget (adr/0044 Ek 2026-11-24): the panel's
 * gates (`staff_login`, `staff_password_reset`) want a token with every
 * request. The script loads when the person first touches the form, not
 * with the page; the box shows only when Cloudflare wants an interaction.
 */
export function useStaffTurnstile(
  action: Extract<TurnstileGate, "staff_login" | "staff_password_reset">
): StaffTurnstile {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  // Asked with the page; a send before the answer waits for it
  const config = useQuery(publicConfigQuery())
  const siteKey = config.data?.turnstile.site_key ?? null
  const language = i18n.language
  const [active, setActive] = useState(false)
  const [interactive, setInteractive] = useState(false)
  const widget = useRef<TurnstileWidget | null>(null)
  const starting = useRef<Promise<TurnstileWidget> | null>(null)
  const container = useRef<{ element: HTMLElement | null; waiting: ((el: HTMLElement) => void)[] }>(
    { element: null, waiting: [] }
  )

  const place = useCallback((element: HTMLDivElement | null) => {
    container.current.element = element
    if (element) {
      const waiting = container.current.waiting
      container.current.waiting = []
      for (const resolve of waiting) {
        resolve(element)
      }
    }
  }, [])

  useEffect(
    () => () => {
      widget.current?.destroy()
      widget.current = null
      starting.current = null
    },
    []
  )

  const start = useCallback(
    (key: string): Promise<TurnstileWidget> => {
      if (starting.current) {
        return starting.current
      }
      setActive(true)
      const element = new Promise<HTMLElement>((resolve) => {
        const known = container.current.element
        if (known) {
          resolve(known)
        } else {
          container.current.waiting.push(resolve)
        }
      })
      const started = Promise.all([loadTurnstile(), element]).then(([api, at]) => {
        widget.current ??= new TurnstileWidget(api, at, {
          siteKey: key,
          action,
          language,
          theme: "auto",
          onInteractive: setInteractive,
        })
        return widget.current
      })
      // A script that did not load may load at the next try
      started.catch(() => {
        starting.current = null
      })
      starting.current = started
      return started
    },
    [action, language]
  )

  const gate = useMemo<StaffGate>(
    () => ({
      take: async () => {
        const key = (await client.ensureQueryData(publicConfigQuery())).turnstile.site_key
        return key ? (await start(key)).take() : null
      },
      spent: () => {
        widget.current?.spent()
      },
    }),
    [client, start]
  )

  const warm = useCallback(() => {
    if (siteKey) {
      start(siteKey)
        .then((started) => {
          started.prepare()
        })
        .catch(() => undefined)
    }
  }, [siteKey, start])

  const slot = active ? (
    <div
      data-turnstile=""
      className={interactive ? "flex flex-col gap-2" : "absolute size-0 overflow-hidden"}
    >
      <p role="status" className={interactive ? "text-sm" : "sr-only"}>
        {interactive ? t("login.turnstile.hint") : null}
      </p>
      <div ref={place} role="group" aria-label={t("login.turnstile.label")} />
    </div>
  ) : null

  return { gate, warm, slot }
}
