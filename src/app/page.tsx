import { listArtifacts } from "@/server/genui/artifacts";

export default async function Home() {
  const artifacts = await listArtifacts(10);

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-cyan-300">GenUI Popup Broker</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-normal">
            Agent-generated UI, opened as local popups.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-neutral-300">
            This resident app accepts CLI and MCP requests from other AI agents, generates OpenUI artifacts, and opens each
            result in a dedicated Electron popup window.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <StatusTile label="Service role" value="Popup broker" />
          <StatusTile label="Primary entrypoints" value="CLI / MCP" />
          <StatusTile label="Artifact store" value=".genui/artifacts" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold">CLI</h2>
            <pre className="mt-4 overflow-x-auto rounded-md bg-black/50 p-4 text-sm text-cyan-100">
              <code>{'npm run genui -- popup --prompt "売上ダッシュボードを表示して" --agent-id codex'}</code>
            </pre>
            <pre className="mt-3 overflow-x-auto rounded-md bg-black/50 p-4 text-sm text-cyan-100">
              <code>{'npm run genui -- close --popup-id "<popupId>"'}</code>
            </pre>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold">MCP Tools</h2>
            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <p>
                <code className="rounded bg-black/50 px-2 py-1 text-cyan-100">genui.open_popup</code> creates an
                artifact and opens a popup.
              </p>
              <p>
                <code className="rounded bg-black/50 px-2 py-1 text-cyan-100">genui.close_popup</code> closes a popup by
                id.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Recent Artifacts</h2>
            <span className="text-sm text-neutral-400">{artifacts.length} saved</span>
          </div>
          {artifacts.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-400">No artifacts yet. Open one from CLI or MCP while Electron is running.</p>
          ) : (
            <div className="mt-4 divide-y divide-white/10">
              {artifacts.map((artifact) => (
                <a
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:text-cyan-200"
                  href={`/preview/${artifact.artifactId}`}
                  key={artifact.artifactId}
                >
                  <span>
                    <span className="font-medium">{artifact.title}</span>
                    <span className="ml-2 text-neutral-500">{artifact.agentId ?? "unknown agent"}</span>
                  </span>
                  <span className="shrink-0 text-neutral-400">{new Date(artifact.createdAt).toLocaleString()}</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
