import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

/** Hôte des tuiles de carte (gabarit {s}.tile… → *.tile…), pour la politique de contenu. */
const tileSources = (() => {
  const template = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  try {
    const host = new URL(template.replace(/\{[^}]+\}/g, "x")).host;
    return template.includes("://{s}.") ? `https://${host} https://*.${host.split(".").slice(1).join(".")}` : `https://${host}`;
  } catch {
    return "https://tile.openstreetmap.org";
  }
})();

/**
 * Politique de sécurité du contenu. Les scripts restent limités au site ; les
 * scripts en ligne de Next (données de rendu) sont autorisés, faute de nonce
 * possible sur les pages statiques. Aucun script, cadre ni objet externe.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""} ${tileSources}`,
  "font-src 'self'",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const httpsSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HTTPS imposé pendant deux ans, seulement quand le site est servi en HTTPS.
  ...(httpsSite ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // La géolocalisation n'est autorisée que pour notre origine, jamais pour un iframe tiers.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Détection hors ligne + relance automatique des navigations et actions (réseau mobile instable).
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // Images des annonces servies par Supabase Storage (bucket public `media`).
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  // Ancienne adresse de « Mes annonces » (niveau 18), désormais dans le tableau de bord (la requête est conservée).
  async redirects() {
    return [{ source: "/mes-annonces", destination: "/tableau-de-bord/annonces", permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Le service worker doit toujours être revalidé pour que ses mises à jour s'appliquent.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
