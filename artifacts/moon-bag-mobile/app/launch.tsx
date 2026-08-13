import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import {
  useCreateLaunchedCoin,
  getGetLaunchedCoinsQueryKey,
  requestUploadUrl,
  getLaunchedCoins,
  getCoinPosition,
  createCoinTrade,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export default function LaunchCoinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [supply, setSupply] = useState(1_000_000_000);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const SUPPLY_PRESETS = [
    { label: '1M', value: 1_000_000 },
    { label: '100M', value: 100_000_000 },
    { label: '1B', value: 1_000_000_000 },
    { label: '1T', value: 1_000_000_000_000 },
  ];

  const pickPhoto = async () => {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const contentType = asset.mimeType ?? blob.type ?? 'image/jpeg';
      const { uploadURL, objectPath } = await requestUploadUrl({
        name: asset.fileName ?? 'coin-photo.jpg',
        size: blob.size || 1,
        contentType,
      });
      const put = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
      if (!put.ok) throw new Error(`upload ${put.status}`);
      setImageUrl(`/api/storage${objectPath}`);
      setPhotoUri(asset.uri);
    } catch {
      setError('Photo upload failed — try again.');
    } finally {
      setUploading(false);
    }
  };

  const launch = useCreateLaunchedCoin({
    mutation: {
      onSuccess: (coin) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        queryClient.invalidateQueries({ queryKey: getGetLaunchedCoinsQueryKey({ sort: 'trending', limit: 50 }) });
        router.replace(`/coin/${coin.id}`);
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError('Launch failed — try a different ticker.');
      },
    },
  });

  const LAUNCH_FEE_MGOAT = 10_000_000;
  const [payingFee, setPayingFee] = useState(false);

  const submit = async () => {
    setError('');
    if (name.trim().length < 1 || ticker.trim().length < 2 || description.trim().length < 5) {
      setError('Fill in a name, a ticker (2-10 letters), and a short description.');
      return;
    }
    // Launch fee: sell 10M MGOAT from the trader's position without crediting
    // the proceeds to their wallet — that's the platform's cut (client-orchestrated by design).
    setPayingFee(true);
    try {
      const coins = await getLaunchedCoins({ ticker: 'MGOAT', limit: 1 });
      const mgoat = coins[0];
      if (!mgoat) {
        setError('MGOAT market unavailable — try again in a moment.');
        return;
      }
      const pos = await getCoinPosition(mgoat.id, 'you').catch(() => null);
      const held = pos?.tokens_held ?? 0;
      if (held < LAUNCH_FEE_MGOAT) {
        setError(
          `Launching costs ${LAUNCH_FEE_MGOAT.toLocaleString()} MGOAT — you hold ${Math.floor(held).toLocaleString()}. Buy MGOAT first, then come back.`,
        );
        return;
      }
      // Gross up by /0.9: the trade endpoint's 10% fee means it sells
      // (amount_usd * 0.9 / price) tokens — this makes exactly 10M leave.
      const feeUsd = (LAUNCH_FEE_MGOAT * mgoat.price) / 0.9;
      await createCoinTrade(mgoat.id, { type: 'sell', amount_usd: feeUsd, trader_name: 'you' });
    } catch {
      setError('Could not charge the launch fee — try again.');
      return;
    } finally {
      setPayingFee(false);
    }
    launch.mutate({
      data: {
        name: name.trim(),
        ticker: ticker.trim().toUpperCase().slice(0, 10),
        description: description.trim(),
        creator_name: 'you',
        initial_supply: supply,
        image_url: imageUrl,
      },
    });
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 4, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable testID="back-button" onPress={() => router.back()} style={{ paddingVertical: 8, width: 44 }}>
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>

      <Text style={{ color: colors.foreground, fontSize: 24, fontFamily: 'Inter_700Bold' }}>Launch a Coin 🚀</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 4, marginBottom: 20, fontFamily: 'Inter_500Medium' }}>
        Invent your own meme coin. It goes live on Moon Bag instantly — simulated, zero gas fees.
      </Text>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>COIN PHOTO</Text>
      <Pressable
        testID="photo-picker"
        onPress={pickPhoto}
        disabled={uploading}
        style={[styles.photoPicker, { borderColor: colors.input, backgroundColor: colors.card }]}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
        ) : (
          <Feather name="image" size={26} color={colors.mutedForeground} />
        )}
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}>
          {uploading ? 'Uploading…' : photoUri ? 'Photo ready — tap to change' : 'Tap to add a photo for your coin'}
        </Text>
        {uploading ? <ActivityIndicator color={colors.primary} /> : null}
      </Pressable>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>COIN NAME</Text>
      <TextInput
        testID="name-input"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Turbo Hamster"
        placeholderTextColor={colors.mutedForeground}
        maxLength={64}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>TICKER</Text>
      <TextInput
        testID="ticker-input"
        value={ticker}
        onChangeText={(t) => setTicker(t.toUpperCase())}
        placeholder="e.g. HAMST"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="characters"
        maxLength={10}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>THE STORY</Text>
      <TextInput
        testID="description-input"
        value={description}
        onChangeText={setDescription}
        placeholder="Why is this coin going to the moon?"
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={4}
        maxLength={500}
        style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>STARTING SUPPLY — HOW MANY COINS EXIST AT LAUNCH</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SUPPLY_PRESETS.map((p) => (
          <Pressable
            key={p.label}
            testID={`supply-${p.label}`}
            onPress={() => setSupply(p.value)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              alignItems: 'center',
              borderColor: supply === p.value ? colors.primary : colors.input,
              backgroundColor: supply === p.value ? colors.primary + '22' : colors.card,
            }}
          >
            <Text style={{ color: supply === p.value ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6, fontFamily: 'Inter_500Medium' }}>
        {supply.toLocaleString()} {ticker ? ticker : 'coins'} at launch
      </Text>

      <View
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary + '55',
          backgroundColor: colors.primary + '11',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>
          LAUNCH FEE
        </Text>
        <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'Inter_700Bold' }}>
          {LAUNCH_FEE_MGOAT.toLocaleString()} MGOAT
        </Text>
      </View>

      {error ? (
        <Text style={{ color: colors.destructive, fontSize: 13, marginTop: 10, fontFamily: 'Inter_500Medium' }}>{error}</Text>
      ) : null}

      <Pressable
        testID="launch-button"
        onPress={submit}
        disabled={launch.isPending || payingFee}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: colors.primary, opacity: pressed || launch.isPending || payingFee ? 0.7 : 1 },
        ]}
      >
        {launch.isPending || payingFee ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 15, textTransform: 'uppercase' }}>
            🚀 Launch it
          </Text>
        )}
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  photoPicker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  submit: { marginTop: 24, paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
});
