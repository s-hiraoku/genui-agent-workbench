import { SettingsClient } from "./SettingsClient";

type SettingsPageProps = {
  searchParams: Promise<{ animation?: string; controlUrl?: string; token?: string; theme?: string; themeColor?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { animation, controlUrl, token, themeColor } = await searchParams;
  return <SettingsClient animation={animation} controlToken={token ?? ""} controlUrl={controlUrl ?? ""} themeColor={themeColor} />;
}
