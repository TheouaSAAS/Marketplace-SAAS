import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("shops");

export default function Page({ searchParams }: PageProps<"/commerces">) {
  return <SectionPreview section="shops" searchParams={searchParams} />;
}
