import { SettingsClient } from "./SettingsClient";

type SettingsPageProps = {
  searchParams: Promise<{ animation?: string; controlUrl?: string; theme?: string; themeColor?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { animation, controlUrl, themeColor } = await searchParams;
  return <SettingsClient animation={animation} controlUrl={controlUrl ?? ""} themeColor={themeColor} />;
}
