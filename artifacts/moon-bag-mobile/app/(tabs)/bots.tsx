import React, { useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useGetTraderPositions,
  getGetTraderPositionsQueryKey,
  useGetTraderTrades,
  getGetTraderTradesQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { CoinAvatar, EmptyState, formatUsd } from '@/components/ui';

const BOTS = [
  { name: 'zubu', label: 'Zubu', tagline: 'Best trader in the world 🌍 · $1,000 stake', icon: 'github' as const },
  { name: 'bobo', label: 'Bobo', tagline: 'Cool-headed dip buyer · $1,500 stake', icon: 'cpu' as const },
];

export default function BotsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [active, setActive] = useState<string>('zubu');

  const { data: positions, refetch: rp, isRefetching: rp1 } = useGetTraderPositions(active, {
    query: { queryKey: getGetTraderPositionsQueryKey(active), refetchInterval: 10000 },
  });
  const { data: trades, refetch: rt, isRefetching: rt1 } = useGetTraderTrades(active, {
    query: { queryKey: getGetTraderTradesQueryKey(active), refetchInterval: 10000 },
  });

  const totalValue = (positions ?? []).reduce((s, p) => s + p.current_value, 0);
  const totalProfit = (positions ?? []).reduce((s, p) => s + p.profit, 0);
  const bot = BOTS.find((b) => b.name === active)!;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 110, paddingHorizontal: 16 }}
      refreshControl={<RefreshControl refreshing={rp1 || rt1} onRefresh={() => { rp(); rt(); }} tintColor={colors.primary} />}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Trading Bots</Text>

      <View style={styles.switcher}>
        {BOTS.map((b) => (
          <Pressable
            key={b.name}
            testID={`bot-${b.name}`}
            onPress={() => setActive(b.name)}
            style={[
              styles.switchBtn,
              {
                backgroundColor: active === b.name ? colors.primary : colors.card,
                borderColor: active === b.name ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: active === b.name ? colors.primaryForeground : colors.foreground,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 14,
              }}
            >
              {b.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 12, fontFamily: 'Inter_500Medium' }}>
        {bot.tagline}
      </Text>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>HOLDINGS</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{formatUsd(totalValue)}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_500Medium' }}>OPEN P&L</Text>
          <Text
            style={{
              color: totalProfit >= 0 ? colors.primary : colors.destructive,
              fontSize: 18,
              fontFamily: 'Inter_700Bold',
            }}
          >
            {totalProfit >= 0 ? '+' : ''}{formatUsd(Math.abs(totalProfit)).replace('$', '$')}
          </Text>
        </View>
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Positions</Text>
      {(positions ?? []).length === 0 ? (
        <EmptyState icon={<Feather name="inbox" size={24} color={colors.mutedForeground} />} text="No open positions right now." />
      ) : (
        (positions ?? []).map((p) => (
          <Pressable
            key={p.coin_id}
            onPress={() => router.push(`/coin/${p.coin_id}`)}
            style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <CoinAvatar url={p.image_url} ticker={p.ticker} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{p.coin_name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{p.ticker}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{formatUsd(p.current_value)}</Text>
              <Text style={{ color: p.profit >= 0 ? colors.primary : colors.destructive, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                {p.profit >= 0 ? '+' : '-'}{formatUsd(Math.abs(p.profit))}
              </Text>
            </View>
          </Pressable>
        ))
      )}

      <Text style={[styles.section, { color: colors.foreground }]}>Recent Trades</Text>
      {(trades ?? []).length === 0 ? (
        <EmptyState icon={<Feather name="activity" size={24} color={colors.mutedForeground} />} text="No trades yet — check back in a minute." />
      ) : (
        (trades ?? []).slice(0, 20).map((t) => (
          <View key={t.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather
              name={t.type === 'buy' ? 'arrow-down-left' : 'arrow-up-right'}
              size={18}
              color={t.type === 'buy' ? colors.primary : colors.destructive}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                {t.type === 'buy' ? 'Bought' : 'Sold'} {t.ticker}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {new Date(t.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{formatUsd(t.amount_usd)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  switcher: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, gap: 2 },
  section: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
