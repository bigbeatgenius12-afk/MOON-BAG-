import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import {
  useGetLaunchedCoin,
  getGetLaunchedCoinQueryKey,
  useGetCoinTrades,
  getGetCoinTradesQueryKey,
  useGetCoinPosts,
  getGetCoinPostsQueryKey,
  useGetCoinPosition,
  getGetCoinPositionQueryKey,
  useCreateCoinTrade,
  useGetLaunchedCoins,
  getGetLaunchedCoinsQueryKey,
  createCoinTrade,
  useGetCoinOrders,
  getGetCoinOrdersQueryKey,
  useCreateCoinOrder,
  useCancelCoinOrder,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useWallet, TRADER_NAME } from '@/context/wallet';
import { CoinAvatar, PctBadge, formatUsd, formatPrice } from '@/components/ui';

export default function CoinDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const coinId = Number(id);
  const queryClient = useQueryClient();
  const { balance, deduct, add } = useWallet();

  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [copiedCa, setCopiedCa] = useState(false);

  const { data: coin, isLoading } = useGetLaunchedCoin(coinId, {
    query: { enabled: !!coinId, queryKey: getGetLaunchedCoinQueryKey(coinId), refetchInterval: 5000 },
  });
  const { data: trades } = useGetCoinTrades(coinId, {
    query: { enabled: !!coinId, queryKey: getGetCoinTradesQueryKey(coinId), refetchInterval: 8000 },
  });
  const { data: posts } = useGetCoinPosts(coinId, {
    query: { enabled: !!coinId, queryKey: getGetCoinPostsQueryKey(coinId), refetchInterval: 30000 },
  });
  const { data: position } = useGetCoinPosition(coinId, TRADER_NAME, {
    query: { enabled: !!coinId, queryKey: getGetCoinPositionQueryKey(coinId, TRADER_NAME), refetchInterval: 8000 },
  });

  // All coins are bought with MGOAT (Mergegoat) — except MGOAT itself, bought with cash.
  const isMgoat = coin?.ticker === 'MGOAT';
  const { data: mgoatList } = useGetLaunchedCoins(
    { ticker: 'MGOAT', limit: 1 },
    { query: { queryKey: getGetLaunchedCoinsQueryKey({ ticker: 'MGOAT', limit: 1 }) } },
  );
  const mgoatCoin = mgoatList?.[0];
  const payWithMgoat = tradeType === 'buy' && !isMgoat && !!mgoatCoin;
  const { data: mgoatPosition } = useGetCoinPosition(mgoatCoin?.id ?? 0, TRADER_NAME, {
    query: {
      enabled: !!mgoatCoin && !isMgoat,
      queryKey: getGetCoinPositionQueryKey(mgoatCoin?.id ?? 0, TRADER_NAME),
      refetchInterval: 8000,
    },
  });
  const mgoatHeld = mgoatPosition?.tokens_held ?? 0;
  const [swapBusy, setSwapBusy] = useState(false);

  // ── Buy triggers: auto-buy with MGOAT when market cap hits a target ──
  const { data: orders } = useGetCoinOrders(coinId, TRADER_NAME, {
    query: { enabled: !!coinId, queryKey: getGetCoinOrdersQueryKey(coinId, TRADER_NAME), refetchInterval: 8000 },
  });
  const createOrder = useCreateCoinOrder();
  const cancelOrder = useCancelCoinOrder();
  const [triggerMgoat, setTriggerMgoat] = useState('');
  const [triggerMcap, setTriggerMcap] = useState('');
  const [orderMsg, setOrderMsg] = useState('');

  const submitOrder = () => {
    const mg = parseFloat(triggerMgoat) || 0;
    const mc = parseFloat(triggerMcap) || 0;
    if (mg < 1 || mc < 1) {
      setOrderMsg('Enter an MGOAT amount and a target market cap.');
      setTimeout(() => setOrderMsg(''), 2500);
      return;
    }
    createOrder.mutate(
      { id: coinId, data: { trader_name: TRADER_NAME, mgoat_amount: mg, target_market_cap: mc } },
      {
        onSuccess: () => {
          setTriggerMgoat(''); setTriggerMcap('');
          setOrderMsg('Trigger set! ⏱');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          queryClient.invalidateQueries({ queryKey: getGetCoinOrdersQueryKey(coinId, TRADER_NAME) });
          setTimeout(() => setOrderMsg(''), 2500);
        },
        onError: (e: unknown) => {
          const err = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          setOrderMsg(err ?? "Couldn't set the trigger.");
          setTimeout(() => setOrderMsg(''), 3000);
        },
      },
    );
  };

  const tradeMutation = useCreateCoinTrade({
    mutation: {
      onSuccess: (_data, vars) => {
        const usd = vars.data.amount_usd;
        if (vars.data.type === 'buy') {
          // cash already deducted before request
        } else {
          add(usd * 0.9); // sells credit net proceeds after 10% fee
        }
        setMessage(vars.data.type === 'buy' ? 'Bought! 🚀' : 'Sold!');
        setAmount('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinQueryKey(coinId) });
        queryClient.invalidateQueries({ queryKey: getGetCoinTradesQueryKey(coinId) });
        queryClient.invalidateQueries({ queryKey: getGetCoinPositionQueryKey(coinId, TRADER_NAME) });
        queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinsQueryKey({ sort: 'trending', limit: 50 }) });
        setTimeout(() => setMessage(''), 2500);
      },
      onError: (_err, vars) => {
        if (vars.data.type === 'buy') add(vars.data.amount_usd); // refund
        setMessage('Trade failed — try a different amount.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setTimeout(() => setMessage(''), 3000);
      },
    },
  });

  const submitTrade = async () => {
    const usd = parseFloat(amount);
    if (!coin || Number.isNaN(usd) || usd <= 0) {
      setMessage('Enter a valid amount.');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    // Buys are paid in MGOAT — don't fall back to cash while MGOAT data is still loading.
    if (tradeType === 'buy' && !isMgoat && !mgoatCoin) {
      setMessage('Loading MGOAT market — try again in a second.');
      setTimeout(() => setMessage(''), 2500);
      return;
    }
    // Buys are paid in MGOAT: sell that many MGOAT, then buy this coin with the proceeds.
    if (payWithMgoat && mgoatCoin) {
      const mgoatAmount = usd; // input is in MGOAT tokens for MGOAT-paid buys
      if (mgoatAmount > mgoatHeld + 0.000001) {
        setMessage('Not enough MGOAT — buy Mergegoat first.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      setSwapBusy(true);
      let proceeds: number | null = null;
      try {
        const sellTrade = await createCoinTrade(mgoatCoin.id, {
          type: 'sell',
          amount_usd: mgoatAmount * mgoatCoin.price,
          trader_name: TRADER_NAME,
        });
        proceeds = sellTrade.amount_usd;
        await createCoinTrade(coinId, { type: 'buy', amount_usd: proceeds, trader_name: TRADER_NAME });
        setAmount('');
        setMessage(`Swapped MGOAT → ${coin.ticker}! 🚀`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        queryClient.invalidateQueries({ queryKey: getGetCoinPositionQueryKey(mgoatCoin.id, TRADER_NAME) });
        queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinQueryKey(coinId) });
        queryClient.invalidateQueries({ queryKey: getGetCoinTradesQueryKey(coinId) });
        queryClient.invalidateQueries({ queryKey: getGetCoinPositionQueryKey(coinId, TRADER_NAME) });
        queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinsQueryKey({ sort: 'trending', limit: 50 }) });
      } catch {
        if (proceeds !== null) {
          add(proceeds); // MGOAT sold but buy leg failed — credit proceeds to cash so nothing is lost
          setMessage('Buy failed — proceeds added to your cash.');
        } else {
          setMessage('Swap failed — try again.');
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } finally {
        setSwapBusy(false);
        setTimeout(() => setMessage(''), 3000);
      }
      return;
    }
    if (tradeType === 'buy') {
      if (!deduct(usd)) {
        setMessage('Not enough cash.');
        setTimeout(() => setMessage(''), 2000);
        return;
      }
    } else {
      const held = position ? position.current_value : 0;
      if (usd > held) {
        setMessage('You don\u2019t hold that much.');
        setTimeout(() => setMessage(''), 2000);
        return;
      }
    }
    tradeMutation.mutate({ id: coinId, data: { trader_name: TRADER_NAME, type: tradeType, amount_usd: usd } });
  };

  if (isLoading || !coin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 4, paddingBottom: insets.bottom + (Platform.OS === 'web' ? 44 : 24), paddingHorizontal: 16 }}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable testID="back-button" onPress={() => router.back()} style={{ paddingVertical: 8, width: 44 }}>
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>

      <View style={styles.headRow}>
        <CoinAvatar url={coin.image_url} ticker={coin.ticker} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: 'Inter_700Bold' }}>{coin.name}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            {coin.ticker} · by {coin.creator_name}
          </Text>
        </View>
      </View>

      <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>CURRENT PRICE</Text>
        <Text style={{ color: colors.primary, fontSize: 30, fontFamily: 'Inter_700Bold' }}>{formatPrice(coin.price)}</Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
          <PctBadge value={coin.price_change_24h} size={14} />
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>MCap {formatUsd(coin.market_cap)}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Vol {formatUsd(coin.volume_24h)}</Text>
        </View>
      </View>

      {position && position.tokens_held > 0 ? (
        <View style={[styles.holdingCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="briefcase" size={16} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}>
            You hold {formatUsd(position.current_value)}
          </Text>
          <Text style={{ color: position.current_value - position.total_invested >= 0 ? colors.primary : colors.destructive, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
            {position.current_value - position.total_invested >= 0 ? '+' : '-'}
            {formatUsd(Math.abs(position.current_value - position.total_invested))}
          </Text>
        </View>
      ) : null}

      {/* Trade panel */}
      <View style={[styles.tradeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.switcher}>
          {(['buy', 'sell'] as const).map((t) => (
            <Pressable
              key={t}
              testID={`trade-${t}`}
              onPress={() => setTradeType(t)}
              style={[
                styles.switchBtn,
                {
                  backgroundColor: tradeType === t ? (t === 'buy' ? colors.primary : colors.destructive) : colors.secondary,
                },
              ]}
            >
              <Text
                style={{
                  color: tradeType === t ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: 'Inter_700Bold',
                  fontSize: 14,
                  textTransform: 'uppercase',
                }}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 10, fontFamily: 'Inter_500Medium' }}>
          {tradeType === 'buy'
            ? payWithMgoat
              ? `🐐 MGOAT available: ${Math.floor(mgoatHeld).toLocaleString()}`
              : `Cash available: ${formatUsd(balance)}`
            : `Held: ${formatUsd(position?.current_value ?? 0)}`}
        </Text>
        <TextInput
          testID="amount-input"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder={payWithMgoat ? 'Amount in MGOAT' : 'Amount in USD'}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {(payWithMgoat
            ? ([[100_000, '100K'], [1_000_000, '1M'], [10_000_000, '10M']] as const)
            : ([[10, '$10'], [50, '$50'], [100, '$100']] as const)
          ).map(([v, label]) => (
            <Pressable
              key={label}
              onPress={() => setAmount(String(v))}
              style={[styles.quick, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          testID="submit-trade"
          onPress={submitTrade}
          disabled={tradeMutation.isPending || swapBusy}
          style={({ pressed }) => [
            styles.submit,
            {
              backgroundColor: tradeType === 'buy' ? colors.primary : colors.destructive,
              opacity: pressed || tradeMutation.isPending || swapBusy ? 0.7 : 1,
            },
          ]}
        >
          {tradeMutation.isPending || swapBusy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 15, textTransform: 'uppercase' }}>
              {tradeType === 'buy' ? `Buy ${coin.ticker}` : `Sell ${coin.ticker}`}
            </Text>
          )}
        </Pressable>
        {message ? (
          <Text style={{ color: colors.foreground, fontSize: 13, marginTop: 8, textAlign: 'center', fontFamily: 'Inter_500Medium' }}>
            {message}
          </Text>
        ) : null}
        <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8, textAlign: 'center' }}>
          10% SafeMoon fee applies · simulated trading
        </Text>
      </View>

      {/* Buy trigger */}
      {!isMgoat ? (
        <View style={[styles.tradeCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
          <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 }}>
            ⏱ Buy Trigger
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
            The moment {coin.ticker}&apos;s market cap hits your target, your MGOAT buys in automatically.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TextInput
              value={triggerMgoat}
              onChangeText={setTriggerMgoat}
              keyboardType="decimal-pad"
              placeholder="MGOAT to spend"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { flex: 1, marginTop: 0, backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
            />
            <TextInput
              value={triggerMcap}
              onChangeText={setTriggerMcap}
              keyboardType="decimal-pad"
              placeholder="Target mcap $"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { flex: 1, marginTop: 0, backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
            />
          </View>
          <Pressable
            onPress={submitOrder}
            disabled={createOrder.isPending}
            style={({ pressed }) => [styles.submit, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary, opacity: pressed || createOrder.isPending ? 0.7 : 1 }]}
          >
            {createOrder.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 14, textTransform: 'uppercase' }}>Set Trigger</Text>
            )}
          </Pressable>
          {orderMsg ? (
            <Text style={{ color: colors.foreground, fontSize: 12, marginTop: 8, textAlign: 'center', fontFamily: 'Inter_500Medium' }}>{orderMsg}</Text>
          ) : null}
          {orders && orders.length > 0
            ? orders.slice(0, 5).map((o) => (
                <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8, marginTop: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>
                    🐐 {Math.floor(o.mgoat_amount).toLocaleString()} @ ${Math.floor(o.target_market_cap).toLocaleString()} mcap
                  </Text>
                  <Text style={{
                    color: o.status === 'open' ? colors.primary : o.status === 'executed' ? colors.primary : o.status === 'cancelled' ? colors.mutedForeground : colors.destructive,
                    fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase',
                  }}>
                    {o.status}
                  </Text>
                  {o.status === 'open' ? (
                    <Pressable
                      onPress={() => cancelOrder.mutate(
                        { orderId: o.id, data: { trader_name: TRADER_NAME } },
                        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCoinOrdersQueryKey(coinId, TRADER_NAME) }) },
                      )}
                      style={{ paddingLeft: 10 }}
                    >
                      <Feather name="x" size={14} color={colors.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            : null}
        </View>
      ) : null}

      <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>{coin.description}</Text>

      {/* Contract address */}
      {coin.contract_address ? (
        <Pressable
          onPress={async () => {
            await Clipboard.setStringAsync(coin.contract_address!);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopiedCa(true);
            setTimeout(() => setCopiedCa(false), 2000);
          }}
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
              Contract · {coin.blockchain ?? 'Mergegoat'}
            </Text>
            <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: 'Inter_500Medium' }} numberOfLines={1} ellipsizeMode="middle">
              {coin.contract_address}
            </Text>
          </View>
          <Feather name={copiedCa ? 'check' : 'copy'} size={16} color={copiedCa ? colors.primary : colors.mutedForeground} />
        </Pressable>
      ) : null}

      {/* Mascot feed */}
      {posts && posts.length > 0 ? (
        <View style={[styles.feedCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={styles.feedHead}>
            <Feather name="message-circle" size={15} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
              {posts[0].author} — LIVE FEED
            </Text>
          </View>
          {posts.slice(0, 8).map((p) => (
            <View key={p.id} style={[styles.post, { borderTopColor: colors.border }]}>
              <CoinAvatar url={coin.image_url} ticker={coin.ticker} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                  {p.author} · {new Date(p.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 19, marginTop: 2 }}>{p.content}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Recent trades */}
      <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 16, marginBottom: 8 }}>
        Recent Trades
      </Text>
      {(trades ?? []).slice(0, 15).map((t) => (
        <View key={t.id} style={[styles.tradeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather
            name={t.type === 'buy' ? 'arrow-down-left' : 'arrow-up-right'}
            size={16}
            color={t.type === 'buy' ? colors.primary : colors.destructive}
          />
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}>{t.trader_name}</Text>
          <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{formatUsd(t.amount_usd)}</Text>
        </View>
      ))}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  priceCard: { padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  holdingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  tradeCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  switcher: { flexDirection: 'row', gap: 8 },
  switchBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 8,
    fontFamily: 'Inter_500Medium',
  },
  quick: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  submit: { marginTop: 12, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  feedCard: { borderRadius: 14, borderWidth: 1, padding: 12 },
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8 },
  post: { flexDirection: 'row', gap: 8, paddingVertical: 10, borderTopWidth: 1 },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
});
