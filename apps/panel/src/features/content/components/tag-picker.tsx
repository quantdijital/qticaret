import { useQuery } from "@tanstack/react-query"
import { Hash, Loader2, Plus, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MAX_POST_TAGS, searchTags, useCreateTerm } from "@/features/content/api/terms"
import type { TermView } from "@/features/content/api/terms"
import { errorText } from "@/lib/errors"

const T = "content.terms"
const DELAY_MS = 250

const folded = (text: string) => text.toLocaleLowerCase("tr").trim()
const viewOf = ({ id, name, handle, path }: TermView): TermView => ({ id, name, handle, path })

/**
 * A post's tags: each a small badge to take off, and a search that adds
 * one of the shop's tags or, when none has the typed name, makes it first.
 */
export function TagPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: readonly TermView[]
  onChange: (value: TermView[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [q, setQ] = useState("")
  const create = useCreateTerm()
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(text.trim())
    }, DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [text])
  const found = useQuery({
    queryKey: ["content-terms", "tag-search", q],
    queryFn: () => searchTags(q),
    enabled: open,
  })
  const chosen = new Set(value.map((tag) => tag.id))
  const options = (found.data ?? []).filter((tag) => !chosen.has(tag.id))
  const typed = text.trim()
  // A name no tag has yet (nor one already on the post): offered to make
  const exists = [...(found.data ?? []), ...value].some((tag) => folded(tag.name) === folded(typed))
  const full = value.length >= MAX_POST_TAGS
  const add = (tag: TermView) => {
    onChange([...value, viewOf(tag)])
    setText("")
  }
  const make = () => {
    create.mutate(
      { kind: "tag", name: typed },
      {
        onSuccess: ({ term }) => {
          add(term)
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul aria-label={t(`${T}.tags`)} className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag.id}>
              <Badge variant="secondary" className="gap-1 py-0.5 pr-0.5 font-normal">
                <Hash aria-hidden="true" />
                <span className="max-w-40 truncate">{tag.name}</span>
                <button
                  type="button"
                  aria-label={t(`${T}.removeTag`, { name: tag.name })}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    onChange(value.filter((each) => each.id !== tag.id))
                  }}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t(`${T}.noTags`)}</p>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={full}
          >
            <Plus />
            {t(`${T}.addTag`)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          {/* The server searches; what it answers is shown as it is */}
          <Command shouldFilter={false}>
            <CommandInput value={text} onValueChange={setText} placeholder={t(`${T}.searchTag`)} />
            <CommandList>
              {found.isFetching && !found.data ? (
                <div className="flex justify-center py-6">
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              ) : (
                <CommandEmpty>{t(`${T}.noTag`)}</CommandEmpty>
              )}
              {typed !== "" && !exists ? (
                <CommandItem value="__create__" disabled={create.isPending} onSelect={make}>
                  {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  {t(`${T}.createTag`, { name: typed })}
                </CommandItem>
              ) : null}
              {options.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.id}
                  onSelect={() => {
                    add(tag)
                  }}
                >
                  <Hash className="text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{tag.name}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {full ? (
        <p className="text-xs text-muted-foreground">
          {t(`${T}.tagsFull`, { max: MAX_POST_TAGS })}
        </p>
      ) : null}
    </div>
  )
}
