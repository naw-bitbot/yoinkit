import { useSettings } from "./useSettings";

export function usePro() {
  const { settings, loading } = useSettings();
  return {
    isPro: settings?.pro_unlocked ?? false,
    proSince: settings?.pro_since || null,
    loading,
  };
}
