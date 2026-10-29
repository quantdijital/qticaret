import { randomUUID } from "node:crypto"
import { ProviderError } from "../errors"
import type {
  AccountingAdapter,
  AccountingRef,
  CustomerInput,
  MoneyInput,
  SaleInput,
} from "./adapter"

/**
 * A stand-in accounting program for development and tests (F11.5, KK2):
 * it keeps what it was sent by reference, as a real adapter must, so a
 * record sent twice is one record. `failNext` makes the next calls fail as
 * an unreachable program would. Never offered where the shop runs live.
 */

export type FakeRecordKind = "customer" | "sale" | "payment" | "return"

export interface FakeRecord {
  kind: FakeRecordKind
  reference: string
  external_id: string
  body: unknown
}

class FakeLedger {
  readonly records = new Map<string, FakeRecord>()
  /** Calls made, failed ones too. */
  calls = 0
  private failures = 0

  /** The next `count` calls fail. */
  failNext(count: number): void {
    this.failures = count
  }

  reset(): void {
    this.records.clear()
    this.calls = 0
    this.failures = 0
  }

  of(kind: FakeRecordKind): FakeRecord[] {
    return [...this.records.values()].filter((record) => record.kind === kind)
  }

  write(kind: FakeRecordKind, reference: string, body: unknown): Promise<AccountingRef> {
    this.calls += 1
    if (this.failures > 0) {
      this.failures -= 1
      return Promise.reject(
        new ProviderError({
          provider: "accounting_fake",
          providerCode: "unavailable",
          retryable: true,
        })
      )
    }
    const key = `${kind}:${reference}`
    const known = this.records.get(key)
    if (known) {
      return Promise.resolve({ external_id: known.external_id })
    }
    const external_id = `fake_${randomUUID()}`
    this.records.set(key, { kind, reference, external_id, body })
    return Promise.resolve({ external_id })
  }
}

/** The fake program's books, shared by the process (tests read and steer it). */
export const fakeAccountingLedger = new FakeLedger()

export const fakeAccountingAdapter: AccountingAdapter = {
  id: "fake",
  upsertCustomer: (input: CustomerInput) =>
    fakeAccountingLedger.write("customer", input.reference, input.party),
  pushSale: (input: SaleInput) => fakeAccountingLedger.write("sale", input.reference, input),
  pushPayment: (input: MoneyInput) => fakeAccountingLedger.write("payment", input.reference, input),
  pushReturn: (input: MoneyInput) => fakeAccountingLedger.write("return", input.reference, input),
  healthCheck: () => Promise.resolve("ok"),
}
