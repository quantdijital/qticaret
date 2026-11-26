import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { beginSave } from "./forms"

interface Values {
  name: string
  weight: string
  tags: string[]
}
const stored: Values = { name: "Bıçak", weight: "1", tags: ["a"] }

// A card as the panel draws it: the server's values, a refetch not wiping what is
// typed, its dirty state read while drawing (RHF tracks only what is read)
function useCard({ saved }: { saved: Values }) {
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const { isDirty, dirtyFields } = form.formState
  return Object.assign(form, { isDirty, dirtyFields })
}
const card = (initial: Values = stored) => renderHook(useCard, { initialProps: { saved: initial } })

describe("beginSave: a save keeps what is typed while it is on its way", () => {
  it("ends clean when nothing changed meanwhile", () => {
    const { result } = card()
    act(() => {
      result.current.setValue("weight", "2", { shouldDirty: true })
    })
    const settle = beginSave(result.current)
    act(() => {
      settle(result.current.getValues())
    })
    expect(result.current.getValues()).toEqual({ ...stored, weight: "2" })
    expect(result.current.isDirty).toBe(false)
  })

  it("keeps a field edited during the save and leaves the form dirty", () => {
    const { result } = card()
    act(() => {
      result.current.setValue("weight", "2", { shouldDirty: true })
    })
    const settle = beginSave(result.current)
    const sent = { ...result.current.getValues() }
    act(() => {
      result.current.setValue("name", "Çakı", { shouldDirty: true })
    })
    act(() => {
      settle(sent)
    })
    expect(result.current.getValues()).toEqual({ ...stored, weight: "2", name: "Çakı" })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.dirtyFields).toEqual({ name: true })
    // The baseline is what was saved: undoing puts back the sent name, not the old one
    act(() => {
      result.current.setValue("name", "Bıçak", { shouldDirty: true })
    })
    expect(result.current.isDirty).toBe(false)
  })

  it("keeps a list edited during the save", () => {
    const { result } = card()
    const settle = beginSave(result.current)
    act(() => {
      result.current.setValue("tags", ["a", "b"], { shouldDirty: true })
    })
    act(() => {
      settle(stored)
    })
    expect(result.current.getValues("tags")).toEqual(["a", "b"])
    expect(result.current.isDirty).toBe(true)
  })

  it("still holds the edit when the refetched values arrive after it settled", () => {
    const { result, rerender } = card()
    act(() => {
      result.current.setValue("weight", "2", { shouldDirty: true })
    })
    const settle = beginSave(result.current)
    const sent = { ...result.current.getValues() }
    act(() => {
      result.current.setValue("name", "Çakı", { shouldDirty: true })
    })
    act(() => {
      settle(sent)
    })
    rerender({ saved: sent })
    expect(result.current.getValues()).toEqual({ ...stored, weight: "2", name: "Çakı" })
    expect(result.current.isDirty).toBe(true)
  })

  it("still holds the edit when the refetched values arrived before it settled", () => {
    const { result, rerender } = card()
    act(() => {
      result.current.setValue("weight", "2", { shouldDirty: true })
    })
    const settle = beginSave(result.current)
    const sent = { ...result.current.getValues() }
    act(() => {
      result.current.setValue("name", "Çakı", { shouldDirty: true })
    })
    rerender({ saved: sent })
    act(() => {
      settle(sent)
    })
    expect(result.current.getValues()).toEqual({ ...stored, weight: "2", name: "Çakı" })
    expect(result.current.isDirty).toBe(true)
  })

  it("puts the saved values in when the server answered with its own (no edits meanwhile)", () => {
    const { result } = card()
    act(() => {
      result.current.setValue("name", "  Çakı ", { shouldDirty: true })
    })
    const settle = beginSave(result.current)
    act(() => {
      settle({ ...stored, name: "Çakı" })
    })
    expect(result.current.getValues("name")).toBe("Çakı")
    expect(result.current.isDirty).toBe(false)
  })
})
