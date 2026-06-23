import { useLocation, Link } from "wouter";
import { LayoutDashboard, Wallet, TrendingUp, PieChart, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/wallet", icon: Wallet, label: "Wallet" },
  { href: "/investments", icon: TrendingUp, label: "Invest" },
  { href: "/portfolio", icon: PieChart, label: "Portfolio" },
  { href: "/community", icon: Users, label: "Community" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-background/97 backdrop-blur-md border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-screen-sm mx-auto">
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link key={href} href={href} data-testid={`nav-${label.toLowerCase()}`}>
              <div className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl transition-all duration-200 relative">
                {isActive && (
                  <div className="absolute inset-0 rounded-2xl bg-primary/10" />
                )}
                <Icon
                  size={20}
                  className={cn(
                    "transition-colors duration-200 relative z-10",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium relative z-10 transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
