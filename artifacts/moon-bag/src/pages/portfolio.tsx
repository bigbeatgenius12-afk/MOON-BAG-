import { useGetLaunchedCoins, useGetCoinPosition, getGetCoinPositionQueryKey } from "@workspace/api-client-react";
import { useWallet } from "@/lib/wallet";
import { formatPrice, formatNumber, cn } from "@/lib/utils";
import { Card } from "@/components/ui";
import { Link } from "wouter";
import { Wallet, TrendingUp, TrendingDown, Plus, ShieldCheck, Lock, Unlock } from "lucide-react";
import { useState } from "react";

const UNLOCK_CAP = 58_000_000;
const DEPOSIT_AMOUNTS = [1000, 5000, 10000, 50000];

function CoinPositionRow({ coinId, coinName, ticker, price, isRugProof, marketCap, traderName }: {
  coinId: number; coinName: string; ticker: string; price: number;
  isRugProof: boolean; marketCap: number; traderName: string;
}) {
  const { data: pos } = useGetCoinPosition(coinId, traderName, {
    query: { enabled: !!traderName, queryKey: getGetCoinPositionQueryKey(coinId, traderName) },
  });

  if (!pos || pos.tokens_held <= 0) return null;

  const pnl = pos.current_value - pos.total_invested;
  const pnlPct = pos.total_invested > 0 ? (pnl / pos.total_invested) * 100 : 0;
  const unlocked = marketCap >= UNLOCK_CAP;

  return (
    <Link href={`/launched/${coinId}`}>
      <div className="flex items-center justify-between p-4 hover:bg-muted/10 border-b border-border/40 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 flex items-center justify-center font-bold font-mono text-xs border",
            isRugProof ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"
          )}>
            {ticker.slice(0, 4)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold group-hover:text-primary transition-colors">{coinName}</span>
              {isRugProof && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> RUG PROOF
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {formatNumber(pos.tokens_held)} {ticker} @ {formatPrice(price)}
            </div>
          </div>
        </div>
        <div className="text-right space-y-1">
          <div className="font-mono font-bold">${formatNumber(pos.current_value)}</div>
          <div className={cn("text-xs font-mono flex items-center justify-end gap-1", pnl >= 0 ? "text-primary" : "text-destructive")}>
            {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {pnl >= 0 ? "+" : ""}${formatNumber(Math.abs(pnl))} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
          </div>
          {isRugProof && !unlocked && (
            <div className="text-[10px] font-mono text-yellow-400 flex items-center gap-1 justify-end">
              <Lock className="w-2.5 h-2.5" /> Profit locked
            </div>
          )}
          {isRugProof && unlocked && (
            <div className="text-[10px] font-mono text-primary flex items-center gap-1 justify-end">
              <Unlock className="w-2.5 h-2.5" /> Unlocked
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function PortfolioPage() {
  const { balance, traderName, updateTraderName, deposit } = useWallet();
  const { data: coins } = useGetLaunchedCoins({ sort: "market_cap", limit: 50 });
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(traderName);
  const [showDeposit, setShowDeposit] = useState(false);

  const handleNameSave = () => {
    if (nameInput.trim()) updateTraderName(nameInput.trim());
    setEditingName(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">

      {/* Wallet Card */}
      <Card className="border-primary/40 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.08)] overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold font-mono text-sm uppercase tracking-widest text-muted-foreground">
              <Wallet className="w-4 h-4 text-primary" /> Virtual Wallet
            </div>
            <button
              onClick={() => setShowDeposit(!showDeposit)}
              className="flex items-center gap-1.5 text-xs font-bold font-mono uppercase tracking-wider text-primary border border-primary/50 px-3 py-1.5 hover:bg-primary/10 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Funds
            </button>
          </div>

          <div>
            <div className="text-xs font-mono text-muted-foreground mb-1">Available Balance</div>
            <div className="text-5xl font-bold font-mono text-primary tracking-tighter">
              ${formatNumber(balance)}
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-1">Simulated USD — no real money</div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="text-xs font-mono text-muted-foreground">Trader:</div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="bg-muted/30 border border-primary/50 px-2 py-1 text-xs font-mono text-foreground outline-none w-40"
                  onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(); if (e.key === "Escape") setEditingName(false); }}
                  autoFocus
                />
                <button onClick={handleNameSave} className="text-xs font-bold text-primary font-mono hover:underline">SAVE</button>
              </div>
            ) : (
              <button onClick={() => { setEditingName(true); setNameInput(traderName); }} className="text-xs font-bold font-mono text-primary hover:underline">
                {traderName} ✎
              </button>
            )}
          </div>

          {showDeposit && (
            <div className="pt-3 border-t border-border/50 space-y-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Deposit virtual funds</div>
              <div className="grid grid-cols-4 gap-2">
                {DEPOSIT_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { deposit(amt); setShowDeposit(false); }}
                    className="py-2.5 text-xs font-bold font-mono uppercase border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                  >
                    +${formatNumber(amt)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Positions */}
      <Card className="border-border/50">
        <div className="p-4 border-b border-border/50 bg-muted/10 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-bold font-mono uppercase tracking-wider text-sm">Your Positions</h2>
        </div>
        {coins?.length === 0 ? (
          <div className="p-12 text-center font-mono text-muted-foreground text-sm">
            NO POSITIONS. BUY SOME COINS.
          </div>
        ) : (
          <div>
            {coins?.map((coin) => (
              <CoinPositionRow
                key={coin.id}
                coinId={coin.id}
                coinName={coin.name}
                ticker={coin.ticker}
                price={coin.price}
                isRugProof={coin.is_rug_proof ?? false}
                marketCap={coin.market_cap}
                traderName={traderName}
              />
            ))}
          </div>
        )}
        <div className="p-4 border-t border-border/40 text-xs font-mono text-muted-foreground text-center">
          Positions update after each trade. Click a coin to trade.
        </div>
      </Card>
    </div>
  );
}
