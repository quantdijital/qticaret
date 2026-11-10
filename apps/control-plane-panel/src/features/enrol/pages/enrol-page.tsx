import { useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useMe, useSignOut } from "@/features/auth/api"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"
import { PasswordInput } from "@/features/auth/components/password-input"
import { useConfirmFactor, useStartFactor } from "@/features/enrol/api"
import { AuthenticatorLink } from "@/features/enrol/components/authenticator-link"
import { RecoveryCodes } from "@/features/enrol/components/recovery-codes"
import { errorText } from "@/lib/errors"
import { heldEnrolmentToken, holdEnrolmentToken } from "@/lib/link-token"

type Step = "app" | "codes" | "done"

function SignOutLink({ label }: { label: string }) {
  const navigate = useNavigate()
  const signOut = useSignOut(() => void navigate({ to: "/login" }))
  return (
    <Button
      variant="link"
      className="h-auto self-start px-0"
      onClick={() => {
        signOut.mutate()
      }}
    >
      {label}
    </Button>
  )
}

/** After an owner's reset the setup opens only from the e-mailed link (adr/0061 Ek C4, M3). */
function LinkRequired() {
  const { t } = useTranslation()
  return (
    <AuthShell>
      <div role="alert">
        <AuthHeading
          title={t("enrol.linkRequired.title")}
          subtitle={t("enrol.linkRequired.text")}
        />
      </div>
      <div className="mt-6 flex">
        <SignOutLink label={t("enrol.signOut")} />
      </div>
    </AuthShell>
  )
}

function AppStep({
  token,
  onConfirmed,
}: {
  token: string | null
  onConfirmed: (codes: string[]) => void
}) {
  const { t } = useTranslation()
  const start = useStartFactor()
  const confirm = useConfirmFactor()
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const started = useRef(false)
  useEffect(() => {
    // Once: each start replaces the factor before it
    if (!started.current) {
      started.current = true
      start.mutate()
    }
  }, [start])
  const factor = start.data
  if (start.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">{errorText(t, start.error)}</p>
        <Button
          variant="outline"
          onClick={() => {
            start.mutate()
          }}
        >
          {t("common.retry")}
        </Button>
      </div>
    )
  }
  if (!factor) {
    return (
      <div aria-busy="true" className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    )
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        confirm.mutate(
          { code: code.trim(), password, enrolmentToken: token },
          {
            onSuccess: (codes) => {
              setPassword("")
              onConfirmed(codes)
            },
          }
        )
      }}
    >
      <AuthenticatorLink factor={factor} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="first-code">{t("enrol.code")}</Label>
        <Input
          id="first-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="enrol-password">{t("enrol.password")}</Label>
        <PasswordInput
          id="enrol-password"
          autoComplete="current-password"
          aria-describedby="enrol-password-hint"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
          }}
        />
        <p id="enrol-password-hint" className="text-xs text-muted-foreground">
          {t("enrol.passwordHint")}
        </p>
      </div>
      {confirm.error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText(t, confirm.error)}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={!/^\d{6}$/.test(code.trim()) || password === "" || confirm.isPending}
      >
        {t("enrol.confirm")}
      </Button>
    </form>
  )
}

/**
 * 2FA setup (adr/0061 §3.5, Ek C4), before anything else: for a new member
 * (from an invitation), after an owner's reset (with the e-mailed link),
 * or after turning one's own off. The app, its first code with the
 * password, the recovery codes once; then a new sign-in with the code,
 * so the session itself has passed it.
 */
export function EnrolPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useMe()
  const signOut = useSignOut(() => void navigate({ to: "/login" }))
  const [step, setStep] = useState<Step>("app")
  const [codes, setCodes] = useState<string[]>([])
  const [kept, setKept] = useState(false)
  const token = heldEnrolmentToken()
  if (me?.enrolment_token_required && !token && step === "app") {
    return <LinkRequired />
  }
  return (
    <AuthShell wide>
      <div className="flex flex-col gap-6">
        <AuthHeading title={t(`enrol.${step}.title`)} subtitle={t(`enrol.${step}.text`)} />
        {step === "app" ? (
          <AppStep
            token={token}
            onConfirmed={(next) => {
              // The link's token is spent with the setup
              holdEnrolmentToken(null)
              setCodes(next)
              setStep("codes")
            }}
          />
        ) : null}
        {step === "codes" ? (
          <>
            <RecoveryCodes codes={codes} />
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={kept}
                onCheckedChange={(checked) => {
                  setKept(checked === true)
                }}
              />
              {t("enrol.kept")}
            </label>
            <Button
              disabled={!kept}
              onClick={() => {
                // Shown once: gone from the page as soon as they are kept
                setCodes([])
                setStep("done")
              }}
            >
              {t("enrol.next")}
            </Button>
          </>
        ) : null}
        {step === "done" ? (
          <Button
            onClick={() => {
              signOut.mutate()
            }}
          >
            {t("enrol.signInAgain")}
          </Button>
        ) : null}
        {/* Not beside the codes: leaving there would lose them */}
        {step === "app" ? <SignOutLink label={t("enrol.later")} /> : null}
      </div>
    </AuthShell>
  )
}
