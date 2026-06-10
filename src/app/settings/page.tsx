import { SettingsClient } from "./SettingsClient";

type SettingsPageProps = {
  searchParams: Promise<{
    animation?: string;
    controlUrl?: string;
    token?: string;
    theme?: string;
    themeColor?: string;
    visualTheme?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { animation, controlUrl, token, theme, themeColor, visualTheme } = await searchParams;
  return (
    <SettingsClient
      animation={animation}
      controlToken={token ?? ""}
      controlUrl={controlUrl ?? ""}
      theme={theme}
      themeColor={themeColor}
      visualTheme={visualTheme}
    />
  );
}
