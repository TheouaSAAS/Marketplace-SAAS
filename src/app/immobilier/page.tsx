import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("realEstate");

export default function Page({ searchParams }: PageProps<"/immobilier">) {
  return <SectionPreview section="realEstate" searchParams={searchParams} />;
}
