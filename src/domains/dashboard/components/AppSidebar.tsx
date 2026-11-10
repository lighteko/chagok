import { ArrowLeftRight, BookOpen, Calculator, Receipt } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/atomics/atoms/sidebar";
import type { WorkspaceView } from "@/shared/desktop/preferences";

const items = [
  { view: "transactions" as const, label: "거래내역", icon: ArrowLeftRight },
  { view: "expenses" as const, label: "별도 지출", icon: Receipt },
  { view: "settlement" as const, label: "월별 정산", icon: Calculator },
];

export function AppSidebar({
  view,
  onSelect,
  version,
}: {
  view: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  version?: string;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <BookOpen
            className="size-5 shrink-0"
            aria-hidden="true"
          />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">차곡</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>장부 관리</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="작업 메뉴">
              <SidebarMenu>
                {items.map(({ view: id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={view === id}
                      aria-current={view === id ? "page" : undefined}
                      tooltip={label}
                      onClick={() => onSelect(id)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {version ? `차곡 v${version}` : "차곡"}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
