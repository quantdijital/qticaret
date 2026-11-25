import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * The AI platform credits (adr/0085 §1): wallets, the append-only ledger,
 * the charged operations and the top-up requests, with the checks that
 * keep money whole (no negative balance, no row of 0 credits) and a
 * trigger refusing a ledger row's update or delete. Down drops them all.
 */
export class Migration20261125011726 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "ai_credit_wallet" drop constraint if exists "ai_credit_wallet_tenant_id_unique";`
    )
    this.addSql(
      `alter table if exists "ai_credit_order" drop constraint if exists "ai_credit_order_tenant_id_unique";`
    )
    this.addSql(
      `alter table if exists "ai_credit_operation" drop constraint if exists "ai_credit_operation_tenant_id_operation_id_unique";`
    )
    this.addSql(
      `alter table if exists "ai_credit_entry" drop constraint if exists "ai_credit_entry_grant_ref_unique";`
    )
    this.addSql(
      `create table if not exists "ai_credit_entry" ("id" text not null, "tenant_id" text not null, "kind" text check ("kind" in ('grant_purchase', 'grant_plan_monthly', 'spend', 'release', 'expire', 'adjust')) not null, "amount" integer not null, "bucket" text check ("bucket" in ('plan', 'purchased')) not null, "operation_id" text null, "grant_ref" text null, "note" text null, "actor" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_credit_entry_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_entry_deleted_at" ON "ai_credit_entry" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_entry_tenant_id_created_at" ON "ai_credit_entry" ("tenant_id", "created_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_entry_tenant_id_operation_id" ON "ai_credit_entry" ("tenant_id", "operation_id") WHERE operation_id IS NOT NULL AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_credit_entry_grant_ref_unique" ON "ai_credit_entry" ("grant_ref") WHERE grant_ref IS NOT NULL AND deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "ai_credit_operation" ("id" text not null, "tenant_id" text not null, "operation_id" text not null, "task" text not null, "capability" text not null, "credits" integer not null, "plan_credits" integer not null, "purchased_credits" integer not null, "calls" integer not null default 1, "status" text check ("status" in ('open', 'charged', 'released')) not null default 'open', "service" text null, "model" text null, "input_tokens" integer null, "output_tokens" integer null, "images" integer null, "estimated_cost_micros" integer null, "closed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_credit_operation_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_operation_deleted_at" ON "ai_credit_operation" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_credit_operation_tenant_id_operation_id_unique" ON "ai_credit_operation" ("tenant_id", "operation_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_operation_status_created_at" ON "ai_credit_operation" ("status", "created_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "ai_credit_order" ("id" text not null, "tenant_id" text not null, "pack_id" text not null, "pack_name" text not null, "credits" integer not null, "amount" integer not null, "currency" text not null, "status" text check ("status" in ('pending', 'paid', 'cancelled')) not null default 'pending', "method" text check ("method" in ('bank_transfer', 'card_manual', 'other')) null, "reference" text null, "requested_by" text null, "decided_by" text null, "requested_at" timestamptz not null, "decided_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_credit_order_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_order_deleted_at" ON "ai_credit_order" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_credit_order_tenant_id_unique" ON "ai_credit_order" ("tenant_id") WHERE status = 'pending' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_order_status_requested_at" ON "ai_credit_order" ("status", "requested_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_order_tenant_id_requested_at" ON "ai_credit_order" ("tenant_id", "requested_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "ai_credit_wallet" ("id" text not null, "tenant_id" text not null, "plan_balance" integer not null default 0, "plan_period" text null, "purchased_balance" integer not null default 0, "purchased_expires_at" timestamptz null, "daily_cap" integer null, "spent_today" integer not null default 0, "spent_day" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_credit_wallet_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_wallet_deleted_at" ON "ai_credit_wallet" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_credit_wallet_tenant_id_unique" ON "ai_credit_wallet" ("tenant_id") WHERE deleted_at IS NULL;`
    )

    // adr/0085 (hand-added: the DML has no checks): no balance below 0, no
    // ledger row of 0 credits, an operation's buckets add up to its credits,
    // whatever writes the row
    this.addSql(
      `alter table if exists "ai_credit_wallet" add constraint "ai_credit_wallet_plan_balance_check" check ("plan_balance" >= 0);`
    )
    this.addSql(
      `alter table if exists "ai_credit_wallet" add constraint "ai_credit_wallet_purchased_balance_check" check ("purchased_balance" >= 0);`
    )
    this.addSql(
      `alter table if exists "ai_credit_wallet" add constraint "ai_credit_wallet_spent_today_check" check ("spent_today" >= 0);`
    )
    this.addSql(
      `alter table if exists "ai_credit_wallet" add constraint "ai_credit_wallet_daily_cap_check" check ("daily_cap" is null or "daily_cap" >= 0);`
    )
    this.addSql(
      `alter table if exists "ai_credit_entry" add constraint "ai_credit_entry_amount_check" check ("amount" <> 0);`
    )
    this.addSql(
      `alter table if exists "ai_credit_operation" add constraint "ai_credit_operation_credits_check" check ("plan_credits" >= 0 and "purchased_credits" >= 0 and "plan_credits" + "purchased_credits" = "credits");`
    )
    this.addSql(
      `alter table if exists "ai_credit_operation" add constraint "ai_credit_operation_calls_check" check ("calls" >= 1);`
    )
    this.addSql(
      `alter table if exists "ai_credit_order" add constraint "ai_credit_order_credits_check" check ("credits" > 0 and "amount" >= 0);`
    )

    // The ledger is append-only for every writer, the module's own included
    // (a row is never changed or removed; TRUNCATE, a whole table's reset, is not a row's)
    this.addSql(
      `create or replace function "ai_credit_entry_append_only"() returns trigger language plpgsql as $$ begin raise exception 'ai_credit_entry is append-only' using errcode = 'restrict_violation'; end; $$;`
    )
    this.addSql(
      `create trigger "ai_credit_entry_append_only" before update or delete on "ai_credit_entry" for each row execute function "ai_credit_entry_append_only"();`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop trigger if exists "ai_credit_entry_append_only" on "ai_credit_entry";`)
    this.addSql(`drop function if exists "ai_credit_entry_append_only"();`)
    this.addSql(`drop table if exists "ai_credit_entry" cascade;`)

    this.addSql(`drop table if exists "ai_credit_operation" cascade;`)

    this.addSql(`drop table if exists "ai_credit_order" cascade;`)

    this.addSql(`drop table if exists "ai_credit_wallet" cascade;`)
  }
}
