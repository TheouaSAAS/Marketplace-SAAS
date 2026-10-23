import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/spinner";
import { Container } from "@/components/ui/container";
import { WorkspaceNav } from "@/modules/businesses/components/workspace-nav";

export const metadata: Metadata = {
  title: "Espace professionnel",
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: LayoutProps<"/espace-pro/[id]">) {
  return (
    <Container className="flex flex-col gap-6 py-6 sm:py-10 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <aside className="lg:sticky lg:top-4">
        {/* La navigation lit l'adresse de la page : rendue au moment de la requête. */}
        <Suspense fallback={<Skeleton className="h-11 w-full" />}>
          <WorkspaceNav />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </Container>
  );
}
