import { describe, expect, it } from "vitest";
import { displayValue, fieldLabel, getField, setField } from "./draft-fields";
import type { ListingDraft } from "./fields";

const draft = { title: "Studio", description: "", price: null, priceUnit: null, negotiable: false, contactPhone: null, contactEmail: null, attributes: { chambres: 1 } } as unknown as ListingDraft;

describe("champs du brouillon désignés par leur nom", () => {
  it("lit et écrit un champ simple ou un attribut, sans modifier l'original", () => {
    expect(getField(draft, "title")).toBe("Studio");
    expect(getField(draft, "attributes.chambres")).toBe(1);
    const next = setField(setField(draft, "price", 90000), "attributes.meuble", true);
    expect(next).toMatchObject({ price: 90000, attributes: { chambres: 1, meuble: true } });
    expect(draft.price).toBeNull();
  });

  it("vide un champ proprement et ignore un champ inconnu (aucune injection de propriété)", () => {
    expect(setField(draft, "title", null).title).toBe("");
    expect(setField(draft, "negotiable", undefined).negotiable).toBe(false);
    expect(setField(draft, "attributes.chambres", "").attributes).not.toHaveProperty("chambres");
    expect(setField(draft, "owner_id", "pirate")).toBe(draft);
    expect(setField(draft, "__proto__", { admin: true })).toBe(draft);
  });

  it("affiche des libellés et des valeurs lisibles", () => {
    expect(fieldLabel("price", null)).toBe("Prix");
    expect(fieldLabel("attributes.chambres", "immobilier")).toBe("Chambres");
    expect(fieldLabel("attributes.inconnu", "immobilier")).toBe("inconnu");
    expect(displayValue("price", 150000, null).replace(/\s/g, " ")).toBe("150 000 F CFA");
    expect(displayValue("priceUnit", "par_mois", null)).toBe("Par mois");
    expect(displayValue("attributes.meuble", true, "immobilier")).toBe("Oui");
    expect(displayValue("title", "", null)).toBe("(vide)");
    expect(displayValue("description", "x".repeat(300), null)).toHaveLength(161);
  });
});
