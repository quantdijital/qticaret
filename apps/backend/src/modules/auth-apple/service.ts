import { randomBytes } from "node:crypto"
import type {
  AuthIdentityProviderService,
  AuthenticationInput,
  AuthenticationResponse,
} from "@medusajs/framework/types"
import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { appleClientSecret, appleNameOf, keyIdOf, verifyAppleIdToken } from "../../lib/auth/apple"
import type { AppleKey } from "../../lib/auth/apple"
import { createHttpClient } from "../../lib/clients"
import type { HttpClient } from "../../lib/clients"

export interface AppleAuthOptions {
  clientId: string
  teamId: string
  keyId: string
  /** The .p8 key in PEM; `\n` written out is read as a line break. */
  privateKey: string
  /** The storefront page Apple posts back to; never taken from a request. */
  callbackUrl: string
  /** A fake Apple in tests; Apple's own address otherwise. */
  baseUrl?: string
}

interface SignInState {
  nonce: string
  callback_url: string
}

const KEYS_TTL_MS = 60 * 60 * 1000

const tokenAnswer = z.object({ id_token: z.string().min(1).max(8000) }).loose()
const keysAnswer = z.object({
  keys: z.array(z.object({ kid: z.string().max(100) }).loose()).max(20),
})

const appleError = (body: unknown): string | undefined => {
  const error = (body as { error?: unknown } | null)?.error
  return typeof error === "string" && /^[a-z_]{1,40}$/.test(error) ? error : undefined
}

const fieldOf = (data: AuthenticationInput, name: string): string | undefined => {
  const value = data.body?.[name] ?? data.query?.[name]
  return typeof value === "string" ? value : undefined
}

/**
 * Sign in with Apple as a Medusa auth provider (`apple`, adr/0037 §3).
 * Apple posts the result to the storefront's page (`form_post`), which
 * hands it to `/auth/customer/apple/callback`. The code is exchanged with a
 * fresh client secret, and the identity token is checked against Apple's
 * keys, this client and this sign-in's nonce. Medusa's own provider list
 * has no Apple.
 */
class AppleAuthService extends AbstractAuthModuleProvider {
  static override identifier = "apple"
  static override DISPLAY_NAME = "Apple"

  private readonly options_: AppleAuthOptions
  private readonly client: HttpClient
  private keys: { list: AppleKey[]; at: number } | null = null

  static override validateOptions(options: Record<string, unknown>): void {
    for (const name of ["clientId", "teamId", "keyId", "privateKey", "callbackUrl"]) {
      if (typeof options[name] !== "string" || options[name] === "") {
        throw new Error(`auth-apple: ${name} is required`)
      }
    }
  }

  constructor(_container: Record<string, unknown>, options: AppleAuthOptions) {
    super()
    this.options_ = { ...options, privateKey: options.privateKey.replace(/\\n/g, "\n") }
    this.client = createHttpClient({
      provider: "apple",
      baseUrl: options.baseUrl ?? "https://appleid.apple.com",
      errorCode: appleError,
      // A shopper is waiting at the sign-in page
      timeoutMs: 5_000,
      retry: { attempts: 2 },
    })
  }

  override async authenticate(
    _data: AuthenticationInput,
    service: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const stateKey = randomBytes(32).toString("hex")
    const state: SignInState = {
      nonce: randomBytes(32).toString("hex"),
      callback_url: this.options_.callbackUrl,
    }
    await service.setState(stateKey, state as unknown as Record<string, unknown>)
    const location = new URL(
      "/auth/authorize",
      this.options_.baseUrl ?? "https://appleid.apple.com"
    )
    location.search = new URLSearchParams({
      client_id: this.options_.clientId,
      redirect_uri: state.callback_url,
      response_type: "code",
      // Apple sends the name and e-mail only by form post
      response_mode: "form_post",
      scope: "name email",
      state: stateKey,
      nonce: state.nonce,
    }).toString()
    return { success: true, location: location.toString() }
  }

  override async validateCallback(
    data: AuthenticationInput,
    service: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const failed = fieldOf(data, "error")
    if (failed) {
      return { success: false, error: "apple.sign_in_cancelled" }
    }
    const code = fieldOf(data, "code")
    const stateKey = fieldOf(data, "state")
    const state = stateKey
      ? ((await service.getState(stateKey)) as unknown as SignInState | null)
      : null
    if (!code || !state?.nonce) {
      return { success: false, error: "apple.sign_in_expired" }
    }
    try {
      const { id_token: idToken } = await this.client.request({
        method: "POST",
        path: "/auth/token",
        form: {
          client_id: this.options_.clientId,
          client_secret: appleClientSecret(this.options_),
          code,
          grant_type: "authorization_code",
          redirect_uri: state.callback_url,
        },
        schema: tokenAnswer,
      })
      const identity = verifyAppleIdToken(idToken, await this.keysFor(idToken), {
        clientId: this.options_.clientId,
        nonce: state.nonce,
      })
      if (!identity?.email || !identity.emailVerified) {
        return { success: false, error: "apple.identity_invalid" }
      }
      const name = appleNameOf(data.body?.["user"])
      const metadata = {
        email: identity.email,
        is_private_email: identity.isPrivateEmail,
        ...(name.firstName ? { given_name: name.firstName } : {}),
        ...(name.lastName ? { family_name: name.lastName } : {}),
      }
      const authIdentity = await service
        .retrieve({ entity_id: identity.sub })
        .catch(async (error: unknown) => {
          if ((error as { type?: string }).type !== MedusaError.Types.NOT_FOUND) {
            throw error
          }
          return service.create({ entity_id: identity.sub, user_metadata: metadata })
        })
      return { success: true, authIdentity }
    } catch {
      return { success: false, error: "apple.sign_in_failed" }
    }
  }

  /** Apple's keys, read again an hour later or when a token names a key not seen yet. */
  private async keysFor(idToken: string): Promise<AppleKey[]> {
    const kid = keyIdOf(idToken)
    const fresh = this.keys && Date.now() - this.keys.at < KEYS_TTL_MS
    if (fresh && this.keys?.list.some((key) => key.kid === kid)) {
      return this.keys.list
    }
    const { keys } = await this.client.request({ path: "/auth/keys", schema: keysAnswer })
    this.keys = { list: keys, at: Date.now() }
    return keys
  }
}

export default AppleAuthService
