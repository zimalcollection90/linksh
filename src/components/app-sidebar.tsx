"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Link2,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  Bell,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "../../supabase/client";
import { signOutAction } from "@/app/actions";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  adminOnly?: boolean;
  exact?: boolean;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const adminSections: NavSection[] = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
      { href: "/dashboard/links", icon: Link2, label: "All Links", exact: true },
      { href: "/dashboard/analytics", icon: BarChart3, label: "All Analytics", exact: true },
      { href: "/dashboard/members", icon: Users, label: "Members" },
    ]
  },
  {
    label: "Personal",
    items: [
      { href: "/dashboard/links?view=own", icon: Link2, label: "My Links" },
      { href: "/dashboard/analytics?view=own", icon: BarChart3, label: "My Analytics" },
      { href: "/dashboard/settings", icon: Settings, label: "Settings" },
    ]
  }
];

const memberItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/links", icon: Link2, label: "Links" },
  { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];



export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // Fetch profile directly from users table — no company dependency
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) setProfile(data);
      }
    };
    getUser();
  }, []);

  const isAdmin =
    profile?.role === "admin" ||
    profile?.role === "super_admin";

  const displayName = profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const sections = isAdmin 
    ? adminSections 
    : [{ label: "", items: memberItems }];

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex flex-col h-screen sticky top-0 bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-40",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
          collapsed && "justify-center px-2"
        )}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex-shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="text-sidebar-foreground font-bold text-lg tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              LinkFlux
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!collapsed && section.label && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40 mb-2">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact 
                  ? pathname === item.href 
                  : pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/dashboard");

                const content = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                      collapsed && "justify-center px-2",
                      isActive
                        ? "bg-primary/15 text-primary border-l-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <Badge className="ml-auto text-xs py-0 px-1.5 bg-primary/20 text-primary border-0">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href} delayDuration={0}>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-border font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return content;
              })}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          {/* Theme toggle */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200",
                  collapsed && "justify-center px-2"
                )}
              >
                {!mounted ? (
                  <Moon className="w-4 h-4 flex-shrink-0" />
                ) : theme === "dark" ? (
                  <Sun className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 flex-shrink-0" />
                )}
                {!collapsed && <span className="text-sm">Toggle Theme</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                Toggle Theme
              </TooltipContent>
            )}
          </Tooltip>

          {/* Sign out */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <form action={signOutAction} className="w-full">
                <button
                  type="submit"
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="text-sm">Sign Out</span>}
                </button>
              </form>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                Sign Out
              </TooltipContent>
            )}
          </Tooltip>

          {/* User */}
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/50",
            collapsed && "justify-center px-2"
          )}>
            <Avatar className="w-7 h-7 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</p>
                <Badge variant="outline" className={cn(
                  "text-[10px] py-0 px-1.5 border-0",
                  isAdmin ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                )}>
                  {isAdmin ? "Admin" : "Member"}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-primary hover:border-primary transition-all duration-200 z-50"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
