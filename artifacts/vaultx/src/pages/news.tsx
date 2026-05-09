import { useState } from "react";
import { Newspaper, Search, ArrowLeft, Calendar, Tag, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { Link, useParams } from "wouter";

const CATEGORIES = ["all", "announcement", "investment", "security", "market"];
const CATEGORY_COLORS: Record<string, string> = {
  announcement: "bg-primary/10 text-primary border-primary/20",
  investment: "bg-emerald-50 text-emerald-600 border-emerald-200",
  security: "bg-amber-50 text-amber-600 border-amber-200",
  market: "bg-purple-50 text-purple-600 border-purple-200",
};

async function fetchNews(category?: string, search?: string) {
  const params = new URLSearchParams({ limit: "50" });
  if (category && category !== "all") params.set("category", category);
  const res = await fetch(`/api/news?${params}`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  if (search) return data.filter((p: any) => p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt?.toLowerCase().includes(search.toLowerCase()));
  return data;
}

export function NewsArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { data: post, isLoading } = useQuery({
    queryKey: ["news", id],
    queryFn: async () => {
      const res = await fetch(`/api/news/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <AppLayout title="News">
        <div className="px-4 pt-5 space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout title="News">
        <div className="px-4 pt-10 text-center">
          <p className="text-muted-foreground">Article not found</p>
          <Link href="/news" className="text-primary text-sm mt-2 inline-block">← Back to News</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="News">
      <div className="px-4 pt-4 pb-24">
        <Link href="/news" className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors">
          <ArrowLeft size={14} />
          Back to News
        </Link>

        <div className="space-y-3">
          <Badge className={cn("text-xs capitalize border", CATEGORY_COLORS[post.category] ?? "bg-muted")}>
            <Tag size={10} className="mr-1" />
            {post.category}
          </Badge>
          <h1 className="text-xl font-bold text-foreground leading-tight">{post.title}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={12} />
            <span>{formatDateTime(post.publishedAt ?? post.createdAt)}</span>
          </div>
          {post.imageUrl && (
            <img src={post.imageUrl} alt={post.title} className="w-full rounded-xl aspect-video object-cover" />
          )}
          <div className="pt-2 prose prose-sm max-w-none">
            {post.content.split("\n").map((para: string, i: number) => (
              <p key={i} className="text-sm text-foreground/90 leading-relaxed mb-3">{para}</p>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewsPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["news", category, search],
    queryFn: () => fetchNews(category, search),
    staleTime: 60000,
  });

  return (
    <AppLayout title="News">
      <div className="px-4 pt-5 pb-24 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search news..."
            className="pl-9 h-10"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                category === c ? "bg-primary text-white border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        ) : posts?.length ? (
          <div className="space-y-3">
            {posts.map((post: any) => (
              <Link key={post.id} href={`/news/${post.id}`}>
                <div className="bg-white border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]">
                  {post.isFeatured && (
                    <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] mb-2">Featured</Badge>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground leading-tight">{post.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border capitalize", CATEGORY_COLORS[post.category] ?? "bg-muted text-muted-foreground")}>
                          {post.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar size={9} />
                          {formatDateTime(post.publishedAt ?? post.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-2xl p-10 text-center">
            <Newspaper size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No news found</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later for updates</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
