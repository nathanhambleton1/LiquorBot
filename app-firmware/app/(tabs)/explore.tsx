// -----------------------------------------------------------------------------
// File:   explore.tsx
// Purpose: Explore page – themed Recipe Books (≤20 % overlap per *section*),
//          per-account persistence, manual refresh button.
// -----------------------------------------------------------------------------

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions,
  Modal, FlatList, Animated, Easing, Platform, UIManager, ActivityIndicator,
  NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Amplify } from 'aws-amplify';
import { getUrl } from 'aws-amplify/storage';
import { getCurrentUser } from '@aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../src/amplifyconfiguration.json';

Amplify.configure(config);
if (Platform.OS === 'android')
  UIManager.setLayoutAnimationEnabledExperimental?.(true);

/* -------------------------------------------------------------------------- */
/*                                TYPES                                       */
/* -------------------------------------------------------------------------- */
type Drink = {
  id: number;
  name: string;
  category: string;
  description?: string;
  image: string;
  ingredients?: string;              // “id:amt:prio,…”
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
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */
const MAX_INGS      = 15;
const MIN_DRINKS    = 3;
const OVERLAP_CAP   = 0.20;   // per-section
const CAROUSEL_LOOP = 30;
const ITEM_W        = 112;
const AUTO_SPEED    = 36;
const placeholder   =
  'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';

/* ------------------- tiny helpers ------------------- */
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const parseIngIds = (d: Drink) =>
  d.ingredients
    ? d.ingredients.split(',').map((c) => +c.split(':')[0]).filter(Number.isFinite)
    : [];

/* -------------------------------------------------------------------------- */
/*                      PER-SECTION book builder (≤20 % overlap)              */
/* -------------------------------------------------------------------------- */
function buildBookDistinct(
  pool: Drink[],
  sectionUsed: Set<number>,
  id: string,
  name: string,
  desc: string
): RecipeBook | null {
  if (!pool.length) return null;

  const uniquePool = pool.filter((d) => !sectionUsed.has(d.id));
  const dupPool    = pool.filter((d) => sectionUsed.has(d.id));

  for (let attempt = 0; attempt < 10; attempt++) {
    const ordered = [...shuffle(uniquePool), ...shuffle(dupPool)];
    const sel: Drink[] = [];
    const ingSet = new Set<number>();

    for (const d of ordered) {
      const nextIng = new Set([...ingSet, ...parseIngIds(d)]);
      if (nextIng.size > MAX_INGS) continue;

      const dupCntIfAdd =
        (sel.filter((x) => sectionUsed.has(x.id)).length +
          (sectionUsed.has(d.id) ? 1 : 0));
      const dupRatio = dupCntIfAdd / (sel.length + 1);

      if (dupRatio <= OVERLAP_CAP) {
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
        image: sel[0]?.image ?? placeholder,
      };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                INFINITE DRINK CAROUSEL  (unchanged apart from key tweaks)  */
/* -------------------------------------------------------------------------- */
function InfiniteDrinkCarousel({ drinks }: { drinks: Drink[] }) {
  if (!drinks.length) return null;
  const data   = useMemo(() => Array.from({ length: CAROUSEL_LOOP }).flatMap(() => drinks), [drinks]);
  const list   = useRef<FlatList>(null);
  const offset = useRef(0);
  const tick   = useRef(new Animated.Value(0)).current;
  const loop   = useRef<Animated.CompositeAnimation | null>(null);
  const resume = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    loop.current = Animated.loop(
      Animated.timing(tick, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: false })
    );
    loop.current.start();
  };
  const stop = () => loop.current?.stop();

  useEffect(() => {
    list.current?.scrollToIndex({ index: Math.floor(data.length / 2), animated: false });
    start();
    const id = tick.addListener(() => {
      offset.current += AUTO_SPEED / 60;
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
    });
    return () => { tick.removeListener(id); stop(); };
  }, [data]);

  const wrap = ({ nativeEvent: { contentOffset } }: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = contentOffset.x;
    const pad = drinks.length * ITEM_W;
    const total = data.length * ITEM_W;
    if (contentOffset.x < pad) {
      offset.current += pad * (CAROUSEL_LOOP / 2);
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
    } else if (contentOffset.x > total - pad) {
      offset.current -= pad * (CAROUSEL_LOOP / 2);
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
    }
  };

  const pause = () => { stop(); if (resume.current) clearTimeout(resume.current); };
  const onEnd = () => {
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(() => { tick.setValue(0); start(); }, 500);
  };

  return (
    <FlatList
      ref={list}
      data={data}
      keyExtractor={(_, i) => String(i)}
      horizontal
      renderItem={({ item }) => (
        <View style={styles.modalDrink}>
          <Image source={{ uri: item.image }} style={styles.modalDrinkImg} />
          <Text style={styles.modalDrinkName}>{item.name}</Text>
        </View>
      )}
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
/*                            UI bits (modal/card)                            */
/* -------------------------------------------------------------------------- */
interface BookModalProps {
  book: RecipeBook | null;
  visible: boolean;
  onClose: () => void;
  ingredientMap: Map<number, Ingredient>;
}
const BookModal = ({ book, visible, onClose, ingredientMap }: BookModalProps) => {
  if (!book) return null;
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
                <View key={d.id} style={styles.modalDrink}>
                  <Image source={{ uri: d.image }} style={styles.modalDrinkImg} />
                  <Text style={styles.modalDrinkName}>{d.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <InfiniteDrinkCarousel drinks={book.drinks} />
          )}

          <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Ingredients to Load</Text>
          {book.ingredientIds.map((id) => (
            <Text key={id} style={styles.ingItem}>
              • {ingredientMap.get(id)?.name ?? `#${id}`}
            </Text>
          ))}
        </View>
      </View>
    </Modal>
  );
};

interface BookCardProps { book: RecipeBook; onPress: () => void }
const BookCard = ({ book, onPress }: BookCardProps) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.bookTile}>
    <View style={styles.bookCard}>
      <Image source={{ uri: book.image }} style={styles.bookImage} />
      <View style={styles.bookOverlay} />
      <Text style={styles.bookTitle}>{book.name}</Text>
      <Text style={styles.bookSubtitle}>
        {book.drinks.length} drinks · {book.ingredientIds.length} ingredients
      </Text>
    </View>
  </TouchableOpacity>
);

/* -------------------------------------------------------------------------- */
/*                           MAIN EXPLORE SCREEN                              */
/* -------------------------------------------------------------------------- */
export default function ExploreScreen() {
  const [drinks,         setDrinks]   = useState<Drink[]>([]);
  const [ingredients,    setIngs]     = useState<Ingredient[]>([]);
  const [userId,         setUserId]   = useState('anon');   // “anon” for guests
  const [books,          setBooks]    = useState<[string, RecipeBook[]][] | null>(null);
  const [loading,        setLoading]  = useState(true);
  const [modalBook,      setModal]    = useState<RecipeBook | null>(null);
  const [modalVis,       setModalVis] = useState(false);
  const ingredientMap = useMemo(() => {
    const m = new Map<number, Ingredient>();
    ingredients.forEach((i) => m.set(i.id, i));
    return m;
  }, [ingredients]);

  /* 1. fetch drinks + ingredients */
  useEffect(() => {
    (async () => {
      try {
        const [dUrl, iUrl] = await Promise.all([
          getUrl({ key: 'drinkMenu/drinks.json' }),
          getUrl({ key: 'drinkMenu/ingredients.json' }),
        ]);
        const [dRes, iRes] = await Promise.all([fetch(dUrl.url), fetch(iUrl.url)]);
        setDrinks(await dRes.json());
        setIngs(await iRes.json());
      } catch (e) { console.error(e); }
    })();
  }, []);

  /* 2. fetch current user id */
  useEffect(() => {
    (async () => {
      try {
        const { username } = await getCurrentUser();
        setUserId(username || 'anon');
      } catch { /* guest */ }
    })();
  }, []);

  /* 3. load from cache or generate */
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
      } catch { /* ignore parse errors */ }

      const built = generateBooks(drinks, ingredientMap);
      setBooks(built);
      setLoading(false);
      try { await AsyncStorage.setItem(storageKey, JSON.stringify(built)); } catch {}
    })();
  }, [drinks, ingredients, userId]);

  /* ---------------- refresh handler ---------------- */
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setBooks(null);
    try { await AsyncStorage.removeItem(`exploreBooks_${userId}`); } catch {}
    const rebuilt = generateBooks(drinks, ingredientMap);
    setBooks(rebuilt);
    setLoading(false);
    try { await AsyncStorage.setItem(`exploreBooks_${userId}`, JSON.stringify(rebuilt)); } catch {}
  }, [drinks, ingredientMap, userId]);

  /* ---------------- UI ---------------- */
  if (loading || !books) {
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
        {/* Header row with refresh button */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Explore</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={26} color="#CE975E" />
          </TouchableOpacity>
        </View>

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
                  onPress={() => { setModal(item); setModalVis(true); }}
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
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*              generateBooks – builds all three sections once                */
/* -------------------------------------------------------------------------- */
function generateBooks(
    drinks: Drink[],
    ingredientMap: Map<number, Ingredient>
    ): [string, RecipeBook[]][] {
    /* ---------- helper for spirit name ---------- */
    const spiritOf = (d: Drink) => {
        for (const id of parseIngIds(d)) {
        const i = ingredientMap.get(id);
        if (i?.type?.toLowerCase() === 'spirit') return i.name.toLowerCase();
        }
        return null;
    };

  /* 1 ▸ Starter Kits */
  const starterLabels = ['vodka', 'rum', 'tequila', 'gin', 'whiskey'];
  const starterUsed   = new Set<number>();
  const starterBooks: RecipeBook[] = [];

  starterLabels.forEach((spirit) => {
    const pool = drinks.filter((d) => spiritOf(d)?.includes(spirit));
    const b = buildBookDistinct(
      pool,
      starterUsed,
      `starter_${spirit}`,
      `${spirit[0].toUpperCase()}${spirit.slice(1)} Starter Kit`,
      `Load-out for all things ${spirit}.`
    );
    if (b) starterBooks.push(b);
  });
  while (starterBooks.length < 10) {
    const extra = buildBookDistinct(
      drinks,
      starterUsed,
      `starter_extra_${starterBooks.length}`,
      `Starter Mix #${starterBooks.length + 1}`,
      'Additional starter kit.'
    );
    if (!extra) break;
    starterBooks.push(extra);
  }

  /* 2 ▸ Bartender Favorites (by category label) */
  const favUsed  = new Set<number>();
  const favBooks: RecipeBook[] = [];
  const catMap = new Map<string, Drink[]>();
  drinks.forEach((d) => {
    const key = d.category?.trim() || 'Misc';
    (catMap.get(key) ?? catMap.set(key, []).get(key)!)?.push(d);
  });
  catMap.forEach((pool, cat) => {
    const b = buildBookDistinct(
      pool,
      favUsed,
      `fav_${cat.toLowerCase().replace(/\s+/g, '_')}`,
      `${cat} Picks`,
      `Popular ${cat.toLowerCase()} cocktails.`
    );
    if (b) favBooks.push(b);
  });
  while (favBooks.length < 4) {
    const extra = buildBookDistinct(
      drinks,
      favUsed,
      `fav_auto_${favBooks.length}`,
      `Fan Favourites #${favBooks.length + 1}`,
      'Randomly generated favourites.'
    );
    if (!extra) break;
    favBooks.push(extra);
  }

  /* 3 ▸ Party Packs – must include ≥3 spirit bases */
    const partyBooks: RecipeBook[] = [];
    const names      = shuffle([
    'Game-Night Mix', 'Game-Day Pack', 'Brunch Favorites',
    'Late-Night Blend', 'Party Essentials', 'Classics Party Pack',
    ]);

    const spiritSet = (list: Drink[]) =>
    new Set(list.map(spiritOf).filter(Boolean) as string[]);

    let idx = 0, attempts = 0, bestSoFar: RecipeBook | null = null;

    while (partyBooks.length < 4 && attempts < 30) {
    /* NEW — fresh “used” set so packs can overlap each other */
    const b = buildBookDistinct(
        drinks,
        new Set<number>(),                      // ← was partyUsed
        `party_${idx}`,
        names[idx % names.length],
        'Mixed-spirit party load-out.',
    );

    attempts++;
    idx++;

    if (!b) break;                            // nothing buildable this round

    const bases = spiritSet(b.drinks);

    /* keep track of the most diverse pack seen */
    if (!bestSoFar || bases.size > spiritSet(bestSoFar.drinks).size)
        bestSoFar = b;

    /* skip packs that don’t hit the ≥3-spirit rule */
    if (bases.size < 3) continue;

    partyBooks.push(b);
    }

    /* guarantee 1 pack, then try to grow to at least 3 */
    if (partyBooks.length === 0 && bestSoFar) partyBooks.push(bestSoFar);
    while (partyBooks.length < 3) {
    const extra = buildBookDistinct(
        drinks,
        new Set<number>(),                      // ← fresh again
        `party_auto_${partyBooks.length}`,
        `Party Mix #${partyBooks.length + 1}`,
        'Extra party load-out.',
    );
    if (!extra || spiritSet(extra.drinks).size < 3) break;
    partyBooks.push(extra);
    }
    return [
        ['Starter Kits',        starterBooks],
        ['Bartender Favorites', favBooks],
        ['Party Packs',         partyBooks],
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

  /* header + refresh */
  headerRow: { flexDirection: 'row', justifyContent: 'space-between',
               alignItems: 'center', paddingHorizontal: 20,
               paddingTop: 80, marginBottom: 10 },
  header:    { color: '#DFDCD9', fontSize: 36, fontWeight: 'bold' },
  refreshButton: { padding: 6 },

  /* section */
  sectionRow:   { flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 20, marginTop: 12, marginBottom: 4 },
  sectionTitle: { color: '#DFDCD9', fontSize: 24, fontWeight: '600' },

  /* card row */
  booksRow: { paddingLeft: 20, paddingVertical: 10, paddingRight: 10 },
  bookTile: {
    marginRight: 14, borderRadius: 12, backgroundColor: '#1F1F1F', padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  bookCard:   { width: CARD_W, height: CARD_W * 0.68, borderRadius: 8,
                overflow: 'hidden', backgroundColor: '#1F1F1F' },
  bookImage:  { width: '100%', height: '100%', resizeMode: 'contain' },
  bookOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  bookTitle:  { position: 'absolute', bottom: 40, left: 12, right: 12,
                color: '#DFDCD9', fontSize: 20, fontWeight: '600' },
  bookSubtitle:{ position: 'absolute', bottom: 18, left: 12, right: 12,
                 color: '#CE975E', fontSize: 14 },

  /* loading */
  loadingScreen:{ flex: 1, backgroundColor: '#141414',
                  justifyContent: 'center', alignItems: 'center' },
  loadingText:  { color: '#DFDCD9', marginTop: 10 },

  /* modal */
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
                 justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent:{ width: '100%', backgroundColor: '#1F1F1F',
                 borderRadius: 12, padding: 20 },
  modalClose:  { position: 'absolute', top: 15, right: 15, zIndex: 2 },
  modalTitle:  { color: '#DFDCD9', fontSize: 24, fontWeight: '600', marginBottom: 4 },
  modalSubtitle:{ color: '#4F4F4F', marginBottom: 16 },
  sectionHeader:{ color: '#CE975E', fontSize: 18, marginBottom: 8 },

  modalDrink:     { marginRight: 12, width: 100 },
  modalDrinkImg:  { width: 100, height: 100, borderRadius: 8, marginBottom: 4,
                    backgroundColor: 'transparent' },
  modalDrinkName: { color: '#DFDCD9', fontSize: 12, textAlign: 'center' },

  ingItem: { color: '#DFDCD9', fontSize: 14, marginBottom: 2 },
});
