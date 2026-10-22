import Link from "next/link";
import { House, MapPin } from "lucide-react";
import { href } from "@/config/routes";
import { displayedVerification } from "@/domain/verification";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/verification";
import { CategoryVisual } from "@/components/content/category-visual";
import { displayAttributes } from "@/modules/listings/domain/attributes";
import { confirmationFreshness, freshnessLabel } from "../domain/freshness";
import type { RealEstateCardData } from "../server/queries";
import { CompareToggle } from "./compare";

const KEY_FACTS = new Set(["Type de bien", "Pièces", "Chambres", "Surface", "Meublé"]);

/** Carte d'un bien : faits déclarés, prix, fraîcheur ; « à reconfirmer » bien visible. */
export function PropertyCard({ property, now }: { property: RealEstateCardData; now: Date }) {
  const facts = displayAttributes("immobilier", property.attributes).filter((fact) => KEY_FACTS.has(fact.label));
  const freshness = confirmationFreshness(property.last_confirmed_at, property.published_at, now);
  const detail = href("listingDetail", { params: { slug: property.slug } });
  return (
    <article className="relative flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-focus">
      <CategoryVisual icon={property.category?.icon} fallback={House} tone="brand" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <VerificationBadge status={displayedVerification(property.verification_status, property.verified_at, now)} />
          {property.availability_status === "available" && <Badge tone="success">Disponible (déclaré)</Badge>}
          {property.availability_status === "reserved" && <Badge tone="warning">Réservé</Badge>}
        </div>
        <h3 className="line-clamp-2 font-bold leading-snug">
          <Link href={detail} className="after:absolute after:inset-0 hover:text-brand-700 focus-visible:outline-none">
            {property.title}
          </Link>
        </h3>
        {facts.length > 0 && (
          <p className="text-sm text-ink-muted">{facts.map((fact) => (fact.label === "Meublé" ? (fact.value === "Oui" ? "Meublé" : "Non meublé") : fact.value)).join(" · ")}</p>
        )}
        {property.neighborhood?.name && (
          <p className="flex items-center gap-1 text-sm text-ink-muted">
            <MapPin aria-hidden className="h-3.5 w-3.5" />
            {property.neighborhood.name}
          </p>
        )}
        <p className={freshness.status === "stale" ? "text-sm font-semibold text-yellow-800" : "text-xs text-ink-subtle"}>
          {freshnessLabel(freshness, Boolean(property.last_confirmed_at))}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="font-bold text-brand-800">{formatPrice(property.price, property.price_unit ?? "total")}</p>
          {/* Au-dessus du lien couvrant la carte. */}
          <div className="relative z-10">
            <CompareToggle slug={property.slug} title={property.title} />
          </div>
        </div>
      </div>
    </article>
  );
}
