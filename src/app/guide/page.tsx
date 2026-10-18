import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("guide");

export default function Page({ searchParams }: PageProps<"/guide">) {
  return <SectionPreview section="guide" searchParams={searchParams} />;
}
