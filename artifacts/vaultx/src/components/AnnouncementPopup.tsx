import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { X, Megaphone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Announcement {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
}

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    // Bullet points
    if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
      const content = trimmed.replace(/^[•\-*]\s*/, "");
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-primary mt-1 shrink-0">•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }

    // Numbered lists
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-primary font-semibold shrink-0 min-w-[1.2rem]">{numberedMatch[1]}.</span>
          <span>{renderInline(numberedMatch[2])}</span>
        </div>
      );
    }

    // Checkmarks (✅)
    if (trimmed.startsWith("✅") || trimmed.startsWith("☑") || trimmed.startsWith("✔")) {
      return (
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span>{renderInline(trimmed)}</span>
        </div>
      );
    }

    return <p key={i} className="my-0.5">{renderInline(trimmed)}</p>;
  });
}

function renderInline(text: string) {
  // Handle markdown links [text](url)
  const parts = text.split(/(\[.+?\]\(.+?\))/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\[(.+?)\]\((.+?)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80">
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function AnnouncementPopup() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchAnnouncement = useCallback(async () => {
    if (!user || fetched) return;
    setFetched(true);
    try {
      const res = await fetch("/api/announcements/active", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setAnnouncement(data);
        setTimeout(() => setVisible(true), 600);
      }
    } catch {}
  }, [user, fetched]);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  const dismiss = useCallback(async (announcementId: number) => {
    setClosing(true);
    await new Promise((r) => setTimeout(r, 300));
    setVisible(false);
    setClosing(false);
    setAnnouncement(null);

    try {
      await fetch(`/api/announcements/${announcementId}/view`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
  }, []);

  const [, navigate] = useLocation();

  const handleViewCommunity = async (announcementId: number) => {
    await dismiss(announcementId);
    navigate("/community");
  };

  if (!user || !announcement || !visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-4 transition-all duration-300",
        visible && !closing ? "bg-black/60 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"
      )}
    >
      <div
        className={cn(
          "relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col transition-all duration-300",
          visible && !closing
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-8 scale-95"
        )}
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Megaphone size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-0.5">
              Wexora Global
            </p>
            <h2 className="text-base font-bold text-foreground leading-tight truncate">
              {announcement.title}
            </h2>
          </div>
          <button
            onClick={() => dismiss(announcement.id)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-foreground leading-relaxed space-y-0.5 min-h-0">
          {renderContent(announcement.content)}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-4 border-t border-border shrink-0 space-y-2">
          <Button
            className="w-full h-11 font-semibold text-sm rounded-xl"
            onClick={() => dismiss(announcement.id)}
          >
            I Understand
          </Button>
          <Button
            variant="outline"
            className="w-full h-10 text-sm rounded-xl gap-2"
            onClick={() => handleViewCommunity(announcement.id)}
          >
            <MessageSquare size={14} />
            View Community
          </Button>
          <p className="text-center text-[10px] text-muted-foreground pt-1">
            This message will not be shown again for 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
