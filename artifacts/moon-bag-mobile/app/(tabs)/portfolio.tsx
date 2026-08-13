import React from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useGetTraderPositions, getGetTraderPositionsQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useWallet, TRADER_NAME } from '@/context/wallet';
import { CoinAvatar, EmptyState, formatUsd } from '@/components/ui';

export default function PortfolioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { balance } = useWallet();

  const { data: positions, refetch, isRefetching } = useGetTraderPositions(TRADER_NAME, {
    query: { queryKey: getGetTraderPositionsQueryKey(TRADER_NAME), refetchInterval: 10000 },
  });

  const holdings = (positions ?? []).filter((p) => p.tokens_held > 0);
  const holdingsValue = holdings.reduce((s, p) => s + p.current_value, 0);
  const openPl = holdings.reduce((s, p) => s + p.profit, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 110, paddingHorizontal: 16 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Portfolio</Text>

      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>TOTAL VALUE</Text>
        <Text style={{ color: colors.foreground, fontSize: 34, fontFamily: 'Inter_700Bold' }}>
          {formatUsd(balance + holdingsValue)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            Cash {formatUsd(balance)}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
            Coins {formatUsd(holdingsValue)}
          </Text>
          <Text
            style={{
              color: openPl >= 0 ? colors.primary : colors.destructive,
              fontSize: 13,
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            {openPl >= 0 ? '+' : '-'}{formatUsd(Math.abs(openPl))}
          </Text>
        </View>
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Your Coins</Text>
      {holdings.length === 0 ? (
        <EmptyState
          icon={<Feather name="briefcase" size={26} color={colors.mutedForeground} />}
          text="You don't hold any coins yet. Grab something from the Launches tab!"
        />
      ) : (
        holdings.map((p) => (
          <Pressable
            key={p.coin_id}
            testID={`holding-${p.coin_id}`}
            onPress={() => router.push(`/coin/${p.coin_id}`)}
            style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <CoinAvatar url={p.image_url} ticker={p.ticker} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>{p.coin_name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {p.ticker} · invested {formatUsd(p.total_invested)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{formatUsd(p.current_value)}</Text>
              <Text style={{ color: p.profit >= 0 ? colors.primary : colors.destructive, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                {p.profit >= 0 ? '+' : '-'}{formatUsd(Math.abs(p.profit))}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  hero: { padding: 18, borderRadius: 14, borderWidth: 1, gap: 2 },
  section: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 18, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
