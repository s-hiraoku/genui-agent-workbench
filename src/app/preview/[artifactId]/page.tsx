import { notFound } from "next/navigation";
import { loadArtifact } from "@/server/genui/artifacts";
import { PreviewClient } from "./PreviewClient";

type PreviewPageProps = {
  params: Promise<{ artifactId: string }>;
  searchParams: Promise<{
    popupId?: string;
    controlUrl?: string;
    size?: string;
    agent?: string;
    theme?: string;
  }>;
};

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { artifactId } = await params;
  const { popupId, controlUrl, size, agent } = await searchParams;
  const artifact = await loadArtifact(artifactId);

  if (!artifact) {
    notFound();
  }

  return (
    <PreviewClient
      artifactId={artifact.artifactId}
      artifactTitle={artifact.title}
      agentLabel={agent ?? artifact.agentId}
      controlUrl={controlUrl}
      openuiLang={artifact.openuiLang}
      popupId={popupId}
      size={size}
    />
  );
}
