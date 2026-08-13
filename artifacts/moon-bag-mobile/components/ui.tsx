import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';

// ── Formatting helpers ──────────────────────────────────────────────

export function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatPrice(p: number): string {
  if (p >= 1) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(9).replace(/0+$/, '') || '0'}`;
}

// Resolve relative image paths (e.g. "/zubu.png") against the deployment
// domain, where the web app serves its public assets.
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return null;
  // Video logos can't autoplay reliably in RN <Image>; use the poster PNG.
  const still = url.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.png');
  return `https://${domain}${still}`;
}

// ── Small shared components ─────────────────────────────────────────

export function CoinAvatar({ url, ticker, size = 40 }: { url?: string | null; ticker: string; size?: number }) {
  const colors = useColors();
  const resolved = resolveImageUrl(url);
  if (resolved) {
    return (
      <Image
        source={{ uri: resolved }}
        style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: colors.muted }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: size * 0.32 }}>
        {ticker.slice(0, 3)}
      </Text>
    </View>
  );
}

export function PctBadge({ value, size = 13 }: { value: number | null | undefined; size?: number }) {
  const colors = useColors();
  const v = value ?? 0;
  const up = v >= 0;
  return (
    <Text
      style={{
        color: up ? colors.primary : colors.destructive,
        fontFamily: 'Inter_600SemiBold',
        fontSize: size,
      }}
    >
      {up ? '+' : ''}
      {v.toFixed(1)}%
    </Text>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
});
