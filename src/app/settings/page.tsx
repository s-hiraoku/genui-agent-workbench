import { SettingsClient } from "./SettingsClient";

type SettingsPageProps = {
  searchParams: Promise<{ controlUrl?: string; theme?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { controlUrl } = await searchParams;
  return <SettingsClient controlUrl={controlUrl ?? ""} />;
}
