import { X } from "lucide-react"
import type { UnderstoodView } from "@qticaret/ui"

/**
 * A search read from the shopper's sentence (adr/0077 §7): "Anladığım:"
 * and each part as a quiet pill that takes it away (a filter, so
 * nofollow), one row that wraps.
 */
export function Understood({ understood }: { understood: UnderstoodView }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm font-semibold text-text-2">{understood.title}</p>
      <ul className="flex flex-wrap gap-2">
        {understood.parts.map((part) => (
          <li key={part.path}>
            <a href={part.path} rel="nofollow" aria-label={part.remove} className="gf-chip">
              {part.label}
              <X className="size-4" aria-hidden="true" strokeWidth={2} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
