import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { defaultWizardValues } from "../schema"
import type { WizardValues } from "../schema"
import { missingRequired } from "../wizard-template"
import { AttributesSection } from "./attributes-section"

/**
 * O1 (PR #200 security review): a required attribute left empty is marked
 * under its own field before the product is created, and the mark goes
 * once the field is filled.
 */

const TEMPLATE = {
  id: "atpl_1",
  name: "Kupa",
  definitions: [
    {
      id: "def_1",
      key: "material",
      label: "Malzeme",
      type: "text",
      unit: null,
      options: null,
      rank: 0,
      is_required: true,
      is_filterable: false,
      is_seo_highlight: false,
      scope: "product",
      option_title: null,
      varies_by: null,
    },
  ],
}

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: () => Promise.resolve({ attribute_templates: [TEMPLATE] }) } },
}))

function renderSection() {
  let form: UseFormReturn<WizardValues> | undefined
  function Form() {
    form = useForm<WizardValues>({
      defaultValues: { ...defaultWizardValues(), template_id: "atpl_1" },
    })
    return (
      <FormProvider {...form}>
        <AttributesSection />
      </FormProvider>
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Form />
    </QueryClientProvider>
  )
  return () => {
    if (!form) {
      throw new Error("no form")
    }
    return form
  }
}

describe("the new product's attributes", () => {
  it("marks a required one left empty under its field, until it is filled", async () => {
    const form = renderSection()
    const input = await screen.findByLabelText(/Malzeme/)
    const missing = missingRequired(
      TEMPLATE as Parameters<typeof missingRequired>[0],
      form().getValues("attributes")
    )
    expect(missing).toEqual(["material"])
    act(() => {
      form().setError("attributes.material", { message: "products.errors.attributeRequired" })
    })
    expect(await screen.findByText(/şablonda zorunlu/)).toBeInTheDocument()
    await userEvent.setup().type(input, "Seramik")
    expect(screen.queryByText(/şablonda zorunlu/)).not.toBeInTheDocument()
    expect(form().getValues("attributes")).toEqual({ material: "Seramik" })
  })
})
