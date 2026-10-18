import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("tourism");

export default function Page({ searchParams }: PageProps<"/tourisme">) {
  return <SectionPreview section="tourism" searchParams={searchParams} />;
}
