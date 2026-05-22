import { listArtifacts } from "@/server/genui/artifacts";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const artifacts = await listArtifacts(10);
  return (
    <HomeClient
      artifacts={artifacts.map((a) => ({
        artifactId: a.artifactId,
        title: a.title,
        createdAt: a.createdAt,
      }))}
    />
  );
}
