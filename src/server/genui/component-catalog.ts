export type ComponentCatalogItem = {
  name: string;
  category: string;
  description: string;
  useCases: string[];
  examplePrompt: string;
};

export const componentCatalog: ComponentCatalogItem[] = [
  {
    name: "MapView",
    category: "Maps",
    description: "OpenStreetMap-backed map panel with center, zoom, height, and colored markers.",
    useCases: ["customer locations", "store/site maps", "routes", "incidents", "nearby places"],
    examplePrompt: "東京の顧客拠点を地図で表示して。優先度別にマーカーを分けて。",
  },
  {
    name: "AudioPlayer",
    category: "Media",
    description: "Playlist-style audio player for music, voice notes, podcasts, recordings, and generated audio.",
    useCases: ["music preview", "voice note review", "meeting recordings", "podcasts", "generated speech"],
    examplePrompt: "音声メモをプレーヤーで表示して。概要と再生リストも付けて。",
  },
  {
    name: "VideoPlayer",
    category: "Media",
    description: "Video player with poster, chapters, and transcript support for demos, clips, recordings, and walkthroughs.",
    useCases: ["screen recordings", "feature demos", "tutorials", "incident evidence", "generated clips"],
    examplePrompt: "デモ動画をチャプター付きで表示して。重要な場面もまとめて。",
  },
];
