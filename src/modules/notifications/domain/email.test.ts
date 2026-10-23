import { describe, expect, it } from "vitest";
import { categoryOf, createUnsubscribeToken, internalUrl, renderEmail, verifyUnsubscribeToken } from "./email";

const options = { siteUrl: "https://carrefour.example/", siteName: "Carrefour des Possibles", unsubscribeUrl: "https://carrefour.example/notifications/desabonnement?jeton=abc", preferencesUrl: "https://carrefour.example/tableau-de-bord/notifications" };
const USER = "00000000-0000-4000-8000-000000000001";

describe("e-mails de notification", () => {
  it("reprend le titre, le lien interne et les liens de désabonnement", () => {
    const email = renderEmail({ type: "message", title: "Nouveau message de Awa", body: null, link: "/messages/123", displayName: "Koffi" }, options);
    expect(email.subject).toBe("Nouveau message de Awa — Carrefour des Possibles");
    expect(email.text).toContain("Bonjour Koffi,");
    expect(email.text).toContain("https://carrefour.example/messages/123");
    expect(email.text).toContain("Ne plus recevoir ces e-mails : https://carrefour.example/notifications/desabonnement?jeton=abc");
    expect(email.text).toContain("« Messages »");
  });

  it("échappe le HTML et n'accepte que des liens internes", () => {
    const email = renderEmail({ type: "annonce", title: "<script>alert(1)</script>", body: "Motif : \"faux\" & co", link: "//pirate.example", displayName: null }, options);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&quot;faux&quot; &amp; co");
    expect(email.html).toContain('href="https://carrefour.example/"');
    expect(internalUrl("https://a.example", "https://b.example/x")).toBe("https://a.example/");
  });

  it("range chaque type dans sa catégorie de préférence", () => {
    expect(categoryOf("page_pro")).toBe("decisions");
    expect(categoryOf("recherche")).toBe("recherche");
    expect(categoryOf("inconnu")).toBeNull();
  });
});

describe("désabonnement sans connexion", () => {
  it("vérifie un jeton signé et refuse toute altération", () => {
    const token = createUnsubscribeToken("secret-de-test", USER, "recherche");
    expect(verifyUnsubscribeToken("secret-de-test", token)).toEqual({ userId: USER, category: "recherche" });
    expect(verifyUnsubscribeToken("autre-secret", token)).toBeNull();
    const [payload, mac] = token.split(".");
    const forged = `${Buffer.from(`${USER}|tout`).toString("base64url")}.${mac}`;
    expect(verifyUnsubscribeToken("secret-de-test", forged)).toBeNull();
    expect(verifyUnsubscribeToken("secret-de-test", `${payload}`)).toBeNull();
    expect(verifyUnsubscribeToken("secret-de-test", "n'importe quoi")).toBeNull();
  });
});
