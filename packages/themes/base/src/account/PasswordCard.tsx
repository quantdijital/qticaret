import type { Translate } from "@qticaret/ui"

/** "Şifre" on the account's details: a change goes through the reset link sent by e-mail. */
export function PasswordCard({ t }: { t: Translate }) {
  return (
    <section
      aria-labelledby="sifre"
      className="flex flex-col gap-2 rounded-3xl border bg-card p-6 text-sm sm:p-7"
    >
      <h2 id="sifre" className="text-2xl">
        {t("account.password")}
      </h2>
      <p className="text-muted-foreground">{t("account.password_text")}</p>
      <a href="/hesap/sifre-sifirla" className="w-fit font-medium underline underline-offset-4">
        {t("account.password_link")}
      </a>
    </section>
  )
}
