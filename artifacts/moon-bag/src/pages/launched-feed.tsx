import { useState } from "react";
import { Link } from "wouter";
import { useGetLaunchedCoins, getGetLaunchedCoinsQueryKey } from "@workspace/api-client-react";
import { spotlightActive, isSpotlit, SPOTLIGHT_TICKERS } from "@/lib/spotlight";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateLaunchedCoin } from "@workspace/api-client-react";
import { Rocket, Users, Coins, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { formatPrice, formatNumber, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { LiveTick } from "@/components/live-tick";
import { CoinLogo } from "@/components/coin-logo";

const UNLOCK_CAP = 58_000_000;

export default function LaunchedFeedPage() {
  const [sort, setSort] = useState<"newest" | "trending" | "market_cap">("newest");
  const { data: rawCoins, isLoading } = useGetLaunchedCoins({ sort, limit: 50 }, { query: { queryKey: getGetLaunchedCoinsQueryKey({ sort, limit: 50 }), refetchInterval: 8000 } });

  // Flagship coins (BLUJO INU & MERGEGOAT) always pinned to the top
  const PINNED = ["MGOAT", "BLUJO"];
  const sorted = rawCoins
    ? [
        ...PINNED.map((t) => rawCoins.find((c) => c.ticker === t)).filter((c): c is NonNullable<typeof c> => !!c),
        ...rawCoins.filter((c) => !PINNED.includes(c.ticker)),
      ]
    : rawCoins;
  // Spotlight mode: only show the featured coin
  // Spotlight hides other coins, but coins the user launched themselves always show.
  const coins = spotlightActive
    ? sorted?.filter((c) => isSpotlit(c.ticker) || c.creator_name === "you")
    : sorted;

  const blushe = rawCoins?.find((c) => c.ticker === "BLUSHE");
  const queryClient = useQueryClient();
  const launchBlushe = useCreateLaunchedCoin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinsQueryKey({ sort, limit: 50 }) });
      },
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {SPOTLIGHT_TICKERS.includes("BLUJO") && (
        <div className="relative border-2 border-yellow-400/60 bg-gradient-to-b from-black via-red-950/30 to-black overflow-hidden shadow-[0_0_50px_rgba(250,204,21,0.2)]">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <video
              src="/blujo-fire.mp4"
              poster="/blujo-fire.png"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover min-h-[320px] md:min-h-[480px]"
            />
            <div className="relative flex flex-col items-center justify-center gap-4 p-8">
              <img
                src="/blujo-inu.jpg"
                alt="BLUJO INU"
                className="w-56 h-56 md:w-72 md:h-72 object-cover border-2 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.4)]"
              />
              <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.4)] text-center">
                BLUJO INU
              </h2>
              <p className="font-mono text-xs uppercase tracking-widest text-yellow-400/80 text-center">
                💎 Blue-chip listing — forged in fire
              </p>
              <div className="mt-4 flex items-center gap-4 border border-pink-400/50 bg-pink-500/10 p-4 shadow-[0_0_25px_rgba(244,114,182,0.2)]">
                <img
                  src="/blushe-inu.png"
                  alt="BLUSHE INU"
                  className="w-24 h-24 object-cover border-2 border-pink-400 shadow-[0_0_18px_rgba(244,114,182,0.5)]"
                />
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-rose-400">
                    BLUSHE INU
                  </h3>
                  <p className="font-mono text-[11px] text-pink-300/80">The wife of BLUJO INU 💍</p>
                  {blushe ? (
                    <Link href={`/launched/${blushe.id}`}>
                      <span className="inline-block mt-1.5 bg-pink-400 text-black text-[10px] font-bold font-mono px-3 py-1 uppercase tracking-widest hover:bg-pink-300 transition-colors cursor-pointer">
                        💖 NOW LIVE — TRADE HER
                      </span>
                    </Link>
                  ) : (
                    <button
                      onClick={() =>
                        !launchBlushe.isPending &&
                        launchBlushe.mutate({
                          data: {
                            name: "BLUSHE INU",
                            ticker: "BLUSHE",
                            description:
                              "The glamorous wife of BLUJO INU. Diamonds, silk, and a portfolio that never dips. Behind every great bull is an even greater cow.",
                            image_url: "/blushe-inu.png",
                            creator_name: "BlujoDevs",
                            initial_supply: 1000000000,
                          },
                        })
                      }
                      className="inline-block mt-1.5 bg-pink-400 text-black text-[10px] font-bold font-mono px-3 py-1 uppercase tracking-widest animate-pulse hover:bg-pink-300 hover:animate-none transition-colors cursor-pointer disabled:opacity-50"
                      disabled={launchBlushe.isPending}
                    >
                      {launchBlushe.isPending ? "LAUNCHING..." : "Coming Soon — 💍 Press to make her available"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase flex items-center gap-3">
            <Rocket className="w-8 h-8 text-primary" />
            Launch Terminal
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-2 uppercase">Live feed of unvetted degenerate payloads.</p>
        </div>
        <div className="flex p-1 border border-border bg-card/30">
          {(["newest", "trending", "market_cap"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={cn(
                "px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition-colors",
                sort === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted/20 border-border/50" />
          ))}
        </div>
      ) : coins?.length === 0 ? (
        <div className="text-center py-20 font-mono text-muted-foreground border border-dashed border-border">
          NO LAUNCHES DETECTED. BE THE FIRST.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {coins?.map((coin) => {
            const isRugProof = coin.is_rug_proof;
            const isLuxe = coin.ticker === "BLUJO";
            const unlockCap = coin.market_cap_unlock ?? UNLOCK_CAP;
            const unlockPct = Math.min((coin.market_cap / unlockCap) * 100, 100);

            return (
              <Link key={coin.id} href={`/launched/${coin.id}`}>
                <Card className={cn(
                  "group flex flex-col h-full overflow-hidden transition-all cursor-pointer",
                  isLuxe
                    ? "border-2 border-yellow-400/70 bg-gradient-to-b from-yellow-400/10 via-card/60 to-yellow-400/5 hover:border-yellow-300 shadow-[0_0_35px_rgba(250,204,21,0.25)] hover:shadow-[0_0_50px_rgba(250,204,21,0.4)]"
                    : isRugProof
                    ? "border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.08)]"
                    : "border-border/50 bg-card/40 hover:border-primary/50 hover:bg-card/80"
                )}>
                  {isLuxe ? (
                    <div className="bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-500 text-black text-[10px] font-bold font-mono px-3 py-1.5 flex items-center justify-between uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">💎 BLUE-CHIP LISTING</span>
                      <span>EST. VALUATION: $1,000,000+</span>
                    </div>
                  ) : isRugProof && (
                    <div className="bg-primary text-primary-foreground text-[10px] font-bold font-mono px-3 py-1.5 flex items-center gap-1.5 uppercase tracking-widest">
                      <ShieldCheck className="w-3 h-3" /> RUG PROOF — PENNY COIN
                    </div>
                  )}

                  <div className="p-5 flex-1 space-y-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className={cn(
                            "font-bold text-lg truncate transition-colors",
                            isLuxe
                              ? "text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.35)]"
                              : isRugProof ? "text-primary" : "group-hover:text-primary"
                          )}>{coin.name}</h3>
                          {isLuxe && (
                            <Badge className="text-[10px] shrink-0 bg-yellow-400 text-black border-0 font-bold">24K</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] shrink-0">{coin.ticker}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">by {coin.creator_name}</p>
                      </div>
                      {coin.image_url ? (
                        <CoinLogo
                          src={coin.image_url}
                          alt={coin.name}
                          className={cn(
                            "w-12 h-12 object-cover shrink-0",
                            isLuxe
                              ? "border-2 border-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.5)] ring-2 ring-yellow-400/30 ring-offset-2 ring-offset-black"
                              : isRugProof
                              ? "border border-primary/40 shadow-[0_0_10px_hsl(var(--primary)/0.25)]"
                              : "border border-border"
                          )}
                        />
                      ) : (
                        <div className={cn(
                          "w-12 h-12 flex items-center justify-center font-bold shrink-0 text-sm",
                          isRugProof ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted text-muted-foreground"
                        )}>
                          {coin.ticker.slice(0, 4)}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{coin.description}</p>

                    {/* Unlock progress bar for rug-proof coins */}
                    {isRugProof && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-primary" /> TO $58M UNLOCK</span>
                          <span>{unlockPct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-700 rounded-full"
                            style={{ width: `${unlockPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    "p-4 border-t font-mono grid grid-cols-2 gap-y-3 gap-x-2 text-xs",
                    isLuxe ? "bg-yellow-400/10 border-yellow-400/30" : isRugProof ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/50"
                  )}>
                    <div>
                      <div className="text-muted-foreground mb-1">PRICE</div>
                      <div className="font-bold"><LiveTick value={coin.price}>{formatPrice(coin.price)}</LiveTick></div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1 text-right">MCAP</div>
                      <div className={cn("font-bold text-right", isRugProof ? "text-primary" : "text-primary")}>
                        ${formatNumber(coin.market_cap)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span>{coin.holders} Holders</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <Coins className="w-3 h-3 text-muted-foreground" />
                      <LiveTick value={coin.price_change_24h ?? 0} className={cn(
                        (coin.price_change_24h ?? 0) >= 0 ? "text-primary" : "text-destructive"
                      )}>
                        {formatPercent(coin.price_change_24h ?? 0)}
                      </LiveTick>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
