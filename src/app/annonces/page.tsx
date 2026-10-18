import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("listings");

export default function Page({ searchParams }: PageProps<"/annonces">) {
  return <SectionPreview section="listings" searchParams={searchParams} />;
}
