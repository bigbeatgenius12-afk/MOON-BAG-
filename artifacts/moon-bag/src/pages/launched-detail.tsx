import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetLaunchedCoin,
  useGetCoinTrades,
  useGetCoinPosts,
  getGetCoinPostsQueryKey,
  useCreateCoinTrade,
  useGetCoinPosition,
  useClaimCoinRewards,
  useBuyCoinHotspot,
  useGetMarketCoin,
  getGetMarketCoinQueryKey,
  useGetLaunchedCoins,
  getGetTraderStatsQueryKey,
  getGetLaunchedCoinQueryKey,
  getGetCoinTradesQueryKey,
  getGetCoinPositionQueryKey,
  getGetLaunchedCoinsQueryKey,
  useGetCoinOrders,
  getGetCoinOrdersQueryKey,
  useCreateCoinOrder,
  useCancelCoinOrder,
} from "@workspace/api-client-react";
import {
  Globe, Twitter, Send, ArrowRightLeft, ShieldCheck, Lock, Unlock,
  TrendingUp, CreditCard, Wallet, Copy, CheckCheck, Flame, Droplets, Gift,
} from "lucide-react";
import { Card, Button, Input, Label, Badge } from "@/components/ui";
import { formatPrice, formatNumber, cn } from "@/lib/utils";
import { LiveTick } from "@/components/live-tick";
import { CoinLogo } from "@/components/coin-logo";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet";

const UNLOCK_CAP = 58_000_000;
const QUICK_AMOUNTS = [10, 50, 100, 500];

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={cn("w-full h-2 bg-muted/40 rounded-full overflow-hidden", className)}>
      <div className="h-full bg-primary transition-all duration-700 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 transition-colors group">
      <span>{short}</span>
      {copied ? <CheckCheck className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground group-hover:text-primary" />}
    </button>
  );
}

export default function LaunchedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const coinId = Number(id);
  const queryClient = useQueryClient();
  const { balance, traderName, deduct, add } = useWallet();

  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [currency, setCurrency] = useState<"USD" | "SOL" | "BLUJO" | "MGOAT">("USD");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [claimMsg, setClaimMsg] = useState("");

  const { data: coin, isLoading: isCoinLoading } = useGetLaunchedCoin(coinId, {
    query: { enabled: !!coinId, queryKey: getGetLaunchedCoinQueryKey(coinId), refetchInterval: 5000 },
  });
  const { data: trades } = useGetCoinTrades(coinId, {
    query: { enabled: !!coinId, queryKey: getGetCoinTradesQueryKey(coinId) },
  });
  const { data: posts } = useGetCoinPosts(coinId, {
    query: { enabled: !!coinId, queryKey: getGetCoinPostsQueryKey(coinId), refetchInterval: 30000 },
  });
  const { data: position, refetch: refetchPosition } = useGetCoinPosition(coinId, traderName, {
    query: { enabled: !!coinId && !!traderName, queryKey: getGetCoinPositionQueryKey(coinId, traderName) },
  });

  const { data: solCoin } = useGetMarketCoin("solana", {
    query: { queryKey: getGetMarketCoinQueryKey("solana"), staleTime: 60_000 },
  });
  const solPrice = solCoin?.current_price ?? 0;

  // BLUJO INU + MERGEGOAT as payment currencies (swap → this coin).
  // Looked up by ticker so they're found no matter how many coins exist.
  const { data: blujoList } = useGetLaunchedCoins({ ticker: "BLUJO", limit: 1 }, {
    query: { queryKey: getGetLaunchedCoinsQueryKey({ ticker: "BLUJO", limit: 1 }) },
  });
  const { data: mgoatList } = useGetLaunchedCoins({ ticker: "MGOAT", limit: 1 }, {
    query: { queryKey: getGetLaunchedCoinsQueryKey({ ticker: "MGOAT", limit: 1 }) },
  });
  const blujoCoin = blujoList?.[0];
  const mgoatCoin = mgoatList?.[0];
  // Page identity comes from the coin itself, not from a bounded list lookup.
  const isBlujoPage = coin?.ticker === "BLUJO";
  const isMgoatPage = coin?.ticker === "MGOAT";
  // All coins are bought with MGOAT (Mergegoat) — except MGOAT itself, which you buy with USD/SOL.
  const mgoatOnly = !isMgoatPage;
  const { data: blujoPosition } = useGetCoinPosition(blujoCoin?.id ?? 0, traderName, {
    query: {
      enabled: !!blujoCoin && !isBlujoPage && !!traderName,
      queryKey: getGetCoinPositionQueryKey(blujoCoin?.id ?? 0, traderName),
    },
  });
  const { data: mgoatPosition } = useGetCoinPosition(mgoatCoin?.id ?? 0, traderName, {
    query: {
      enabled: !!mgoatCoin && !isMgoatPage && !!traderName,
      queryKey: getGetCoinPositionQueryKey(mgoatCoin?.id ?? 0, traderName),
    },
  });
  const blujoHoldingsUsd = blujoPosition?.current_value ?? 0;
  const blujoPrice = blujoCoin?.price ?? 0;
  const mgoatHoldingsUsd = mgoatPosition?.current_value ?? 0;
  const mgoatPrice = mgoatCoin?.price ?? 0;

  // Force MGOAT payment on restricted (newly launched) coins
  useEffect(() => {
    if (mgoatOnly && tradeType === "buy" && currency !== "MGOAT") setCurrency("MGOAT");
  }, [mgoatOnly, tradeType, currency]);

  const createTrade = useCreateCoinTrade();
  const claimRewards = useClaimCoinRewards();
  const buyHotspot = useBuyCoinHotspot();
  const [serviceMsg, setServiceMsg] = useState("");

  const inputNum = parseFloat(amount) || 0;
  const amountNum =
    currency === "SOL" ? inputNum * solPrice :
    currency === "BLUJO" ? inputNum * blujoPrice :
    currency === "MGOAT" ? inputNum * mgoatPrice :
    inputNum;
  const netReceived = amountNum * 0.90; // after 10% fee
  const estimatedTokens = coin && netReceived > 0 ? netReceived / coin.price : 0;
  const insufficientFunds = tradeType === "buy" && (
    currency === "BLUJO" ? amountNum > blujoHoldingsUsd + 0.000001 :
    currency === "MGOAT" ? amountNum > mgoatHoldingsUsd + 0.000001 :
    amountNum > balance
  );

  useEffect(() => {
    if (txStatus === "success" || txStatus === "error") {
      const t = setTimeout(() => setTxStatus("idle"), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [txStatus]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetTraderStatsQueryKey(traderName) });
    queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinQueryKey(coinId) });
    queryClient.invalidateQueries({ queryKey: getGetCoinTradesQueryKey(coinId) });
    queryClient.invalidateQueries({ queryKey: getGetCoinPositionQueryKey(coinId, traderName) });
    refetchPosition();
  };

  const handleTrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountNum || !coin) return;

    // Pay with BLUJO or MGOAT: sell the payment coin first, then buy this coin with the proceeds
    const payCoin = currency === "BLUJO" ? blujoCoin : currency === "MGOAT" ? mgoatCoin : undefined;
    if (tradeType === "buy" && payCoin) {
      const holdings = currency === "BLUJO" ? blujoHoldingsUsd : mgoatHoldingsUsd;
      if (amountNum > holdings + 0.000001) {
        setTxStatus("error"); setTxMsg(`Not enough ${currency}. Buy more first.`); return;
      }
      setTxStatus("processing");
      createTrade.mutate(
        { id: payCoin.id, data: { type: "sell", amount_usd: amountNum, trader_name: traderName } },
        {
          onSuccess: (sellTrade) => {
            const proceeds = sellTrade.amount_usd;
            createTrade.mutate(
              { id: coinId, data: { type: "buy", amount_usd: proceeds, trader_name: traderName } },
              {
                onSuccess: () => {
                  setAmount(""); setTxStatus("success");
                  setTxMsg(`Swapped ${currency} → ${coin.ticker}! Spent $${formatNumber(proceeds)} of ${currency}.`);
                  queryClient.invalidateQueries({ queryKey: getGetCoinPositionQueryKey(payCoin.id, traderName) });
                  queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinQueryKey(payCoin.id) });
                  invalidateAll();
                },
                onError: () => {
                  add(proceeds); // refund proceeds to wallet if the buy leg fails
                  setTxStatus("error"); setTxMsg("Buy leg failed — proceeds added to wallet.");
                },
              }
            );
          },
          onError: () => { setTxStatus("error"); setTxMsg(`${currency} swap failed. Try again.`); },
        }
      );
      return;
    }

    if (tradeType === "buy" && !deduct(amountNum)) {
      setTxStatus("error"); setTxMsg("Insufficient balance. Add funds in Portfolio."); return;
    }
    setTxStatus("processing");
    createTrade.mutate(
      { id: coinId, data: { type: tradeType, amount_usd: amountNum, trader_name: traderName } },
      {
        onSuccess: (trade) => {
          if (tradeType === "sell") add(trade.amount_usd);
          setAmount(""); setTxStatus("success");
          setTxMsg(tradeType === "buy"
            ? `Bought ${formatNumber(estimatedTokens)} ${coin.ticker}! (10% fee applied)`
            : `Sold — received $${formatNumber(trade.amount_usd)}`);
          invalidateAll();
        },
        onError: () => {
          if (tradeType === "buy") add(amountNum);
          setTxStatus("error"); setTxMsg("Trade failed. Try again.");
        },
      }
    );
  };

  // ── Buy triggers: auto-buy with MGOAT when market cap hits a target ──
  const { data: orders } = useGetCoinOrders(coinId, traderName, {
    query: { enabled: !!coinId && !!traderName, queryKey: getGetCoinOrdersQueryKey(coinId, traderName), refetchInterval: 8000 },
  });
  const createOrder = useCreateCoinOrder();
  const cancelOrder = useCancelCoinOrder();
  const [triggerMgoat, setTriggerMgoat] = useState("");
  const [triggerMcap, setTriggerMcap] = useState("");
  const [orderMsg, setOrderMsg] = useState("");

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const mg = parseFloat(triggerMgoat) || 0;
    const mc = parseFloat(triggerMcap) || 0;
    if (mg < 1 || mc < 1) { setOrderMsg("✗ Enter an MGOAT amount and a target market cap."); return; }
    setOrderMsg("");
    createOrder.mutate(
      { id: coinId, data: { trader_name: traderName, mgoat_amount: mg, target_market_cap: mc } },
      {
        onSuccess: () => {
          setTriggerMgoat(""); setTriggerMcap("");
          setOrderMsg("✓ Trigger set! It fires the moment the market cap hits your target.");
          queryClient.invalidateQueries({ queryKey: getGetCoinOrdersQueryKey(coinId, traderName) });
        },
        onError: (e: unknown) => {
          const err = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          setOrderMsg(`✗ ${err ?? "Couldn't set the trigger."}`);
        },
      },
    );
  };

  const handleCancelOrder = (orderId: number) => {
    cancelOrder.mutate(
      { orderId, data: { trader_name: traderName } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCoinOrdersQueryKey(coinId, traderName) }) },
    );
  };

  const handleBuyHotspot = () => {
    setServiceMsg("");
    buyHotspot.mutate(
      { id: coinId, data: { trader_name: traderName } },
      {
        onSuccess: (r) => { setServiceMsg(`✓ Boosted until ${new Date(r.hotspot_until!).toLocaleDateString()} — -$100 MGOAT`); invalidateAll(); },
        onError: (e: unknown) => setServiceMsg(`✗ ${(e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Boost purchase failed"}`),
      }
    );
  };

  const handleClaim = () => {
    if (!coin) return;
    claimRewards.mutate(
      { id: coinId, data: { trader_name: traderName } },
      {
        onSuccess: (result) => {
          add(result.claimed);
          setClaimMsg(result.message);
          invalidateAll();
          setTimeout(() => setClaimMsg(""), 4000);
        },
      }
    );
  };

  if (isCoinLoading) return <div className="animate-pulse h-[60vh] bg-muted/20 border border-border rounded" />;
  if (!coin) return <div className="text-center py-20 font-mono text-muted-foreground">Payload not found.</div>;

  const isRugProof = coin.is_rug_proof;
  const unlockCap = coin.market_cap_unlock ?? UNLOCK_CAP;
  const unlocked = coin.market_cap >= unlockCap;
  const unlockProgress = Math.min((coin.market_cap / unlockCap) * 100, 100);
  const hasPosition = position && position.tokens_held > 0;
  const maxSell = hasPosition ? position.current_value : 0;
  const totalRewards = (position?.locked_rewards ?? 0) + (position?.pending_rewards ?? 0);
  const hotspotActive = !!coin.hotspot_until && new Date(coin.hotspot_until) > new Date();
  const launchDate = new Date(coin.created_at);
  const holdDays = Math.floor((Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">

      {/* ── LEFT ── */}
      <div className="lg:col-span-2 space-y-5">

        {/* Header */}
        <Card className="p-5 border-border/50 relative overflow-hidden">
          {isRugProof && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold font-mono px-3 py-1 tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> RUG PROOF
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {coin.image_url ? (
              <CoinLogo src={coin.image_url} alt={coin.name}
                className={cn("w-28 h-28 object-cover shrink-0", isRugProof
                  ? "border-2 border-primary/60 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                  : "border border-border")} />
            ) : (
              <div className={cn("w-28 h-28 flex items-center justify-center text-xl font-bold font-mono border shrink-0",
                isRugProof ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-muted")}>
                {coin.ticker}
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tighter uppercase">{coin.name}</h1>
                <Badge variant="outline">{coin.ticker}</Badge>
                {isRugProof && <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-[10px] gap-1"><ShieldCheck className="w-3 h-3" /> PENNY COIN</Badge>}
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                by <span className="text-primary font-bold">{coin.creator_name}</span>
                <span className="mx-2 opacity-40">•</span>{launchDate.toLocaleDateString()}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{coin.description}</p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {coin.website && <a href={coin.website} target="_blank" rel="noreferrer" className="p-2 border border-border hover:border-primary/50 hover:bg-muted transition-colors"><Globe className="w-4 h-4" /></a>}
                {coin.twitter && <a href={`https://twitter.com/${coin.twitter.replace("@","")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 hover:bg-muted transition-colors text-xs font-mono"><Twitter className="w-3.5 h-3.5" /> @{coin.twitter.replace("@","")}</a>}
                {coin.telegram && <a href={`https://t.me/${coin.telegram.replace("@","")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-primary/50 hover:bg-muted transition-colors text-xs font-mono"><Send className="w-3.5 h-3.5" /> t.me/{coin.telegram.replace("@","")}</a>}
              </div>
            </div>
          </div>
        </Card>

        {/* Mascot social feed — the coin promotes itself */}
        {posts && posts.length > 0 && (
          <Card className="border-primary/30 overflow-hidden">
            <div className="p-3 border-b border-border/50 bg-primary/5 flex items-center gap-2">
              <Twitter className="w-4 h-4 text-primary" />
              <span className="font-bold font-mono text-xs uppercase tracking-widest">
                {posts[0].author} — Live Feed
              </span>
              <span className="ml-auto text-[10px] font-mono text-primary animate-pulse">● POSTING LIVE</span>
            </div>
            <div className="divide-y divide-border/30 max-h-[320px] overflow-y-auto">
              {posts.map((post) => (
                <div key={post.id} className="p-4 flex gap-3">
                  {coin.image_url && (
                    <CoinLogo src={coin.image_url} alt={post.author}
                      className="w-10 h-10 rounded-full object-cover border border-primary/40 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="font-bold text-primary">{post.author}</span>
                      <span className="text-muted-foreground">
                        {new Date(post.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm mt-1 leading-snug">{post.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Token Info Grid */}
        <Card className="border-border/50 overflow-hidden">
          <div className="p-3 border-b border-border/50 bg-muted/10 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-bold font-mono text-xs uppercase tracking-widest">Token Info</span>
          </div>
          <div className="divide-y divide-border/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/30">
              {[
                { label: "Market Cap", value: `$${formatNumber(coin.market_cap)}`, highlight: true },
                { label: "24h Volume", value: `$${formatNumber(coin.volume_24h)}` },
                { label: "Liquidity", value: `$${formatNumber(coin.liquidity ?? 0)}` },
                { label: "Holders", value: coin.holders.toLocaleString() },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="p-3">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                  <div className={cn("font-mono font-bold text-sm", highlight ? "text-primary" : "text-foreground")}>{value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/30">
              {[
                { label: "Buys", value: (coin.buys_count ?? 0).toLocaleString() },
                { label: "Supply", value: formatNumber(coin.initial_supply) },
                { label: "Hold Time", value: holdDays === 0 ? "< 1 day" : (`${holdDays}d` as React.ReactNode) },
                { label: "Price", value: <LiveTick value={coin.price}>{formatPrice(coin.price)}</LiveTick> },
              ].map(({ label, value }) => (
                <div key={label} className="p-3">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
                  <div className="font-mono font-bold text-sm">{value}</div>
                </div>
              ))}
            </div>
            {/* SafeMoon-style tokenomics row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-border/30 bg-muted/5">
              <div className="p-3 flex items-start gap-2">
                <Flame className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Total Burned</div>
                  <div className="font-mono font-bold text-sm text-orange-400">{formatNumber(coin.total_burned ?? 0)}</div>
                </div>
              </div>
              <div className="p-3 flex items-start gap-2">
                <Gift className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Reward Pool</div>
                  <div className="font-mono font-bold text-sm text-yellow-400">${formatNumber(coin.reward_pool ?? 0)}</div>
                </div>
              </div>
              <div className="p-3 flex items-start gap-2 sm:col-span-1 col-span-2">
                <Droplets className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">10% Trade Fee</div>
                  <div className="font-mono text-sm text-muted-foreground">5% reflect · 3% liq · 2% burn</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-border/30">
              <div className="p-3">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Blockchain</div>
                <div className="font-mono font-bold text-sm">{coin.blockchain ?? "—"}</div>
              </div>
              <div className="p-3">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Launchpad</div>
                <div className="font-mono font-bold text-sm">{coin.launchpad ?? "—"}</div>
              </div>
              <div className="p-3">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Contract</div>
                {coin.contract_address
                  ? <CopyableAddress address={coin.contract_address} />
                  : <div className="font-mono text-sm text-yellow-400/80">TBA — Custom contract coming</div>}
              </div>
            </div>
          </div>
        </Card>

        {/* Rug-proof + SafeMoon panel */}
        {isRugProof && (
          <Card className={cn("border p-5 space-y-4", unlocked ? "border-primary/60 bg-primary/5" : "border-yellow-500/40 bg-yellow-500/5")}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-bold font-mono uppercase tracking-wider text-sm">
                {unlocked
                  ? <><Unlock className="w-4 h-4 text-primary" /><span className="text-primary">PROFITS UNLOCKED — CLAIM NOW</span></>
                  : <><Lock className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400">PROFIT LOCK ACTIVE</span></>}
              </div>
              <span className="text-xs font-mono text-muted-foreground">${formatNumber(coin.market_cap)} / ${formatNumber(unlockCap)}</span>
            </div>
            {!unlocked && (
              <>
                <ProgressBar value={coin.market_cap} max={unlockCap} />
                <p className="text-xs font-mono text-muted-foreground">{unlockProgress.toFixed(2)}% to unlock — ${formatNumber(unlockCap - coin.market_cap)} remaining</p>
              </>
            )}

            {/* Reward pool & your rewards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-card/60 border border-border/50 p-3">
                <div className="flex items-center gap-1.5 mb-1"><Gift className="w-3.5 h-3.5 text-yellow-400" /><span className="text-[10px] font-mono text-muted-foreground uppercase">Total Pool</span></div>
                <div className="font-mono font-bold text-yellow-400">${formatNumber(coin.reward_pool ?? 0)}</div>
              </div>
              <div className="bg-card/60 border border-border/50 p-3">
                <div className="flex items-center gap-1.5 mb-1"><Flame className="w-3.5 h-3.5 text-orange-400" /><span className="text-[10px] font-mono text-muted-foreground uppercase">Burned</span></div>
                <div className="font-mono font-bold text-orange-400">{formatNumber(coin.total_burned ?? 0)}</div>
              </div>
              {hasPosition && (
                <div className={cn("bg-card/60 border p-3", unlocked ? "border-primary/50" : "border-yellow-500/40")}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {unlocked ? <Unlock className="w-3.5 h-3.5 text-primary" /> : <Lock className="w-3.5 h-3.5 text-yellow-400" />}
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Your Rewards</span>
                  </div>
                  <div className={cn("font-mono font-bold", unlocked ? "text-primary" : "text-yellow-400")}>
                    ${formatNumber(totalRewards)}
                  </div>
                </div>
              )}
            </div>

            {/* Claim button */}
            {unlocked && hasPosition && totalRewards > 0 && (
              <div className="space-y-2">
                <Button onClick={handleClaim} disabled={claimRewards.isPending}
                  className="w-full h-10 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  {claimRewards.isPending ? "CLAIMING..." : `CLAIM $${formatNumber(totalRewards)} REWARDS`}
                </Button>
                {claimMsg && <div className="text-xs font-mono text-primary text-center font-bold">✓ {claimMsg}</div>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/30">
              {[
                { icon: <ShieldCheck className="w-4 h-4 text-primary" />, title: "Can't Be Rugged", desc: "Price only goes up. Never drops on sells." },
                { icon: <Gift className="w-4 h-4 text-yellow-400" />, title: "5% Reflects to Holders", desc: "Every trade fills the locked reward pool proportionally." },
                { icon: <TrendingUp className="w-4 h-4 text-primary" />, title: unlocked ? "Profits Unlocked" : `Unlock at $${formatNumber(unlockCap)}`, desc: unlocked ? "Claim your full rewards now." : "Hit $58M market cap and claim everything." },
              ].map((rule, i) => (
                <div key={i} className="bg-card/60 border border-border/50 p-3 space-y-1">
                  <div className="flex items-center gap-2">{rule.icon}<span className="text-xs font-bold font-mono uppercase">{rule.title}</span></div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rule.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Trade history */}
        <Card className="border-border/50">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/10">
            <h3 className="font-bold uppercase tracking-wider flex items-center gap-2 text-sm">
              <ArrowRightLeft className="w-4 h-4 text-primary" /> Terminal Activity
            </h3>
            <span className="text-xs font-mono text-muted-foreground animate-pulse">LIVE_FEED</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead className="text-xs text-muted-foreground bg-muted/20">
                <tr>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Trader</th>
                  <th className="text-right p-3 font-medium">USD</th>
                  <th className="text-right p-3 font-medium">Tokens</th>
                  <th className="text-right p-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {trades?.length === 0
                  ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-xs uppercase tracking-wider">No activity yet. Be the first.</td></tr>
                  : trades?.map((trade) => (
                    <tr key={trade.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3">
                        <span className={cn("uppercase font-bold text-xs px-2 py-1", trade.type === "buy" ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10")}>
                          {trade.type}
                        </span>
                      </td>
                      <td className="p-3 truncate max-w-[140px]">
                        {trade.trader_name === "bobo"
                          ? <Link href="/bobo" className="inline-flex items-center gap-1 text-primary font-bold hover:underline">🤖 bobo</Link>
                          : trade.trader_name}
                      </td>
                      <td className="p-3 text-right">${formatNumber(trade.amount_usd)}</td>
                      <td className="p-3 text-right">{formatNumber(trade.tokens)}</td>
                      <td className="p-3 text-right text-muted-foreground text-xs">
                        {new Date(trade.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── RIGHT ── */}
      <div className="space-y-5">
        <Card className="p-5 border-primary/30 bg-card shadow-[0_0_20px_hsl(var(--primary)/0.05)]">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">Current Price</div>
              <div className="text-4xl font-mono font-bold text-primary"><LiveTick value={coin.price}>{formatPrice(coin.price)}</LiveTick></div>
              <div className={cn("text-sm font-mono mt-1", (coin.price_change_24h ?? 0) >= 0 ? "text-primary" : "text-destructive")}>
                <LiveTick value={coin.price_change_24h ?? 0}>
                  {(coin.price_change_24h ?? 0) >= 0 ? "+" : ""}{(coin.price_change_24h ?? 0).toFixed(2)}% (24h)
                </LiveTick>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50 text-xs font-mono">
              {[
                { label: "Mkt Cap", value: `$${formatNumber(coin.market_cap)}` },
                { label: "Holders", value: coin.holders.toString() },
                { label: "24h Vol", value: `$${formatNumber(coin.volume_24h)}` },
                { label: "Buys", value: (coin.buys_count ?? 0).toString() },
                { label: "Burned 🔥", value: formatNumber(coin.total_burned ?? 0) },
                { label: "Liquidity 💧", value: `$${formatNumber(coin.liquidity ?? 0)}` },
              ].map(({ label, value }) => (
                <div key={label}><div className="text-muted-foreground mb-0.5">{label}</div><div className="font-bold">{value}</div></div>
              ))}
            </div>
            {coin.contract_address && (
              <div className="pt-2 border-t border-border/50">
                <div className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-widest">Contract</div>
                <CopyableAddress address={coin.contract_address} />
              </div>
            )}
            {hasPosition && (
              <div className={cn("border p-3 space-y-2", unlocked ? "border-primary/50 bg-primary/5" : "border-yellow-500/30 bg-yellow-500/5")}>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Your Position ({traderName})</div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div><div className="text-muted-foreground">Invested</div><div className="font-bold">${formatNumber(position.total_invested)}</div></div>
                  <div><div className="text-muted-foreground">Value</div><div className="font-bold text-primary">${formatNumber(position.current_value)}</div></div>
                  <div className="col-span-2">
                    <div className={cn("font-bold", unlocked ? "text-primary" : "text-yellow-400")}>
                      {unlocked ? "✓" : "🔒"} Rewards: ${formatNumber(totalRewards)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Trade form */}
        <Card className="border-border/80 bg-background overflow-hidden">
          <div className="flex border-b border-border">
            {(["buy", "sell"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTradeType(t); setAmount(""); setTxStatus("idle"); if (t === "sell" && currency === "BLUJO") setCurrency("USD"); }}
                className={cn("flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-colors",
                  tradeType === t
                    ? t === "buy" ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
                    : "hover:bg-muted/50 text-muted-foreground")}>
                {t}
              </button>
            ))}
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between bg-muted/20 border border-border/50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Wallet className="w-3 h-3 text-primary" />{tradeType === "buy" ? "Available" : "Wallet"}
              </div>
              <span className="text-xs font-mono font-bold">${formatNumber(balance)}</span>
            </div>

            {/* Pay-with currency toggle */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Pay With</div>
              {(() => {
                const options: ("USD" | "SOL" | "BLUJO" | "MGOAT")[] =
                  tradeType === "sell" ? ["USD", "SOL"]
                  : mgoatOnly ? ["MGOAT"]
                  : isMgoatPage && blujoCoin ? ["USD", "SOL", "BLUJO"]
                  : ["USD", "SOL"];
                const labels: Record<string, string> = { USD: "$ USD", SOL: "◎ SOL", BLUJO: "🐂 BLUJO", MGOAT: "🐐 MGOAT" };
                return (
                  <div className={cn("grid gap-1.5", options.length === 3 ? "grid-cols-3" : options.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
                    {options.map((c) => (
                      <button key={c} type="button" onClick={() => { setCurrency(c); setAmount(""); setTxStatus("idle"); }}
                        className={cn("py-2 text-xs font-mono font-bold border transition-colors flex items-center justify-center gap-1.5",
                          currency === c ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary")}>
                        {labels[c]}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {mgoatOnly && tradeType === "buy" && (
                <div className="text-[10px] font-mono text-purple-400">
                  🐐 Moon Bag coins are bought with MERGEGOAT. Your MGOAT: <span className="font-bold">${formatNumber(mgoatHoldingsUsd)}</span>
                </div>
              )}
              {currency === "SOL" && (
                <div className="text-[10px] font-mono text-muted-foreground">
                  {solPrice > 0 ? <>1 SOL = <span className="text-primary font-bold">${formatNumber(solPrice)}</span> (live)</> : "Loading SOL price..."}
                </div>
              )}
              {currency === "BLUJO" && (
                <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
                  <div>Your BLUJO: <span className="text-primary font-bold">${formatNumber(blujoHoldingsUsd)}</span> — swaps sell BLUJO and buy {coin.ticker}</div>
                  <div className="text-yellow-400">⚠ BLUJO's rug-proof sell rules apply: principal value is used until $58M unlock.</div>
                </div>
              )}
              {currency === "MGOAT" && !mgoatOnly && (
                <div className="text-[10px] font-mono text-muted-foreground">
                  Your MGOAT: <span className="text-purple-400 font-bold">${formatNumber(mgoatHoldingsUsd)}</span> — swaps sell MGOAT and buy {coin.ticker}
                </div>
              )}
            </div>

            {/* 10% fee notice */}
            <div className="bg-muted/20 border border-border/40 p-2.5 text-[10px] font-mono text-muted-foreground space-y-0.5">
              <div className="font-bold text-foreground">10% SafeMoon Fee Applied</div>
              <div>5% → Holder Rewards &nbsp;·&nbsp; 3% → Liquidity &nbsp;·&nbsp; 2% → Burn 🔥</div>
            </div>

            {isRugProof && tradeType === "sell" && !unlocked && (
              <div className="bg-yellow-500/10 border border-yellow-500/40 p-3 text-xs font-mono text-yellow-400 space-y-1">
                <div className="font-bold flex items-center gap-1.5"><Lock className="w-3 h-3" /> PROFIT LOCK ACTIVE</div>
                <div>You receive your original investment only. Profits + reflection rewards unlock at $58M.</div>
              </div>
            )}
            {isRugProof && tradeType === "sell" && unlocked && (
              <div className="bg-primary/10 border border-primary/40 p-3 text-xs font-mono text-primary space-y-1">
                <div className="font-bold flex items-center gap-1.5"><Unlock className="w-3 h-3" /> UNLOCKED</div>
                <div>$58M reached — claim your full rewards above, then sell freely.</div>
              </div>
            )}

            <form onSubmit={handleTrade} className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {tradeType === "buy" ? `You Pay (${currency})` : `You Sell (${currency})`}
                  </Label>
                  {tradeType === "sell" && hasPosition && (
                    <button type="button"
                      onClick={() => setAmount(currency === "SOL" && solPrice > 0 ? (maxSell / solPrice).toFixed(4) : maxSell.toFixed(2))}
                      className="text-[10px] font-mono text-primary hover:underline uppercase">
                      MAX ${formatNumber(maxSell)}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">{currency === "SOL" ? "◎" : currency === "BLUJO" ? "🐂" : currency === "MGOAT" ? "🐐" : "$"}</span>
                  <Input type="number" placeholder="0.00"
                    className={cn("pl-7 text-lg font-bold", insufficientFunds && "border-destructive")}
                    value={amount} onChange={(e) => { setAmount(e.target.value); setTxStatus("idle"); }}
                    required min="0.01" step="any" />
                </div>
                {insufficientFunds && <p className="text-xs font-mono text-destructive">Insufficient balance</p>}
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_AMOUNTS.map((q) => (
                    <button key={q} type="button"
                      onClick={() => setAmount(
                        currency === "SOL" && solPrice > 0 ? (q / solPrice).toFixed(4)
                        : currency === "BLUJO" && blujoPrice > 0 ? (q / blujoPrice).toFixed(0)
                        : currency === "MGOAT" && mgoatPrice > 0 ? (q / mgoatPrice).toFixed(0)
                        : String(q))}
                      className={cn("py-1.5 text-xs font-mono font-bold border transition-colors",
                        Math.abs(amountNum - q) < 0.01 ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary")}>
                      ${q}
                    </button>
                  ))}
                </div>
              </div>

              {amountNum > 0 && coin && (
                <div className="bg-muted/20 border border-border/50 p-3 space-y-1 text-xs font-mono">
                  {currency === "SOL" && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>◎{inputNum} SOL =</span><span className="font-bold text-foreground">${formatNumber(amountNum)}</span>
                    </div>
                  )}
                  {currency === "BLUJO" && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>🐂 {formatNumber(inputNum)} BLUJO =</span><span className="font-bold text-foreground">${formatNumber(amountNum)}</span>
                    </div>
                  )}
                  {currency === "MGOAT" && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>🐐 {formatNumber(inputNum)} MGOAT =</span><span className="font-bold text-foreground">${formatNumber(amountNum)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>After 10% fee</span><span className="font-bold text-foreground">${formatNumber(netReceived)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{tradeType === "buy" ? "You receive" : "Tokens sold"}</span>
                    <span className="font-bold text-foreground">{formatNumber(estimatedTokens)} {coin.ticker}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground border-t border-border/40 pt-1">
                    <span className="text-yellow-400">Reflection added</span>
                    <span className="text-yellow-400 font-bold">+${formatNumber(amountNum * 0.05)}</span>
                  </div>
                </div>
              )}

              {txStatus === "success" && <div className="bg-primary/10 border border-primary/40 p-2 text-xs font-mono text-primary text-center font-bold">✓ {txMsg}</div>}
              {txStatus === "error" && <div className="bg-destructive/10 border border-destructive/40 p-2 text-xs font-mono text-destructive text-center font-bold">✗ {txMsg}</div>}

              <Button type="submit"
                variant={tradeType === "buy" ? "default" : "destructive"}
                className="w-full h-12 text-base font-bold uppercase tracking-widest flex items-center gap-2"
                disabled={createTrade.isPending || txStatus === "processing" || insufficientFunds}>
                <CreditCard className="w-4 h-4" />
                {txStatus === "processing" ? "EXECUTING..." : `${tradeType.toUpperCase()} ${coin.ticker}`}
              </Button>
              <p className="text-[10px] font-mono text-muted-foreground text-center">
                Trading as <span className="text-primary">{traderName}</span> · Simulated · No real money
              </p>
            </form>
          </div>
        </Card>

        {/* ── Buy trigger: auto-buy when market cap hits a target ── */}
        <Card className="border-cyan-500/40 bg-cyan-500/5 rounded-none">
          <div className="p-4 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">⏱ Buy Trigger</div>
            <p className="text-[10px] font-mono text-muted-foreground">
              Set it and forget it — the moment {coin.ticker}&apos;s market cap hits your target, your MGOAT automatically buys in.
            </p>
            <form onSubmit={handleCreateOrder} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">🐐 MGOAT to spend</label>
                  <Input type="number" min="1" placeholder="1000000" value={triggerMgoat}
                    onChange={(e) => setTriggerMgoat(e.target.value)} className="font-mono rounded-none h-9 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase">Target Mkt Cap ($)</label>
                  <Input type="number" min="1" placeholder="10000" value={triggerMcap}
                    onChange={(e) => setTriggerMcap(e.target.value)} className="font-mono rounded-none h-9 text-xs" />
                </div>
              </div>
              <Button type="submit" variant="outline"
                className="w-full h-9 text-xs font-mono font-bold uppercase tracking-widest border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                disabled={createOrder.isPending}>
                {createOrder.isPending ? "SETTING…" : "SET TRIGGER"}
              </Button>
            </form>
            {orderMsg && (
              <div className={cn("p-2 text-[10px] font-mono font-bold text-center border",
                orderMsg.startsWith("✓") ? "bg-primary/10 border-primary/40 text-primary" : "bg-destructive/10 border-destructive/40 text-destructive")}>
                {orderMsg}
              </div>
            )}
            {orders && orders.length > 0 && (
              <div className="space-y-1">
                {orders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between border border-border/50 px-2 py-1.5 text-[10px] font-mono">
                    <span className="text-muted-foreground">
                      🐐 {formatNumber(o.mgoat_amount)} @ ${formatNumber(o.target_market_cap)} mcap
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn("font-bold uppercase",
                        o.status === "open" ? "text-cyan-400" :
                        o.status === "executed" ? "text-primary" :
                        o.status === "cancelled" ? "text-muted-foreground" : "text-destructive")}
                        title={o.fail_reason ?? undefined}>
                        {o.status}
                      </span>
                      {o.status === "open" && (
                        <button type="button" onClick={() => handleCancelOrder(o.id)}
                          className="text-muted-foreground hover:text-destructive" disabled={cancelOrder.isPending}>
                          ✕
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ── Paid coin services (MGOAT) ── */}
        <Card className="border-purple-500/40 bg-purple-500/5 rounded-none">
          <div className="p-4 space-y-3">
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400">🐐 Coin Services — pay with MGOAT</div>

            {hotspotActive && (
              <div className="bg-yellow-400/10 border border-yellow-400/40 p-2 text-[10px] font-mono text-yellow-400 font-bold">
                🔥 HOTSPOT ACTIVE — promoted app-wide until {new Date(coin.hotspot_until!).toLocaleDateString()}
              </div>
            )}

            <div className="border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold">🔥 Boost</span>
                <span className="text-purple-400 font-bold">$100 MGOAT</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">Boost {coin.ticker} to everyone on the app for 28 days — featured banner on every page. Every new coin starts with 28 days free.</p>
              <Button type="button" variant="outline" className="w-full h-9 text-xs font-mono font-bold uppercase tracking-widest"
                disabled={buyHotspot.isPending}
                onClick={handleBuyHotspot}>
                {buyHotspot.isPending ? "BOOSTING…" : hotspotActive ? "EXTEND 28 DAYS — 🐐 $100" : "BOOST — 🐐 $100"}
              </Button>
            </div>

            {serviceMsg && (
              <div className={cn("p-2 text-[10px] font-mono font-bold text-center border",
                serviceMsg.startsWith("✓") ? "bg-primary/10 border-primary/40 text-primary" : "bg-destructive/10 border-destructive/40 text-destructive")}>
                {serviceMsg}
              </div>
            )}
            <p className="text-[10px] font-mono text-muted-foreground">Your MGOAT: <span className="text-purple-400 font-bold">${formatNumber(mgoatHoldingsUsd)}</span></p>
          </div>
        </Card>
      </div>
    </div>
  );
}
