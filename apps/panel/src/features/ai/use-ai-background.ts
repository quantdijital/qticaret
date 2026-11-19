import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"
import { AI_KEY, aiServicesQuery } from "@/features/ai/api/ai"
import { hintClosed } from "@/features/ai/hint-state"
import { acceptSuggestion, dismissSuggestion, requestImageJob } from "@/features/ai/api/suggestions"
import type { AiFailure } from "@/features/ai/api/suggestions"
import { mediaDetailQuery } from "@/features/media/api/media"
import type { MediaDetail } from "@/features/media/api/media"
import { sdk } from "@/lib/sdk"

export const BACKGROUND_TASK = "image_background"

/** The `ai.image_edit` job as the async job API shows it (docs/22 PR 4-1 notes). */
export interface AiImageEditJob {
  id: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  progress: number | null
  error_code: string | null
  result_summary: {
    done?: { media_id: string; result_id: string; suggestion_id: string | null }[]
    failed?: { media_id: string; key: string }[]
    skipped?: number
    stopped_by?: string | null
  } | null
}

const moving = (job: AiImageEditJob | undefined) =>
  job?.status === "queued" || job?.status === "running"

/** The job, looked at every second while it runs (the settings' long task pattern). */
export const aiImageJobQuery = (id: string | null) =>
  queryOptions({
    queryKey: [...AI_KEY, "job", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ async_job: AiImageEditJob }>(`/admin/async-jobs/${id ?? ""}`))
        .async_job,
    enabled: id !== null,
    refetchInterval: (query) => (moving(query.state.data) ? 1000 : false),
  })

/**
 * The task's view: whether the role may run it, its services and options;
 * read only where a picture could be edited (`enabled`).
 */
export function useBackgroundTask(enabled = true) {
  const services = useQuery({ ...aiServicesQuery(), enabled })
  const view = services.data?.tasks.find((each) => each.id === BACKGROUND_TASK)
  /** The options the service makes: Gemini only white, so "Şeffaf" is not offered with it. */
  const optionsOf = (service: string): string[] => {
    const made = services.data?.services.find((each) => each.id === service)?.backgrounds
    return (view?.options ?? []).filter((each) => made?.includes(each) ?? true)
  }
  // No service and the connect tip closed for good: the action goes, as the AI button does
  const gone = (view?.usable.length ?? 0) === 0 && hintClosed()
  return { allowed: (view?.allowed ?? false) && !gone, view, optionsOf }
}

export type AiBackgroundState =
  | { status: "idle" }
  | { status: "running"; progress: number | null; service: string | null }
  | {
      status: "ready"
      result: MediaDetail
      suggestionId: string | null
      service: string | null
    }
  | { status: "error"; failure: unknown; service: string | null }

/** A job's own refusal as a failure the panel words (`aiFailureText`): its key only. */
const keyed = (key: string | null): Partial<AiFailure> => ({ code: key })

/**
 * One picture's background or scene job (adr/0071 §8, docs/22 Aşama 4, 7;
 * `task`: `image_background` or `image_scene`): asked for
 * (202), followed until it ends, then its result read as a new picture;
 * a scene typed once goes as `prompt` (`start(option, service, prompt)`).
 * Nothing is written: `accept()` records the decision and hands the new
 * picture back, the caller adds it where it belongs; `dismiss()` turns
 * the suggestion down, the unused picture goes with the nightly sweep.
 */
export function useAiBackground(mediaId: string, task: string = BACKGROUND_TASK) {
  const queryClient = useQueryClient()
  const [ask, setAsk] = useState<
    | { status: "idle" }
    | { status: "asking"; service: string | null }
    | { status: "job"; jobId: string; service: string | null }
    | { status: "error"; failure: unknown; service: string | null }
  >({ status: "idle" })
  // A later ask wins: an older answer arriving after it is dropped
  const turn = useRef(0)
  const job = useQuery(aiImageJobQuery(ask.status === "job" ? ask.jobId : null))
  const summary = job.data?.result_summary ?? null
  const done = job.data?.status === "succeeded" ? summary?.done?.[0] : undefined
  const result = useQuery({ ...mediaDetailQuery(done?.result_id ?? ""), enabled: Boolean(done) })

  const start = useCallback(
    async (option: string, service?: string, prompt?: string) => {
      const mine = ++turn.current
      setAsk({ status: "asking", service: service ?? null })
      try {
        const queued = await requestImageJob({
          task,
          mediaIds: [mediaId],
          ...(prompt === undefined ? { option } : { prompt }),
          service,
        })
        if (mine === turn.current) {
          setAsk({ status: "job", jobId: queued.job_id, service: queued.service || null })
        }
      } catch (failure) {
        if (mine !== turn.current) {
          return
        }
        const code = (failure as Partial<AiFailure> | null)?.code
        if (code === "ai.no_service" || code === "ai.service_unavailable") {
          void queryClient.invalidateQueries({ queryKey: [...AI_KEY, "services"] })
        }
        setAsk({ status: "error", failure, service: service ?? null })
      }
    },
    [mediaId, task, queryClient]
  )

  const reset = useCallback(() => {
    turn.current++
    setAsk({ status: "idle" })
  }, [])

  let state: AiBackgroundState = { status: "idle" }
  if (ask.status === "asking") {
    state = { status: "running", progress: null, service: ask.service }
  } else if (ask.status === "error") {
    state = { status: "error", failure: ask.failure, service: ask.service }
  } else if (ask.status === "job") {
    const service = ask.service
    if (job.isError) {
      state = { status: "error", failure: job.error, service }
    } else if (!job.data || moving(job.data)) {
      state = { status: "running", progress: job.data?.progress ?? null, service }
    } else if (done) {
      if (result.data) {
        state = { status: "ready", result: result.data, suggestionId: done.suggestion_id, service }
      } else if (result.isError) {
        state = { status: "error", failure: result.error, service }
      } else {
        state = { status: "running", progress: 100, service }
      }
    } else {
      const key = summary?.failed?.[0]?.key ?? summary?.stopped_by ?? job.data.error_code ?? null
      state = { status: "error", failure: keyed(key), service }
    }
  }

  /** The new picture to use; the decision is recorded, nothing is written to a record. */
  const accept = async (): Promise<MediaDetail | null> => {
    if (state.status !== "ready") {
      return null
    }
    const { result: picture, suggestionId } = state
    reset()
    // The picture is already here: a decision that could not be recorded holds nothing up
    if (suggestionId) {
      await acceptSuggestion(suggestionId).catch(() => null)
    }
    return picture
  }

  const dismiss = () => {
    if (state.status === "ready" && state.suggestionId) {
      void dismissSuggestion(state.suggestionId).catch(() => undefined)
    }
    reset()
  }

  return { state, start, accept, dismiss, reset }
}
