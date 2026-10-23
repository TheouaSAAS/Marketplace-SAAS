import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { DashboardNav } from "@/modules/dashboard/components/dashboard-nav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Tableau de bord : navigation commune (onglets défilants sur mobile, colonne sur grand écran). */
export default function DashboardLayout({ children }: LayoutProps<"/tableau-de-bord">) {
  return (
    <Container className="flex flex-col gap-6 py-6 sm:py-10 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="lg:sticky lg:top-4">
        <DashboardNav />
      </aside>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </Container>
  );
}
