export type GenUIMockDataMode = "auto" | "sales" | "support" | "none";
export type GenUILocale = "auto" | "ja" | "en";

export type RenderGenUIInput = {
  prompt: string;
  agentId?: string;
  title?: string;
  context?: Record<string, unknown>;
  mockData?: GenUIMockDataMode;
  locale?: GenUILocale;
};

export type GenUIArtifact = {
  artifactId: string;
  prompt: string;
  agentId?: string;
  title: string;
  openuiLang: string;
  createdAt: string;
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
};

export type PopupOpenResponse = {
  popupId: string;
  artifactId: string;
  previewUrl: string;
  status: PopupStatus;
};
