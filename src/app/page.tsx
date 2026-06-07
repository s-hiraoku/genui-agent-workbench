import { listArtifacts } from "@/server/genui/artifacts";
import { readBrokerState } from "@/server/genui/broker-state";
import { HomeClient } from "./HomeClient";

export const dynamic = "force-dynamic";

async function isBrokerReachable(controlUrl: string, controlToken: string | undefined): Promise<boolean> {
  if (!controlUrl) return false;
  try {
    const res = await fetch(`${controlUrl}/v1/status`, {
      cache: "no-store",
      headers: controlToken ? { "x-genui-token": controlToken } : undefined,
      signal: AbortSignal.timeout(500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function Home() {
  const [artifacts, brokerState] = await Promise.all([listArtifacts(50), readBrokerState()]);
  const brokerReachable = await isBrokerReachable(brokerState?.controlUrl ?? "", brokerState?.controlToken);
  return (
    <HomeClient
      controlUrl={brokerReachable ? (brokerState?.controlUrl ?? "") : ""}
      controlToken={brokerReachable ? (brokerState?.controlToken ?? "") : ""}
      artifacts={artifacts.map((a) => ({
        artifactId: a.artifactId,
        agentId: a.agentId,
        title: a.title,
        openuiLang: a.openuiLang,
        createdAt: a.createdAt,
        generationMode: a.generationMode,
        locale: a.locale,
        context: a.context,
      }))}
    />
  );
}
