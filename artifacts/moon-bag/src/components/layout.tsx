import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Rocket, TrendingUp, LineChart, Wallet, Terminal, ShieldCheck, Users, Bot } from "lucide-react";
import { useGetLaunchedCoins, getGetLaunchedCoinsQueryKey, useGetTraderStats, getGetTraderStatsQueryKey } from "@workspace/api-client-react";
import { formatPrice, formatNumber } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { LiveTick } from "@/components/live-tick";
import { CoinLogo } from "@/components/coin-logo";
import { spotlightActive, isSpotlit } from "@/lib/spotlight";

const LOGO_URL = new URL("/logo.png", import.meta.url).href;

function MergegoatWidget() {
  const { data: coins } = useGetLaunchedCoins({ sort: "newest", limit: 50 }, { query: { queryKey: getGetLaunchedCoinsQueryKey({ sort: "newest", limit: 50 }), refetchInterval: 8000 } });
  const goat = coins?.find((c) => c.ticker === "MGOAT");
  if (!isSpotlit("MGOAT")) return null;
  if (!goat) return null;
  const change = goat.price_change_24h ?? 0;
  const up = change >= 0;
  return (
    <Link href={`/launched/${goat.id}`}>
      <div className="hidden sm:flex items-center gap-2 border border-purple-500/60 bg-purple-500/10 px-3 py-1.5 hover:bg-purple-500/20 hover:border-purple-400 transition-all cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.15)]">
        <img src="/mergegoat.png" alt="MERGEGOAT" className="w-5 h-5 object-cover rounded-full shrink-0" />
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="font-bold text-purple-400 uppercase tracking-wider">MGOAT</span>
          <LiveTick value={goat.price} className="text-foreground font-bold">{formatPrice(goat.price)}</LiveTick>
          <LiveTick value={change} className={cn("font-bold", up ? "text-primary" : "text-destructive")}>
            {up ? "+" : ""}{change.toFixed(2)}%
          </LiveTick>
        </div>
      </div>
    </Link>
  );
}

function BlujoWidget() {
  const { data: coins } = useGetLaunchedCoins({ sort: "newest", limit: 50 }, { query: { queryKey: getGetLaunchedCoinsQueryKey({ sort: "newest", limit: 50 }), refetchInterval: 8000 } });
  const blujo = coins?.find((c) => c.ticker === "BLUJO");
  if (!blujo || !isSpotlit("BLUJO")) return null;
  const change = blujo.price_change_24h ?? 0;
  const up = change >= 0;
  return (
    <Link href={`/launched/${blujo.id}`}>
      <div className="hidden sm:flex items-center gap-2 border border-yellow-400/70 bg-yellow-400/10 px-3 py-1.5 hover:bg-yellow-400/20 hover:border-yellow-300 transition-all cursor-pointer shadow-[0_0_16px_rgba(250,204,21,0.3)]">
        <img src="/blujo-inu.jpg" alt="BLUJO INU" className="w-5 h-5 object-cover rounded-full border border-yellow-400 shrink-0" />
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <ShieldCheck className="w-3 h-3 text-yellow-400 shrink-0" />
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-400 uppercase tracking-wider">BLUJO</span>
          <LiveTick value={blujo.price} className="text-foreground font-bold">{formatPrice(blujo.price)}</LiveTick>
          <LiveTick value={change} className={cn("font-bold", up ? "text-primary" : "text-destructive")}>
            {up ? "+" : ""}{change.toFixed(2)}%
          </LiveTick>
        </div>
      </div>
    </Link>
  );
}

function HotspotBanner() {
  const { data: coins } = useGetLaunchedCoins({ sort: "newest", limit: 50 }, { query: { queryKey: getGetLaunchedCoinsQueryKey({ sort: "newest", limit: 50 }), refetchInterval: 8000 } });
  const now = Date.now();
  const hot = (coins ?? []).filter(
    (c) =>
      c.hotspot_until &&
      new Date(c.hotspot_until).getTime() > now &&
      isSpotlit(c.ticker)
  );
  if (hot.length === 0) return null;
  return (
    <div className="w-full bg-yellow-400/10 border-b border-yellow-400/30 overflow-hidden">
      <div className="container mx-auto px-4 py-1.5 flex items-center gap-3 font-mono text-xs overflow-x-auto">
        <span className="text-yellow-400 font-bold uppercase tracking-widest shrink-0">🔥 Hotspot</span>
        {hot.map((c) => (
          <Link key={c.id} to={`/launched/${c.id}`} className="flex items-center gap-1.5 shrink-0 border border-yellow-400/40 bg-yellow-400/5 px-2 py-0.5 hover:bg-yellow-400/20 transition-colors">
            {c.image_url && <CoinLogo src={c.image_url} alt="" className="w-4 h-4 rounded-full object-cover" />}
            <span className="font-bold text-yellow-400">{c.ticker}</span>
            <LiveTick value={c.price} className="text-muted-foreground">{formatPrice(c.price)}</LiveTick>
            <LiveTick value={c.price_change_24h ?? 0} className={(c.price_change_24h ?? 0) >= 0 ? "text-primary" : "text-destructive"}>
              {(c.price_change_24h ?? 0) >= 0 ? "+" : ""}{(c.price_change_24h ?? 0).toFixed(1)}%
            </LiveTick>
          </Link>
        ))}
        <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">PROMOTED</span>
      </div>
    </div>
  );
}

function FollowersChip() {
  const { traderName } = useWallet();
  const { data: stats } = useGetTraderStats(traderName, {
    query: {
      enabled: !!traderName,
      queryKey: getGetTraderStatsQueryKey(traderName),
      refetchInterval: 15_000,
    },
  });
  const followers = stats?.followers ?? 0;
  return (
    <div className="hidden md:flex items-center gap-2 border border-border/60 bg-muted/20 px-3 py-1.5 font-mono text-xs" title="Followers — trade to gain more!">
      <Users className="w-3 h-3 text-primary shrink-0" />
      <span className="font-bold text-foreground">{formatNumber(followers)}</span>
      <span className="text-muted-foreground">followers</span>
    </div>
  );
}

const OFFICIAL_CA = "ZuBu9xK3mQvR7pTcW2eYfGh5jL8nDs4aUiXoP6bMoonBag";

function ContractChip() {
  const [copied, setCopied] = useState(false);
  const short = `${OFFICIAL_CA.slice(0, 4)}...${OFFICIAL_CA.slice(-4)}`;
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(OFFICIAL_CA).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="hidden lg:flex items-center gap-2 border border-primary/40 bg-primary/5 px-3 py-1.5 hover:border-primary hover:bg-primary/10 transition-all cursor-pointer font-mono text-xs"
      title="Copy contract address"
    >
      <span className="text-muted-foreground">CA:</span>
      <span className="font-bold text-primary">{copied ? "COPIED!" : short}</span>
    </button>
  );
}

function WalletChip() {
  const { balance } = useWallet();
  return (
    <Link href="/portfolio">
      <div className="hidden md:flex items-center gap-2 border border-border/60 bg-muted/20 px-3 py-1.5 hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer font-mono text-xs">
        <Wallet className="w-3 h-3 text-primary shrink-0" />
        <span className="text-muted-foreground">BAL:</span>
        <span className="font-bold text-foreground">${formatNumber(balance)}</span>
      </div>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = spotlightActive
    ? [
        { href: "/", label: "Launches", icon: TrendingUp },
        { href: "/launch", label: "Launch Coin", icon: Rocket },
        { href: "/portfolio", label: "Portfolio", icon: Wallet },
        { href: "/bobo", label: "Bobo", icon: Bot },
      ]
    : [
        { href: "/", label: "Market", icon: LineChart },
        { href: "/launched", label: "Launches", icon: TrendingUp },
        { href: "/launch", label: "Launch Coin", icon: Rocket },
        { href: "/portfolio", label: "Portfolio", icon: Wallet },
        { href: "/bobo", label: "Bobo", icon: Bot },
      ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <img
                src="/logo.png"
                alt="Moon Bag"
                className="w-9 h-9 object-cover rounded-sm group-hover:shadow-[0_0_15px_hsl(var(--primary)/0.6)] transition-all"
              />
              <span className="font-bold text-xl tracking-tighter uppercase font-sans">
                Moon<span className="text-primary">Bag</span>
              </span>
            </Link>
            <MergegoatWidget />
          </div>

          <nav className="hidden md:flex items-center gap-5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider transition-colors hover:text-primary",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <ContractChip />
            <FollowersChip />
            <WalletChip />
            <BlujoWidget />
            <button className="md:hidden p-2 text-muted-foreground hover:text-primary">
              <Terminal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <HotspotBanner />

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border py-6 bg-background mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-muted-foreground uppercase">
          <p>© {new Date().getFullYear()} MoonBag Terminal. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <Wallet className="w-3 h-3" /> Simulated Trading — No Real Money
            </span>
            <span>V_0.1.0_ALPHA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
