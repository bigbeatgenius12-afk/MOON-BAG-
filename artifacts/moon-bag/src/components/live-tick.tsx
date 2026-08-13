import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a numeric display and flashes green on an up-tick, red on a down-tick.
 * Pass the raw numeric value driving the display; children render the formatted text.
 * Uses tabular-nums so widths stay stable and the layout never jumps.
 */
export function LiveTick({ value, className, children }: { value: number; className?: string; children: React.ReactNode }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      prev.current = value;
      const t = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [value]);

  return (
    <span
      className={cn(
        "tabular-nums transition-colors duration-300 rounded-sm",
        className,
        flash === "up" && "text-primary bg-primary/20",
        flash === "down" && "text-destructive bg-destructive/20"
      )}
    >
      {children}
    </span>
  );
}
