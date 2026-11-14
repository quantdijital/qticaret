import type {
  AnySection,
  BodyGroup,
  BodySection,
  CategorySection,
  LayoutDocument,
  MainSection,
  MainSectionType,
} from "@/features/storefront/api/layout"

/**
 * The main sections in the editor (adr/0049 Ek 2026-11-14 §5, §7): one to a
 * group, read in by the server; the tree shows each as a fixed row that
 * opens its form, and nothing moves, copies, hides or removes it. A page's
 * body (its list, its limit, its order) is the group without its main one.
 */
export const MAIN_TYPES: readonly MainSectionType[] = [
  "header_bar",
  "footer_bar",
  "product_main",
  "category_main",
]

export const isMain = (section: AnySection): section is MainSection =>
  (MAIN_TYPES as readonly string[]).includes(section.type)

const isBody = <S extends AnySection>(section: S): section is Exclude<S, MainSection> =>
  !isMain(section)

/** A page's own sections, its main one aside: what its list shows and its limit counts. */
export const bodyOf = (doc: LayoutDocument, page: BodyGroup): BodySection[] =>
  (doc[page] as readonly AnySection[]).filter(isBody) as BodySection[]

/** The category page's sections, its grid aside. */
export const categoryBody = (doc: LayoutDocument): CategorySection[] => doc.category.filter(isBody)

/** A group's main section, which the server always reads in (none from an older one). */
export const mainOf = <T extends MainSectionType>(
  doc: LayoutDocument,
  type: T
): Extract<MainSection, { type: T }> | undefined =>
  [...doc.header, ...doc.footer, ...doc.product, ...doc.category].find(
    (section): section is Extract<MainSection, { type: T }> => section.type === type
  )

/** The group's main sections first, then its body in the order given. */
export const withBody = <S extends AnySection>(group: readonly S[], body: readonly S[]): S[] => [
  ...group.filter(isMain),
  ...body,
]
