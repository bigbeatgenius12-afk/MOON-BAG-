import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return "$0.00";
  if (price < 0.01 && price > 0) {
    // 4 significant digits so tiny prices visibly tick (e.g. $0.000001028)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumSignificantDigits: 4,
      maximumSignificantDigits: 4,
    }).format(price);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toLocaleString();
}

export function formatPercent(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0.00%";
  const formatted = num.toFixed(2) + "%";
  return num > 0 ? "+" + formatted : formatted;
}
