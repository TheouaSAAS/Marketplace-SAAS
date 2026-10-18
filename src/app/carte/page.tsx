import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("map");

export default function Page({ searchParams }: PageProps<"/carte">) {
  return <SectionPreview section="map" searchParams={searchParams} />;
}
