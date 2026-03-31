"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Search, Ban, CheckCircle, Mail, Users, MoreHorizontal, Shield, Download, BarChart2, Clock, Globe, ShieldCheck, Bot, FilterX, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  suspended: "bg-red-500/10 text-red-400 border-red-500/20",
  pending: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function MembersClient({ members: initialMembers, invites }: { members: any[]; invites: any[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const filtered = members.filter((m) => {
    const matchesSearch = !search ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.display_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedUserIds = useMemo(
    () => Object.entries(selectedIds).filter(([, checked]) => checked).map(([id]) => id),
    [selectedIds]
  );

  const callMembersApi = async (payload: any) => {
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Request failed");
  };

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await fetch("/api/admin/members", { cache: "no-store" });
        const json = await res.json();
        if (res.ok && Array.isArray(json?.members)) {
          const normalized = json.members.map((m: any) => ({
            ...m,
            status: m.membership_status || m.status || "pending",
          }));
          setMembers(normalized);
        }
      } catch {
        // Best-effort hydration from API.
      }
    };
    loadMembers();
  }, []);

  const handleUpdateStatus = async (memberId: string, status: string) => {
    try {
      await callMembersApi({ action: "set_status", userId: memberId, status });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
      return;
    }
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, status } : m));
    toast.success(`Member ${status}`);
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    try {
      await callMembersApi({ action: "set_role", userId: memberId, role });
    } catch (e: any) {
      toast.error(e?.message || "Failed to update role");
      return;
    }
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role } : m));
    toast.success(`Role updated to ${role}`);
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedUserIds.length === 0) {
      toast.error("Select at least one member");
      return;
    }
    try {
      await callMembersApi({ action: "set_status", userIds: selectedUserIds, status });
      setMembers((prev) => prev.map((m) => (
        selectedUserIds.includes(m.id) ? { ...m, status } : m
      )));
      setSelectedIds({});
      toast.success(`Updated ${selectedUserIds.length} members`);
    } catch (e: any) {
      toast.error(e?.message || "Bulk update failed");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Email required"); return; }
    setInviting(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
      }),
    });
    const payload = await res.json();

    setInviting(false);
    if (!res.ok) { toast.error(payload?.error || "Failed to send invite"); return; }
    const inviteUrl = payload?.inviteUrl || `${window.location.origin}/invite?token=${encodeURIComponent(payload?.invite?.token || "")}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // Clipboard may be blocked; still show the link to the admin.
    }
    toast.success("Invite link created", { description: inviteUrl });
    setInviteOpen(false);
    setInviteEmail("");
  };

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>Members</h1>
          <p className="text-sm text-muted-foreground mt-1">{members.length} total members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.open("/api/admin/members/export", "_blank")}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90 text-white" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: members.length, icon: Users, color: "text-primary" },
          { label: "Active", value: members.filter(m => m.status === "active").length, icon: CheckCircle, color: "text-green-400" },
          { label: "Pending Approval", value: members.filter(m => m.status === "pending").length, icon: Clock, color: "text-amber-400" },
          { label: "Pending Invites", value: invites.filter(i => i.status === "pending").length, icon: Mail, color: "text-cyan-400" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-muted/50">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => handleBulkStatus("active")} disabled={selectedUserIds.length === 0}>
          Activate Selected
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleBulkStatus("suspended")} disabled={selectedUserIds.length === 0}>
          Suspend Selected
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleBulkStatus("pending")} disabled={selectedUserIds.length === 0}>
          Mark Pending
        </Button>
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Member</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Links</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Clicks</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Earnings</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Joined</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">Last Active</th>
                <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-sm text-muted-foreground py-12">No members found</td>
                </tr>
              )}
              {filtered.map((member, i) => {
                const name = member.display_name || member.full_name || member.email?.split("@")[0] || "Unknown";
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <motion.tr
                    key={member.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={!!selectedIds[member.id]}
                          onChange={(e) => setSelectedIds((prev) => ({ ...prev, [member.id]: e.target.checked }))}
                        />
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="text-xs bg-primary/20 text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                          {member.last_seen_ip && (
                            <p className="text-[10px] text-muted-foreground/60 font-mono">{member.last_seen_ip}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs border-0 ${member.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {member.role || "member"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${statusColors[member.status || "active"]}`}>
                        {member.status || "active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm">{member.linkCount || 0}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div>
                        <span className="text-sm">{(member.totalClicks || 0).toLocaleString()}</span>
                        {member.realClicks !== undefined && (
                          <p className="text-[10px] text-green-400">{member.realClicks.toLocaleString()} real</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-green-400">${(member.totalEarnings || 0).toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {member.created_at ? formatDistanceToNow(new Date(member.created_at), { addSuffix: true }) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {member.last_active_at ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true }) : "—"}
                      </span>
                    </td>
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
                            <button className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem asChild className="gap-2">
                              <Link href={`/dashboard/members/${member.id}`}>
                                <BarChart2 className="w-3.5 h-3.5" />
                                View Analytics
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {member.status === "pending" && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(member.id, "active")} className="gap-2 text-green-400 focus:text-green-400">
                                <CheckCircle className="w-3.5 h-3.5" /> Approve Member
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleUpdateRole(member.id, member.role === "admin" ? "member" : "admin")} className="gap-2">
                              <Shield className="w-3.5 h-3.5" />
                              {member.role === "admin" ? "Demote to Member" : "Promote to Admin"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {member.status === "active" ? (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(member.id, "suspended")} className="gap-2 text-red-400 focus:text-red-400">
                                <Ban className="w-3.5 h-3.5" /> Suspend
                              </DropdownMenuItem>
                            ) : member.status === "suspended" ? (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(member.id, "active")} className="gap-2 text-green-400 focus:text-green-400">
                                <CheckCircle className="w-3.5 h-3.5" /> Reactivate
                              </DropdownMenuItem>
                            ) : null}
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

      {/* Pending Invites */}
      {invites.some(i => i.status === "pending") && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            Pending Invites
          </h3>
          <div className="space-y-2">
            {invites.filter(i => i.status === "pending").map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })} · {invite.role}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">Pending</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Syne, sans-serif" }}>Invite Member</DialogTitle>
            <DialogDescription>Send an invitation to a new team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleInvite} disabled={inviting}>
                {inviting ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
