import { ResponsiveImage } from "@qticaret/ui"
import type { AuthorView, Translate } from "@qticaret/ui"

/**
 * A blog author (adr/0060, design.md § İçerik sayfaları): the round photo
 * (else the name's initial on a paper well), the post's closing box and
 * the head of the author's page. Their own profiles are quiet pills that
 * open in a new tab.
 */

const SIZE = { box: "size-16", head: "size-24" } as const

function Photo({ author, size }: { author: AuthorView; size: keyof typeof SIZE }) {
  if (author.image) {
    return (
      <span className={`${SIZE[size]} relative block shrink-0 overflow-hidden rounded-full`}>
        <ResponsiveImage
          image={{ ...author.image, alt: "" }}
          sizes={size === "box" ? "64px" : "96px"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZE[size]} flex shrink-0 items-center justify-center rounded-full bg-paper-2 font-extrabold text-text-2 ${size === "box" ? "text-section" : "text-display"}`}
    >
      {author.name.trim().charAt(0).toLocaleUpperCase("tr-TR")}
    </span>
  )
}

function Links({ author, t }: { author: AuthorView; t: Translate }) {
  if (author.links.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {author.links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener"
            aria-label={t("blog.author_link_on", { name: author.name, network: link.label })}
            className="gf-btn gf-btn--quiet gf-btn--small"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * The box at the end of a post: photo, name to the author's page, title,
 * the bio's first paragraph in three lines, the profiles and a link to
 * all their posts.
 */
export function AuthorBox({ author, t }: { author: AuthorView; t: Translate }) {
  const opening = author.bio[0] ?? null
  return (
    <section
      aria-labelledby="yazar-hakkinda"
      className="mt-12 flex flex-col gap-4 rounded-media gf-pane p-6 sm:flex-row sm:gap-6"
    >
      <Photo author={author} size="box" />
      <div className="flex min-w-0 flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="yazar-hakkinda" className="text-sm font-semibold tracking-normal text-text-2">
            {t("blog.author_about")}
          </h2>
          <p className="text-md font-extrabold">
            <a
              href={author.path}
              className="transition-colors duration-(--dur-micro) hover:text-text-2"
            >
              {author.name}
            </a>
          </p>
          {author.jobTitle && <p className="text-sm text-text-2">{author.jobTitle}</p>}
        </div>
        {opening && <p className="line-clamp-3 text-text-2">{opening}</p>}
        <Links author={author} t={t} />
        <a href={author.path} className="text-sm font-semibold underline underline-offset-4">
          {t("blog.author_posts")}
        </a>
      </div>
    </section>
  )
}

/** The author's page head: the larger photo beside the one `h1`, title, bio and profiles. */
export function AuthorHead({ author, t }: { author: AuthorView; t: Translate }) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
      <Photo author={author} size="head" />
      <div className="flex min-w-0 flex-col items-start gap-4">
        <div className="flex flex-col gap-2">
          <h1>{author.name}</h1>
          {author.jobTitle && <p className="text-lead text-text-2">{author.jobTitle}</p>}
        </div>
        {author.bio.map((paragraph, index) => (
          <p key={String(index)} className="max-w-[60ch] text-text-2">
            {paragraph}
          </p>
        ))}
        <Links author={author} t={t} />
      </div>
    </header>
  )
}
