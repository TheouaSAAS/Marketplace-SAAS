import { jsonLd } from "../domain/structured-data";

/** Données structurées schema.org (sérialisation sûre, même méthode que le fil d'Ariane). */
export function ListingJsonLd({ items }: { items: Record<string, unknown>[] }) {
  return items.map((data, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />);
}
