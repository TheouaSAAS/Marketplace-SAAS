import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("publish");

export default function Page({ searchParams }: PageProps<"/publier">) {
  return <SectionPreview section="publish" searchParams={searchParams} />;
}
