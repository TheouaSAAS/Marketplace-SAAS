import { SectionPreview, sectionPreviewMetadata } from "@/components/layout/section-preview";

export const metadata = sectionPreviewMetadata("newcomer");

export default function Page({ searchParams }: PageProps<"/nouveau-arrivant">) {
  return <SectionPreview section="newcomer" searchParams={searchParams} />;
}
