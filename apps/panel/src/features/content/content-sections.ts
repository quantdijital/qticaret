/** The parts of a text's page the advisor's "go to field" lands on, by their element ids. */
export const CONTENT_SECTIONS = {
  general: "content-general",
  body: "content-body",
  seo: "content-seo",
  cover: "content-cover-section",
  summary: "content-summary",
  terms: "content-terms",
} as const

const S = CONTENT_SECTIONS

// The advisor's "go to field" targets: the parts above by their ids (a folded one opens)
export const CONTENT_TARGETS: Readonly<Record<string, string>> = {
  edit_title: S.seo,
  edit_description: S.seo,
  edit_robots: S.seo,
  use_template_title: S.seo,
  use_template_description: S.seo,
  edit_body: S.body,
  edit_handle: S.general,
  edit_author: S.summary,
  add_image: S.cover,
}
