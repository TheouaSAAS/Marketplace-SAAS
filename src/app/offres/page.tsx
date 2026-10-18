import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("pricing");

export default function Page({ searchParams }: PageProps<"/offres">) {
  return <SectionPreview section="pricing" searchParams={searchParams} />;
}
