// The theme editor's preview asks its quick view here (adr/0049 Ek 2026-11-15): the proxy reads
// the token off this address, so the answer follows the draft the frame shows (its switches, its
// card settings), never the live design. The same handler as `/api/quick-view`.
export { GET } from "@/app/api/quick-view/route"

// Every answer is the shopper's: never a cached page
export const dynamic = "force-dynamic"
