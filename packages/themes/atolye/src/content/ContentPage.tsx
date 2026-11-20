import type {
  ContactActions,
  ContentPageSectionView,
  ContentPageView,
  FormAction,
  HomeSectionView,
  PageTextSectionView,
  Translate,
} from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Blocks, type Subscribe } from "../sections/Blocks"
import { PageHead } from "./PageHead"
import { idSuffixes } from "./page-ids"
import { isHomeSection, isPageText, PageTexts, textParts, type TextPart } from "./PageText"
import { PostPage } from "./PostPage"

/** A run of a page's sections: its own text sections, or the home page's types between them. */
type Run = { text: true; parts: TextPart[] } | { text: false; sections: HomeSectionView[] }

/** The page's sections as runs, in the shop's order. */
function runsOf(sections: readonly ContentPageSectionView[]): Run[] {
  const runs: { text: boolean; sections: ContentPageSectionView[] }[] = []
  for (const section of sections) {
    const text = isPageText(section)
    const last = runs.at(-1)
    if (last?.text === text) {
      last.sections.push(section)
    } else {
      runs.push({ text, sections: [section] })
    }
  }
  return runs.map((run) =>
    run.text
      ? { text: true, parts: textParts(run.sections.filter(isPageText)) }
      : { text: false, sections: run.sections.filter(isHomeSection) }
  )
}

/** A page from a storefront before its sections: its whole text, drawn as one. */
const textAlone = (view: ContentPageView): PageTextSectionView[] => [
  {
    id: "",
    type: "rich_text",
    variant: "article",
    title: null,
    html: view.html,
    outline: [],
    faq: null,
    help: null,
  },
]

/**
 * The shop's own pages and its blog posts (adr/0019, adr/0046 Ek
 * 2026-11-05 içerik sayfaları). A post is an article with its facts,
 * contents, products and the posts to read next. A page is its head (its
 * one h1) and its sections in the shop's order (adr/0073 Ek 2026-11-19
 * (2) K8): its own text sections as the page drew its text before they
 * were sections (`PageTexts`), the home page's types each in its own
 * container (`Blocks`). The text sections that open the page stand in the
 * head's container, so a page of its text alone is drawn as before; a
 * later run of them in a container of its own, the same distance below.
 */
export function ContentPage({
  view,
  t,
  actions,
  subscribe,
  quickAdd,
}: {
  view: ContentPageView
  t: Translate
  actions?: ContactActions
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
}) {
  if (view.post) {
    return <PostPage view={view} t={t} />
  }
  const sections = view.sections ?? textAlone(view)
  const runs = runsOf(sections)
  // Two text sections of a kind on the page: the later one's fixed ids apart
  const ids = idSuffixes(sections.filter(isPageText))
  const [first] = runs
  const lead = first?.text ? first : null
  const rest = lead ? runs.slice(1) : runs
  return (
    <>
      <Container className={lead ? "flex flex-col gap-8 pt-6 lg:gap-12 lg:pt-10" : "pt-6 lg:pt-10"}>
        <PageHead view={view} t={t} />
        {lead && <PageTexts parts={lead.parts} t={t} actions={actions} ids={ids} />}
      </Container>
      {rest.map((run, index) =>
        run.text ? (
          <Container
            key={`metin-${String(index)}`}
            className={
              run.parts.length > 1 ? "flex flex-col gap-8 pt-8 lg:gap-12 lg:pt-12" : "pt-8 lg:pt-12"
            }
          >
            <PageTexts parts={run.parts} t={t} actions={actions} ids={ids} />
          </Container>
        ) : (
          <Blocks
            key={`bolumler-${String(index)}`}
            sections={run.sections}
            t={t}
            subscribe={subscribe}
            quickAdd={quickAdd}
          />
        )
      )}
    </>
  )
}
