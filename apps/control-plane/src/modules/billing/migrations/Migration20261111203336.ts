import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111203336 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "subscription" drop constraint if exists "subscription_tenant_id_unique";`
    )
    this.addSql(
      `alter table if exists "reminder" drop constraint if exists "reminder_charge_id_kind_unique";`
    )
    this.addSql(
      `alter table if exists "charge" drop constraint if exists "charge_subscription_id_period_start_unique";`
    )
    this.addSql(
      `alter table if exists "billing_setting" drop constraint if exists "billing_setting_key_unique";`
    )
    this.addSql(
      `create table if not exists "billing_setting" ("id" text not null, "key" text check ("key" in ('payment_instruction')) not null, "value" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "billing_setting_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_billing_setting_deleted_at" ON "billing_setting" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_billing_setting_key_unique" ON "billing_setting" ("key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "charge" ("id" text not null, "subscription_id" text not null, "tenant_id" text not null, "period" text check ("period" in ('monthly', 'yearly')) not null, "period_start" text not null, "period_end" text not null, "amount" integer not null, "list_amount" integer not null, "currency_code" text not null default 'TRY', "due_on" text not null, "status" text check ("status" in ('open', 'paid', 'waived', 'void')) not null default 'open', "paid_on" text null, "method" text check ("method" in ('bank_transfer', 'card_manual', 'other')) null, "reference" text null, "settled_by" text null, "settled_at" timestamptz null, "settle_reason" text null, "amount_reason" text null, "invoice_number" text null, "invoice_ettn" text null, "invoice_pdf_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "charge_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_charge_deleted_at" ON "charge" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_charge_subscription_id_period_start_unique" ON "charge" ("subscription_id", "period_start") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_charge_tenant_id_due_on" ON "charge" ("tenant_id", "due_on") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_charge_status_due_on" ON "charge" ("status", "due_on") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "reminder" ("id" text not null, "charge_id" text not null, "tenant_id" text not null, "kind" text check ("kind" in ('before_14', 'before_7', 'before_3', 'before_1', 'due', 'overdue_3', 'restricted')) not null, "channel" text not null default 'email', "outcome" text check ("outcome" in ('pending', 'sent', 'skipped', 'failed')) not null default 'pending', "error_code" text null, "sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "reminder_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_reminder_deleted_at" ON "reminder" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_reminder_charge_id_kind_unique" ON "reminder" ("charge_id", "kind") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_reminder_tenant_id_created_at" ON "reminder" ("tenant_id", "created_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "subscription" ("id" text not null, "tenant_id" text not null, "package_id" text not null, "price" integer not null, "currency_code" text not null default 'TRY', "period" text check ("period" in ('monthly', 'yearly')) not null, "started_on" text not null, "trial_ends_on" text null, "current_period_start" text not null, "current_period_end" text not null, "anchor_day" integer not null, "grace_days" integer not null, "grace_days_override" integer null, "grace_override_reason" text null, "status" text check ("status" in ('trialing', 'active', 'past_due', 'restricted', 'cancelled')) not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "subscription_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_subscription_deleted_at" ON "subscription" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscription_tenant_id_unique" ON "subscription" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_subscription_status" ON "subscription" ("status") WHERE deleted_at IS NULL;`
    )

    // Ek C16 review: no negative money, whatever writes the row (hand-added: the DML has no checks)
    this.addSql(
      `alter table if exists "charge" add constraint "charge_amount_check" check ("amount" >= 0);`
    )
    this.addSql(
      `alter table if exists "charge" add constraint "charge_list_amount_check" check ("list_amount" >= 0);`
    )
    this.addSql(
      `alter table if exists "subscription" add constraint "subscription_price_check" check ("price" >= 0);`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "billing_setting" cascade;`)

    this.addSql(`drop table if exists "charge" cascade;`)

    this.addSql(`drop table if exists "reminder" cascade;`)

    this.addSql(`drop table if exists "subscription" cascade;`)
  }
}
