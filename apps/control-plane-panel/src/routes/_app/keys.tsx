import { createFileRoute } from "@tanstack/react-router"
import { KeysPage } from "@/features/keys/pages/keys-page"
import { requireOwner } from "../-require-member"

/** The keys: the owner's alone (adr/0061 §3.5, Ek C8). */
export const Route = createFileRoute("/_app/keys")({
  beforeLoad: ({ context }) => {
    requireOwner(context.me)
  },
  component: KeysPage,
})
