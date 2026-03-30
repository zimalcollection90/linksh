"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Copy, Check, ExternalLink, BarChart2, Edit, Trash2, QrCode,
  Search, Filter, Plus, Download, Link2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "../../../../supabase/client";
import CreateLinkDrawer from "@/components/create-link-drawer";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

interface LinkItem {
  id: string;
  short_code: string;
  destination_url: string;
  title?: string;
  click_count?: number;
  status?: string;
  expires_at?: string;
  created_at: string;
  is_password_protected?: boolean;
  users?: { full_name?: string; display_name?: string; email?: string };
}

const statusColors: Record<string, string> = {
  active: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  expired: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  paused: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function LinksClient({ links: initialLinks, isAdmin }: { links: LinkItem[]; isAdmin: boolean }) {
  const [links, setLinks] = useState(initialLinks);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editLink, setEditLink] = useState<LinkItem | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleCopy = (shortCode: string, id: string) => {
    navigator.clipboard.writeText(`${baseUrl}/${shortCode}`);
    setCopiedId(id);
    toast.success("Copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("links").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete link");
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== id));
    toast.success("Link deleted");
  };

  const filtered = links.filter((l) => {
    const matchesSearch =
      !search ||
      l.short_code.toLowerCase().includes(search.toLowerCase()) ||
      l.destination_url.toLowerCase().includes(search.toLowerCase()) ||
      l.title?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || l.status === filter;
    return matchesSearch && matchesFilter;
  });

  const refreshLinks = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("users").select("id, role").eq("user_id", user.id).single();
    const query = isAdmin
      ? supabase.from("links").select("*, users(full_name, display_name, email)").order("created_at", { ascending: false })
      : supabase.from("links").select("*").eq("user_id", profile?.id).order("created_at", { ascending: false });
    const { data } = await query;
    if (data) setLinks(data);
  };

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>Links</h1>
          <p className="text-sm text-muted-foreground mt-1">{links.length} total links</p>
        </div>
        <Button
          className="gap-2 bg-primary hover:bg-primary/90 text-white"
          onClick={() => { setEditLink(null); setDrawerOpen(true); }}
        >
          <Plus className="w-4 h-4" />
          New Link
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {["all", "active", "expired", "paused"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Link2 className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No links found</p>
            <p className="text-xs mt-1">Create your first short link to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Link</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Destination</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Clicks</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Created</th>
                  {isAdmin && <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Owner</th>}
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((link, i) => (
                  <motion.tr
                    key={link.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <ExternalLink className="w-3 h-3 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-mono font-medium text-primary">/{link.short_code}</p>
                          {link.title && <p className="text-xs text-muted-foreground">{link.title}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{link.destination_url}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <BarChart2 className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-medium">{(link.click_count || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${statusColors[link.status || "active"]}`}>
                        {link.status || "active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {link.users?.display_name || link.users?.full_name || link.users?.email?.split("@")[0] || "—"}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCopy(link.short_code, link.id)}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                          title="Copy"
                        >
                          {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <Link
                          href={`/dashboard/links/${link.id}`}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                          title="Analytics"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => { setEditLink(link); setDrawerOpen(true); }} className="gap-2">
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(link.id)}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateLinkDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editLink={editLink}
        onSuccess={refreshLinks}
      />
    </div>
  );
}
