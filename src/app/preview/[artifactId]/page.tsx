import { notFound } from "next/navigation";
import { loadArtifact } from "@/server/genui/artifacts";
import { PreviewClient } from "./PreviewClient";

type PreviewPageProps = {
  params: Promise<{ artifactId: string }>;
  searchParams: Promise<{
    popupId?: string;
    controlUrl?: string;
    token?: string;
    size?: string;
    agent?: string;
    animation?: string;
    themeColor?: string;
    visualTheme?: string;
    theme?: string;
  }>;
};

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { artifactId } = await params;
  const { popupId, controlUrl, token, size, agent, animation, theme, themeColor, visualTheme } = await searchParams;
  const artifact = await loadArtifact(artifactId);

  if (!artifact) {
    notFound();
  }

  return (
    <PreviewClient
      artifactId={artifact.artifactId}
      artifactTitle={artifact.title}
      artifactContext={artifact.context}
      agentLabel={agent ?? artifact.agentId}
      animation={animation}
      controlUrl={controlUrl}
      controlToken={token}
      openuiLang={artifact.openuiLang}
      popupId={popupId}
      size={size}
      theme={theme}
      themeColor={themeColor}
      visualTheme={visualTheme}
    />
  );
}
