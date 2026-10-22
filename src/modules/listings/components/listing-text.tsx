/** Description telle que rédigée par l'annonceur (texte brut, retours à la ligne conservés). */
export function ListingDescription({ text }: { text: string }) {
  return (
    <section aria-labelledby="description" className="flex flex-col gap-2">
      <h2 id="description" className="text-xl font-bold">
        Description
      </h2>
      <p className="whitespace-pre-line break-words leading-relaxed">{text}</p>
    </section>
  );
}

/** Caractéristiques connues de la catégorie (voir `displayAttributes`). */
export function ListingAttributes({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="caracteristiques" className="flex flex-col gap-2">
      <h2 id="caracteristiques" className="text-xl font-bold">
        Caractéristiques
      </h2>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between gap-3 border-b border-border py-2">
            <dt className="text-ink-muted">{item.label}</dt>
            <dd className="text-right font-semibold">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
