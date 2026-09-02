import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export const OfflineBadge = () => {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      data-testid="offline-badge"
      className="fixed top-3 left-1/2 z-[70] -translate-x-1/2 flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/95 px-3.5 py-1.5 text-xs font-medium text-amber-950 shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <CloudOff className="h-3.5 w-3.5" />
      Offline — using saved files
    </div>
  );
};
