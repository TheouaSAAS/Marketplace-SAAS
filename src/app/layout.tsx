import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { SITE } from "@/config/site";
import { AssistantLauncher } from "@/components/layout/assistant-launcher";
import { askAction } from "@/modules/assistant/server/ask-action";
import { BottomNav, BottomNavView } from "@/components/layout/bottom-nav";
import { ServiceWorkerRegistration } from "@/components/layout/service-worker-registration";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { ToastProvider } from "@/components/ui/toast";
import { isFeatureEnabled } from "@/server/features";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  // « latin » couvre le français (é, è, ç, œ, ’, …) : pas de second fichier préchargé sur chaque page.
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  applicationName: SITE.name,
  title: {
    default: `${SITE.name} — ${SITE.slogan}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.slogan}`,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image", title: `${SITE.name} — ${SITE.slogan}`, description: SITE.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#146c86",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${jakarta.variable} h-full antialiased`}>
      {/* Marge basse sur mobile : la barre de navigation fixe ne masque jamais le contenu. */}
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-overlay"
        >
          Aller au contenu
        </a>
        <EnvironmentBanner />
        <ToastProvider>
          <SiteHeader />
          <OfflineBanner />
          <main id="contenu" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
          <Suspense fallback={<BottomNavView pathname={null} />}>
            <BottomNav />
          </Suspense>
          <AssistantLauncher enabled={isFeatureEnabled("ai_assistant")} ask={askAction} />
        </ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
