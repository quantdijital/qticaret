import { useQuery } from "@tanstack/react-query"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { Table, TableBody, TableCell, TableRow } from "@qticaret/admin-ui/ui/table"
import { OWN_SCENES_MAX, aiScenesQuery, useSaveAiScenes } from "@/features/ai/api/scenes"
import type { OwnScene, OwnSceneInput } from "@/features/ai/api/scenes"
import { useCan } from "@/features/auth/api/staff"
import { AiSceneDialog } from "@/features/settings/components/ai-scene-dialog"
import { errorText } from "@/lib/errors"

const C = "ai.scenes"

/**
 * Settings › Yapay zekâ › Sahneler (docs/22 Aşama 7): the shop's own
 * scenes for "Sahneye yerleştir", a compact row each (name, a line of its
 * description, ⋯ to change or delete), "Sahne ekle" in the header, and
 * one switch under them for the sector pack's starting scenes. Owner and
 * admin change them (`settings`); others see the list.
 */
export function AiScenesCard() {
  const { t } = useTranslation()
  const mayChange = useCan("settings")
  const query = useQuery(aiScenesQuery())
  const save = useSaveAiScenes()
  const [editing, setEditing] = useState<OwnScene | "new" | null>(null)
  const [removing, setRemoving] = useState<OwnScene | null>(null)
  const hintId = useId()
  const values = query.data?.values
  const scenes = values?.scenes ?? []
  const full = scenes.length >= OWN_SCENES_MAX

  const persist = async (next: Partial<{ show_pack_scenes: boolean; scenes: OwnSceneInput[] }>) => {
    try {
      await save.mutateAsync(next)
      toast.success(t("settings.saved"))
      return true
    } catch (failure) {
      toast.error(errorText(t, failure))
      return false
    }
  }
  const saveScene = (fields: { name: string; prompt: string }) => {
    const target = editing === "new" ? null : editing
    const next: OwnSceneInput[] = target
      ? scenes.map((each) => (each.id === target.id ? { ...each, ...fields } : each))
      : [...scenes, fields]
    return persist({ scenes: next })
  }

  return (
    <SectionCard
      title={t(`${C}.title`)}
      description={t(mayChange ? `${C}.description` : `${C}.readOnly`, {
        count: scenes.length,
        max: OWN_SCENES_MAX,
      })}
      action={
        mayChange ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!values || full}
            title={full ? t(`${C}.full`, { max: OWN_SCENES_MAX }) : undefined}
            onClick={() => {
              setEditing("new")
            }}
          >
            <Plus />
            {t(`${C}.add`)}
          </Button>
        ) : null
      }
      flush
    >
      {query.isError ? (
        <div className="px-5 pb-4">
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : !values ? (
        <div className="px-5 pb-4">
          <LoadingRows rows={2} />
        </div>
      ) : (
        <>
          <Table aria-label={t(`${C}.title`)}>
            <TableBody>
              {scenes.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell className="px-5 py-3 text-[13px] whitespace-normal text-muted-foreground">
                    {t(`${C}.empty`)}
                  </TableCell>
                </TableRow>
              ) : (
                scenes.map((scene) => (
                  <TableRow key={scene.id} className="sm:h-14">
                    <TableCell className="w-full max-w-0 py-2 pl-5">
                      <div className="truncate font-medium">{scene.name}</div>
                      <div className="truncate text-[13px] text-muted-foreground">
                        {scene.prompt}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 pr-5 text-right">
                      {mayChange ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={save.isPending}
                              aria-label={t(`${C}.actionsFor`, { name: scene.name })}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(scene)
                              }}
                            >
                              <Pencil />
                              {t(`${C}.edit`)}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setRemoving(scene)
                              }}
                            >
                              <Trash2 />
                              {t(`${C}.remove`)}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex min-h-14 items-center gap-4 border-t px-5 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
              {t(`${C}.showPacks`)}
              <InfoTip name={t(`${C}.showPacks`)} hintId={hintId} hint={t(`${C}.showPacksHint`)} />
              <HiddenHint id={hintId}>{t(`${C}.showPacksHint`)}</HiddenHint>
            </div>
            <Switch
              aria-label={t(`${C}.showPacks`)}
              aria-describedby={hintId}
              checked={values.show_pack_scenes}
              disabled={!mayChange || save.isPending}
              onCheckedChange={(next) => {
                void persist({ show_pack_scenes: next })
              }}
            />
          </div>
        </>
      )}
      {editing !== null ? (
        <AiSceneDialog
          scene={editing === "new" ? null : editing}
          saving={save.isPending}
          onSave={saveScene}
          onClose={() => {
            setEditing(null)
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={t(`${C}.removeTitle`, { name: removing?.name ?? "" })}
        description={t(`${C}.removeDescription`)}
        confirmLabel={t(`${C}.remove`)}
        destructive
        onConfirm={() => {
          const gone = removing
          if (gone) {
            void persist({ scenes: scenes.filter((each) => each.id !== gone.id) })
          }
        }}
      />
    </SectionCard>
  )
}
