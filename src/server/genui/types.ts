export type GenUIMockDataMode = "auto" | "sales" | "support" | "none";
export type GenUILocale = "auto" | "ja" | "en";
export type GenUIGenerationMode = "llm" | "fallback";
export type GenUIGlassPreset = "clear" | "pane" | "milky" | "dense" | "mint" | "sky" | "rose" | "amber";
export type GenUILabelInkPreset = "green" | "slate" | "white" | "blue" | "amber" | "red";
export type GenUIWindowAnimationPreset = "center" | "left" | "right" | "top" | "fade";
export type GenUIThemeColorPreset = "blue" | "cyan" | "violet" | "mint" | "rose" | "amber" | "white";
export type GenUIDesignSettings = {
  glassPreset: GenUIGlassPreset;
  labelInkPreset: GenUILabelInkPreset;
  themeColorPreset: GenUIThemeColorPreset;
  windowAnimationPreset: GenUIWindowAnimationPreset;
};

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
  design?: GenUIDesignSettings;
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
