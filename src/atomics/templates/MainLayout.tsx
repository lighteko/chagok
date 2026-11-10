import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

interface NavigationItem {
  id: string;
  label: string;
  icon: ReactNode;
}

interface MainLayoutProps {
  children: ReactNode;
  navigation: NavigationItem[];
  activeItem: string;
  onNavigate: (id: string) => void;
  footer?: ReactNode;
}

export function MainLayout({ children, navigation, activeItem, onNavigate, footer }: MainLayoutProps) {
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground">
      <aside className="flex w-44 shrink-0 flex-col border-r border-line bg-sidebar xl:w-48">
        <div className="flex h-[76px] items-center gap-2.5 px-5">
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </span>
          <span className="text-[23px] font-bold tracking-tighter">차곡</span>
        </div>
        <div className="px-5 pt-5 pb-2 text-[11px] font-medium tracking-wide text-muted">장부 관리</div>
        <nav
          aria-label="작업 메뉴"
          className="space-y-1 px-3"
        >
          {navigation.map(item => (
            <button
              key={item.id}
              type="button"
              aria-current={activeItem === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[13px] transition focus-visible:outline-2 focus-visible:outline-primary",
                activeItem === item.id
                  ? "bg-primary-soft font-semibold text-primary"
                  : "text-muted hover:bg-hover hover:text-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-line px-5 py-5 text-[11px] text-muted">{footer}</div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
