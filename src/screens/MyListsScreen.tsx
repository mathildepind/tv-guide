import React, { useCallback, useState } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getEntries } from '../db/database';
import type { Entry, MyListsStackParamList, WatchStatus } from '../types';

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
  success: '#10b981',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 6;
const NUM_COLUMNS = 2;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * (NUM_COLUMNS + 1) * 2) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

type NavProp = NativeStackNavigationProp<MyListsStackParamList, 'MyLists'>;

// ─── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onPress,
}: {
  entry: Entry;
  onPress: () => void;
}) {
  const imageUri = entry.poster_path ?? null;

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

        {/* Media type badge */}
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

        {/* Rating pill */}
        {entry.rating !== null && (
          <View style={styles.ratingPill}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= (entry.rating ?? 0) ? 'star' : 'star-outline'}
                size={8}
                color="#facc15"
              />
            ))}
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

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ status }: { status: WatchStatus }) {
  return (
    <View style={styles.emptyContainer}>
      {status === 'want_to_watch' ? (
        <>
          <Ionicons name="bookmark-outline" size={56} color={COLORS.textSubtle} />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptySubtitle}>
            Search for movies and TV shows and add them to your watchlist.
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="checkmark-circle-outline" size={56} color={COLORS.textSubtle} />
          <Text style={styles.emptyTitle}>No watched titles yet</Text>
          <Text style={styles.emptySubtitle}>
            Mark titles as watched and rate them to see them here.
          </Text>
        </>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type TabKey = 'want_to_watch' | 'watched';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'want_to_watch', label: 'Want to Watch' },
  { key: 'watched', label: 'Watched' },
];

export default function MyListsScreen() {
  const navigation = useNavigation<NavProp>();
  const [activeTab, setActiveTab] = useState<TabKey>('want_to_watch');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Re-fetch whenever the screen is focused (e.g. returning from DetailScreen)
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setIsLoading(true);
        try {
          const data = await getEntries(activeTab);
          if (active) setEntries(data);
        } finally {
          if (active) setIsLoading(false);
        }
      }

      load();

      return () => {
        active = false;
      };
    }, [activeTab]),
  );

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const handlePressEntry = useCallback(
    (entry: Entry) => {
      navigation.navigate('Detail', {
        emsId: entry.ems_id,
        mediaType: entry.media_type,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Entry }) => (
      <EntryCard entry={item} onPress={() => handlePressEntry(item)} />
    ),
    [handlePressEntry],
  );

  const keyExtractor = useCallback((item: Entry) => String(item.id), []);

  return (
    <View style={styles.container}>
      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => handleTabChange(tab.key)}
          >
            {tab.key === 'want_to_watch' ? (
              <Ionicons
                name="bookmark"
                size={14}
                color={activeTab === tab.key ? COLORS.accent : COLORS.textSubtle}
              />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={activeTab === tab.key ? COLORS.success : COLORS.textSubtle}
              />
            )}
            <Text
              style={[
                styles.tabBtnText,
                activeTab === tab.key &&
                  (tab.key === 'want_to_watch'
                    ? styles.tabBtnTextAccent
                    : styles.tabBtnTextSuccess),
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Count ── */}
      {!isLoading && entries.length > 0 && (
        <Text style={styles.countLabel}>
          {entries.length} title{entries.length !== 1 ? 's' : ''}
        </Text>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={
            entries.length === 0 ? styles.flatListEmpty : styles.flatListContent
          }
          ListEmptyComponent={<EmptyState status={activeTab} />}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.columnWrapper}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  tabBtnText: {
    color: COLORS.textSubtle,
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextAccent: { color: COLORS.accent },
  tabBtnTextSuccess: { color: COLORS.success },
  // Count
  countLabel: {
    color: COLORS.textSubtle,
    fontSize: 12,
    marginLeft: 20,
    marginBottom: 4,
    marginTop: 6,
  },
  // Centered loader
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // List
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
  // Card
  card: {
    width: CARD_WIDTH,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
  },
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
    gap: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cardInfo: { padding: 8 },
  cardTitle: { color: COLORS.text, fontSize: 13, fontWeight: '600', lineHeight: 17 },
  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    marginTop: 60,
  },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
