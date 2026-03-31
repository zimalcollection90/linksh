"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "../../../../supabase/client";
import { useTheme } from "next-themes";
import { updateMonthlyGoalAction } from "@/app/actions";
import {
  User, Shield, Bell, Key, Globe, Palette, Copy, Check,
  Plus, Trash2, Eye, EyeOff, RefreshCw, Target
} from "lucide-react";

interface SettingsClientProps {
  profile: any;
  apiKeys: any[];
  ipExclusions: any[];
  initialMonthlyGoal?: number;
}

export default function SettingsClient({ 
  profile: initialProfile, 
  apiKeys: initialApiKeys, 
  ipExclusions: initialExclusions,
  initialMonthlyGoal = 1000 
}: SettingsClientProps) {
  const [profile, setProfile] = useState(initialProfile || {});
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [ipExclusions, setIpExclusions] = useState(initialExclusions);
  const [newIp, setNewIp] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState(initialMonthlyGoal);
  const [updatingGoal, setUpdatingGoal] = useState(false);
  const supabase = createClient();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (profile?.theme === "light" || profile?.theme === "dark") {
      setTheme(profile.theme);
    }
  }, [profile?.theme, setTheme]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({
        display_name: profile.display_name,
        full_name: profile.full_name,
        username: profile.username,
        bio: profile.bio,
        theme: profile.theme,
        accent_color: profile.accent_color,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) { toast.error("Failed to save profile"); return; }
    toast.success("Profile saved!");
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated!");
    setNewPassword(""); setConfirmPassword(""); setCurrentPassword("");
  };

  const handleGenerateApiKey = async () => {
    const keyValue = "lf_" + Array.from({ length: 32 }, () =>
      Math.random().toString(36).charAt(2)
    ).join("");
    const keyPrefix = keyValue.slice(0, 8) + "...";

    const { error } = await supabase.from("api_keys").insert({
      user_id: profile.id,
      name: `API Key ${apiKeys.length + 1}`,
      key_hash: keyValue,
      key_prefix: keyPrefix,
      is_active: true,
    });

    if (error) { toast.error("Failed to generate key"); return; }
    setGeneratedKey(keyValue);
    toast.success("API Key generated! Copy it now — it won't be shown again.");

    const { data: keys } = await supabase.from("api_keys").select("id, name, key_prefix, last_used_at, usage_count, is_active, created_at").eq("user_id", profile.id);
    if (keys) setApiKeys(keys);
  };

  const handleRevokeApiKey = async (keyId: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", keyId);
    if (error) { toast.error("Failed to revoke key"); return; }
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
    toast.success("API key revoked");
  };

  const handleAddIp = async () => {
    if (!newIp) return;
    const { error } = await supabase.from("ip_exclusions").insert({
      user_id: profile.id,
      ip_address: newIp,
    });
    if (error) { toast.error("Failed to add IP"); return; }
    const { data } = await supabase.from("ip_exclusions").select("*").eq("user_id", profile.id);
    if (data) setIpExclusions(data);
    setNewIp("");
    toast.success("IP added to exclusion list");
  };

  const handleRemoveIp = async (id: string) => {
    await supabase.from("ip_exclusions").delete().eq("id", id);
    setIpExclusions((prev) => prev.filter((ip) => ip.id !== id));
    toast.success("IP removed");
  };
  
  const handleUpdateGoal = async () => {
    setUpdatingGoal(true);
    const res = await updateMonthlyGoalAction(monthlyGoal);
    setUpdatingGoal(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Monthly click goal updated successfully!");
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const displayName = profile.display_name || profile.full_name || profile.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5 max-w-[900px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account settings and preferences.</p>
      </motion.div>

      <Tabs defaultValue="profile">
        <TabsList className="bg-muted/50 mb-6">
          {[
            { value: "profile", icon: User, label: "Profile" },
            { value: "security", icon: Shield, label: "Security" },
            { value: "notifications", icon: Bell, label: "Notifications" },
            { value: "api", icon: Key, label: "API Keys" },
            { value: "ip", icon: Globe, label: "IP Exclusions" },
            { value: "appearance", icon: Palette, label: "Appearance" },
            ...(profile.role === "admin" || profile.role === "super_admin" 
              ? [{ value: "admin", icon: Target, label: "Admin" }] 
              : []),
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 text-xs sm:text-sm">
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-xl bg-primary/20 text-primary font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{displayName}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <Button variant="outline" size="sm" className="mt-2 text-xs h-7">Change Avatar</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={profile.display_name || ""} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input
                    value={profile.username || ""}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                    className="bg-background pl-7"
                    placeholder="your_username"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email || ""} disabled className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                value={profile.bio || ""}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Tell people about yourself..."
                className="bg-background resize-none"
                rows={3}
              />
            </div>
            <Button className="bg-primary hover:bg-primary/90" onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Change Password</h3>
              <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-background pr-9"
                    />
                    <button onClick={() => setShowPasswords(!showPasswords)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type={showPasswords ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type={showPasswords ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-background" />
                </div>
                <Button className="bg-primary hover:bg-primary/90" onClick={handleChangePassword}>Update Password</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold mb-2">Email Preferences</h3>
            {[
              { label: "Weekly Reports", desc: "Get a summary of your link performance every week" },
              { label: "Click Milestones", desc: "Notify me when links reach click milestones" },
              { label: "Fraud Alerts", desc: "Alert me when suspicious activity is detected" },
              { label: "Team Activity", desc: "Notifications about team member activity" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">API Keys</h3>
              <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-white" onClick={handleGenerateApiKey}>
                <Plus className="w-3.5 h-3.5" /> Generate Key
              </Button>
            </div>

            {generatedKey && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-400 font-medium mb-2">⚠️ Copy your key now — it won't be shown again!</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-foreground flex-1 truncate">{generatedKey}</code>
                  <button onClick={() => handleCopy(generatedKey, "new")} className="text-muted-foreground hover:text-primary">
                    {copiedKey === "new" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            {apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No API keys yet. Generate one to get started.</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{key.key_prefix}</p>
                    </div>
                    <Badge variant="outline" className={`text-xs border-0 ${key.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                      {key.is_active ? "Active" : "Revoked"}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:block">{key.usage_count || 0} uses</span>
                    <button onClick={() => handleRevokeApiKey(key.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* IP Exclusions Tab */}
        <TabsContent value="ip">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-semibold">IP Exclusion List</h3>
            <p className="text-sm text-muted-foreground">Clicks from excluded IPs won't count towards your analytics.</p>
            <div className="flex gap-2 max-w-sm">
              <Input
                placeholder="e.g. 192.168.1.1"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                className="bg-background font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleAddIp()}
              />
              <Button className="bg-primary hover:bg-primary/90" onClick={handleAddIp}>Add</Button>
            </div>
            {ipExclusions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No IP exclusions yet.</p>
            ) : (
              <div className="space-y-2">
                {ipExclusions.map((ip) => (
                  <div key={ip.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-mono">{ip.ip_address}</span>
                    <button onClick={() => handleRemoveIp(ip.id)} className="text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Theme</h3>
              <div className="grid grid-cols-2 gap-3 max-w-xs">
                {["dark", "light"].map((t) => (
                  <button
                    key={t}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      profile.theme === t ? "border-primary bg-primary/10" : "border-border hover:border-border/80"
                    }`}
                    onClick={() => {
                      setProfile({ ...profile, theme: t });
                      setTheme(t);
                    }}
                  >
                    <div className={`w-8 h-8 rounded-lg ${t === "dark" ? "bg-slate-800" : "bg-gray-100"}`} />
                    <span className="text-sm capitalize">{t}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Accent Color</h3>
              <div className="flex gap-3">
                {[
                  { name: "purple", color: "#7C3AED" },
                  { name: "teal", color: "#0EA5E9" },
                  { name: "green", color: "#22C55E" },
                  { name: "orange", color: "#F97316" },
                ].map((accent) => (
                  <button
                    key={accent.name}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${profile.accent_color === accent.name ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: accent.color }}
                    onClick={() => setProfile({ ...profile, accent_color: accent.name })}
                  />
                ))}
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90" onClick={handleSaveProfile} disabled={saving}>
              Save Preferences
            </Button>
          </div>
        </TabsContent>

        {/* Admin Tab */}
        <TabsContent value="admin">
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Platform Settings</h3>
              <p className="text-sm text-muted-foreground mb-6">Manage global settings for all platform members.</p>
              
              <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                  <Label htmlFor="monthly-goal">Global Monthly Click Goal</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="monthly-goal"
                      type="number"
                      value={monthlyGoal}
                      onChange={(e) => setMonthlyGoal(parseInt(e.target.value) || 0)}
                      className="bg-background font-mono"
                    />
                    <span className="text-sm text-muted-foreground">clicks</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    This sets the target shown to all members on their dashboard progress bar.
                  </p>
                </div>
                
                <Button 
                  className="bg-primary hover:bg-primary/90" 
                  onClick={handleUpdateGoal} 
                  disabled={updatingGoal}
                >
                  {updatingGoal ? "Updating..." : "Update Global Goal"}
                </Button>
              </div>
            </div>
            
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium mb-2 text-amber-500 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Admin Controls
              </h4>
              <p className="text-xs text-muted-foreground">
                More global administrative settings will appear here in future updates.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
