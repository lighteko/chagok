import type { ReactNode } from "react";

export function MainLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-surface px-8 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-2xl font-bold tracking-tighter text-primary">
            차곡<span className="ml-3 text-xs font-normal tracking-widest text-muted">CHAGOK</span>
          </span>
          <span className="text-sm text-muted">월별 운영 장부</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-8 py-14">{children}</main>
      <footer className="mx-auto max-w-5xl px-8 pb-8 text-xs text-muted">{footer}</footer>
    </div>
  );
}
