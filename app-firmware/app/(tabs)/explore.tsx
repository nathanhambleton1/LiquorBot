// -----------------------------------------------------------------------------
// File:   explore.tsx   (UPDATED – 11 Jun 2025)
// Purpose: Explore page – themed Recipe Books plus “Load to Device” button that
//          publishes the book’s ingredient IDs to the ESP‑32 slot‑config topic.
//          *NEW*: leverages on‑device image cache so book covers and drink
//          thumbnails appear instantly (same strategy used by menu.tsx).
// -----------------------------------------------------------------------------

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ImageBackground, Dimensions, Modal, FlatList, Animated, Easing,
  Platform, UIManager, ActivityIndicator, NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getUrl } from 'aws-amplify/storage';
import { getCurrentUser } from '@aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLiquorBot } from '../components/liquorbot-provider';
import { Amplify } from 'aws-amplify';
import config from '../../src/amplifyconfiguration.json';
import { PubSub } from '@aws-amplify/pubsub';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';       // ★ NEW ★

/* ─────────── Amplify + PubSub bootstrap ─────────── */
Amplify.configure(config);
const pubsub = new PubSub({
  region:   'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

if (Platform.OS === 'android')
  UIManager.setLayoutAnimationEnabledExperimental?.(true);

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */
type Drink = {
  id: number;
  name: string;
  category: string;
  description?: string;
  image: string;
  /** legacy single-string field (id:oz:prio, …) */
  ingredients?: string;
  /** new multi-string field(s) (id:oz:prio, …) */
  recipes?: string[];
};

type Ingredient = { id: number; name: string; type: string };

type RecipeBook = {
  id: string;
  name: string;
  description: string;
  ingredientIds: number[];
  drinks: Drink[];
  image: string;
};

/* -------------------------------------------------------------------------- */
/*                             IMAGE‑CACHE HELPERS                            */
/* -------------------------------------------------------------------------- */
/** Use same folder as menu.tsx (drink‑images) for shared cache */
function getLocalDrinkImagePath(drinkId: number, imageUrl: string) {
  const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
  return `${FileSystem.cacheDirectory || FileSystem.documentDirectory}drink-images/drink_${drinkId}.${ext}`;
}

/** Returns the best <Image> source for a drink – local first, else downloads */
async function getDrinkImageSource(drink: Drink): Promise<{ uri: string }> {
  if (!drink.image) return { uri: '' };
  const localUri = getLocalDrinkImagePath(drink.id, drink.image);
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) return { uri: localUri };
    await FileSystem.makeDirectoryAsync(localUri.substring(0, localUri.lastIndexOf('/')), { intermediates: true });
    await FileSystem.downloadAsync(drink.image, localUri);
    return { uri: localUri };
  } catch {
    return { uri: drink.image };
  }
}

/** Same logic but for arbitrary URLs (e.g. book cover) */
function getLocalCoverPath(url: string, key: string) {
  const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
  return `${FileSystem.cacheDirectory || FileSystem.documentDirectory}explore-covers/${key}.${ext}`;
}

async function getCoverImageSource(url: string, key: string): Promise<{ uri: string }> {
  if (!url) return { uri: '' };
  const localUri = getLocalCoverPath(url, key);
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) return { uri: localUri };
    await FileSystem.makeDirectoryAsync(localUri.substring(0, localUri.lastIndexOf('/')), { intermediates: true });
    await FileSystem.downloadAsync(url, localUri);
    return { uri: localUri };
  } catch {
    return { uri: url };
  }
}

/* -------------------------------------------------------------------------- */
/*                              CONSTANTS                                     */
/* -------------------------------------------------------------------------- */
const MAX_INGS      = 15;   // hardware limit (slots)
const MIN_DRINKS    = 3;
const OVERLAP_CAP   = 0.20; // per-section
const CAROUSEL_LOOP = 30;
const ITEM_W        = 112;
const AUTO_SPEED    = 36;

const placeholder = '../../assets/images/glasses/rocks.png';

/* handy helpers */
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** parse "id:oz:prio" → id – handles both old `.ingredients` and new `.recipes[]` */
const parseIngIds = (d: Drink): number[] => {
  const slice = (str: string) => +str.split(':')[0];
  if (d.ingredients)
    return d.ingredients.split(',').map(slice).filter(Number.isFinite);

  if (Array.isArray(d.recipes))
    return d.recipes
      .flatMap((r) => r.split(',').map(slice))
      .filter(Number.isFinite);

  return [];
};

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/* ───── Undo helpers (shared) ───── */
const getUndoKey = (user: string, botId: string) =>
  `undoConfig-${user}-${botId}`;

async function saveUndo(
  slots: number[] | unknown,
  user:  string,
  botId: string,
) {
  try {
    await AsyncStorage.setItem(getUndoKey(user, botId), JSON.stringify(slots));
  } catch { /* ignore */ }
}

/* -------------------------------------------------------------------------- */
/*                     PER-SECTION BOOK‑BUILDER (≤20 % overlap)              */
/* -------------------------------------------------------------------------- */
function buildBookDistinct(
  pool: Drink[],
  sectionUsed: Set<number>,
  id: string,
  name: string,
  desc: string,
): RecipeBook | null {
  if (!pool.length) return null;

  const uniquePool = pool.filter((d) => !sectionUsed.has(d.id));
  const dupPool    = pool.filter((d) =>  sectionUsed.has(d.id));

  for (let attempt = 0; attempt < 10; attempt++) {
    const ordered = [...shuffle(uniquePool), ...shuffle(dupPool)];
    const sel: Drink[] = [];
    const ingSet = new Set<number>();

    for (const d of ordered) {
      const nextIng = new Set([...ingSet, ...parseIngIds(d)]);
      if (nextIng.size > MAX_INGS) continue;

      const dupCntIfAdd =
        sel.filter((x) => sectionUsed.has(x.id)).length +
        (sectionUsed.has(d.id) ? 1 : 0);

      if (dupCntIfAdd / (sel.length + 1) <= OVERLAP_CAP) {
        sel.push(d);
        nextIng.forEach((id) => ingSet.add(id));
        if (sel.length >= 8 || ingSet.size >= MAX_INGS) break;
      }
    }

    if (sel.length >= MIN_DRINKS) {
      sel.forEach((d) => sectionUsed.add(d.id));
      return {
        id,
        name,
        description: desc,
        drinks: sel,
        ingredientIds: [...ingSet],
        image: sel[0]?.image || placeholder,
      };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                       DRINK THUMBNAIL (cached images)                      */
/* -------------------------------------------------------------------------- */
const DrinkThumb = ({ drink }: { drink: Drink }) => {
  const [src, setSrc] = useState<{ uri: string }>({ uri: '' });
  useEffect(() => {
    let mounted = true;
    getDrinkImageSource(drink).then((s) => mounted && setSrc(s));
    return () => { mounted = false; };
  }, [drink]);

  return (
    <View style={styles.modalDrink}>
      {src.uri ? (
        <Image source={src} style={styles.modalDrinkImg} />
      ) : (
        <View style={[styles.modalDrinkImg, { backgroundColor: '#141414' }]} />
      )}
      <Text style={styles.modalDrinkName}>{drink.name}</Text>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*                       INFINITE‑SCROLL DRINK CAROUSEL                       */
/* -------------------------------------------------------------------------- */
function InfiniteDrinkCarousel({ drinks }: { drinks: Drink[] }) {
  if (!drinks.length) return null;
  const data   = useMemo(
    () => Array.from({ length: CAROUSEL_LOOP }).flatMap(() => drinks),
    [drinks],
  );
  const list   = useRef<FlatList>(null);
  const offset = useRef(0);
  const tick   = useRef(new Animated.Value(0)).current;
  const loop   = useRef<Animated.CompositeAnimation | null>(null);
  const resume = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    loop.current = Animated.loop(
      Animated.timing(tick, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.current.start();
  };
  const stop = () => loop.current?.stop();

  useEffect(() => {
    list.current?.scrollToIndex({
      index: Math.floor(data.length / 2),
      animated: false,
    });
    start();

    const id = tick.addListener(() => {
      offset.current += AUTO_SPEED / 60;
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
    });
    return () => {
      tick.removeListener(id);
      stop();
    };
  }, [data]);

  const wrap = ({
    nativeEvent: { contentOffset },
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = contentOffset.x;
    const pad   = drinks.length * ITEM_W;
    const total = data.length   * ITEM_W;
    if (contentOffset.x < pad) {
      offset.current += pad * (CAROUSEL_LOOP / 2);
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
    } else if (contentOffset.x > total - pad) {
      offset.current -= pad * (CAROUSEL_LOOP / 2);
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
    }
  };

  const pause = () => {
    stop();
    if (resume.current) clearTimeout(resume.current);
  };
  const onEnd = () => {
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(() => {
      tick.setValue(0);
      start();
    }, 500);
  };

  return (
    <FlatList
      ref={list}
      data={data}
      keyExtractor={(_, i) => String(i)}
      horizontal
      renderItem={({ item }) => <DrinkThumb drink={item} />}
      getItemLayout={(_, i) => ({ length: ITEM_W, offset: i * ITEM_W, index: i })}
      showsHorizontalScrollIndicator={false}
      onScroll={wrap}
      scrollEventThrottle={16}
      onTouchStart={pause}
      onScrollEndDrag={onEnd}
      onMomentumScrollEnd={onEnd}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                            MODAL + BOOK CARD                               */
/* -------------------------------------------------------------------------- */
interface BookModalProps {
  book: RecipeBook | null;
  visible: boolean;
  onClose: () => void;
  ingredientMap: Map<number, Ingredient>;
  isConnected: boolean;
  onApply: (book: RecipeBook) => Promise<void>;
}

const BookModal = ({
  book,
  visible,
  onClose,
  ingredientMap,
  isConnected,
  onApply,
}: BookModalProps) => {
  const [saving,  setSaving]  = useState(false);
  const [applied, setApplied] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  if (!book) return null;

  const animateSuccess = () =>
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true }),
    ]).start();

  const handleApply = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onApply(book);
      setApplied(true);
      animateSuccess();
      setTimeout(() => setApplied(false), 2000);
    } catch (e) { console.error(e); }
    finally     { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Ionicons name="close" size={26} color="#DFDCD9" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>{book.name}</Text>
          <Text style={styles.modalSubtitle}>{book.description}</Text>

          <Text style={styles.sectionHeader}>Included Drinks</Text>
          {book.drinks.length <= 3 ? (
            <View style={{ flexDirection: 'row' }}>
              {book.drinks.map((d) => (
                <DrinkThumb key={d.id} drink={d} />
              ))}
            </View>
          ) : (
            <InfiniteDrinkCarousel drinks={book.drinks} />
          )}

          <Text style={[styles.sectionHeader, { marginTop: 20 }]}> 
            Ingredients to Load
          </Text>
          {sortIngredientsByType(book.ingredientIds, ingredientMap).map((id) => (
            <Text key={id} style={styles.ingItem}>
              • {ingredientMap.get(id)?.name ?? `#${id}`}
            </Text>
          ))}

          {/* Apply button */}
          <TouchableOpacity
            style={[styles.applyBtn, (!isConnected || saving) && { opacity: 0.5 }]}
            onPress={handleApply}
            disabled={!isConnected || saving}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons
                name={applied ? 'checkmark-circle' : 'rocket-outline'}
                size={24}
                color={applied ? '#63d44a' : '#141414'}
              />
            </Animated.View>
            <Text style={styles.applyBtnText}>
              {applied ? 'Loaded!' : saving ? 'Sending…' : 'Load to Connected Device'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

interface BookCardProps { book: RecipeBook; onPress: () => void }
const BookCard = ({ book, onPress }: BookCardProps) => {
  const [cover, setCover] = useState<{ uri: string }>({ uri: '' });
  useEffect(() => {
    let mounted = true;
    getCoverImageSource(book.image, book.id).then((s) => mounted && setCover(s));
    return () => { mounted = false; };
  }, [book]);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.bookTile}>
      <View style={styles.bookCard}>
        {cover.uri ? (
          <Image source={cover} style={styles.bookImage} />
        ) : (
          <View style={[styles.bookImage, { backgroundColor: '#1F1F1F' }]} />
        )}
        <View style={styles.bookOverlay} />
        <Text style={styles.bookTitle}>{book.name}</Text>
        <Text style={styles.bookSubtitle}>
          {book.drinks.length} drinks · {book.ingredientIds.length} ingredients
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/* -------------------------------------------------------------------------- */
/*                          MAIN EXPLORE SCREEN                               */
/* -------------------------------------------------------------------------- */
export default function ExploreScreen() {
  /* gate non-admins */
  const { isAdmin } = useLiquorBot();
  if (!isAdmin) {
    router.replace('/');
    return null;
  }
  const { isConnected, liquorbotId } = useLiquorBot();

  const [drinks,      setDrinks]  = useState<Drink[]>([]);
  const [ingredients, setIngs]    = useState<Ingredient[]>([]);
  const [userId,      setUserId]  = useState('anon');
  const [books,       setBooks]   = useState<[string, RecipeBook[]][]>([]);
  const [loading,     setLoading] = useState(true);

  const [modalBook, setModal]    = useState<RecipeBook | null>(null);
  const [modalVis,  setModalVis] = useState(false);

  /* subscribe to SLOT-CONFIG topic so page stays in sync */
  useEffect(() => {
    if (!liquorbotId) return;
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    const sub   = pubsub.subscribe({ topics: [topic] }).subscribe({
      error: (err) => console.error('Subscription error:', err),
    });
    return () => sub.unsubscribe();
  }, [liquorbotId]);

  /* map for quick id→ingredient */
  const ingredientMap = useMemo(() => {
    const m = new Map<number, Ingredient>();
    ingredients.forEach((i) => m.set(i.id, i));
    return m;
  }, [ingredients]);

  /* 1 ▸ fetch drinks & ingredients from S3 */
  useEffect(() => {
    (async () => {
      try {
        const [dUrl, iUrl] = await Promise.all([
          getUrl({ key: 'drinkMenu/drinks.json' }),
          getUrl({ key: 'drinkMenu/ingredients.json' }),
        ]);
        const [dRes, iRes] = await Promise.all([
          fetch(dUrl.url), fetch(iUrl.url),
        ]);
        setDrinks(await dRes.json());
        setIngs(await iRes.json());
      } catch (e) { console.error(e); }
    })();
  }, []);

  /* 2 ▸ current user */
  useEffect(() => {
    (async () => {
      try {
        const { username } = await getCurrentUser();
        setUserId(username || 'anon');
      } catch { /* guest */ }
    })();
  }, []);

  /* 3 ▸ load / generate recipe books */
  useEffect(() => {
    if (!drinks.length || !ingredients.length || !userId) return;

    const storageKey = `exploreBooks_${userId}`;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          setBooks(JSON.parse(cached));
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }

      const built = generateBooks(drinks, ingredientMap);
      setBooks(built);
      setLoading(false);
      try { await AsyncStorage.setItem(storageKey, JSON.stringify(built)); } catch {}
    })();
  }, [drinks, ingredients, userId]);

  /* ––––– REFRESH HANDLER ––––– */
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setBooks([]);
    try { await AsyncStorage.removeItem(`exploreBooks_${userId}`); } catch {}
    const rebuilt = generateBooks(drinks, ingredientMap);
    setBooks(rebuilt);
    setLoading(false);
    try { await AsyncStorage.setItem(`exploreBooks_${userId}`, JSON.stringify(rebuilt)); } catch {}
  }, [drinks, ingredientMap, userId]);

  /* ––––– SLOT-CONFIG publisher ––––– */
  const publishSlotMessage = useCallback(async (payload: any) => {
    if (!liquorbotId) return;
    try {
      const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
      await pubsub.publish({ topics: [topic], message: payload });
    } catch (e) { console.error('Publish error:', e); }
  }, [liquorbotId]);

  const applyBookToDevice = useCallback(async (book: RecipeBook) => {
    await saveUndo(
      JSON.parse(
        (await AsyncStorage.getItem(getUndoKey(userId, String(liquorbotId)))) || '[]',
      ),
      userId,
      String(liquorbotId),
    );
    try {
      const sortedIds = sortIngredientsByType(book.ingredientIds, ingredientMap);
      const padded = Array.from({ length: 15 }, (_, i) =>
        i < sortedIds.length ? sortedIds[i] : 0,
      );
      await Promise.all(
        padded.map((ingId, idx) =>
          publishSlotMessage({
            action: 'SET_SLOT',
            slot: idx + 1,
            ingredientId: ingId,
            timestamp: Date.now(),
          }),
        ),
      );
      await publishSlotMessage({ action: 'GET_CONFIG' });
      console.log('Slot-config update complete');
    } catch (e) {
      console.error('Failed to apply book:', e);
      throw e;
    }
  }, [publishSlotMessage, ingredientMap, userId, liquorbotId]);

  /* ––––– UI ––––– */
  if (loading || !books.length) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#CE975E" />
        <Text style={styles.loadingText}>Loading explore content…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ImageBackground
          source={require('../../assets/images/explore.png')}
          style={styles.exploreImage}
          resizeMode="cover"
        >
          <View style={styles.headerRow}>
            <Text style={styles.header}>Explore</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <Ionicons name="refresh" size={26} color="#CE975E" />
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {books.map(([sec, list]) => (
          <View key={sec}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{sec}</Text>
            </View>

            <FlatList
              horizontal
              data={list}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => (
                <BookCard
                  book={item}
                  onPress={() => {
                    setModal(item);
                    setModalVis(true);
                  }}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.booksRow}
            />
          </View>
        ))}
      </ScrollView>

      <BookModal
        book={modalBook}
        visible={modalVis}
        onClose={() => setModalVis(false)}
        ingredientMap={ingredientMap}
        isConnected={isConnected}
        onApply={applyBookToDevice}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*               generateBooks – builds Starter, Base, Party                  */
/* -------------------------------------------------------------------------- */
function generateBooks(
  drinks: Drink[],
  ingredientMap: Map<number, Ingredient>,
): [string, RecipeBook[]][] {
  /* helper: the first Alcohol found in the recipe */
  const baseSpirit = (d: Drink) => {
    for (const id of parseIngIds(d)) {
      const i = ingredientMap.get(id);
      if (i?.type?.toLowerCase() === 'alcohol') return i.name.toLowerCase();
    }
    return null;
  };

  /* 1 ▸ Starter Packs – purely miscellaneous */
  const starterBooks: RecipeBook[] = [];
  const starterUsed = new Set<number>();
  for (let i = 0; i < 5; i++) {
    const b = buildBookDistinct(
      shuffle(drinks),
      starterUsed,
      `starter_${i}`,
      `Starter Pack #${i + 1}`,
      'Miscellaneous beginner load-out.',
    );
    if (!b) break;
    starterBooks.push(b);
  }

  /* 2 ▸ Base Spirit collections (one per category) */
  const spiritBooks: RecipeBook[] = [];
  const spiritUsed  = new Set<number>();
  const catMap = new Map<string, Drink[]>();
  drinks.forEach((d) => {
    const key = d.category?.trim() || 'Misc';
    (catMap.get(key) ?? catMap.set(key, []).get(key)!)?.push(d);
  });
  catMap.forEach((pool, cat) => {
    const b = buildBookDistinct(
      pool,
      spiritUsed,
      `spirit_${cat.toLowerCase().replace(/\s+/g, '_')}`,
      `${cat} Classics`,
      `Essential cocktails based on ${cat.toLowerCase()}.`,
    );
    if (b) spiritBooks.push(b);
  });

  /* 3 ▸ Party Packs – aim for ≥3 different base spirits each */
  const partyBooks: RecipeBook[] = [];
  const names = shuffle([
    'Game-Night Mix', 'Brunch Vibes', 'Weekend Bender',
    'Tailgate Pack', 'Late-Night Blend', 'Tiki Party',
  ]);

  const spiritSet = (list: Drink[]) =>
    new Set(list.map(baseSpirit).filter(Boolean) as string[]);

  let idx = 0, attempts = 0, best: RecipeBook | null = null;
  while (partyBooks.length < 4 && attempts < 40) {
    const b = buildBookDistinct(
      shuffle(drinks),
      new Set<number>(),                  // fresh overlap rules per attempt
      `party_${idx}`,
      names[idx % names.length],
      'High-variety party load-out.',
    );
    attempts++; idx++;
    if (!b) continue;
    if (!best || spiritSet(b.drinks).size > spiritSet(best.drinks).size) best = b;
    if (spiritSet(b.drinks).size < 3) continue;  // need ≥3 alcohol bases
    partyBooks.push(b);
  }
  if (!partyBooks.length && best) partyBooks.push(best);

  return [
    ['Starter Packs', starterBooks],
    ['Base Spirits',  spiritBooks],
    ['Party Packs',   partyBooks],
  ];
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = SCREEN_WIDTH * 0.55;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  scroll:    { paddingBottom: 100 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between',
               alignItems: 'center', paddingHorizontal: 20,
               paddingTop: 80, marginBottom: 10 },
  header: { color: '#DFDCD9', fontSize: 36, fontWeight: 'bold' },
  refreshButton: { padding: 6 },

  sectionRow:   { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, marginTop: 12, marginBottom: 4 },
  sectionTitle: { color: '#DFDCD9', fontSize: 24, fontWeight: '600' },

  booksRow: { paddingLeft: 20, paddingVertical: 10, paddingRight: 10 },
  bookTile: {
    marginRight: 14, borderRadius: 12, backgroundColor: '#1F1F1F', padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  bookCard:   { width: CARD_W * 0.9, height: CARD_W * 0.6, borderRadius: 8,
                overflow: 'hidden', backgroundColor: '#1F1F1F' },
  bookImage:  { width: '100%', height: '100%', resizeMode: 'contain' },
  bookOverlay:{ ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(0,0,0,0.35)' },
  bookTitle:  { position: 'absolute', bottom: 40, left: 12, right: 12,
                color: '#DFDCD9', fontSize: 20, fontWeight: '600' },
  bookSubtitle:{ position: 'absolute', bottom: 18, left: 12, right: 12,
                 color: '#CE975E', fontSize: 14 },

  loadingScreen:{ flex: 1, backgroundColor: '#141414',
                  justifyContent: 'center', alignItems: 'center' },
  loadingText:  { color: '#DFDCD9', marginTop: 10 },

  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
                 justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent:{ width: '100%', backgroundColor: '#1F1F1F',
                 borderRadius: 12, padding: 20 },
  modalClose:  { position: 'absolute', top: 15, right: 15, zIndex: 2 },
  modalTitle:  { color: '#DFDCD9', fontSize: 24, fontWeight: '600',
                 marginBottom: 4 },
  modalSubtitle:{ color: '#4F4F4F', marginBottom: 16 },
  sectionHeader:{ color: '#CE975E', fontSize: 18, marginBottom: 8 },

  modalDrink:     { marginRight: 12, width: 100 },
  modalDrinkImg:  { width: 100, height: 100, borderRadius: 8, marginBottom: 4,
                    backgroundColor: 'transparent' },
  modalDrinkName: { color: '#DFDCD9', fontSize: 12, textAlign: 'center' },

  ingItem: { color: '#DFDCD9', fontSize: 14, marginBottom: 2 },

  applyBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#CE975E', borderRadius: 10, paddingVertical: 12,
    marginTop: 24,
  },
  applyBtnText: { color: '#141414', fontSize: 16, fontWeight: 'bold',
                  marginLeft: 10 },

  exploreImage: {
    width: '100%',
    height: 400,
    resizeMode: 'cover',
    marginBottom: 10,
  },
});

/* -------------------------------------------------------------------------- */
/*                        INGREDIENT SORTING HELPER                           */
/* -------------------------------------------------------------------------- */
function sortIngredientsByType(ids: number[], ingredientMap: Map<number, Ingredient>): number[] {
  const priority: Record<string, number> = {
    alcohol: 0,
    mixer: 1,
    'sweet & sour': 2,
  };
  return [...ids].sort((a, b) => {
    const typeA = ingredientMap.get(a)?.type?.toLowerCase() || '';
    const typeB = ingredientMap.get(b)?.type?.toLowerCase() || '';
    const prioA = priority[typeA] ?? 99;
    const prioB = priority[typeB] ?? 99;
    if (prioA !== prioB) return prioA - prioB;
    return a - b;
  });
}
