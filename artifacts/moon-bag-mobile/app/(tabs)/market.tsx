import React from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useGetMarketCoins, getGetMarketCoinsQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { PctBadge, EmptyState, formatUsd, formatPrice } from '@/components/ui';

export default function MarketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const params = { page: 1, per_page: 50 };
  const { data: coins, isLoading, refetch, isRefetching } = useGetMarketCoins(params, {
    query: { queryKey: getGetMarketCoinsQueryKey(params), refetchInterval: 30000 },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Market</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
          Live prices
        </Text>
      </View>
      <FlatList
        data={coins ?? []}
        keyExtractor={(c) => c.id}
        scrollEnabled={!!coins && coins.length > 0}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 16 }}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState icon={<Feather name="trending-up" size={28} color={colors.mutedForeground} />} text="Market data is unavailable right now. Pull to refresh." />
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, width: 26, fontFamily: 'Inter_500Medium' }}>
              {item.market_cap_rank ?? '–'}
            </Text>
            <Image source={{ uri: item.image }} style={styles.logo} contentFit="cover" transition={150} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                {item.symbol.toUpperCase()} · {formatUsd(item.market_cap)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.price, { color: colors.foreground }]}>{formatPrice(item.current_price)}</Text>
              <PctBadge value={item.price_change_percentage_24h} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  logo: { width: 36, height: 36, borderRadius: 18 },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  price: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
