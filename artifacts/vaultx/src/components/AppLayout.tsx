import { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

export function AppLayout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title={title} />
      <main className="flex-1 pb-24 max-w-screen-sm mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
