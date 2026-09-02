import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pdf_install_dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS has no beforeinstallprompt — show manual Add-to-Home-Screen hint.
    if (isIOS()) {
      setIosHint(true);
      setVisible(true);
    }

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="install-prompt"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-violet-500/30 bg-neutral-900/95 p-4 text-neutral-100 shadow-2xl backdrop-blur md:inset-x-auto md:right-4 md:left-auto md:w-96"
    >
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="PDF Studio" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install PDF Studio</p>
          {iosHint ? (
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
              Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Share, then
              <span className="font-medium text-neutral-200"> “Add to Home Screen”</span> to install.
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
              Add it to your home screen for a full-screen, offline app experience.
            </p>
          )}
          {!iosHint && (
            <div className="mt-3 flex gap-2">
              <Button
                data-testid="install-app-btn"
                size="sm"
                onClick={install}
                className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-500"
              >
                <Download className="h-4 w-4" /> Install
              </Button>
              <Button
                data-testid="install-dismiss-btn"
                size="sm"
                variant="ghost"
                onClick={dismiss}
                className="h-8 text-neutral-400 hover:text-neutral-100"
              >
                Not now
              </Button>
            </div>
          )}
        </div>
        <button
          data-testid="install-close-btn"
          onClick={dismiss}
          className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
