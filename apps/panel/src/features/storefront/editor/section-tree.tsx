import { Link } from "@tanstack/react-router"
import { ChevronRight, Columns3, Contact, Palette, Plus, Store } from "lucide-react"
import type { Dispatch, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type {
  AnySection,
  BodyGroup,
  LayoutDocument,
  Placement,
} from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  idsOf,
  isScheduled,
  newAnnouncementBar,
  newFooterNewsletter,
  newSectionId,
} from "@/features/storefront/layout/sections"
import { PageSections } from "./page-sections"
import { SECTION_ICONS, kindOf, sectionLabel } from "./section-meta"
import { SectionRow } from "./section-row"

const T = "storefront.editor.tree"

function TreeGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </div>
  )
}

/** A part of the frame edited on another screen: its name and links there. */
function ElsewhereRow({
  icon: Icon,
  name,
  links,
}: {
  icon: LucideIcon
  name: string
  links: { to: "/settings/store" | "/storefront/menus"; label: string }[]
}) {
  return (
    <li className="flex items-start gap-2 py-1.5 pr-2 pl-6">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{name}</span>
        <span className="flex flex-wrap gap-x-3 text-xs">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-primary-text underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </span>
      </div>
    </li>
  )
}

/** A button that adds what a group lacks (the header's bar, the footer's box). */
function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li className="pl-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-primary-text"
        onClick={onClick}
      >
        <Plus />
        {label}
      </Button>
    </li>
  )
}

interface SectionTreeProps {
  /** The page being edited: its own sections between the header and the footer. */
  page: BodyGroup
  doc: LayoutDocument
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: AnySection) => void
  onAddSection: (placement?: Placement) => void
  onTheme: () => void
}

/**
 * The page's parts as the storefront draws them, top to bottom: the
 * header, the chosen page's own sections, the footer; then the theme's
 * own settings. The menus, the logo and the contact details are edited
 * on their own screens, linked from where they show.
 */
export function SectionTree({
  page,
  doc,
  problems,
  dispatch,
  onOpen,
  onRemove,
  onAddSection,
  onTheme,
}: SectionTreeProps) {
  const { t } = useTranslation()
  const store = t(`${T}.storeProfile`)
  const menus = t(`${T}.menus`)
  const row = (section: AnySection, inFooter = false) => {
    const { name, detail } = sectionLabel(t, section, inFooter)
    return (
      <SectionRow
        key={section.id}
        id={section.id}
        icon={SECTION_ICONS[kindOf(section, inFooter)]}
        name={name}
        detail={detail}
        visible={section.visible}
        scheduled={isScheduled(section)}
        problem={problems.has(section.id)}
        onOpen={() => {
          onOpen(section.id)
        }}
        onToggle={() => {
          dispatch({ type: "toggle", id: section.id })
        }}
        onRemove={() => {
          onRemove(section)
        }}
      />
    )
  }
  const add = (group: "header" | "footer") => {
    const id = newSectionId(idsOf(doc))
    const section = group === "header" ? newAnnouncementBar(id) : newFooterNewsletter(id)
    dispatch({ type: "add", group, section })
    onOpen(id)
  }
  const [bar] = doc.header
  const [newsletter] = doc.footer
  return (
    <nav aria-label={t(`${T}.label`)} className="flex flex-col gap-5 p-3">
      <TreeGroup title={t(`${T}.header`)}>
        <ul className="flex flex-col gap-0.5">
          {bar ? (
            row(bar)
          ) : (
            <AddRow
              label={t(`${T}.addAnnouncement`)}
              onClick={() => {
                add("header")
              }}
            />
          )}
          <ElsewhereRow
            icon={Store}
            name={t(`${T}.logo`)}
            links={[
              { to: "/settings/store", label: store },
              { to: "/storefront/menus", label: menus },
            ]}
          />
        </ul>
      </TreeGroup>
      <TreeGroup title={t(`storefront.editor.page.${page}`)}>
        <PageSections
          page={page}
          doc={doc}
          problems={problems}
          dispatch={dispatch}
          onOpen={onOpen}
          onRemove={onRemove}
          onAdd={onAddSection}
        />
      </TreeGroup>
      <TreeGroup title={t(`${T}.footer`)}>
        <ul className="flex flex-col gap-0.5">
          {newsletter ? (
            row(newsletter, true)
          ) : (
            <AddRow
              label={t(`${T}.addNewsletter`)}
              onClick={() => {
                add("footer")
              }}
            />
          )}
          <ElsewhereRow
            icon={Columns3}
            name={t(`${T}.columns`)}
            links={[{ to: "/storefront/menus", label: menus }]}
          />
          <ElsewhereRow
            icon={Contact}
            name={t(`${T}.contact`)}
            links={[{ to: "/settings/store", label: store }]}
          />
        </ul>
      </TreeGroup>
      <TreeGroup title={t(`${T}.theme`)}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start pl-6"
          onClick={onTheme}
        >
          <Palette />
          <span className="flex-1 text-left">{t(`${T}.themeSettings`)}</span>
          <ChevronRight className="text-muted-foreground" />
        </Button>
      </TreeGroup>
    </nav>
  )
}
