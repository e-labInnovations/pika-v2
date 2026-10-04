type Named = { id: string | number; name?: string | null }

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)

/** Ids of the docs named in the text: the whole name, or any word of it (first names, "fuel"). */
export function mentioned(docs: Named[], text: string): string[] {
  const t = text.toLowerCase()
  const inText = new Set(words(text))
  return docs
    .filter((d) => {
      const name = (d.name ?? '').toLowerCase().trim()
      return (name.length >= 3 && t.includes(name)) || words(name).some((w) => inText.has(w))
    })
    .map((d) => String(d.id))
}
