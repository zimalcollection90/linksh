"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Ban, CheckCircle, Users, MoreHorizontal, Shield, Download,
  BarChart2, Clock, ShieldCheck, Bot, FilterX, UserCheck, UserX, RefreshCw,
  Wifi, TrendingUp, Activity
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  active: {
    label: "Active",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    icon: CheckCircle,
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    icon: Clock,
  },
  suspended: {
    label: "Suspended",
    className: "bg-red-500/15 text-red-400 border-red-500/25",
    icon: Ban,
  },
};

export default function MembersClient({ members: initialMembers }: { members: any[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; memberId: string; action: string; name: string } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const filtered = useMemo(() => members.filter((m) => {
    const matchesSearch = !search ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.display_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [members, search, statusFilter]);

  const selectedUserIds = useMemo(
    () => Object.entries(selectedIds).filter(([, checked]) => checked).map(([id]) => id),
    [selectedIds]
  );

  const counts = useMemo(() => ({
    total: members.length,
    active: members.filter(m => m.status === "active").length,
    pending: members.filter(m => m.status === "pending").length,
    suspended: members.filter(m => m.status === "suspended").length,
  }), [members]);

  // Auto-refresh members from API
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch("/api/admin/members", { cache: "no-store" });
        const json = await res.json();
        if (res.ok && Array.isArray(json?.members)) {
          setMembers(json.members.map((m: any) => ({
            ...m,
            status: m.membership_status || m.status || "pending",
          })));
        }
      } catch {
        // best-effort
      }
    };
    loadMembers();
  }, []);

  const callApi = async (payload: any) => {
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Request failed");
  };

  const handleUpdateStatus = async (memberId: string, status: string) => {
    setProcessing(memberId);
    try {
      await callApi({ action: "set_status", userId: memberId, status });
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, status } : m));
      const labels: Record<string, string> = { active: "approved ✅", suspended: "suspended 🚫", pending: "set to pending" };
      toast.success(`Member ${labels[status] || status}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    setProcessing(memberId);
    try {
      await callApi({ action: "set_role", userId: memberId, role });
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role } : m));
      toast.success(`Role updated to ${role}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update role");
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (memberId: string) => {
    setProcessing(memberId);
    try {
      await callApi({ action: "delete_user", userId: memberId });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success("Member deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete member");
    } finally {
      setProcessing(null);
      setConfirmDialog(null);
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedUserIds.length === 0) { toast.error("Select at least one member"); return; }
    try {
      await callApi({ action: "set_status", userIds: selectedUserIds, status });
      setMembers((prev) => prev.map((m) => selectedUserIds.includes(m.id) ? { ...m, status } : m));
      setSelectedIds({});
      toast.success(`Updated ${selectedUserIds.length} member(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Bulk update failed");
    }
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch("/api/admin/members", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && Array.isArray(json?.members)) {
        setMembers(json.members.map((m: any) => ({
          ...m,
          status: m.membership_status || m.status || "pending",
        })));
        toast.success("Member list refreshed");
      }
    } catch {
      toast.error("Failed to refresh");
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
            Members
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global workspace · {counts.total} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.open("/api/admin/members/export", "_blank")}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: counts.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: counts.active, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Pending Approval", value: counts.pending, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Suspended", value: counts.suspended, icon: Ban, color: "text-red-400", bg: "bg-red-500/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pending Approval Alert */}
      <AnimatePresence>
        {counts.pending > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  {counts.pending} member{counts.pending > 1 ? "s" : ""} waiting for approval
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pending users can sign in but cannot create links or access analytics.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 flex-shrink-0"
              onClick={() => setStatusFilter("pending")}
            >
              View Pending
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-muted/50">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        {selectedUserIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedUserIds.length} selected</span>
            <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10" onClick={() => handleBulkStatus("active")}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve All
            </Button>
            <Button size="sm" variant="outline" className="text-red-400 border-red-500/40 hover:bg-red-500/10" onClick={() => handleBulkStatus("suspended")}>
              <Ban className="w-3.5 h-3.5 mr-1" /> Suspend All
            </Button>
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.length === filtered.length && filtered.length > 0}
                    onChange={(e) => {
                      const next: Record<string, boolean> = {};
                      if (e.target.checked) filtered.forEach(m => { next[m.id] = true; });
                      setSelectedIds(next);
                    }}
                    className="rounded"
                  />
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Member</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Links</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Clicks</span>
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                  <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> Real / Bot</span>
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Joined</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Last Active</span>
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-sm text-muted-foreground py-16">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No members found
                  </td>
                </tr>
              )}
              {filtered.map((member, i) => {
                const name = member.display_name || member.full_name || member.email?.split("@")[0] || "Unknown";
                const initials = name.slice(0, 2).toUpperCase();
                const status = member.status || "pending";
                const statusCfg = statusConfig[status] || statusConfig.pending;
                const StatusIcon = statusCfg.icon;
                const isLoading = processing === member.id;

                return (
                  <motion.tr
                    key={member.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors ${isLoading ? "opacity-60" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={!!selectedIds[member.id]}
                        onChange={(e) => setSelectedIds((prev) => ({ ...prev, [member.id]: e.target.checked }))}
                        className="rounded"
                      />
                    </td>

                    {/* Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="text-xs bg-primary/20 text-primary font-medium">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          {member.last_seen_ip && (
                            <p className="text-[10px] text-muted-foreground/50 font-mono flex items-center gap-1 mt-0.5">
                              <Wifi className="w-2.5 h-2.5" />
                              {member.last_seen_ip}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs border-0 gap-1 ${
                          member.role === "admin" || member.role === "super_admin"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {(member.role === "admin" || member.role === "super_admin") && (
                          <ShieldCheck className="w-3 h-3" />
                        )}
                        {member.role || "member"}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs gap-1 ${statusCfg.className}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </Badge>
                    </td>

                    {/* Links */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm font-medium">{member.linkCount || 0}</span>
                    </td>

                    {/* Clicks */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div>
                        <span className="text-sm font-medium">{(member.totalClicks || 0).toLocaleString()}</span>
                        {member.realClicks > 0 && (
                          <p className="text-[10px] text-emerald-400 font-medium">
                            {member.realClicks.toLocaleString()} real
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Real / Bot */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          {(member.realClicks || 0).toLocaleString()}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-red-400 flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          {(member.botExcluded || 0).toLocaleString()}
                        </span>
                      </div>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {member.created_at
                          ? formatDistanceToNow(new Date(member.created_at), { addSuffix: true })
                          : "—"}
                      </span>
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {member.last_active_at
                          ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })
                          : "Never"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/dashboard/members/${member.id}`}
                          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                          title="View Analytics"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </Link>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all" disabled={isLoading}>
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem asChild className="gap-2">
                              <Link href={`/dashboard/members/${member.id}`}>
                                <BarChart2 className="w-3.5 h-3.5" /> View Analytics
                              </Link>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Approve */}
                            {status !== "active" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(member.id, "active")}
                                className="gap-2 text-emerald-400 focus:text-emerald-400 focus:bg-emerald-500/10"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve Member
                              </DropdownMenuItem>
                            )}

                            {/* Suspend */}
                            {status === "active" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(member.id, "suspended")}
                                className="gap-2 text-red-400 focus:text-red-400 focus:bg-red-500/10"
                              >
                                <Ban className="w-3.5 h-3.5" /> Suspend
                              </DropdownMenuItem>
                            )}

                            {/* Reactivate */}
                            {status === "suspended" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(member.id, "active")}
                                className="gap-2 text-emerald-400 focus:text-emerald-400 focus:bg-emerald-500/10"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Reactivate
                              </DropdownMenuItem>
                            )}

                            {/* Reject pending */}
                            {status === "pending" && (
                              <DropdownMenuItem
                                onClick={() => handleUpdateStatus(member.id, "suspended")}
                                className="gap-2 text-orange-400 focus:text-orange-400 focus:bg-orange-500/10"
                              >
                                <UserX className="w-3.5 h-3.5" /> Reject
                              </DropdownMenuItem>
                            )}

                            {/* Role toggle */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member.id, member.role === "admin" ? "member" : "admin")}
                              className="gap-2"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              {member.role === "admin" ? "Demote to Member" : "Promote to Admin"}
                            </DropdownMenuItem>

                            {/* Delete */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmDialog({ open: true, memberId: member.id, action: "delete", name })
                              }
                              className="gap-2 text-red-400 focus:text-red-400 focus:bg-red-500/10"
                            >
                              <UserX className="w-3.5 h-3.5" /> Delete Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Syne, sans-serif" }}>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{confirmDialog?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => confirmDialog && handleDelete(confirmDialog.memberId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
