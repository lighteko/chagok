import { ArrowLeftRight, Calculator, Receipt, BookOpen } from "lucide-react";
import appIcon from "@/domains/dashboard/assets/chagok-icon.svg";
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
  tutorialOpen,
  onTutorial,
}: {
  view: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  version?: string;
  tutorialOpen: boolean;
  onTutorial: () => void;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img
            src={appIcon}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 group-data-[collapsible=icon]:size-7"
          />
          <div className="grid gap-0.5 group-data-[collapsible=icon]:hidden">
            <span className="text-xl font-bold tracking-tight text-primary">차곡</span>
            <span className="text-xs text-muted-foreground">월별 정산 장부</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>장부 관리</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="작업 메뉴">
              <SidebarMenu className="gap-1">
                {items.map(({ view: id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={view === id}
                      aria-current={view === id ? "page" : undefined}
                      tooltip={label}
                      className="h-10"
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="사용 안내"
              aria-label="사용 안내"
              onClick={onTutorial}
              aria-expanded={tutorialOpen}
              aria-controls={tutorialOpen ? "chagok-tutorial" : undefined}
              data-tutorial-launch
            >
              <BookOpen aria-hidden="true" />
              <span>사용 안내</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {version ? `차곡 v${version}` : "차곡"}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
