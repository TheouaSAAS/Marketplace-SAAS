import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("events");

export default function Page({ searchParams }: PageProps<"/evenements">) {
  return <SectionPreview section="events" searchParams={searchParams} />;
}
