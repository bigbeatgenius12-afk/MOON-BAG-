import { Router, type IRouter } from "express";
import {
  GetMarketCoinsResponse,
  GetMarketCoinResponse,
  GetMarketCoinChartResponse,
  GetTrendingCoinsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

async function cgFetch(path: string): Promise<unknown> {
  const res = await fetch(`${COINGECKO_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status}: ${path}`);
  }
  return res.json();
}

// GET /market/coins
router.get("/market/coins", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
  const perPage = Math.min(parseInt(String(req.query.per_page ?? "50"), 10) || 50, 250);
  const search = req.query.search ? String(req.query.search) : undefined;

  try {
    if (search) {
      // search then fetch details
      const searchData = (await cgFetch(
        `/search?query=${encodeURIComponent(search)}`
      )) as { coins: { id: string }[] };
      const ids = searchData.coins
        .slice(0, perPage)
        .map((c) => c.id)
        .join(",");
      if (!ids) {
        res.json(GetMarketCoinsResponse.parse([]));
        return;
      }
      const data = await cgFetch(
        `/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=7d`
      );
      res.json(GetMarketCoinsResponse.parse(data));
    } else {
      const data = await cgFetch(
        `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=7d`
      );
      res.json(GetMarketCoinsResponse.parse(data));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch market coins");
    res.status(502).json({ error: "Failed to fetch market data" });
  }
});

// GET /market/coins/:coinId
router.get("/market/coins/:coinId", async (req, res): Promise<void> => {
  const coinId = Array.isArray(req.params.coinId) ? req.params.coinId[0] : req.params.coinId;
  try {
    const data = (await cgFetch(
      `/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
    )) as Record<string, unknown>;

    const md = data.market_data as Record<string, Record<string, number>> | undefined;
    const links = data.links as Record<string, unknown> | undefined;
    const desc = data.description as Record<string, string> | undefined;
    const img = data.image as Record<string, string> | undefined;

    const coin = {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      image: img?.large ?? img?.small ?? "",
      current_price: md?.current_price?.usd ?? 0,
      market_cap: md?.market_cap?.usd ?? 0,
      market_cap_rank: data.market_cap_rank ?? null,
      total_volume: md?.total_volume?.usd ?? 0,
      price_change_percentage_24h: md?.price_change_percentage_24h ?? null,
      price_change_percentage_7d: md?.price_change_percentage_7d_in_currency?.usd ?? null,
      price_change_percentage_30d: md?.price_change_percentage_30d_in_currency?.usd ?? null,
      circulating_supply: md?.circulating_supply ?? null,
      total_supply: md?.total_supply ?? null,
      max_supply: md?.max_supply ?? null,
      ath: md?.ath?.usd ?? null,
      atl: md?.atl?.usd ?? null,
      description: (desc?.en ?? "").replace(/<[^>]*>/g, "").slice(0, 2000),
      homepage: Array.isArray(links?.homepage) ? (links.homepage as string[])[0] || null : null,
      twitter_handle: links?.twitter_screen_name ? String(links.twitter_screen_name) : null,
    };

    res.json(GetMarketCoinResponse.parse(coin));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch coin detail");
    res.status(502).json({ error: "Failed to fetch coin data" });
  }
});

// GET /market/coins/:coinId/chart/:days
router.get("/market/coins/:coinId/chart/:days", async (req, res): Promise<void> => {
  const coinId = Array.isArray(req.params.coinId) ? req.params.coinId[0] : req.params.coinId;
  const days = parseInt(
    Array.isArray(req.params.days) ? req.params.days[0] : req.params.days,
    10
  ) || 7;
  try {
    const data = await cgFetch(
      `/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`
    );
    res.json(GetMarketCoinChartResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch chart data");
    res.status(502).json({ error: "Failed to fetch chart data" });
  }
});

// GET /market/trending
router.get("/market/trending", async (req, res): Promise<void> => {
  try {
    const trendingData = (await cgFetch("/search/trending")) as {
      coins: { item: { id: string } }[];
    };
    const ids = trendingData.coins
      .slice(0, 10)
      .map((c) => c.item.id)
      .join(",");
    if (!ids) {
      res.json(GetTrendingCoinsResponse.parse([]));
      return;
    }
    const data = await cgFetch(
      `/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=7d`
    );
    res.json(GetTrendingCoinsResponse.parse(data));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trending coins");
    res.status(502).json({ error: "Failed to fetch trending coins" });
  }
});

export default router;
