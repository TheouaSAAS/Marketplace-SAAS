import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";
import { LAUNCH_CITY } from "@/domain/city";

/** Image de partage par défaut (réseaux sociaux, messageries) : marque, slogan, ville de lancement. */
export const alt = `${SITE.name} — ${SITE.slogan}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#13576d", color: "#ffffff" }}>
        <div style={{ display: "flex", fontSize: 34, opacity: 0.85 }}>{LAUNCH_CITY.name} · Côte d’Ivoire</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>{SITE.name}</div>
          <div style={{ display: "flex", fontSize: 44 }}>« {SITE.slogan} »</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.85 }}>Bonnes adresses · annonces · immobilier · emploi · événements · professionnels</div>
      </div>
    ),
    size,
  );
}
