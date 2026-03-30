"use client";

import React from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, Zap } from "lucide-react";
import Link from "next/link";

interface BioPageClientProps {
  profile: {
    full_name?: string;
    display_name?: string;
    username?: string;
    bio?: string;
    avatar_url?: string;
    email?: string;
  };
  links: Array<{
    id: string;
    short_code: string;
    title?: string;
    destination_url: string;
    click_count?: number;
  }>;
}

export default function BioPageClient({ profile, links }: BioPageClientProps) {
  const displayName = profile.display_name || profile.full_name || profile.username || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Profile Card */}
        <div className="flex flex-col items-center mb-8">
          <Avatar className="w-20 h-20 mb-4 ring-4 ring-primary/30">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="text-2xl font-bold bg-primary/20 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>{displayName}</h1>
          {profile.username && (
            <p className="text-sm text-muted-foreground mt-0.5">@{profile.username}</p>
          )}
          {profile.bio && (
            <p className="text-sm text-muted-foreground mt-3 text-center leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.map((link, i) => (
            <motion.a
              key={link.id}
              href={`${baseUrl}/${link.short_code}`}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center justify-between w-full p-4 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/40 transition-all duration-200 group hover:scale-[1.02]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{link.title || link.destination_url}</p>
                {link.title && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{link.destination_url}</p>
                )}
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 ml-3 transition-colors" />
            </motion.a>
          ))}
        </div>

        {links.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">No links yet</p>
          </div>
        )}

        {/* Powered by */}
        <div className="flex items-center justify-center gap-1.5 mt-10">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Powered by <span className="text-primary font-medium">LinkFlux</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
