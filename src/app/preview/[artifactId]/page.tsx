import { notFound } from "next/navigation";
import { loadArtifact } from "@/server/genui/artifacts";
import { PreviewClient } from "./PreviewClient";

type PreviewPageProps = {
  params: Promise<{ artifactId: string }>;
  searchParams: Promise<{ popupId?: string; controlUrl?: string }>;
};

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { artifactId } = await params;
  const { popupId, controlUrl } = await searchParams;
  const artifact = await loadArtifact(artifactId);

  if (!artifact) {
    notFound();
  }

  return (
    <PreviewClient
      artifactTitle={artifact.title}
      controlUrl={controlUrl}
      openuiLang={artifact.openuiLang}
      popupId={popupId}
    />
  );
}
