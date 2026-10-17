import { describe, expect, it } from "vitest";
import { isSupabaseConfigured, parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("applique les valeurs par défaut quand rien n'est renseigné", () => {
    const env = parsePublicEnv({});
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_DEFAULT_CITY_SLUG).toBe("san-pedro");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("traite une chaîne vide comme une valeur absente", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_CONTACT_EMAIL: "  " });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_CONTACT_EMAIL).toBeUndefined();
  });

  it("refuse une URL ou un e-mail mal formés avec un message explicite", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "pas-une-url" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => parsePublicEnv({ NEXT_PUBLIC_CONTACT_EMAIL: "contact@" })).toThrow(/NEXT_PUBLIC_CONTACT_EMAIL/);
  });

  it("refuse un slug de ville avec majuscules ou accents", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_DEFAULT_CITY_SLUG: "San-Pédro" })).toThrow(/slug/);
  });
});

describe("isSupabaseConfigured", () => {
  it("exige l'URL et la clé publique", () => {
    expect(isSupabaseConfigured(parsePublicEnv({}))).toBe(false);
    expect(isSupabaseConfigured(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" }))).toBe(false);
    expect(
      isSupabaseConfigured(
        parsePublicEnv({
          NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        }),
      ),
    ).toBe(true);
  });
});
