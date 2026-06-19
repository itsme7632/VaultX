import { useState } from "react";
import { MessageCircle, Plus, ChevronRight, Send, Clock, CheckCircle, XCircle, RefreshCw, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Link, useParams } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  open:     "bg-primary/10 text-primary border-primary/20",
  answered: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  closed:   "bg-muted text-muted-foreground border-border",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  open:     Clock,
  answered: CheckCircle,
  closed:   XCircle,
};

async function apiCall(url: string, method = "GET", body?: any) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).message ?? "Request failed");
  return res.json();
}

export function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: () => apiCall(`/api/support/tickets/${id}`),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const sendReply = useMutation({
    mutationFn: (message: string) => apiCall(`/api/support/tickets/${id}/reply`, "POST", { message }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeTicket = useMutation({
    mutationFn: () => apiCall(`/api/support/tickets/${id}/close`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Ticket closed" });
    },
  });

  const reopenTicket = useMutation({
    mutationFn: () => apiCall(`/api/support/tickets/${id}/reopen`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Ticket reopened" });
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Support">
        <div className="px-4 pt-5 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={ticket?.subject ?? "Support"}>
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <Link href="/support" className="text-xs text-muted-foreground hover:text-foreground mb-2 inline-block">← Back to tickets</Link>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm flex-1 min-w-0 pr-2 truncate">{ticket?.subject}</h2>
            <Badge className={cn("text-[10px] border capitalize shrink-0", STATUS_COLORS[ticket?.status] ?? "")}>
              {ticket?.status}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            #{ticket?.id} · {formatDateTime(ticket?.createdAt)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {ticket?.messages?.map((msg: any) => (
            <div key={msg.id} className={cn("flex", msg.isAdmin ? "justify-start" : "justify-end")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                msg.isAdmin
                  ? "bg-card border border-border text-foreground rounded-tl-sm"
                  : "bg-primary text-white rounded-tr-sm"
              )}>
                {msg.isAdmin && <p className="text-[10px] font-semibold text-primary mb-1">Support Team</p>}
                <p className="leading-relaxed">{msg.message}</p>
                <p className={cn("text-[10px] mt-1", msg.isAdmin ? "text-muted-foreground" : "text-white/70")}>
                  {formatDateTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))}
          {!ticket?.messages?.length && (
            <div className="text-center py-8 text-sm text-muted-foreground">No messages yet</div>
          )}
        </div>

        {ticket?.status !== "closed" ? (
          <div className="px-4 py-3 border-t border-border bg-card">
            <div className="flex gap-2">
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 h-10"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && reply.trim()) sendReply.mutate(reply.trim()); }}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => reply.trim() && sendReply.mutate(reply.trim())}
                disabled={sendReply.isPending || !reply.trim()}
              >
                <Send size={15} />
              </Button>
            </div>
            <button
              onClick={() => closeTicket.mutate()}
              className="text-[10px] text-muted-foreground mt-2 hover:text-foreground transition-colors"
            >
              Close ticket
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-border bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground mb-2">This ticket is closed</p>
            <button
              onClick={() => reopenTicket.mutate()}
              className="text-xs font-semibold text-primary flex items-center gap-1 mx-auto hover:underline"
            >
              <RefreshCw size={11} /> Reopen ticket
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function SupportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => apiCall("/api/support/tickets"),
    staleTime: 30000,
  });

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const createTicket = useMutation({
    mutationFn: (data: { subject: string; message: string }) =>
      apiCall("/api/support/tickets", "POST", data),
    onSuccess: (newTicket: any) => {
      toast({
        title: "Ticket Created",
        description: `Ticket #${newTicket.id} created. We'll respond within 24 hours.`,
      });
      setShowNew(false);
      setSubject(""); setMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const telegramLink    = settings?.support_telegram?.trim() || null;
  const whatsappNumber  = settings?.support_whatsapp?.trim() || null;
  const waCommunity     = settings?.support_whatsapp_community?.trim() || null;
  const tgGroup         = settings?.support_telegram_group?.trim() || null;

  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}`
    : "https://wa.me/";

  const FAQ = [
    { q: "How long do withdrawals take?", a: "Withdrawals are processed within 24 hours after admin approval." },
    { q: "What is the minimum deposit?", a: "Minimum deposit varies by network. TRC20 minimum is 10 USDT." },
    { q: "How are ROI profits calculated?", a: "Daily profits are calculated based on your invested amount and the daily ROI rate." },
    { q: "How do I enable 2FA?", a: "Go to Profile → Security → Enable 2FA and scan the QR code with Google Authenticator." },
  ];

  return (
    <AppLayout title="Support">
      <div className="px-4 pt-5 pb-24 space-y-5">

        {/* Direct support contacts */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={telegramLink ?? "https://t.me/"}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#0088cc]/5 border border-[#0088cc]/20 rounded-xl p-3.5 flex items-center gap-3 hover:bg-[#0088cc]/10 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-[#0088cc]/10 flex items-center justify-center">
              <MessageCircle size={18} className="text-[#0088cc]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Telegram</p>
              <p className="text-[10px] text-muted-foreground">Live support</p>
            </div>
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-3 hover:bg-emerald-500/10 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MessageCircle size={18} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">WhatsApp</p>
              <p className="text-[10px] text-muted-foreground">24/7 support</p>
            </div>
          </a>
        </div>

        {/* Community links — shown only when configured by admin */}
        {(waCommunity || tgGroup) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Communities</p>
            <div className="space-y-2.5">
              {waCommunity && (
                <a
                  href={waCommunity}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3.5 hover:bg-emerald-500/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Join WhatsApp Community</p>
                    <p className="text-[11px] text-muted-foreground truncate">{waCommunity}</p>
                  </div>
                  <ChevronRight size={15} className="text-muted-foreground shrink-0" />
                </a>
              )}
              {tgGroup && (
                <a
                  href={tgGroup}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 bg-[#0088cc]/5 border border-[#0088cc]/20 rounded-xl px-4 py-3.5 hover:bg-[#0088cc]/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0088cc]/10 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-[#0088cc]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Join Telegram Community</p>
                    <p className="text-[11px] text-muted-foreground truncate">{tgGroup}</p>
                  </div>
                  <ChevronRight size={15} className="text-muted-foreground shrink-0" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* New ticket */}
        {showNew ? (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm text-foreground">New Support Ticket</h3>
            <div>
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Describe your issue briefly"
                className="mt-1.5 h-10"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Provide details about your issue..."
                className="mt-1.5 min-h-[100px] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => createTicket.mutate({ subject, message })}
                disabled={createTicket.isPending || !subject || !message}
              >
                {createTicket.isPending ? "Sending..." : "Submit Ticket"}
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full h-11" onClick={() => setShowNew(true)}>
            <Plus size={16} className="mr-2" />
            New Support Ticket
          </Button>
        )}

        {/* Tickets list */}
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (tickets?.length ?? 0) > 0 ? (
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-3">My Tickets</h3>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
              {tickets.map((ticket: any) => {
                const StatusIcon = STATUS_ICONS[ticket.status] ?? Clock;
                return (
                  <Link key={ticket.id} href={`/support/${ticket.id}`}>
                    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border", STATUS_COLORS[ticket.status] ?? "bg-muted")}>
                        <StatusIcon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                        <p className="text-[10px] text-muted-foreground">
                          #{ticket.id} · {formatDateTime(ticket.updatedAt)}
                        </p>
                      </div>
                      <Badge className={cn("text-[9px] border capitalize shrink-0", STATUS_COLORS[ticket.status] ?? "")}>
                        {ticket.status}
                      </Badge>
                      <ChevronRight size={15} className="text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* FAQ */}
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-3">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {FAQ.map((faq, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <p className="text-sm font-medium text-foreground mb-1.5">{faq.q}</p>
                <p className="text-xs text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
