interface Named {
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
}

/** The name a person goes by in the panel: their own, their company's, or none. */
export function customerName(customer: Named): string | null {
  const own = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim()
  if (own) {
    return own
  }
  const company = customer.company_name?.trim()
  return company?.length ? company : null
}

/** Two letters for the avatar; the e-mail's first letter when there is no name. */
export function initialsOf(customer: Named): string {
  const name = customerName(customer)
  if (!name) {
    return (customer.email?.slice(0, 1) ?? "?").toLocaleUpperCase("tr")
  }
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toLocaleUpperCase("tr"))
    .join("")
}
