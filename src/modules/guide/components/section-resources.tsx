import Link from "next/link";
import { ArrowRight, Map } from "lucide-react";
import { href, isLive } from "@/config/routes";
import { logger } from "@/lib/logger";
import { listCategories } from "@/server/repositories/categories";
import { resourceHref } from "../domain/resources";
import { countCategoryContents, type GuideSection } from "../server/queries";

/**
 * « Sur le site » : les catégories reliées à la rubrique, avec le nombre de
 * contenus publiés. Une catégorie sans contenu est annoncée comme telle, sans lien.
 */
export async function SectionResources({ section, cityId }: { section: GuideSection; cityId: string }) {
  if (section.category_slugs.length === 0) return null;
  let rows: { slug: string; name: string; link: string; total: number }[];
  try {
    const [categories, counts] = await Promise.all([listCategories(), countCategoryContents(cityId, section.category_slugs)]);
    rows = section.category_slugs.flatMap((slug) => {
      const category = categories.find((item) => item.slug === slug);
      return category ? [{ slug, name: category.name, link: resourceHref(category, categories), total: counts.get(slug) ?? 0 }] : [];
    });
  } catch (error) {
    logger.warn("Ressources du guide indisponibles", { module: "guide", error });
    return null;
  }
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="sur-le-site" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h2 id="sur-le-site" className="text-lg font-bold">
        Sur le site
      </h2>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((row) => (
          <li key={row.slug}>
            {row.total > 0 ? (
              <Link href={row.link} className="inline-flex min-h-9 items-center gap-1 font-medium text-brand-700 hover:underline">
                {row.name} · {row.total} contenu{row.total > 1 ? "s" : ""}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex min-h-9 items-center text-ink-muted">{row.name} · aucun contenu publié pour l’instant</span>
            )}
          </li>
        ))}
      </ul>
      {isLive("map") && rows.some((row) => row.total > 0) && (
        <Link href={href("map")} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <Map aria-hidden className="h-4 w-4" />
          Voir sur la carte
        </Link>
      )}
    </section>
  );
}
