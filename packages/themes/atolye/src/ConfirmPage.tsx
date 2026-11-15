import type { ConfirmPageView, Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"

/**
 * Asks before acting on a link (an e-mail's unsubscribe, a confirmation):
 * one tinted well with the words, a warning, one button and the way back.
 * With nothing left to do (done, or a broken link) only the words and the
 * way back.
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
    <a href={view.back.path} className="gf-link">
      {view.back.label}
    </a>
  )
  return (
    <Container className="pt-8 lg:pt-16">
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-6 rounded-tile gf-pane p-6 sm:p-10">
        <h1>{view.title}</h1>
        <p className="max-w-[52ch] text-lg text-text-2">{view.text}</p>
        {view.warning && (
          <p role="note" className="rounded-media bg-highlight-soft p-4 text-md font-semibold">
            {view.warning}
          </p>
        )}
        {view.submit === null ? (
          back
        ) : (
          <form action={action} className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {view.fields.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            <button type="submit" className="gf-btn">
              {view.submit}
            </button>
            {back}
          </form>
        )}
      </div>
    </Container>
  )
}
