import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { keysQuery } from "@/features/keys/api"
import { KeksCard } from "@/features/keys/components/keks-card"
import { SigningKeysCard } from "@/features/keys/components/signing-keys-card"
import { errorText } from "@/lib/errors"

/**
 * "Anahtarlar" (owner, adr/0061 §4, Ek C8): the signing keys and their
 * rotation, the encryption keys and their rewrap, side by side. Key ids,
 * public keys, fingerprints and counts only: no secret value is ever sent
 * to this page.
 */
export function KeysPage() {
  const { t } = useTranslation()
  const keys = useQuery(keysQuery())
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("keys.title")} description={t("keys.text")} />
      {keys.isError ? (
        <ErrorState text={errorText(t, keys.error)} onRetry={() => void keys.refetch()} />
      ) : (
        <PageGrid>
          <PageColumn span={6}>
            <SigningKeysCard overview={keys.data} />
          </PageColumn>
          <PageColumn span={6}>
            <KeksCard status={keys.data?.keks} />
          </PageColumn>
        </PageGrid>
      )}
    </div>
  )
}
