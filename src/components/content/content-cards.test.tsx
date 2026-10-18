import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventCardData } from "@/modules/events/server/queries";
import type { ListingCardData } from "@/modules/listings/server/queries";
import type { PlaceCardData } from "@/modules/places/server/queries";
import { EventCard, ListingCard, PlaceCard } from "./content-cards";

const now = new Date("2026-10-21T10:00:00Z");

const listing: ListingCardData = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "studio",
  title: "Studio meublé",
  price: null,
  price_unit: null,
  availability_status: "available",
  verification_status: "pending_validation",
  verified_at: null,
  published_at: "2026-10-17T08:00:00Z",
  category: { name: "Location", slug: "immobilier-location", icon: null },
  neighborhood: { name: "Cité" },
};

describe("ListingCard", () => {
  it("n'invente jamais un prix absent et signale une disponibilité seulement déclarée", () => {
    render(<ListingCard listing={listing} now={now} />);
    expect(screen.getByText("Prix non communiqué")).toBeInTheDocument();
    expect(screen.getByText("Disponible (déclaré)")).toBeInTheDocument();
    expect(screen.getByText("À vérifier")).toBeInTheDocument();
    expect(screen.getByText("Location · Cité")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Studio meublé");
  });

  it("formate un prix mensuel en FCFA", () => {
    render(<ListingCard listing={{ ...listing, price: 150000, price_unit: "par_mois" }} now={now} />);
    expect(screen.getByText(/150\s000 FCFA \/ mois/)).toBeInTheDocument();
  });

  it("présente une vérification expirée comme « À vérifier »", () => {
    render(<ListingCard listing={{ ...listing, verification_status: "verified", verified_at: "2024-01-01T00:00:00Z" }} now={now} />);
    expect(screen.queryByText("Vérifié")).not.toBeInTheDocument();
    expect(screen.getByText("À vérifier")).toBeInTheDocument();
  });

  it("étiquette clairement un exemple", () => {
    render(<ListingCard listing={{ ...listing, verification_status: "placeholder" }} now={now} />);
    expect(screen.getByText("Exemple · à valider localement")).toBeInTheDocument();
  });
});

describe("PlaceCard", () => {
  it("affiche un lieu vérifié avec sa catégorie et son quartier", () => {
    const place: PlaceCardData = {
      id: "00000000-0000-4000-8000-000000000002",
      slug: "maquis",
      name: "Maquis du port",
      summary: "Cuisine locale.",
      kind: "etablissement",
      verification_status: "verified",
      verified_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      category: { name: "Restaurants", slug: "restaurants-gastronomie", icon: "utensils", family: "decouvrir" },
      neighborhood: null,
    };
    render(<PlaceCard place={place} now={now} />);
    expect(screen.getByText("Vérifié")).toBeInTheDocument();
    expect(screen.getByText("Restaurants")).toBeInTheDocument();
  });
});

describe("EventCard", () => {
  const event: EventCardData = {
    id: "00000000-0000-4000-8000-000000000003",
    slug: "concert",
    title: "Concert sur la plage",
    starts_at: "2026-10-24T19:00:00Z",
    ends_at: null,
    schedule_status: "scheduled",
    is_free: true,
    price_min: null,
    organizer_name: null,
    verification_status: "pending_validation",
    verified_at: null,
    category: { name: "Concerts et spectacles" },
    neighborhood: null,
  };

  it("indique le moment et la gratuité", () => {
    render(<EventCard event={event} now={now} />);
    expect(screen.getByText("Ce week-end")).toBeInTheDocument();
    expect(screen.getByText("Gratuit")).toBeInTheDocument();
    expect(screen.getByText(/samedi 24 octobre à 19:00/i)).toBeInTheDocument();
  });

  it("signale clairement une annulation", () => {
    render(<EventCard event={{ ...event, schedule_status: "cancelled" }} now={now} />);
    expect(screen.getByText("Annulé")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("line-through");
  });

  it("n'invente pas de tarif", () => {
    render(<EventCard event={{ ...event, is_free: false }} now={now} />);
    expect(screen.getByText("Tarif non communiqué")).toBeInTheDocument();
  });
});
