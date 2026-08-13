import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Search, Flame, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { useGetMarketCoins, useGetTrendingCoins } from "@workspace/api-client-react";
import { Card, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui";
import { formatPrice, formatNumber, formatPercent, cn } from "@/lib/utils";

export default function MarketPage() {
  const [search, setSearch] = useState("");
  const { data: coins, isLoading } = useGetMarketCoins({ page: 1, per_page: 50, search: search || undefined });
  const { data: trendingCoins } = useGetTrendingCoins();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Total Market Overview Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border border-border bg-card/50 backdrop-blur-sm font-mono text-sm">
        <div className="flex items-center gap-6 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase">Global Vol:</span>
            <span className="text-primary font-bold">24H_ACTIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase">Dominance:</span>
            <span className="font-bold">BTC 52.4%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase">Fear/Greed:</span>
            <span className="text-primary font-bold">78 GREED</span>
          </div>
        </div>
      </div>

      {/* Trending Strip */}
      {trendingCoins && trendingCoins.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider">
            <Flame className="w-5 h-5 animate-pulse" />
            <h2>Trending Signals</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {trendingCoins.slice(0, 5).map((coin) => (
              <Link key={coin.id} href={`/coin/${coin.id}`}>
                <Card className="p-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full bg-background" />
                    <div className="overflow-hidden">
                      <div className="font-bold truncate">{coin.symbol.toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground truncate">{coin.name}</div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="font-mono text-sm">{formatPrice(coin.current_price)}</div>
                    <Badge variant={coin.price_change_percentage_24h && coin.price_change_percentage_24h >= 0 ? "success" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {formatPercent(coin.price_change_percentage_24h)}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main Market Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xl">
            <Activity className="w-6 h-6 text-primary" />
            <h1>Live Market</h1>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="SEARCH ASSETS..." 
              className="pl-10 uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden border-border/50">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">24h %</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Market Cap</TableHead>
                <TableHead className="text-right hidden md:table-cell">Volume (24h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="w-4 h-4 bg-muted mx-auto" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                        <div className="w-24 h-4 bg-muted" />
                      </div>
                    </TableCell>
                    <TableCell><div className="w-16 h-4 bg-muted ml-auto" /></TableCell>
                    <TableCell><div className="w-12 h-4 bg-muted ml-auto" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><div className="w-20 h-4 bg-muted ml-auto" /></TableCell>
                    <TableCell className="hidden md:table-cell"><div className="w-20 h-4 bg-muted ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : coins?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-mono">
                    NO ASSETS FOUND MATCHING "{search}"
                  </TableCell>
                </TableRow>
              ) : (
                coins?.map((coin) => {
                  const isPositive = coin.price_change_percentage_24h && coin.price_change_percentage_24h >= 0;
                  return (
                    <TableRow key={coin.id} className="group relative">
                      <TableCell className="text-center text-muted-foreground font-mono text-xs">
                        {coin.market_cap_rank || "-"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/coin/${coin.id}`} className="absolute inset-0 z-10" />
                        <div className="flex items-center gap-3">
                          <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full bg-background" />
                          <div>
                            <div className="font-bold group-hover:text-primary transition-colors">
                              {coin.symbol.toUpperCase()}
                            </div>
                            <div className="text-xs text-muted-foreground">{coin.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatPrice(coin.current_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <div className={cn("flex items-center justify-end gap-1", isPositive ? "text-primary" : "text-destructive")}>
                          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {formatPercent(coin.price_change_percentage_24h)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono hidden sm:table-cell text-muted-foreground">
                        ${formatNumber(coin.market_cap)}
                      </TableCell>
                      <TableCell className="text-right font-mono hidden md:table-cell text-muted-foreground">
                        ${formatNumber(coin.total_volume)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
