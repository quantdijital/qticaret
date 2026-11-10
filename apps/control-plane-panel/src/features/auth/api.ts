import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { forgetStepUp } from "@/lib/step-up"

export type StaffRole = "owner" | "operator" | "finance" | "readonly"

/** `GET /admin/cp/me`: who is signed in and where they stand with 2FA (adr/0061 Ek C4). */
export interface Me {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: StaffRole | null
  /** Waiting for the first factor: the role is granted once it is confirmed. */
  pending: boolean
  enrol_by: string | null
  /** After an owner's reset: the setup asks the e-mailed link's token too. */
  enrolment_token_required: boolean
  mfa: { required: boolean; enabled: boolean; passed: boolean }
}

export const ME_KEY = ["auth", "me"] as const

/** The signed-in member; rejects with the API's 401 (nobody) or 403 (`cp.no_role`). */
export const meQuery = () =>
  queryOptions({
    queryKey: ME_KEY,
    queryFn: async () => (await api<{ me: Me }>("/admin/cp/me")).me,
    staleTime: 60_000,
    retry: false,
  })

export function useMe(): Me | undefined {
  return useQuery(meQuery()).data
}

/** Whether the member reaches the panel itself (granted, 2FA passed this session). */
export const isThrough = (me: Me): boolean =>
  me.role !== null && !me.pending && me.mfa.enabled && me.mfa.passed

export const displayName = (me: Pick<Me, "first_name" | "last_name" | "email">): string => {
  const name = [me.first_name, me.last_name].filter(Boolean).join(" ")
  return name !== "" ? name : (me.email ?? "")
}

/** The second step a sign-in asks for once 2FA is on (Medusa's MFA challenge). */
export interface Challenge {
  id: string
  /** The password step's token: the challenge's verification takes it (Medusa 2.21.2). */
  token: string
  methods: string[]
}

interface PasswordAnswer {
  token: string
  mfa_challenge?: { id: string; methods?: string[] }
}

/** A sign-in's token turned into the session cookie; the token is dropped. */
export const openSession = (token: string) =>
  api<unknown>("/auth/session", { method: "POST", bearer: token })

/**
 * E-mail and password. With 2FA on the answer is a challenge for the code;
 * without (a member still to set it up) the session opens at once and the
 * panel leads to the setup.
 */
export async function signInWithPassword(input: {
  email: string
  password: string
}): Promise<Challenge | null> {
  const answer = await api<PasswordAnswer>("/auth/user/emailpass", {
    method: "POST",
    body: { email: input.email, password: input.password },
  })
  if (answer.mfa_challenge) {
    return {
      id: answer.mfa_challenge.id,
      token: answer.token,
      methods: answer.mfa_challenge.methods ?? ["totp", "recovery_code"],
    }
  }
  await openSession(answer.token)
  return null
}

/** The sign-in's code: the app's six digits or a recovery code; then the session opens. */
export async function verifyChallenge(input: {
  challenge: Challenge
  method: "totp" | "recovery_code"
  code: string
}): Promise<void> {
  const answer = await api<{ token: string }>(
    `/auth/mfa/challenges/${encodeURIComponent(input.challenge.id)}/verify`,
    {
      method: "POST",
      body: { method: input.method, code: input.code },
      bearer: input.challenge.token,
    }
  )
  await openSession(answer.token)
}

export function useSignIn() {
  const client = useQueryClient()
  return useMutation({
    // The password is not kept in the mutation cache once the screen is gone
    gcTime: 0,
    mutationFn: signInWithPassword,
    onSuccess: async (challenge) => {
      if (!challenge) {
        await client.invalidateQueries({ queryKey: ["auth"] })
      }
    },
  })
}

export function useVerifyChallenge() {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: verifyChallenge,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["auth"] })
    },
  })
}

/** Ends this session; whatever happens, the panel forgets everything it read. */
export async function signOut(clear: () => void): Promise<void> {
  try {
    await api<unknown>("/auth/session", { method: "DELETE" })
  } catch {
    // Already gone (expired, ended elsewhere): signed out all the same
  } finally {
    forgetStepUp()
    clear()
  }
}

export function useSignOut(onDone: () => void) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () =>
      signOut(() => {
        client.clear()
      }),
    onSettled: onDone,
  })
}
