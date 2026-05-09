import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface SubPageLayoutProps {
  children: ReactNode;
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
  noPadding?: boolean;
}

export function SubPageLayout({ children, title, onBack, actions, noPadding }: SubPageLayoutProps) {
  const handleBack = onBack ?? (() => window.history.back());

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-screen-sm mx-auto">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-border px-4 h-14 flex items-center gap-3 shrink-0">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 active:scale-90 transition-transform"
        >
          <ArrowLeft size={17} className="text-foreground" />
        </button>
        <h1 className="font-bold text-base text-foreground flex-1 truncate">{title}</h1>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className={noPadding ? "" : ""}>
        {children}
      </div>
    </div>
  );
}
