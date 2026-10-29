import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { decryptPii, encryptPii, parseKey } from "../../lib/crypto/pii"
import { newWebhookSecret } from "../../lib/webhooks"
import type { WebhookEvent } from "../../lib/webhooks"
import { WebhookCursor } from "./models/webhook-cursor"
import { WebhookDelivery } from "./models/webhook-delivery"
import { WebhookSubscription } from "./models/webhook-subscription"

interface Options {
  encryptionKey: string
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface DueDelivery {
  id: string
  subscription_id: string
  event: string
  payload: Record<string, unknown>
  attempts: number
  created_at: Date
  url: string
  secret_encrypted: string
}

/** Tries before a delivery stops; and failures in a row before a subscription is turned off. */
export const MAX_ATTEMPTS = 8
export const MAX_STREAK = 8
/** Subscriptions a shop keeps: enough for its systems, too few to crowd the sender. */
export const MAX_SUBSCRIPTIONS = 20
// Minutes after each failed try: 1, 5, 30 minutes, then 2, 6, 12 and 24 hours
const BACKOFF_MINUTES = [1, 5, 30, 120, 360, 720, 1440]
// While a claimed delivery is being sent, no other worker takes it
const LEASE_MINUTES = 5

const contextOf = (id: string) => `webhook-secret:${id}`
const minutesFrom = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000)

/** Events sent to the shop's own systems (F11.7): subscriptions, deliveries and the feeds' cursors. */
class TenantWebhooksModuleService extends MedusaService({
  WebhookSubscription,
  WebhookDelivery,
  WebhookCursor,
}) {
  private readonly key: Buffer

  constructor(container: Record<string, unknown>, options: Options) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    this.key = parseKey(options.encryptionKey, "tenant-webhooks encryptionKey")
  }

  /** A subscription and its secret; the secret is returned here only. */
  async subscribe(input: { url: string; events: WebhookEvent[]; created_by: string | null }) {
    const [, count] = await this.listAndCountWebhookSubscriptions({}, { select: ["id"], take: 1 })
    if (count >= MAX_SUBSCRIPTIONS) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "webhook.limit")
    }
    const id = generateEntityId(undefined, "whsub")
    const secret = newWebhookSecret()
    const subscription = await this.createWebhookSubscriptions({
      id,
      url: input.url,
      events: input.events,
      created_by: input.created_by,
      secret_encrypted: encryptPii(secret, this.key, contextOf(id)),
    })
    return { subscription, secret }
  }

  /** The secret a delivery is signed with. */
  secretOf(id: string, encrypted: string): string {
    return decryptPii(encrypted, this.key, contextOf(id))
  }

  /**
   * Queues an event for every active subscription that takes it; an event
   * queued before (same `event_id`) is left as it is.
   */
  @InjectTransactionManager()
  async enqueue(
    event: WebhookEvent,
    eventId: string,
    payload: Record<string, unknown>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `INSERT INTO webhook_delivery
         (id, subscription_id, event, event_id, payload, status, attempts, next_attempt_at, created_at, updated_at)
       SELECT ('whdel_' || replace(gen_random_uuid()::text, '-', '')), s.id, ?, ?, ?::jsonb, 'pending', 0, now(), now(), now()
         FROM webhook_subscription s
        WHERE s.deleted_at IS NULL AND s.status = 'active' AND ? = ANY(s.events)
       ON CONFLICT (subscription_id, event_id) WHERE deleted_at IS NULL DO NOTHING
       RETURNING id`,
      [event, eventId, JSON.stringify(payload), event]
    )) as unknown[]
    return rows.length
  }

  /**
   * Takes up to `limit` deliveries due now of active subscriptions, at most
   * `perSubscription` of each (a slow receiver never holds up the others),
   * in one statement: two workers never take the same one; a taken one is
   * due again only after the lease.
   */
  @InjectTransactionManager()
  async claimDue(
    limit: number,
    now: Date = new Date(),
    perSubscription = limit,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<DueDelivery[]> {
    const manager = sharedContext.transactionManager as Executor
    // The ranking reads without locks (a window function cannot lock); the
    // claim locks and checks each row again
    return (await manager.execute(
      `WITH ranked AS (
         SELECT d.id, row_number() OVER (PARTITION BY d.subscription_id
                                         ORDER BY d.next_attempt_at, d.id) AS n
           FROM webhook_delivery d
           JOIN webhook_subscription s ON s.id = d.subscription_id
          WHERE d.status = 'pending' AND d.next_attempt_at <= ? AND d.deleted_at IS NULL
            AND s.status = 'active' AND s.deleted_at IS NULL),
       due AS (
         SELECT d.id FROM webhook_delivery d JOIN ranked r ON r.id = d.id
          WHERE r.n <= ? AND d.status = 'pending' AND d.next_attempt_at <= ?
          ORDER BY d.next_attempt_at, d.id LIMIT ?
          FOR UPDATE OF d SKIP LOCKED)
       UPDATE webhook_delivery d SET next_attempt_at = ?, updated_at = now()
         FROM due, webhook_subscription s
        WHERE d.id = due.id AND s.id = d.subscription_id
       RETURNING d.id, d.subscription_id, d.event, d.payload, d.attempts, d.created_at,
                 s.url, s.secret_encrypted`,
      [now, perSubscription, now, limit, minutesFrom(now, LEASE_MINUTES)]
    )) as DueDelivery[]
  }

  async markDelivered(
    delivery: DueDelivery,
    answer: { status: number; duration_ms: number },
    now: Date = new Date()
  ): Promise<void> {
    await this.updateWebhookDeliveries({
      id: delivery.id,
      status: "delivered",
      attempts: delivery.attempts + 1,
      last_status: answer.status,
      last_duration_ms: answer.duration_ms,
      last_error: null,
      delivered_at: now,
    })
    await this.updateWebhookSubscriptions({ id: delivery.subscription_id, failure_streak: 0 })
  }

  /**
   * One more failed try: the delivery later again (or stopped after the
   * last), the subscription one failure further in its streak. Returns
   * whether this turned the subscription off.
   */
  @InjectTransactionManager()
  async markFailed(
    delivery: DueDelivery,
    failure: { status: number | null; duration_ms: number | null; code: string },
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ stopped: boolean; disabled: boolean }> {
    const tried = delivery.attempts + 1
    const stopped = tried >= MAX_ATTEMPTS
    await this.updateWebhookDeliveries(
      {
        id: delivery.id,
        attempts: tried,
        status: stopped ? "stopped" : "pending",
        next_attempt_at: minutesFrom(now, BACKOFF_MINUTES[tried - 1] ?? 1440),
        last_status: failure.status,
        last_duration_ms: failure.duration_ms,
        last_error: failure.code.slice(0, 120),
      },
      sharedContext
    )
    const manager = sharedContext.transactionManager as Executor
    // One statement: two failures at once still count twice, and turn it off once
    const [row] = (await manager.execute(
      `UPDATE webhook_subscription
          SET failure_streak = failure_streak + 1,
              status = CASE WHEN failure_streak + 1 >= ? THEN 'disabled' ELSE status END,
              disabled_at = CASE WHEN failure_streak + 1 >= ? AND status = 'active' THEN now() ELSE disabled_at END,
              updated_at = now()
        WHERE id = ? AND deleted_at IS NULL
       RETURNING status, (failure_streak = ?) AS just_disabled`,
      [MAX_STREAK, MAX_STREAK, delivery.subscription_id, MAX_STREAK]
    )) as { status: string; just_disabled: boolean }[]
    return { stopped, disabled: row?.status === "disabled" && row.just_disabled }
  }

  /** Turns a subscription on again, its streak cleared; its stopped deliveries stay as they are. */
  async reactivate(id: string): Promise<void> {
    await this.updateWebhookSubscriptions({
      id,
      status: "active",
      failure_streak: 0,
      disabled_at: null,
    })
  }

  /** Deliveries done with (sent or stopped) before `before`: the log keeps a month. */
  @InjectTransactionManager()
  async prune(before: Date, @MedusaContext() sharedContext: Context = {}): Promise<number> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `DELETE FROM webhook_delivery WHERE status <> 'pending' AND created_at < ? RETURNING id`,
      [before]
    )) as unknown[]
    return rows.length
  }

  /** How far the named feed was read. */
  async cursorOf(name: string): Promise<number> {
    const [row] = await this.listWebhookCursors({ name }, { take: 1, select: ["position"] })
    return row?.position ?? 0
  }

  async moveCursor(name: string, position: number): Promise<void> {
    const [row] = await this.listWebhookCursors({ name }, { take: 1, select: ["id"] })
    if (row) {
      await this.updateWebhookCursors({ id: row.id, position })
    } else {
      await this.createWebhookCursors({ name, position })
    }
  }

  /** Whether any active subscription takes an event: no feed is read for nobody. */
  @InjectManager()
  async anyTakes(event: WebhookEvent, @MedusaContext() sharedContext: Context = {}) {
    const manager = sharedContext.manager as Executor
    const [row] = (await manager.execute(
      `SELECT EXISTS (SELECT 1 FROM webhook_subscription
                       WHERE deleted_at IS NULL AND status = 'active' AND ? = ANY(events)) AS takes`,
      [event]
    )) as { takes: boolean }[]
    return row?.takes === true
  }
}

export default TenantWebhooksModuleService
