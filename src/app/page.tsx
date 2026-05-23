import { listArtifacts } from "@/server/genui/artifacts";
import { readBrokerState } from "@/server/genui/broker-state";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const [artifacts, brokerState] = await Promise.all([listArtifacts(10), readBrokerState()]);
  return (
    <HomeClient
      controlUrl={brokerState?.controlUrl ?? ""}
      artifacts={artifacts.map((a) => ({
        artifactId: a.artifactId,
        title: a.title,
        createdAt: a.createdAt,
      }))}
    />
  );
}
