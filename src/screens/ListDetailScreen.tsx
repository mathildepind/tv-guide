/**
 * ListDetailScreen
 *
 * Displays all entries for a given WatchStatus, navigable from MyListsScreen
 * if you ever want a dedicated full-screen list view (e.g. tapped from a widget
 * or deep link). The main list UI is currently embedded in MyListsScreen via tabs.
 */

import React, { useCallback } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackRouteProp,
} from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getEntries } from '../db/database';
import { TMDB_IMAGE_BASE_URL } from '../constants/api';
import type { Entry, WatchStatus, MyListsStackParamList } from '../types';
import { useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  background: '#0f0f0f',
  surface: '#1a1a1a',
  surfaceElevated: '#242424',
  accent: '#E50914',
  text: '#ffffff',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  border: '#2a2a2a',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 6;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * (NUM_COLUMNS + 1) * 2) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

// ─── Types ────────────────────────────────────────────────────────────────────

// If you add ListDetail to your stack, extend the param list here.
type NavProp = NativeStackNavigationProp<MyListsStackParamList>;

// ─── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onPress,
}: {
  entry: Entry;
  onPress: () => void;
}) {
  const imageUri = entry.poster_path
    ? `${TMDB_IMAGE_BASE_URL}${entry.poster_path}`
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.posterContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="image-outline" size={32} color={COLORS.textSubtle} />
          </View>
        )}
        <View
          style={[
            styles.badge,
            entry.media_type === 'tv' ? styles.badgeTv : styles.badgeMovie,
          ]}
        >
          <Text style={styles.badgeText}>
            {entry.media_type === 'tv' ? 'TV' : 'Film'}
          </Text>
        </View>
        {entry.rating !== null && (
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={9} color="#facc15" />
            <Text style={styles.ratingPillText}>{entry.rating}/5</Text>
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {entry.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ListDetailScreen({ status }: { status: WatchStatus }) {
  const navigation = useNavigation<NavProp>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setIsLoading(true);
        try {
          const data = await getEntries(status);
          if (active) setEntries(data);
        } finally {
          if (active) setIsLoading(false);
        }
      }

      load();
      return () => { active = false; };
    }, [status]),
  );

  const handlePress = useCallback(
    (entry: Entry) => {
      navigation.navigate('Detail', {
        tmdbId: entry.tmdb_id,
        mediaType: entry.media_type,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Entry }) => (
      <EntryCard entry={item} onPress={() => handlePress(item)} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback((item: Entry) => String(item.id), []);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {entries.length > 0 && (
        <Text style={styles.countLabel}>
          {entries.length} title{entries.length !== 1 ? 's' : ''}
        </Text>
      )}
      <FlatList
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={
          entries.length === 0 ? styles.flatListEmpty : styles.flatListContent
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={56} color={COLORS.textSubtle} />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>
              Search for titles and add them to this list.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columnWrapper}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  countLabel: {
    color: COLORS.textSubtle,
    fontSize: 12,
    marginLeft: 20,
    marginBottom: 4,
    marginTop: 8,
  },
  flatListContent: {
    paddingHorizontal: CARD_MARGIN,
    paddingTop: 8,
    paddingBottom: 24,
  },
  flatListEmpty: { flex: 1 },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: CARD_MARGIN * 2,
    paddingHorizontal: CARD_MARGIN,
    marginBottom: CARD_MARGIN * 2,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  posterContainer: { width: CARD_WIDTH, height: CARD_HEIGHT, position: 'relative' },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeMovie: { backgroundColor: '#1d4ed8' },
  badgeTv: { backgroundColor: '#065f46' },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  ratingPill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingPillText: { color: '#ffffff', fontSize: 10, fontWeight: '600' },
  cardInfo: { padding: 8 },
  cardTitle: { color: COLORS.text, fontSize: 13, fontWeight: '600', lineHeight: 17 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    marginTop: 60,
  },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
