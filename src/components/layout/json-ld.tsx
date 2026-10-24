import { serializeJsonLd } from "@/lib/seo";

/** Données structurées schema.org ; rien si la donnée n'est pas assez fiable (null). */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
