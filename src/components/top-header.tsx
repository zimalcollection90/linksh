"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CreateLinkDrawer from "./create-link-drawer";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import AppSidebar from "./app-sidebar";

function getBreadcrumb(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

export default function TopHeader() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumb(pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-30">
        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden -ml-2">
              <Menu className="w-5 h-5 text-sidebar-foreground" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r border-sidebar-border">
             <div className="h-full flex flex-col">
                <AppSidebar isMobile />
             </div>
          </SheetContent>
        </Sheet>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 flex-1">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-muted-foreground/50 text-sm">/</span>}
              <span
                className={`text-sm ${
                  i === breadcrumbs.length - 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="relative hidden md:flex w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search links..."
            className="pl-8 h-8 text-sm bg-muted/50 border-border"
          />
        </div>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
        </button>

        {/* New Link CTA */}
        <Button
          size="sm"
          className="gap-1.5 bg-primary hover:bg-primary/90 text-white text-sm px-3 h-8"
          onClick={() => setDrawerOpen(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          New Link
        </Button>
      </header>
      <CreateLinkDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
