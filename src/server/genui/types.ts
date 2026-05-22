export type GenUIMockDataMode = "auto" | "sales" | "support" | "none";
export type GenUILocale = "auto" | "ja" | "en";
export type GenUIGenerationMode = "llm" | "fallback";

export type GenUISizePreset =
  | "compact"
  | "card"
  | "panel"
  | "default"
  | "wide"
  | "tall"
  | "stage"
  | "cinema"
  | "fullscreen";

export type RenderGenUIInput = {
  prompt: string;
  agentId?: string;
  title?: string;
  context?: Record<string, unknown>;
  mockData?: GenUIMockDataMode;
  locale?: GenUILocale;
  size?: GenUISizePreset;
  width?: number;
  height?: number;
};

export type GenUIArtifact = {
  artifactId: string;
  prompt: string;
  agentId?: string;
  title: string;
  openuiLang: string;
  createdAt: string;
  generationMode: GenUIGenerationMode;
  model: string;
  locale: GenUILocale;
  mockData: GenUIMockDataMode;
  context?: Record<string, unknown>;
  requiredTools: string[];
};

export type RenderGenUIResult = {
  artifact: GenUIArtifact;
  previewPath: string;
};

export type PopupStatus = "opening" | "open" | "closed" | "failed";

export type PopupRecord = {
  popupId: string;
  artifactId: string;
  agentId?: string;
  title: string;
  status: PopupStatus;
  previewUrl: string;
  createdAt: string;
  closedAt?: string;
  generationMode: GenUIGenerationMode;
};

export type PopupOpenResponse = {
  popupId: string;
  artifactId: string;
  previewUrl: string;
  status: PopupStatus;
  generationMode: GenUIGenerationMode;
  brokerProtocolVersion: string;
};
