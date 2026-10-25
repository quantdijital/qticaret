import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Table, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "../../../components/page-states"
import type { AttributeTemplate } from "../../../lib/attributes"
import { errorText } from "../../../lib/errors"
import { sdk } from "../../../lib/sdk"
import { TemplateEditor } from "./template-editor"
import { TEMPLATES_KEY } from "./use-template-save"

/**
 * Settings > Product attributes (F2.4, adr/0013): the templates products
 * take their attributes from. A template in use cannot be deleted.
 */
function AttributeTemplatesPage() {
  const { t } = useTranslation()
  const prompt = usePrompt()
  const client = useQueryClient()
  const [editing, setEditing] = useState<{ template?: AttributeTemplate } | null>(null)
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () =>
      sdk.client.fetch<{ attribute_templates: AttributeTemplate[] }>("/admin/attribute-templates", {
        query: { limit: 100 },
      }),
  })
  const remove = useMutation({
    mutationFn: (template: AttributeTemplate) =>
      sdk.client.fetch(`/admin/attribute-templates/${encodeURIComponent(template.id)}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      toast.success(t("qticaret.attributeTemplates.deleted"))
      await client.invalidateQueries({ queryKey: TEMPLATES_KEY })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })

  const confirmDelete = async (template: AttributeTemplate) => {
    const confirmed = await prompt({
      title: t("qticaret.attributeTemplates.deleteTitle"),
      description: t("qticaret.attributeTemplates.deleteDescription", { name: template.name }),
      confirmText: t("qticaret.common.delete"),
      cancelText: t("qticaret.common.cancel"),
    })
    if (confirmed) {
      remove.mutate(template)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">{t("qticaret.attributeTemplates.title")}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {t("qticaret.attributeTemplates.subtitle")}
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          onClick={() => {
            setEditing({})
          }}
        >
          {t("qticaret.attributeTemplates.create")}
        </Button>
      </div>
      <div className="px-6 py-4">
        {isPending ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
        ) : data.attribute_templates.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            {t("qticaret.attributeTemplates.empty")}
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t("qticaret.attributeTemplates.name")}</Table.HeaderCell>
                <Table.HeaderCell>{t("qticaret.attributeTemplates.handle")}</Table.HeaderCell>
                <Table.HeaderCell>{t("qticaret.attributeTemplates.attributes")}</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.attribute_templates.map((template) => (
                <Table.Row key={template.id}>
                  <Table.Cell>{template.name}</Table.Cell>
                  <Table.Cell>{template.handle}</Table.Cell>
                  <Table.Cell>{template.definitions.length}</Table.Cell>
                  <Table.Cell className="flex justify-end gap-2">
                    <Button
                      size="small"
                      variant="transparent"
                      onClick={() => {
                        setEditing({ template })
                      }}
                    >
                      {t("qticaret.common.edit")}
                    </Button>
                    <Button
                      size="small"
                      variant="transparent"
                      className="text-ui-fg-error"
                      onClick={() => void confirmDelete(template)}
                    >
                      {t("qticaret.common.delete")}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
      <TemplateEditor
        template={editing?.template}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
      />
    </Container>
  )
}

// The label is a key in the namespace our strings merge into (src/admin/i18n)
export const config = defineRouteConfig({
  label: "qticaret.attributeTemplates.title",
  translationNs: "translation",
})

export default AttributeTemplatesPage
