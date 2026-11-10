import type { DesktopApi } from "@/shared/desktop/contracts";

declare global {
  interface Window {
    chagok: DesktopApi;
  }
}
