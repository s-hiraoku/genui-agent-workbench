export type GenUILocale = "auto" | "ja" | "en";
export type GenUIGenerationMode = "provided";
export type GenUIGlassPreset = "clear" | "pane" | "milky" | "dense" | "mint" | "sky" | "rose" | "amber";
export type GenUILabelInkPreset = "green" | "slate" | "white" | "blue" | "amber" | "red";
export type GenUIWindowAnimationPreset = "center" | "left" | "right" | "top" | "fade";
export type GenUIVisualThemePreset = "hud" | "workbench" | "studio" | "briefing";
export type GenUIThemeColorPreset =
  | "blue"
  | "azure"
  | "cyan"
  | "violet"
  | "mint"
  | "rose"
  | "amber"
  | "white"
  | "midnight"
  | "forest"
  | "crimson"
  | "graphite";
export type GenUIDesignSettings = {
  visualThemePreset: GenUIVisualThemePreset;
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
  | "review"
  | "tall"
  | "stage"
  | "cinema"
  | "fullscreen";

export type RenderGenUIInput = {
  openuiLang: string;
  agentId?: string;
  title?: string;
  context?: Record<string, unknown>;
  locale?: GenUILocale;
  size?: GenUISizePreset;
  width?: number;
  height?: number;
  design?: GenUIDesignSettings;
};

export type GenUIArtifact = {
  artifactId: string;
  agentId?: string;
  title: string;
  openuiLang: string;
  createdAt: string;
  generationMode: GenUIGenerationMode;
  locale: GenUILocale;
  context?: Record<string, unknown>;
};

export type RenderGenUIResult = {
  artifact: GenUIArtifact;
  previewPath: string;
};

export type PopupStatus = "opening" | "open" | "completed" | "cancelled" | "closed" | "failed";

export type PopupInteractionEventKind = "action" | "input" | "submit" | "message";

export type PopupInteractionEvent = {
  eventId: string;
  kind: PopupInteractionEventKind;
  component: string;
  actionId: string;
  label?: string;
  value?: unknown;
  fields?: Record<string, unknown>;
  createdAt: string;
};

export type PopupCompletion = {
  outcome: "completed" | "cancelled" | "failed";
  payload?: {
    actionId?: string;
    value?: unknown;
    fields?: Record<string, unknown>;
    event?: PopupInteractionEvent;
    events?: PopupInteractionEvent[];
  } & Record<string, unknown>;
  completedAt: string;
};

export type PopupRecord = {
  popupId: string;
  artifactId: string;
  agentId?: string;
  title: string;
  status: PopupStatus;
  previewUrl: string;
  createdAt: string;
  closedAt?: string;
  error?: string;
  events?: PopupInteractionEvent[];
  completion?: PopupCompletion;
  generationMode: GenUIGenerationMode;
};

export type PopupOpenResponse = {
  popupId: string;
  artifactId: string;
  agentId?: string;
  title: string;
  previewUrl: string;
  status: PopupStatus;
  createdAt: string;
  closedAt?: string;
  error?: string;
  events?: PopupInteractionEvent[];
  completion?: PopupCompletion;
  generationMode: GenUIGenerationMode;
  brokerProtocolVersion: string;
};
