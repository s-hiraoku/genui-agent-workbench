"use client";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";

import { Renderer } from "@openuidev/react-lang";
import { library } from "@/library";

type PreviewClientProps = {
  openuiLang: string;
  artifactTitle: string;
  popupId?: string;
  controlUrl?: string;
};

export function PreviewClient({ openuiLang, artifactTitle, popupId, controlUrl }: PreviewClientProps) {
  const closePopup = async () => {
    if (popupId && controlUrl) {
      await fetch(`${controlUrl}/v1/popups/${popupId}/close`, { method: "POST" });
      return;
    }

    window.close();
  };

  return (
    <main className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">GenUI Popup</p>
          <h1 className="text-sm font-semibold text-neutral-950">{artifactTitle}</h1>
        </div>
        <button
          className="rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          onClick={closePopup}
          type="button"
        >
          Done / Close
        </button>
      </header>
      <section className="mx-auto max-w-4xl p-4">
        <Renderer response={openuiLang} library={library} />
      </section>
    </main>
  );
}
