/** What the shop changes on a question: its words, its own answer (null removes it). */
export interface QuestionEdit {
  id: string
  body?: string | undefined
  answer?: string | null | undefined
  user_id: string
  /** The shop's name, for an answer written now. */
  author_name: string
}

/** What an edit's undo puts back. */
export interface QuestionEditUndo {
  id: string
  body: string
  has_link: boolean
  status: "pending" | "approved" | "rejected"
  moderated_by: string | null
  /** As text: the undo travels between workflow steps. */
  moderated_at: string | null
  edited_by: string | null
  edited_at: string | null
  answer:
    | { kind: "changed"; id: string; body: string }
    | { kind: "removed"; id: string }
    | { kind: "added"; id: string }
    | null
}
