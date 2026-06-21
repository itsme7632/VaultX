import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ArrowLeft, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { cn } from "@/lib/utils";

const FAQ_CATEGORY_ORDER = [
  "General",
  "Account",
  "Deposits",
  "Withdrawals",
  "Opportunities",
  "Referrals",
  "Security",
];

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

function AccordionItem({ faq, isOpen, onToggle }: { faq: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={cn("border border-border rounded-2xl overflow-hidden transition-all", isOpen && "border-primary/30 shadow-sm")}>
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-4 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-medium text-foreground leading-snug flex-1">{faq.question}</span>
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground shrink-0 mt-0.5 transition-transform duration-200", isOpen && "rotate-180 text-primary")}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
          {faq.answer}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  const [, setLocation] = useLocation();
  const [openId, setOpenId] = useState<number | null>(null);

  const { data: faqs = [], isLoading } = useQuery<FaqItem[]>({
    queryKey: ["faqs"],
    queryFn: () => fetch("/api/faqs", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const grouped: Record<string, FaqItem[]> = {};
  for (const faq of faqs) {
    if (!grouped[faq.category]) grouped[faq.category] = [];
    grouped[faq.category].push(faq);
  }

  const sortedCategories = [
    ...FAQ_CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !FAQ_CATEGORY_ORDER.includes(c)).sort(),
  ];

  return (
    <AppLayout title="FAQ">
      <div className="px-4 pt-2 pb-24 space-y-6">
        <button
          onClick={() => setLocation("/more")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <HelpCircle size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Frequently Asked Questions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Find answers to common questions</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : faqs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-4">
              <HelpCircle size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No FAQs available at the moment.</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later for answers to common questions.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => (
              <div key={category} className="space-y-2">
                <h2 className="text-xs font-bold text-primary uppercase tracking-wider px-1">{category}</h2>
                <div className="space-y-2">
                  {grouped[category].map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      faq={faq}
                      isOpen={openId === faq.id}
                      onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
