import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackRouteProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getMovieDetails, getTVDetails } from '../services/tmdb';
import {
  addEntry as dbAddEntry,
  getEntry,
  removeEntry as dbRemoveEntry,
  updateEntry as dbUpdateEntry,
  addSeasonProgress,
  getSeasonsForEntry,
  updateSeasonProgress,
} from '../db/database';
import type {
  Entry,
  RTMovieDetails,
  RTTVDetails,
  RTTVSeason,
  SearchStackParamList,
  SeasonProgress,
  WatchStatus,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  background: '#0f0f0f',
  surface: '#1a1a1a',
  surfaceElevated: '#242424',
  accent: '#E50914',
  accentDim: '#7f0007',
  text: '#ffffff',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  border: '#2a2a2a',
  success: '#10b981',
  successDim: '#065f46',
};

type NavProp = NativeStackNavigationProp<SearchStackParamList, 'Detail'>;
type RouteProp = NativeStackRouteProp<SearchStackParamList, 'Detail'>;

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({
  rating,
  onRate,
  size = 28,
}: {
  rating: number | null;
  onRate: (star: number) => void;
  size?: number;
}) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRate(star)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons
            name={rating !== null && star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={rating !== null && star <= rating ? '#facc15' : COLORS.textSubtle}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
});

// ─── SeasonRow ────────────────────────────────────────────────────────────────

function SeasonRow({
  season,
  progress,
  onToggle,
  onRate,
}: {
  season: RTTVSeason;
  progress: SeasonProgress | undefined;
  onToggle: (seasonNumber: number, watched: boolean) => void;
  onRate: (seasonNumber: number, rating: number) => void;
}) {
  const watched = progress?.watched ?? false;

  return (
    <View style={seasonStyles.row}>
      <TouchableOpacity
        style={seasonStyles.checkBtn}
        onPress={() => onToggle(season.season_number, !watched)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={watched ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={watched ? COLORS.success : COLORS.textSubtle}
        />
      </TouchableOpacity>

      <View style={seasonStyles.info}>
        <Text style={seasonStyles.name}>{season.name}</Text>
        <Text style={seasonStyles.episodeCount}>
          {season.episode_count} episode{season.episode_count !== 1 ? 's' : ''}
        </Text>
      </View>

      {watched && (
        <View style={seasonStyles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => onRate(season.season_number, star)}
              hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            >
              <Ionicons
                name={
                  progress?.rating != null && star <= progress.rating
                    ? 'star'
                    : 'star-outline'
                }
                size={14}
                color={
                  progress?.rating != null && star <= progress.rating
                    ? '#facc15'
                    : COLORS.textSubtle
                }
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const seasonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  checkBtn: {},
  info: { flex: 1 },
  name: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  episodeCount: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  stars: { flexDirection: 'row', gap: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp>();
  const { emsId, mediaType } = route.params;

  // Remote details
  const [movieDetails, setMovieDetails] = useState<RTMovieDetails | null>(null);
  const [tvDetails, setTVDetails] = useState<RTTVDetails | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(true);

  // Local entry
  const [entry, setEntry] = useState<Entry | null>(null);
  const [seasonProgress, setSeasonProgress] = useState<SeasonProgress[]>([]);

  // Draft state (uncommitted to DB)
  const [draftStatus, setDraftStatus] = useState<WatchStatus | null>(null);
  const [draftRating, setDraftRating] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Load remote + local data ──────────────────────────────────────────────

  const loadDetails = useCallback(async () => {
    setIsFetchingDetails(true);
    setFetchError(null);
    try {
      if (mediaType === 'movie') {
        const d = await getMovieDetails(emsId);
        setMovieDetails(d);
      } else {
        const d = await getTVDetails(emsId);
        setTVDetails(d);
      }
    } catch (err) {
      setFetchError('Could not load details. Check your connection or API key.');
    } finally {
      setIsFetchingDetails(false);
    }
  }, [emsId, mediaType]);

  const loadLocalEntry = useCallback(async () => {
    const e = await getEntry(emsId, mediaType);
    setEntry(e);
    if (e) {
      setDraftStatus(e.status);
      setDraftRating(e.rating);
      setDraftNotes(e.notes ?? '');
      const seasons = await getSeasonsForEntry(e.id);
      setSeasonProgress(seasons);
    }
  }, [emsId, mediaType]);

  useEffect(() => {
    loadDetails();
    loadLocalEntry();
  }, [loadDetails, loadLocalEntry]);

  // ── Derived display values ────────────────────────────────────────────────

  const title =
    mediaType === 'movie'
      ? (movieDetails?.title ?? '')
      : (tvDetails?.title ?? '');

  const overview =
    mediaType === 'movie'
      ? (movieDetails?.description ?? '')
      : (tvDetails?.description ?? '');

  const year =
    mediaType === 'movie'
      ? (movieDetails?.releaseYear ?? '')
      : (tvDetails?.releaseYear ?? '');

  const posterPath =
    mediaType === 'movie'
      ? (movieDetails?.posterUri ?? movieDetails?.primaryImageUrl ?? null)
      : (tvDetails?.posterUri ?? tvDetails?.primaryImageUrl ?? null);

  const criticsScore =
    mediaType === 'movie'
      ? movieDetails?.tomatometerScore?.score
      : tvDetails?.tomatometerScore?.score;

  const consensus =
    mediaType === 'movie'
      ? movieDetails?.tomatometerScore?.consensus
      : tvDetails?.tomatometerScore?.consensus;

  const seasons: RTTVSeason[] =
    mediaType === 'tv' ? (tvDetails?.seasons ?? []) : [];

  // ── Save logic ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!draftStatus) {
      Alert.alert('No list selected', 'Please choose "Want to Watch" or "Watched" first.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      if (!entry) {
        const newEntry = await dbAddEntry({
          ems_id: emsId,
          media_type: mediaType,
          title,
          poster_path: posterPath,
          overview,
          status: draftStatus,
          rating: draftStatus === 'watched' ? draftRating : null,
          notes: draftNotes.trim() || null,
          added_at: now,
          watched_at: draftStatus === 'watched' ? now : null,
        });
        setEntry(newEntry);
      } else {
        await dbUpdateEntry(entry.id, {
          status: draftStatus,
          rating: draftStatus === 'watched' ? draftRating : null,
          notes: draftNotes.trim() || null,
          watched_at:
            draftStatus === 'watched'
              ? (entry.watched_at ?? now)
              : null,
        });
        setEntry({ ...entry, status: draftStatus, rating: draftRating, notes: draftNotes });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    draftStatus,
    draftRating,
    draftNotes,
    entry,
    emsId,
    mediaType,
    title,
    posterPath,
    overview,
  ]);

  const handleRemove = useCallback(() => {
    if (!entry) return;
    Alert.alert(
      'Remove from lists',
      `Remove "${title}" from your lists?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await dbRemoveEntry(entry.id);
            setEntry(null);
            setDraftStatus(null);
            setDraftRating(null);
            setDraftNotes('');
            setSeasonProgress([]);
          },
        },
      ],
    );
  }, [entry, title]);

  // ── Season toggle / rate ──────────────────────────────────────────────────

  const handleSeasonToggle = useCallback(
    async (seasonNumber: number, watched: boolean) => {
      if (!entry) {
        Alert.alert(
          'Add to list first',
          'Save this show to your lists before tracking seasons.',
        );
        return;
      }
      const existing = seasonProgress.find((s) => s.season_number === seasonNumber);
      if (existing) {
        await updateSeasonProgress(existing.id, { watched });
      } else {
        await addSeasonProgress({
          entry_id: entry.id,
          season_number: seasonNumber,
          watched,
          rating: null,
          notes: null,
        });
      }
      const updated = await getSeasonsForEntry(entry.id);
      setSeasonProgress(updated);
    },
    [entry, seasonProgress],
  );

  const handleSeasonRate = useCallback(
    async (seasonNumber: number, rating: number) => {
      if (!entry) return;
      const existing = seasonProgress.find((s) => s.season_number === seasonNumber);
      if (existing) {
        await updateSeasonProgress(existing.id, { rating });
      } else {
        await addSeasonProgress({
          entry_id: entry.id,
          season_number: seasonNumber,
          watched: true,
          rating,
          notes: null,
        });
      }
      const updated = await getSeasonsForEntry(entry.id);
      setSeasonProgress(updated);
    },
    [entry, seasonProgress],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (isFetchingDetails) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textSubtle} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorBody}>{fetchError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadDetails}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.heroContainer}>
          {posterPath ? (
            <Image source={{ uri: posterPath }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="image-outline" size={64} color={COLORS.textSubtle} />
            </View>
          )}
          <View style={styles.heroGradient} />
        </View>

        <View style={styles.body}>
          {/* ── Title & meta ── */}
          <View style={styles.metaRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {mediaType === 'tv' ? 'TV Show' : 'Movie'}
              </Text>
            </View>
            {criticsScore && (
              <View style={styles.scoreRow}>
                <Text style={styles.scoreEmoji}>🍅</Text>
                <Text style={styles.scoreText}>{criticsScore}%</Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{title}</Text>

          {year ? <Text style={styles.year}>{year}</Text> : null}

          {consensus ? (
            <Text style={styles.consensus}>"{consensus}"</Text>
          ) : overview ? (
            <Text style={styles.overview}>{overview}</Text>
          ) : null}

          {/* ── List selection ── */}
          <Text style={styles.sectionLabel}>Add to list</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[
                styles.statusBtn,
                draftStatus === 'want_to_watch' && styles.statusBtnActive,
              ]}
              onPress={() => setDraftStatus('want_to_watch')}
            >
              <Ionicons
                name="bookmark-outline"
                size={16}
                color={draftStatus === 'want_to_watch' ? '#ffffff' : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.statusBtnText,
                  draftStatus === 'want_to_watch' && styles.statusBtnTextActive,
                ]}
              >
                Want to Watch
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusBtn,
                draftStatus === 'watched' && styles.statusBtnActiveGreen,
              ]}
              onPress={() => setDraftStatus('watched')}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={draftStatus === 'watched' ? '#ffffff' : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.statusBtnText,
                  draftStatus === 'watched' && styles.statusBtnTextActive,
                ]}
              >
                Watched
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Rating (only when watched) ── */}
          {draftStatus === 'watched' && (
            <>
              <Text style={styles.sectionLabel}>Your rating</Text>
              <StarRating
                rating={draftRating}
                onRate={(star) =>
                  setDraftRating(star === draftRating ? null : star)
                }
              />
            </>
          )}

          {/* ── Notes ── */}
          <Text style={styles.sectionLabel}>Notes / Review</Text>
          <TextInput
            style={styles.notesInput}
            value={draftNotes}
            onChangeText={setDraftNotes}
            placeholder="Write your thoughts…"
            placeholderTextColor={COLORS.textSubtle}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* ── Save / Remove buttons ── */}
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving || !draftStatus}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#ffffff" />
                <Text style={styles.saveBtnText}>
                  {entry ? 'Update' : 'Save to List'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {entry && (
            <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
              <Ionicons name="trash-outline" size={16} color={COLORS.accent} />
              <Text style={styles.removeBtnText}>Remove from lists</Text>
            </TouchableOpacity>
          )}

          {/* ── Season tracker (TV only) ── */}
          {mediaType === 'tv' && seasons.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 28 }]}>
                Season Tracker
              </Text>
              {!entry && (
                <Text style={styles.seasonHint}>
                  Save this show to a list to start tracking seasons.
                </Text>
              )}
              {seasons.map((season) => {
                const prog = seasonProgress.find(
                  (sp) => sp.season_number === season.season_number,
                );
                return (
                  <SeasonRow
                    key={season.season_number}
                    season={season}
                    progress={prog}
                    onToggle={handleSeasonToggle}
                    onRate={handleSeasonRate}
                  />
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    gap: 12,
    padding: 32,
  },
  errorTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  errorBody: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  retryBtnText: { color: '#ffffff', fontWeight: '700' },
  heroContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(15,15,15,0.85)',
  },
  body: { padding: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  typeBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scoreEmoji: { fontSize: 13 },
  scoreText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 4,
  },
  year: { color: COLORS.textMuted, fontSize: 14, marginBottom: 12 },
  consensus: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  overview: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  statusBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  statusBtnActiveGreen: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  statusBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  statusBtnTextActive: { color: '#ffffff' },
  notesInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 100,
    lineHeight: 20,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
  },
  removeBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  seasonHint: {
    color: COLORS.textSubtle,
    fontSize: 13,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});
