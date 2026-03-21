import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { searchMulti } from '../services/tmdb';
import type { SearchStackParamList, RTSearchResult } from '../types';

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

type NavProp = NativeStackNavigationProp<SearchStackParamList, 'Search'>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function MediaBadge({ type }: { type: 'movie' | 'tv' }) {
  return (
    <View style={[styles.badge, type === 'tv' ? styles.badgeTv : styles.badgeMovie]}>
      <Text style={styles.badgeText}>{type === 'tv' ? 'TV' : 'Film'}</Text>
    </View>
  );
}

function ResultCard({
  item,
  onPress,
}: {
  item: RTSearchResult;
  onPress: () => void;
}) {
  const year = item.releaseYear ? String(item.releaseYear) : null;
  const imageUri = item.posterImageUrl ?? null;
  const criticsScore = item.rottenTomatoes?.criticsScore;

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
        <View style={styles.badgeContainer}>
          <MediaBadge type={item.type} />
        </View>
        {criticsScore != null && criticsScore > 0 && (
          <View style={styles.ratingPill}>
            <Text style={styles.ratingPillEmoji}>🍅</Text>
            <Text style={styles.ratingPillText}>{criticsScore}%</Text>
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {year ? <Text style={styles.cardYear}>{year}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ query }: { query: string }) {
  if (!query.trim()) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="tv-outline" size={64} color={COLORS.textSubtle} />
        <Text style={styles.emptyTitle}>Discover Shows & Movies</Text>
        <Text style={styles.emptySubtitle}>
          Search for anything and start building your watchlist.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={48} color={COLORS.textSubtle} />
      <Text style={styles.emptyTitle}>No results for "{query}"</Text>
      <Text style={styles.emptySubtitle}>Try a different title or keyword.</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RTSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await searchMulti(q);
      setResults(data);
    } catch (err) {
      setError('Failed to fetch results. Check your connection and API key.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  const handlePress = useCallback(
    (item: RTSearchResult) => {
      Keyboard.dismiss();
      navigation.navigate('Detail', {
        emsId: item.emsId,
        mediaType: item.type,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: RTSearchResult }) => (
      <ResultCard item={item} onPress={() => handlePress(item)} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback(
    (item: RTSearchResult) => `${item.type}-${item.emsId}`,
    [],
  );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBarRow}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search-outline"
            size={18}
            color={COLORS.textSubtle}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search movies & TV shows…"
            placeholderTextColor={COLORS.textSubtle}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.accent} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Loading overlay */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={
            results.length === 0 ? styles.flatListEmpty : styles.flatListContent
          }
          ListEmptyComponent={<EmptyState query={query} />}
          keyboardShouldPersistTaps="handled"
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
  searchBarRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#2d0000',
    borderRadius: 8,
    gap: 6,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatListContent: {
    paddingHorizontal: CARD_MARGIN,
    paddingTop: 8,
    paddingBottom: 24,
  },
  flatListEmpty: {
    flex: 1,
  },
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
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeMovie: {
    backgroundColor: '#1d4ed8',
  },
  badgeTv: {
    backgroundColor: '#065f46',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ratingPill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  ratingPillEmoji: {
    fontSize: 11,
  },
  ratingPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  cardInfo: {
    padding: 8,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  cardYear: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    marginTop: 60,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
