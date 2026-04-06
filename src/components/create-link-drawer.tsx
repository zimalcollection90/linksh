"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Download, RefreshCw, Loader2, ExternalLink, Bookmark, X, ChevronRight, Globe } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "../../supabase/client";

interface CreateLinkDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLink?: any;
  onSuccess?: () => void;
}

function generateShortCode() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function CreateLinkDrawer({ open, onOpenChange, editLink, onSuccess }: CreateLinkDrawerProps) {
  const [destinationUrl, setDestinationUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [title, setTitle] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shortCode, setShortCode] = useState("");
  const [savedUrls, setSavedUrls] = useState<{ id: string; url: string; title?: string }[]>([]);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shortUrl = shortCode ? `${baseUrl}/${shortCode}` : "";

  useEffect(() => {
    if (open) {
      fetchSavedUrls();
      if (!editLink) {
        setShortCode(generateShortCode());
      } else {
        setDestinationUrl(editLink.destination_url || "");
        setCustomAlias(editLink.short_code || "");
        setShortCode(editLink.short_code || "");
        setTitle(editLink.title || "");
        setExpiresAt(editLink.expires_at ? editLink.expires_at.slice(0, 10) : "");
        setIsPasswordProtected(editLink.is_password_protected || false);
        setUtmSource(editLink.utm_source || "");
        setUtmMedium(editLink.utm_medium || "");
        setUtmCampaign(editLink.utm_campaign || "");
      }
    }
  }, [open, editLink]);

  const fetchSavedUrls = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("saved_urls")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSavedUrls(data);
    }
  };

  const handleSaveUrl = async () => {
    if (!destinationUrl) {
      toast.error("Please enter a URL first");
      return;
    }

    try {
      new URL(destinationUrl);
    } catch {
      toast.error("Invalid URL format");
      return;
    }

    setIsSavingUrl(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setIsSavingUrl(false);
      return;
    }

    const { error } = await supabase
      .from("saved_urls")
      .upsert({ 
        user_id: user.id, 
        url: destinationUrl,
        title: title || new URL(destinationUrl).hostname 
      }, { onConflict: "user_id,url" });

    setIsSavingUrl(false);

    if (error) {
      toast.error("Failed to save URL: " + error.message);
    } else {
      toast.success("URL saved for quick access!");
      fetchSavedUrls();
    }
  };

  const removeSavedUrl = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("saved_urls").delete().eq("id", id);
    if (!error) {
      setSavedUrls(prev => prev.filter(u => u.id !== id));
      toast.success("Saved URL removed");
    }
  };

  useEffect(() => {
    if (customAlias) {
      setShortCode(customAlias);
    }
  }, [customAlias]);

  // Generate QR Code
  useEffect(() => {
    if (shortUrl && typeof window !== "undefined") {
      import("qrcode").then((QRCode) => {
        QRCode.toDataURL(shortUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: "#7C3AED",
            light: "#FFFFFF",
          },
        }).then(setQrDataUrl).catch(console.error);
      });
    }
  }, [shortUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${shortCode}.png`;
    a.click();
  };

  const handleSubmit = async () => {
    if (!destinationUrl || !shortCode) {
      toast.error("Destination URL and short code are required");
      return;
    }

    try {
      new URL(destinationUrl);
    } catch {
      toast.error("Invalid URL format");
      return;
    }

    setLoading(true);

    // If this is a new protected link (or enabling protection during edit),
    // require a password so the link can actually be unlocked.
    if (isPasswordProtected) {
      const wasPreviouslyProtected = Boolean(editLink?.is_password_protected);
      const enablingProtection = !wasPreviouslyProtected;
      if (!password && enablingProtection) {
        setLoading(false);
        toast.error("Password is required for protected links");
        return;
      }
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    // Check user status directly — no company dependency
    const { data: userProfile } = await supabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .single();

    if (userProfile?.status !== "active") {
      const msg = userProfile?.status === "suspended"
        ? "Your account has been suspended."
        : "Your account is pending admin approval.";
      toast.error(msg);
      setLoading(false);
      return;
    }

    const payload: any = {
      destination_url: destinationUrl,
      short_code: shortCode,
      title: title || null,
      is_password_protected: isPasswordProtected,
      expires_at: expiresAt || null,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      status: "active",
    };

    // password_hash carries the raw password for server-side hashing.
    if (isPasswordProtected) {
      if (password) payload.password_hash = password;
    } else {
      payload.password_hash = null;
    }

    let error: any;

    if (editLink) {
      const result = await supabase
        .from("links")
        .update(payload)
        .eq("id", editLink.id);
      error = result.error;
    } else {
      payload.user_id = user.id;
      const result = await supabase.from("links").insert(payload);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("This short code is already taken. Try another.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success(editLink ? "Link updated!" : "Link created!", {
      description: shortUrl,
    });
    onOpenChange(false);
    onSuccess?.();

    // Reset form
    if (!editLink) {
      setDestinationUrl("");
      setCustomAlias("");
      setTitle("");
      setExpiresAt("");
      setIsPasswordProtected(false);
      setPassword("");
      setUtmSource("");
      setUtmMedium("");
      setUtmCampaign("");
      setShortCode(generateShortCode());
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-l border-border overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl" style={{ fontFamily: "Syne, sans-serif" }}>
            {editLink ? "Edit Link" : "Create Short Link"}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            {editLink ? "Update your link details" : "Shorten a URL and track its performance"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Enhanced Short URL Preview */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-background border border-primary/20 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-50 group-hover:opacity-100 transition-opacity">
              <Globe className="w-12 h-12 -mr-4 -mt-4 text-primary/10 rotate-12" />
            </div>
            
            <div className="relative space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60">Your Short Link</span>
                {copied && <span className="text-[10px] font-bold text-green-500 uppercase">Copied!</span>}
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold font-mono tracking-tight text-foreground truncate">
                    {baseUrl.replace(/^https?:\/\//, "")}/<span className="text-primary">{shortCode || "......"}</span>
                  </p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full hover:bg-primary/20 hover:text-primary shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <Tabs defaultValue="basic">
            <TabsList className="w-full bg-muted">
              <TabsTrigger value="basic" className="flex-1 text-sm">Basic</TabsTrigger>
              <TabsTrigger value="utm" className="flex-1 text-sm">UTM</TabsTrigger>
              <TabsTrigger value="qr" className="flex-1 text-sm">QR Code</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-5 mt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Destination URL *</Label>
                  <button 
                    onClick={handleSaveUrl}
                    disabled={isSavingUrl || !destinationUrl}
                    className="text-[10px] font-bold uppercase tracking-wide text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSavingUrl ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bookmark className="w-3 h-3" />}
                    Save to Quick-Pick
                  </button>
                </div>
                <div className="relative group">
                  <Input
                    placeholder="https://example.com/your-long-url"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    className="bg-background/50 border-muted-foreground/20 focus:border-primary transition-all pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                    <ExternalLink className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                </div>
                
                {/* Saved URLs Quick Pick */}
                {savedUrls.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Frequently Used</p>
                    <div className="flex flex-wrap gap-2">
                      {savedUrls.slice(0, 5).map((u) => (
                        <div 
                          key={u.id}
                          className="group relative"
                        >
                          <button
                            onClick={() => {
                              setDestinationUrl(u.url);
                              if (u.title) setTitle(u.title);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 border border-border hover:border-primary/50 hover:bg-primary/5 ${
                              destinationUrl === u.url ? "bg-primary/10 border-primary text-primary" : "bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            <span className="truncate max-w-[120px]">{u.title || u.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</span>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeSavedUrl(u.id); }}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center scale-75"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Custom Alias</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs opacity-50">
                      /
                    </div>
                    <Input
                      placeholder="my-link"
                      value={customAlias}
                      onChange={(e) => setCustomAlias(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                      className="bg-background/50 border-muted-foreground/20 font-mono pl-6"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 border-muted-foreground/20 hover:bg-primary/5 hover:text-primary transition-all"
                    onClick={() => {
                      const code = generateShortCode();
                      setCustomAlias("");
                      setShortCode(code);
                    }}
                    title="Generate random code"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 px-1">
                  <div className="w-1 h-1 rounded-full bg-primary/40" />
                  <p className="text-[11px] text-muted-foreground">
                    Leave empty to use generated code: <span className="font-mono font-bold text-primary">{shortCode}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Title (Optional)</Label>
                  <Input
                    placeholder="My Campaign Link"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-background/50 border-muted-foreground/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Expiry Date</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="bg-background/50 border-muted-foreground/20"
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      Password Protection
                      {isPasswordProtected && <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />}
                    </p>
                    <p className="text-xs text-muted-foreground">Restrict access to verified visitors</p>
                  </div>
                  <Switch
                    checked={isPasswordProtected}
                    onCheckedChange={setIsPasswordProtected}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {isPasswordProtected && (
                  <div className="space-y-2 pt-2 animate-in slide-in-from-top-2 duration-200">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Set Password</Label>
                    <Input
                      type="password"
                      placeholder="Enter a secure password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background border-primary/20 focus:border-primary h-9"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="utm" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">Add UTM parameters to track campaign performance</p>
              {[
                { label: "UTM Source", value: utmSource, setter: setUtmSource, placeholder: "google, twitter" },
                { label: "UTM Medium", value: utmMedium, setter: setUtmMedium, placeholder: "cpc, email, social" },
                { label: "UTM Campaign", value: utmCampaign, setter: setUtmCampaign, placeholder: "summer_sale" },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label} className="space-y-2">
                  <Label className="text-sm font-medium">{label}</Label>
                  <Input
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="bg-background"
                  />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="qr" className="mt-4">
              <div className="flex flex-col items-center gap-4">
                {qrDataUrl ? (
                  <div className="p-4 bg-white rounded-xl border border-border">
                    <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-xl bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Enter URL to generate QR</p>
                  </div>
                )}
                {qrDataUrl && (
                  <Button variant="outline" onClick={handleDownloadQR} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download PNG
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
              ) : (
                editLink ? "Update Link" : "Create Link"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
