import { listArtifacts } from "@/server/genui/artifacts";

export default async function Home() {
  const artifacts = await listArtifacts(10);

  return (
    <div className="app-surface hud-frame flex min-h-screen w-full flex-col">
      <span className="hud-corner" aria-hidden />

      <div className="app-content mx-auto flex w-full max-w-3xl flex-col gap-10 px-10 pt-14 pb-16">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="hud-eyebrow">
              GENUI <b>· BROKER</b> &nbsp;//&nbsp; SYS · ONLINE
            </span>
            <span className="hud-eyebrow">
              CH-01 &nbsp;//&nbsp; v0.1
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="status-reticle" aria-hidden />
            <h1 className="hud-title text-[34px] leading-none">GenUI Popup Broker</h1>
          </div>

          <p className="app-sub max-w-xl text-sm leading-6">
            A resident broker that opens agent-generated UI as local popups —
            <span className="ml-1 hud-tag">live</span>
          </p>

          <div className="hud-divider mt-2" />
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="hud-eyebrow">RECENT <b>· ARTIFACTS</b></h2>
            <span className="hud-eyebrow">
              N = {String(artifacts.length).padStart(2, "0")}
            </span>
          </div>

          {artifacts.length === 0 ? (
            <div className="hud-empty">
              <p className="hud-eyebrow mb-2">NO SIGNAL</p>
              <p className="text-sm">
                Awaiting agent transmission. <br />
                Spawn a popup from your CLI or MCP client to populate this feed.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {artifacts.map((artifact) => (
                <li key={artifact.artifactId}>
                  <a
                    className="hud-row text-sm"
                    href={`/preview/${artifact.artifactId}`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="hud-tag shrink-0">
                        {artifact.artifactId.slice(-4)}
                      </span>
                      <span className="truncate">{artifact.title}</span>
                    </span>
                    <span className="hud-eyebrow shrink-0">
                      {new Date(artifact.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-auto flex items-center justify-between pt-6">
          <span className="hud-eyebrow">END · OF · LOG</span>
          <span className="hud-eyebrow">UTC {new Date().toISOString().slice(11, 16)}</span>
        </footer>
      </div>
    </div>
  );
}
