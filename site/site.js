const RELEASE_ASSET = "genui-popup-broker-macos-arm64.zip";

function resolveRepository() {
  const { hostname, pathname } = window.location;
  const parts = pathname.split("/").filter(Boolean);

  if (hostname.endsWith(".github.io") && parts.length > 0) {
    return {
      owner: hostname.slice(0, -".github.io".length),
      repo: parts[0],
    };
  }

  const repository = document.querySelector('meta[name="github-repository"]')?.content;
  if (repository?.includes("/")) {
    const [owner, repo] = repository.split("/", 2);
    return { owner, repo };
  }

  return null;
}

function setDownloadLinks() {
  const repository = resolveRepository();
  const downloadLink = document.getElementById("download-link");
  const releaseLink = document.getElementById("release-link");
  const sourceLink = document.getElementById("source-link");
  const cloneCommand = document.getElementById("clone-command");
  const note = document.getElementById("download-note");

  if (!repository || !downloadLink || !releaseLink || !sourceLink || !note) {
    return;
  }

  const repoUrl = `https://github.com/${repository.owner}/${repository.repo}`;
  const latestReleaseUrl = `${repoUrl}/releases/latest`;
  const downloadUrl = `${latestReleaseUrl}/download/${encodeURIComponent(RELEASE_ASSET)}`;

  downloadLink.href = downloadUrl;
  releaseLink.href = latestReleaseUrl;
  sourceLink.href = repoUrl;
  if (cloneCommand) {
    cloneCommand.textContent = `mkdir -p ~/.local/bin
cp ./genui ~/.local/bin/genui
chmod +x ~/.local/bin/genui`;
  }
  note.textContent = `最新 Release から ${RELEASE_ASSET} をダウンロードします。`;
}

setDownloadLinks();
