import { gzipSync } from "node:zlib";
import { expect, test, type Page, type Request } from "@playwright/test";
import { HAS_DATABASE, NO_DATABASE } from "./env";

/**
 * Budget de performance mesuré en local sur le build de production (profil
 * mobile, réseau non bridé) : poids compressé (gzip) des ressources du site
 * demandées au chargement initial — page, JavaScript, CSS, polices — hors
 * images et tuiles de carte, stabilité visuelle (CLS) et plus grand affichage
 * (LCP). Chaque ressource est retéléchargée hors navigateur puis compressée :
 * la mesure ne dépend ni du poste (antivirus qui réécrit le trafic) ni des
 * extensions. Les liens préchargés après le chargement sont comptés à part.
 * Les valeurs des visiteurs (Core Web Vitals) dépendent de l'hébergement et
 * du réseau : voir docs/performance.md.
 */
const BUDGETS = {
  /** JavaScript compressé du chargement initial (Ko). Mesuré : 195 à 204. */
  scriptKb: 230,
  /** Total compressé du chargement initial, hors images et tuiles (Ko). Mesuré : 254 à 267. */
  totalKb: 300,
  cls: 0.1,
  /**
   * Seuil bloquant du LCP local (ms) : limite « médiocre » des Core Web Vitals.
   * En local, les données viennent d'une base distante (1,0 à 3,0 s mesurés) ;
   * l'objectif en production reste 2,5 s, à vérifier sur données réelles.
   */
  lcpMs: 4000,
};

const PAGES = ["/", "/immobilier/location", "/evenements", "/guide", "/professionnels", "/carte", "/lieux/exemple-lieu-a-visiter"];
const MEDIA = /tile\.openstreetmap|\/_next\/image|\.(png|jpe?g|webp|avif|svg|ico)(\?|$)/;

interface Received {
  url: string;
  type: string;
  bytes: number;
  initial: boolean;
}

async function load(page: Page, path: string): Promise<Received[]> {
  const pending: Promise<Received>[] = [];
  let loaded = false;
  const origin = new URL(page.url() === "about:blank" ? (test.info().project.use.baseURL ?? "http://localhost") : page.url()).origin;
  const track = (request: Request) => {
    const initial = !loaded;
    const url = request.url();
    // Ressources du site seulement, GET simples (les préchargements RSC portent des en-têtes propres).
    if (!url.startsWith(origin) || request.method() !== "GET") return;
    pending.push(
      (initial ? page.request.get(url).then((response) => response.body()) : Promise.resolve(Buffer.alloc(0)))
        .then((body) => ({ url, type: request.resourceType(), bytes: initial ? gzipSync(body).length : 0, initial }))
        .catch(() => ({ url, type: request.resourceType(), bytes: 0, initial })),
    );
  };
  page.on("requestfinished", track);
  await page.goto(path, { waitUntil: "load" });
  loaded = true;
  await page.waitForLoadState("networkidle").catch(() => {});
  page.off("requestfinished", track);
  return Promise.all(pending);
}

async function vitals(page: Page) {
  return page.evaluate(async () => {
    let lcp = 0;
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!entry.hadRecentInput) cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { lcp, cls };
  });
}

test.describe("Budget de performance (mobile)", () => {
  for (const path of PAGES) {
    test(`chargement léger : ${path}`, async ({ page, isMobile }) => {
      test.skip(!isMobile, "mesuré sur le profil mobile");
      test.skip(path.startsWith("/lieux/") && !HAS_DATABASE, NO_DATABASE);
      const received = await load(page, path);
      const { lcp, cls } = await vitals(page);
      const kb = (items: Received[]) => items.reduce((total, item) => total + item.bytes, 0) / 1024;
      const initial = received.filter((item) => item.initial && !MEDIA.test(item.url));
      const html = kb(initial.filter((item) => item.type === "document"));
      const scripts = kb(initial.filter((item) => item.type === "script"));
      const total = kb(initial);
      const prefetch = received.filter((item) => !item.initial && !MEDIA.test(item.url)).length;
      if (process.env.PERF_DETAIL) {
        console.log(["DETAIL " + path, ...initial.sort((a, b) => b.bytes - a.bytes).slice(0, 10).map((item) => `${Math.round(item.bytes / 1024)}Ko ${item.type} ${item.url.slice(0, 90)}`)].join("\n"));
      }
      console.log(`PERF ${path} html=${html.toFixed(0)}Ko js=${scripts.toFixed(0)}Ko total=${total.toFixed(0)}Ko prefetch=${prefetch} requêtes cls=${cls.toFixed(3)} lcp=${lcp.toFixed(0)}ms`);
      expect(scripts, "JavaScript (Ko)").toBeLessThanOrEqual(BUDGETS.scriptKb);
      expect(total, "Total hors images (Ko)").toBeLessThanOrEqual(BUDGETS.totalKb);
      expect(cls, "CLS").toBeLessThanOrEqual(BUDGETS.cls);
      expect(lcp, "LCP (ms)").toBeLessThanOrEqual(BUDGETS.lcpMs);
    });
  }
});
