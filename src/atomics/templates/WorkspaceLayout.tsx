import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/atomics/atoms/sidebar";

export function WorkspaceLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <SidebarProvider className="h-svh min-h-0">
      {sidebar}
      <SidebarInset className="h-svh min-w-0 overflow-y-auto">{children}</SidebarInset>
    </SidebarProvider>
  );
}
