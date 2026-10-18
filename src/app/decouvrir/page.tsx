import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("discover");

export default function Page({ searchParams }: PageProps<"/decouvrir">) {
  return <SectionPreview section="discover" searchParams={searchParams} />;
}
