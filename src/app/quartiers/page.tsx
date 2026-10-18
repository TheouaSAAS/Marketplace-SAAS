import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("neighborhoods");

export default function Page({ searchParams }: PageProps<"/quartiers">) {
  return <SectionPreview section="neighborhoods" searchParams={searchParams} />;
}
