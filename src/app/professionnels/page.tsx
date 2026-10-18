import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("directory");

export default function Page({ searchParams }: PageProps<"/professionnels">) {
  return <SectionPreview section="directory" searchParams={searchParams} />;
}
