import { Link } from "wouter";
import {
  useGetTraderPositions,
  getGetTraderPositionsQueryKey,
  useGetTraderTrades,
  getGetTraderTradesQueryKey,
  useGetTraderStats,
  getGetTraderStatsQueryKey,
} from "@workspace/api-client-react";
import { Bot, Users, TrendingUp, Wallet, ArrowRightLeft } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { formatNumber, cn } from "@/lib/utils";
import { LiveTick } from "@/components/live-tick";

const BOBO = "bobo";

export default function BoboPage() {
  const { data: positions } = useGetTraderPositions(BOBO, {
    query: { queryKey: getGetTraderPositionsQueryKey(BOBO), refetchInterval: 8000 },
  });
  const { data: trades } = useGetTraderTrades(BOBO, {
    query: { queryKey: getGetTraderTradesQueryKey(BOBO), refetchInterval: 8000 },
  });
  const { data: stats } = useGetTraderStats(BOBO, {
    query: { queryKey: getGetTraderStatsQueryKey(BOBO), refetchInterval: 15000 },
  });

  const totalValue = (positions ?? []).reduce((s, p) => s + p.current_value, 0);
  const totalProfit = (positions ?? []).reduce((s, p) => s + p.profit, 0);
  const wins = (positions ?? []).filter((p) => p.profit > 0).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <Card className="p-6 border-primary/40 bg-primary/5 shadow-[0_0_25px_hsl(var(--primary)/0.1)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 flex items-center justify-center border-2 border-primary/60 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tighter uppercase">Bobo</h1>
              <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-[10px] gap-1">
                <Bot className="w-3 h-3" /> LIVE TRADING BOT
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Super cool. Super smart. Bobo watches every coin, buys the dips, and takes profits — live, around the clock.
            </p>
            <div className="flex items-center gap-2 mt-2 font-mono text-xs text-muted-foreground">
              <Users className="w-3 h-3 text-primary" />
              <span className="font-bold text-foreground">{formatNumber(stats?.followers ?? 0)}</span> followers
              <span className="mx-1 opacity-40">•</span>
              <span className="text-primary animate-pulse font-bold">● TRADING LIVE</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Bag Value", value: `$${formatNumber(totalValue)}`, icon: Wallet, color: "text-primary" },
          { label: "Open P/L", value: `${totalProfit >= 0 ? "+" : "-"}$${formatNumber(Math.abs(totalProfit))}`, icon: TrendingUp, color: totalProfit >= 0 ? "text-primary" : "text-destructive" },
          { label: "Positions", value: `${positions?.length ?? 0}`, icon: ArrowRightLeft, color: "text-foreground" },
          { label: "Winning", value: `${wins}/${positions?.length ?? 0}`, icon: TrendingUp, color: "text-yellow-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-4 border-border/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={cn("w-3.5 h-3.5", color)} />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <div className={cn("font-mono font-bold text-xl", color)}>{value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Holdings */}
        <Card className="border-border/50">
          <div className="p-4 border-b border-border/50 bg-muted/10">
            <h3 className="font-bold uppercase tracking-wider flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4 text-primary" /> Bobo's Bag
            </h3>
          </div>
          <div className="divide-y divide-border/30">
            {!positions?.length
              ? <div className="p-8 text-center text-muted-foreground font-mono text-xs uppercase tracking-wider">Bobo is scanning the market...</div>
              : positions.map((p) => (
                <Link key={p.coin_id} href={`/launched/${p.coin_id}`}>
                  <div className="p-4 flex items-center gap-3 hover:bg-muted/10 transition-colors cursor-pointer">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.coin_name} className="w-9 h-9 object-cover border border-border rounded-full" />
                      : <div className="w-9 h-9 flex items-center justify-center bg-muted text-[10px] font-bold font-mono">{p.ticker.slice(0, 4)}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{p.coin_name} <span className="text-muted-foreground font-mono text-xs">{p.ticker}</span></div>
                      <div className="text-xs font-mono text-muted-foreground">{formatNumber(p.tokens_held)} tokens</div>
                    </div>
                    <div className="text-right font-mono text-sm">
                      <LiveTick value={p.current_value} className="font-bold block">${formatNumber(p.current_value)}</LiveTick>
                      <span className={cn("text-xs", p.profit >= 0 ? "text-primary" : "text-destructive")}>
                        {p.profit >= 0 ? "+" : "-"}${formatNumber(Math.abs(p.profit))}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </Card>

        {/* Recent trades */}
        <Card className="border-border/50">
          <div className="p-4 border-b border-border/50 bg-muted/10 flex justify-between items-center">
            <h3 className="font-bold uppercase tracking-wider flex items-center gap-2 text-sm">
              <ArrowRightLeft className="w-4 h-4 text-primary" /> Bobo's Moves
            </h3>
            <span className="text-xs font-mono text-muted-foreground animate-pulse">LIVE_FEED</span>
          </div>
          <div className="divide-y divide-border/30 max-h-[480px] overflow-y-auto">
            {!trades?.length
              ? <div className="p-8 text-center text-muted-foreground font-mono text-xs uppercase tracking-wider">No moves yet — Bobo is warming up.</div>
              : trades.map((t) => (
                <Link key={t.id} href={`/launched/${t.coin_id}`}>
                  <div className="p-3 flex items-center gap-3 hover:bg-muted/10 transition-colors cursor-pointer font-mono text-sm">
                    <span className={cn("uppercase font-bold text-xs px-2 py-1 shrink-0", t.type === "buy" ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10")}>
                      {t.type}
                    </span>
                    <span className="font-bold truncate">{t.ticker}</span>
                    <span className="ml-auto shrink-0">${formatNumber(t.amount_usd)}</span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {new Date(t.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
