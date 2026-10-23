import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BusinessCardData } from "@/modules/businesses/server/queries";
import type { EventCardData } from "@/modules/events/server/queries";
import type { GuideCardData } from "@/modules/guide/server/queries";
import type { ListingCardData } from "@/modules/listings/server/queries";
import type { PlaceCardData } from "@/modules/places/server/queries";
import { BusinessCard, EventCard, GuideCard, ListingCard, PlaceCard } from "./content-cards";

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
  last_confirmed_at: null,
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
    published_at: "2026-10-10T08:00:00Z",
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

  it("une vérification d'événement expire après 30 jours", () => {
    render(<EventCard event={{ ...event, verification_status: "verified", verified_at: "2026-09-01T00:00:00Z" }} now={now} />);
    expect(screen.getByText("À vérifier")).toBeInTheDocument();
  });
});

describe("BusinessCard et GuideCard", () => {
  it("affiche une fiche professionnelle sans coordonnées", () => {
    const business: BusinessCardData = {
      id: "00000000-0000-4000-8000-000000000004",
      slug: "electricite-du-port",
      name: "Électricité du port",
      description: "Dépannage et installation.",
      verification_status: "pending_validation",
      verified_at: null,
      updated_at: "2026-10-01T00:00:00Z",
      services: ["Dépannage"],
      service_area: null,
      accepts_quotes: true,
      availability_note: null,
      availability_declared_at: null,
      category: { name: "Artisans et dépannage", slug: "artisans-depannage", icon: "wrench" },
      neighborhood: { name: "Bardot" },
      complete: false,
      sponsored: false,
      verificationPending: false,
    };
    render(<BusinessCard business={business} now={now} context="Professionnel · fiche mise à jour le 1 oct." />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Électricité du port");
    expect(screen.getByText("Professionnel · fiche mise à jour le 1 oct.")).toBeInTheDocument();
    expect(screen.getByText("Artisans et dépannage · Bardot")).toBeInTheDocument();
    expect(screen.queryByText("Profil complété")).not.toBeInTheDocument();
  });

  it("distingue profil complété, vérification demandée et sponsoring", () => {
    const business: BusinessCardData = {
      id: "00000000-0000-4000-8000-000000000005",
      slug: "plomberie-du-port",
      name: "Plomberie du port",
      description: null,
      verification_status: "pending_validation",
      verified_at: null,
      updated_at: "2026-10-01T00:00:00Z",
      services: [],
      service_area: null,
      accepts_quotes: false,
      availability_note: null,
      availability_declared_at: null,
      category: null,
      neighborhood: null,
      complete: true,
      sponsored: true,
      verificationPending: true,
    };
    render(<BusinessCard business={business} now={now} />);
    expect(screen.getByText("Profil complété")).toHaveAttribute("title", expect.stringContaining("pas vérifiées"));
    expect(screen.getByText("En cours de validation")).toBeInTheDocument();
    expect(screen.getByText("Sponsorisé")).toBeInTheDocument();
    expect(screen.queryByText("Vérifié")).not.toBeInTheDocument();
  });

  it("affiche un article du guide avec sa rubrique", () => {
    const article: GuideCardData = {
      id: "00000000-0000-4000-8000-000000000005",
      slug: "ouvrir-un-compte",
      title: "Ouvrir un compte bancaire",
      summary: "Les étapes générales.",
      verification_status: "pending_validation",
      verified_at: null,
      published_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      section: { name: "Démarches", icon: null, slug: "demarches" },
    };
    render(<GuideCard article={article} now={now} />);
    expect(screen.getByText("Démarches")).toBeInTheDocument();
    expect(screen.getByText("À vérifier")).toBeInTheDocument();
  });
});
