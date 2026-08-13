// Spotlight mode: when the list is non-empty, the website surfaces ONLY
// these launched coins. Empty the list to bring every coin back.
export const SPOTLIGHT_TICKERS: string[] = ["BLUJO", "BLUSHE"];

export const spotlightActive = SPOTLIGHT_TICKERS.length > 0;

export function isSpotlit(ticker: string): boolean {
  return !spotlightActive || SPOTLIGHT_TICKERS.includes(ticker);
}
