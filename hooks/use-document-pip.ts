"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ── Document PiP type augmentation ────────────────────────────────────
// The Document Picture-in-Picture API is Chromium-only (Chrome 116+).
// It is not in standard DOM lib types, so we declare it here.

interface DocumentPictureInPicture {
  requestWindow(options?: {
    width?: number;
    height?: number;
  }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useDocumentPip() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof window.documentPictureInPicture !== "undefined";

  const requestPip = useCallback(async (): Promise<Window | null> => {
    if (!window.documentPictureInPicture) return null;

    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 200,
      });

      // Copy stylesheets so Tailwind/CSS works inside the PiP window.
      // We iterate the host page's stylesheets and clone them into PiP.
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.href) {
            // External stylesheet — create a <link>
            const link = pip.document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pip.document.head.appendChild(link);
          } else if (sheet.cssRules) {
            // Inline <style> block — clone rules
            const style = pip.document.createElement("style");
            for (const rule of Array.from(sheet.cssRules)) {
              style.appendChild(pip.document.createTextNode(rule.cssText));
            }
            pip.document.head.appendChild(style);
          }
        } catch {
          // CORS-restricted sheets will throw on .cssRules — skip them
        }
      }

      // Set PiP window background to match our dark theme
      pip.document.body.style.margin = "0";
      pip.document.body.style.padding = "0";
      pip.document.body.style.background = "#09090b"; // zinc-950

      pipWindowRef.current = pip;
      setPipWindow(pip);

      // Clean up when the PiP window is closed by the user
      pip.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipWindow(null);
      });

      return pip;
    } catch (err) {
      return null;
    }
  }, []);

  const closePip = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setPipWindow(null);
    }
  }, []);

  // Close PiP when the hook's host component unmounts
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
      }
    };
  }, []);

  return { isSupported, pipWindow, requestPip, closePip };
}
