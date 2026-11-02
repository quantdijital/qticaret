import type { ConfirmPageView, Translate } from "@qticaret/ui"
import { PageContainer } from "./components/Container"

/**
 * Asks before acting on a link: the words, a warning, one button, the way
 * back. With nothing left to do (done, or a broken link) only the words
 * and the way back.
 */
export function ConfirmPage({
  view,
  action,
}: {
  view: ConfirmPageView
  t: Translate
  action: (form: FormData) => Promise<void>
}) {
  const back = (
    <a href={view.back.path} className="text-sm underline">
      {view.back.label}
    </a>
  )
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-md flex-col gap-5 py-12 text-center">
        <h1 className="text-3xl">{view.title}</h1>
        <p className="text-muted-foreground">{view.text}</p>
        {view.warning && (
          <p role="note" className="rounded-xl border p-3 text-sm">
            {view.warning}
          </p>
        )}
        {view.submit === null ? (
          <p>{back}</p>
        ) : (
          <form action={action} className="flex flex-col items-center gap-3">
            {view.fields.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            <button
              type="submit"
              className="h-11 rounded-button bg-foreground px-6 text-sm font-semibold text-background"
            >
              {view.submit}
            </button>
            {back}
          </form>
        )}
      </div>
    </PageContainer>
  )
}
