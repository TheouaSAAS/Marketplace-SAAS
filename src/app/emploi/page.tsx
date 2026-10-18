import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("jobs");

export default function Page({ searchParams }: PageProps<"/emploi">) {
  return <SectionPreview section="jobs" searchParams={searchParams} />;
}
