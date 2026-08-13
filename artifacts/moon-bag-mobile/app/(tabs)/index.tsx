import React from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useGetLaunchedCoins,
  getGetLaunchedCoinsQueryKey,
  useGetLaunchedCoinStats,
  getGetLaunchedCoinStatsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { CoinAvatar, PctBadge, EmptyState, formatUsd, formatPrice } from '@/components/ui';
import { SPOTLIGHT_TICKER } from '@/constants/spotlight';

export default function LaunchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: coins, isLoading, refetch, isRefetching } = useGetLaunchedCoins(
    { sort: 'trending', limit: 50 },
    { query: { queryKey: getGetLaunchedCoinsQueryKey({ sort: 'trending', limit: 50 }), refetchInterval: 8000 } },
  );
  const { data: stats } = useGetLaunchedCoinStats({
    query: { queryKey: getGetLaunchedCoinStatsQueryKey() },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="cover" />
          <Text style={[styles.brand, { color: colors.foreground }]}>
            MOON<Text style={{ color: colors.primary }}>BAG</Text>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {stats ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
              {stats.total_coins_launched} coins · {formatUsd(stats.total_volume)} vol
            </Text>
          ) : null}
          <Pressable
            testID="launch-coin-button"
            onPress={() => router.push('/launch')}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={{ color: colors.primaryForeground, fontSize: 12, fontFamily: 'Inter_700Bold' }}>Launch</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={(coins ?? []).filter((c) => !SPOTLIGHT_TICKER || c.ticker === SPOTLIGHT_TICKER)}
        keyExtractor={(c) => String(c.id)}
        scrollEnabled={!!coins && coins.length > 0}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 16 }}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState icon={<Feather name="zap" size={28} color={colors.mutedForeground} />} text="No coins launched yet. Zubu is probably cooking one up." />
          )
        }
        renderItem={({ item }) => {
          const hot = !!item.hotspot_until && new Date(item.hotspot_until).getTime() > Date.now();
          return (
            <Pressable
              testID={`coin-${item.id}`}
              onPress={() => router.push(`/coin/${item.id}`)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.card, borderColor: hot ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <CoinAvatar url={item.image_url} ticker={item.ticker} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                  {hot ? <Feather name="zap" size={13} color={colors.primary} /> : null}
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {item.ticker} · by {item.creator_name}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.price, { color: colors.foreground }]}>{formatPrice(item.price)}</Text>
                <PctBadge value={item.price_change_24h} />
              </View>
            </Pressable>
          );
        }}
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
  brand: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  logo: { width: 34, height: 34, borderRadius: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  price: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
