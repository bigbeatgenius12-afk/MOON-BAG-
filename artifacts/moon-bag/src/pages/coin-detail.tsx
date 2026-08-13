import { useState } from "react";
import { useParams } from "wouter";
import { useGetMarketCoin, useGetMarketCoinChart, getGetMarketCoinQueryKey, getGetMarketCoinChartQueryKey } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight, Info, ExternalLink } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";
import { formatPrice, formatNumber, formatPercent, cn } from "@/lib/utils";

export default function CoinDetailPage() {
  const { coinId } = useParams<{ coinId: string }>();
  const [days, setDays] = useState<number>(7);

  const { data: coin, isLoading: isCoinLoading } = useGetMarketCoin(coinId || "", {
    query: { enabled: !!coinId, queryKey: getGetMarketCoinQueryKey(coinId || "") }
  });

  const { data: chartData, isLoading: isChartLoading } = useGetMarketCoinChart(coinId || "", days, {
    query: { enabled: !!coinId, queryKey: getGetMarketCoinChartQueryKey(coinId || "", days) }
  });

  const formattedChartData = chartData?.prices.map(([timestamp, price]) => ({
    time: new Date(timestamp).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      hour: days === 1 ? 'numeric' : undefined 
    }),
    price
  })) || [];

  if (isCoinLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-32 bg-muted/20 border border-border" />
        <div className="h-96 bg-muted/20 border border-border" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-24 bg-muted/20 border border-border" />
          <div className="h-24 bg-muted/20 border border-border" />
          <div className="h-24 bg-muted/20 border border-border" />
          <div className="h-24 bg-muted/20 border border-border" />
        </div>
      </div>
    );
  }

  if (!coin) {
    return <div className="text-center py-20 font-mono text-muted-foreground uppercase">Asset not found.</div>;
  }

  const isPositive = coin.price_change_percentage_24h && coin.price_change_percentage_24h >= 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
      {/* Header Profile */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <img src={coin.image} alt={coin.name} className="w-16 h-16 rounded-full bg-card border border-border" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{coin.name}</h1>
              <Badge variant="outline" className="text-sm px-2 py-0.5">{coin.symbol.toUpperCase()}</Badge>
              {coin.market_cap_rank && (
                <Badge className="bg-muted text-muted-foreground">Rank #{coin.market_cap_rank}</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {coin.homepage && (
                <a href={coin.homepage} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <ExternalLink className="w-3 h-3" /> Website
                </a>
              )}
              {coin.twitter_handle && (
                <a href={`https://twitter.rem/${coin.twitter_handle}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <ExternalLink className="w-3 h-3" /> @{coin.twitter_handle}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="text-4xl font-mono font-bold tracking-tighter">
            {formatPrice(coin.current_price)}
          </div>
          <div className={cn("flex items-center gap-1 font-mono font-bold mt-1 text-lg", isPositive ? "text-primary" : "text-destructive")}>
            {isPositive ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            {formatPercent(coin.price_change_percentage_24h)} <span className="text-sm font-sans text-muted-foreground ml-1">(24H)</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <Card className="p-4 border-border/50 bg-card/30">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold uppercase tracking-wider flex items-center gap-2">
            <LineChart className="w-5 h-5 text-primary" />
            Price History
          </h3>
          <div className="flex items-center gap-2 bg-muted/30 p-1 border border-border">
            {[1, 7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-3 py-1 text-xs font-mono font-bold transition-colors",
                  days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          {isChartLoading ? (
            <div className="w-full h-full flex items-center justify-center font-mono text-muted-foreground animate-pulse">
              LOADING_CHART_DATA...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedChartData}>
                <XAxis 
                  dataKey="time" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  minTickGap={30}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => formatPrice(val)}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 0, fontFamily: 'monospace' }}
                  itemStyle={{ color: 'hsl(var(--primary))' }}
                  formatter={(value: number) => [formatPrice(value), 'Price']}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-border/50 bg-card/30">
          <div className="text-xs text-muted-foreground uppercase mb-1 font-bold tracking-wider">Market Cap</div>
          <div className="font-mono text-xl font-medium">${formatNumber(coin.market_cap)}</div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/30">
          <div className="text-xs text-muted-foreground uppercase mb-1 font-bold tracking-wider">24h Volume</div>
          <div className="font-mono text-xl font-medium">${formatNumber(coin.total_volume)}</div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/30">
          <div className="text-xs text-muted-foreground uppercase mb-1 font-bold tracking-wider">Circulating Supply</div>
          <div className="font-mono text-xl font-medium">{coin.circulating_supply ? formatNumber(coin.circulating_supply) : "∞"}</div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/30">
          <div className="text-xs text-muted-foreground uppercase mb-1 font-bold tracking-wider">All Time High</div>
          <div className="font-mono text-xl font-medium text-primary">{coin.ath ? formatPrice(coin.ath) : "-"}</div>
        </Card>
      </div>

      {/* Description */}
      {coin.description && (
        <Card className="p-6 border-border/50">
          <h3 className="font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-primary" />
            About {coin.name}
          </h3>
          <div 
            className="prose prose-invert max-w-none text-muted-foreground font-sans text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: coin.description }} 
          />
        </Card>
      )}
    </div>
  );
}
