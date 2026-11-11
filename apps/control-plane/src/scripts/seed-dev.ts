import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isValidVkn } from "@qticaret/server-kit"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { isLocalEnv, parseEnv } from "../lib/env"
import { platformHostname } from "../lib/tenants/hostname"
import { CP_AUDIT_MODULE } from "../modules/cp-audit"
import type CpAuditModuleService from "../modules/cp-audit/service"
import type { CompanyFields, ContactFields } from "../modules/tenants/types"
import { plansIn, tenantsIn } from "../workflows/modules"
import { createPackageWorkflow } from "../workflows/plans/packages"
import type { CreatePackageInput } from "../workflows/plans/packages"
import { createTenantWorkflow } from "../workflows/tenants/create-tenant"
import { addDomainWorkflow } from "../workflows/tenants/tenant-domains"

/**
 * The control plane's development records (C7): two packages and three
 * shops, the first the platform's first real customer (My L'arte,
 * mylarte.com) with what is not known yet left blank. Only on a
 * developer's machine; idempotent (a package or shop already there is
 * skipped). `pnpm --filter control-plane cp:seed-dev`
 */

const PACKAGES: CreatePackageInput[] = [
  {
    code: "baslangic",
    name: "Başlangıç",
    price: 49_000,
    period: "monthly",
    trial_days: 14,
    grace_days: 7,
    limits: {
      products: 500,
      orders_per_month: 1_000,
      staff: 2,
      storage_mb: 2_048,
      llm_credits_per_month: 200,
      custom_domains: 1,
    },
  },
  {
    code: "profesyonel",
    name: "Profesyonel",
    price: 149_000,
    period: "monthly",
    trial_days: 14,
    grace_days: 7,
    limits: {
      products: 5_000,
      orders_per_month: 10_000,
      staff: 10,
      storage_mb: 20_480,
      llm_credits_per_month: 2_000,
      custom_domains: 3,
    },
  },
]

/** A VKN with its check digit after nine given digits. */
function vkn(first9: string): string {
  const found = Array.from({ length: 10 }, (_, last) => first9 + String(last)).find(isValidVkn)
  return found ?? ""
}

interface ShopSeed {
  slug: string
  name: string
  package: string
  status: TenantStatus
  domain?: string
  company?: Partial<CompanyFields>
  contacts?: Omit<ContactFields, "is_primary_billing">[]
  note?: string
}

const SHOPS: ShopSeed[] = [
  {
    slug: "mylarte",
    name: "My L'arte",
    package: "profesyonel",
    status: "active",
    domain: "mylarte.com",
    note: "Platformun ilk mağazası: bıçak ve el yapımı ürünler. Firma ve yetkili bilgileri sahibinden gelecek.",
  },
  {
    slug: "egezeytin",
    name: "Ege Zeytin Atölyesi",
    package: "baslangic",
    status: "active",
    company: {
      kind: "company",
      legal_name: "Ege Zeytin Gıda Tarım Sanayi ve Ticaret Ltd. Şti.",
      tax_office: "Ayvalık",
      tax_number: vkn("327105864"),
      address_line: "Sahil Kent Mah. Atatürk Cad. No: 41",
      district: "Ayvalık",
      city: "Balıkesir",
      postal_code: "10400",
    },
    contacts: [
      {
        name: "Selin Aydın",
        role: "owner",
        email: "selin@egezeytin.com.tr",
        phone: "+905324182763",
      },
      { name: "Murat Kaya", role: "technical", email: "murat@egezeytin.com.tr", phone: null },
    ],
  },
  {
    slug: "kahveduragi",
    name: "Kahve Durağı",
    package: "baslangic",
    status: "provisioning",
    company: {
      kind: "sole_proprietor",
      legal_name: "Emre Şahin",
      tax_office: "Çankaya",
      address_line: "Kızılay Mah. Ziya Gökalp Cad. No: 18/3",
      district: "Çankaya",
      city: "Ankara",
      postal_code: "06420",
    },
    contacts: [
      { name: "Emre Şahin", role: "owner", email: "emre@kahveduragi.com", phone: "+905051937420" },
    ],
  },
]

async function seedPackages(container: MedusaContainer): Promise<Map<string, string>> {
  const plans = plansIn(container)
  const existing = new Map((await plans.packages()).map((each) => [each.code, each.id]))
  for (const pkg of PACKAGES.filter((each) => !existing.has(each.code))) {
    const { result } = await createPackageWorkflow(container).run({ input: pkg })
    existing.set(pkg.code, result.id)
  }
  return existing
}

async function seedShop(container: MedusaContainer, shop: ShopSeed, packageId: string | null) {
  const tenants = tenantsIn(container)
  const { result: tenant } = await createTenantWorkflow(container).run({
    input: {
      slug: shop.slug,
      name: shop.name,
      hostname: platformHostname(shop.slug, parseEnv().PLATFORM_DOMAIN),
      created_by: null,
      package_id: packageId,
    },
  })
  if (shop.domain) {
    await addDomainWorkflow(container).run({
      input: { tenant_id: tenant.id, hostname: shop.domain },
    })
  }
  if (shop.company) {
    await tenants.saveCompany(tenant.id, shop.company)
  }
  for (const contact of shop.contacts ?? []) {
    await tenants.saveContact(tenant.id, null, contact)
  }
  if (shop.note) {
    await tenants.createTenantNotes([
      { tenant_id: tenant.id, body: shop.note, pinned: true, author_id: null },
    ])
  }
  // A shop already running when the control plane came: brought in, not set up
  if (shop.status === "active") {
    await tenants.changeStatus(tenant.id, "active", { reason_code: "imported", actor: "system" })
  }
  return tenant.id
}

export default async function seedDev({ container }: ExecArgs): Promise<void> {
  if (!isLocalEnv(parseEnv())) {
    throw new Error("seed-dev: only on a developer's machine")
  }
  const packages = await seedPackages(container)
  const taken = new Set(
    (await tenantsIn(container).listTenants({}, { select: ["slug"] })).map((t) => t.slug)
  )
  const made: string[] = []
  for (const shop of SHOPS.filter((each) => !taken.has(each.slug))) {
    made.push(await seedShop(container, shop, packages.get(shop.package) ?? null))
  }
  await container.resolve<CpAuditModuleService>(CP_AUDIT_MODULE).record({
    kind: "system",
    action: "cp.seed_dev",
    actor_type: "system",
    changes: { packages: PACKAGES.length, shops: made.length },
  })
  container
    .resolve(ContainerRegistrationKeys.LOGGER)
    .info(`seed-dev: ${String(made.length)} shop(s) added, packages ready`)
}
