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
import { Copy, Check, Download, RefreshCw, Loader2, ExternalLink } from "lucide-react";
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

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shortUrl = shortCode ? `${baseUrl}/${shortCode}` : "";

  useEffect(() => {
    if (open && !editLink) {
      setShortCode(generateShortCode());
    } else if (editLink) {
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
  }, [open, editLink]);

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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("users")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profileData) {
      toast.error("User profile not found");
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

    let error: any;

    if (editLink) {
      const result = await supabase
        .from("links")
        .update(payload)
        .eq("id", editLink.id);
      error = result.error;
    } else {
      payload.user_id = profileData.id;
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
          {/* Short URL Preview */}
          {shortUrl && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm text-primary font-mono flex-1 truncate">{shortUrl}</span>
              <button
                onClick={handleCopy}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          <Tabs defaultValue="basic">
            <TabsList className="w-full bg-muted">
              <TabsTrigger value="basic" className="flex-1 text-sm">Basic</TabsTrigger>
              <TabsTrigger value="utm" className="flex-1 text-sm">UTM</TabsTrigger>
              <TabsTrigger value="qr" className="flex-1 text-sm">QR Code</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Destination URL *</Label>
                <Input
                  placeholder="https://example.com/your-long-url"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom Alias</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="my-link"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                    className="bg-background font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
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
                <p className="text-xs text-muted-foreground">Leave empty to use generated code: <span className="font-mono text-primary">{shortCode}</span></p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Title</Label>
                <Input
                  placeholder="My Campaign Link"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Expiry Date</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="bg-background"
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                <div>
                  <p className="text-sm font-medium">Password Protection</p>
                  <p className="text-xs text-muted-foreground">Require a password to access</p>
                </div>
                <Switch
                  checked={isPasswordProtected}
                  onCheckedChange={setIsPasswordProtected}
                />
              </div>

              {isPasswordProtected && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Password</Label>
                  <Input
                    type="password"
                    placeholder="Link password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background"
                  />
                </div>
              )}
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
