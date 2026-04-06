"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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

export default function AppSidebar({ isMobile }: { isMobile?: boolean }) {
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
      <motion.aside
        initial={false}
        animate={{ width: isMobile ? "100%" : collapsed ? 64 : 240 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "flex flex-col h-screen z-40 bg-sidebar border-sidebar-border relative",
          isMobile ? "w-full border-r-0" : "hidden lg:flex sticky top-0 border-r"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
          collapsed && "justify-center px-0"
        )}>
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex-shrink-0"
          >
            <Zap className="w-4 h-4 text-primary" />
          </motion.div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sidebar-foreground font-bold text-lg tracking-tight whitespace-nowrap" 
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                LinkFlux
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!collapsed && section.label && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40 mb-2"
                >
                  {section.label}
                </motion.p>
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
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative",
                      collapsed && "justify-center px-2",
                      isActive
                        ? "text-primary font-semibold"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    )}
                  >
                    {/* Sliding Background Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-pill"
                        className="absolute inset-0 bg-primary/10 rounded-lg -z-10 border-l-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      animate={isActive ? { scale: 1.1, filter: "drop-shadow(0 0 4px rgba(var(--primary),0.5))" } : { scale: 1, filter: "none" }}
                    >
                      <Icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                    </motion.div>

                    {!collapsed && (
                      <motion.span 
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-sm overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}

                    {!collapsed && item.badge && (
                      <Badge className="ml-auto text-xs py-0 px-1.5 bg-primary/20 text-primary border-0">
                        {item.badge}
                      </Badge>
                    )}

                    {/* Active Dot for "Selects" functionality */}
                    {isActive && collapsed && (
                       <motion.div 
                        layoutId="active-dot"
                        className="absolute right-1.5 w-1 h-1 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                       />
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
                <div className="w-5 h-5 flex items-center justify-center">
                  {!mounted ? (
                    <Moon className="w-4 h-4 flex-shrink-0" />
                  ) : theme === "dark" ? (
                    <Sun className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Moon className="w-4 h-4 flex-shrink-0" />
                  )}
                </div>
                {!collapsed && <span className="text-sm whitespace-nowrap">Toggle Theme</span>}
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
                  {!collapsed && <span className="text-sm whitespace-nowrap">Sign Out</span>}
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
            "flex items-center gap-2 px-2 py-2 rounded-lg bg-sidebar-accent/50 overflow-hidden",
            collapsed && "justify-center px-0"
          )}>
            <Avatar className="w-7 h-7 flex-shrink-0 ring-1 ring-primary/20">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[11px] font-medium text-sidebar-foreground truncate leading-none mb-1">{displayName}</p>
                <Badge variant="outline" className={cn(
                  "text-[9px] py-0 px-1 border-0 h-4",
                  isAdmin ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                )}>
                  {isAdmin ? "Admin" : "Member"}
                </Badge>
              </motion.div>
            )}
          </div>
        </div>

        {/* Collapse toggle - only show on desktop */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-primary hover:border-primary transition-all duration-200 z-50 group shadow-sm hover:shadow-md"
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            ) : (
              <ChevronLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
            )}
          </button>
        )}
      </motion.aside>
    </TooltipProvider>
  );
}
