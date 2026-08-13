import { getLaunchedCoins, getCoinPosition, createCoinTrade } from "@workspace/api-client-react";

/** Launching a coin costs this many MGOAT tokens (Mergegoat). */
export const LAUNCH_FEE_MGOAT = 10_000_000;

export type LaunchFeeResult =
  | { ok: true }
  | { ok: false; reason: "no-market" }
  | { ok: false; reason: "insufficient"; held: number; mgoatId: number };

/**
 * Charges the launch fee: sells LAUNCH_FEE_MGOAT tokens from the trader's
 * MGOAT position WITHOUT crediting the proceeds to their wallet — the
 * proceeds are the platform's fee. (Client-orchestrated by design.)
 */
export async function payLaunchFee(traderName: string): Promise<LaunchFeeResult> {
  const coins = await getLaunchedCoins({ ticker: "MGOAT", limit: 1 });
  const mgoat = coins[0];
  if (!mgoat) return { ok: false, reason: "no-market" };

  const pos = await getCoinPosition(mgoat.id, traderName).catch(() => null);
  const held = pos?.tokens_held ?? 0;
  if (held < LAUNCH_FEE_MGOAT) {
    return { ok: false, reason: "insufficient", held, mgoatId: mgoat.id };
  }

  // The trade endpoint sells (amount_usd * 0.9 / price) tokens because of the
  // 10% trade fee — gross up by /0.9 so exactly LAUNCH_FEE_MGOAT tokens leave.
  const feeUsd = (LAUNCH_FEE_MGOAT * mgoat.price) / 0.9;
  await createCoinTrade(mgoat.id, { type: "sell", amount_usd: feeUsd, trader_name: traderName });
  return { ok: true };
}
