"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Smartphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show prompt if not already installed and on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowPrompt(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="bg-card/95 backdrop-blur-md border border-primary/20 rounded-2xl p-5 shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-700" />
            
            <button 
              onClick={() => setShowPrompt(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
                 <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground">Install LinkFlux App</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Add to home screen for a fast, app-like experience and offline access.
                </p>
                <div className="mt-4 flex items-center gap-2">
                   <Button 
                    size="sm" 
                    className="flex-1 gap-2 text-xs font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/15"
                    onClick={handleInstallClick}
                   >
                     <Download className="w-3.5 h-3.5" />
                     Install Now
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
