// -----------------------------------------------------------------------------
// File:   explore.tsx
// Purpose: Explore page – themed Recipe Books plus “Load to Device” button that
//          publishes the book’s ingredient IDs to the ESP-32 slot-config topic
//          (15 slots; 0 = empty) using the same MQTT flow as device-settings.
// -----------------------------------------------------------------------------

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground, Dimensions,
  Modal, FlatList, Animated, Easing, Platform, UIManager, ActivityIndicator,
  NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Amplify } from 'aws-amplify';
import { getUrl } from 'aws-amplify/storage';
import { getCurrentUser } from '@aws-amplify/auth';
import { PubSub } from '@aws-amplify/pubsub';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLiquorBot } from '../components/liquorbot-provider';
import config from '../../src/amplifyconfiguration.json';

/* ─────────── Amplify + PubSub bootstrap ─────────── */
Amplify.configure(config);
const pubsub = new PubSub({
  region:   'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

const SLOT_CONFIG_TOPIC = 'liquorbot/liquorbot001/slot-config';

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
  ingredients?: string;              // “id:amt:prio, …”
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
/*                              CONSTANTS                                     */
/* -------------------------------------------------------------------------- */
const MAX_INGS      = 15;
const MIN_DRINKS    = 3;
const OVERLAP_CAP   = 0.20;    // per-section
const CAROUSEL_LOOP = 30;
const ITEM_W        = 112;
const AUTO_SPEED    = 36;

/* placeholder for any missing drink artwork */
const placeholder =
  'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';

/* handy helpers */
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
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/* -------------------------------------------------------------------------- */
/*                     PER-SECTION BOOK-BUILDER (≤20 % overlap)               */
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
        sel.filter((x) => sectionUsed.has(x.id)).length + (sectionUsed.has(d.id) ? 1 : 0);
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
/*                       INFINITE-SCROLL DRINK CAROUSEL                       */
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
/*                             MODAL + BOOK CARD                              */
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
                <View key={d.id} style={styles.modalDrink}>
                  <Image source={{ uri: d.image }} style={styles.modalDrinkImg} />
                  <Text style={styles.modalDrinkName}>{d.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <InfiniteDrinkCarousel drinks={book.drinks} />
          )}

          <Text style={[styles.sectionHeader, { marginTop: 20 }]}>
            Ingredients to Load
          </Text>
          {book.ingredientIds.map((id) => (
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
              {applied ? 'Loaded!' : saving ? 'Sending…' : 'Load to Device'}
            </Text>
          </TouchableOpacity>
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
/*                          MAIN EXPLORE SCREEN                               */
/* -------------------------------------------------------------------------- */
export default function ExploreScreen() {
  const { isConnected } = useLiquorBot();

  const [drinks,      setDrinks]  = useState<Drink[]>([]);
  const [ingredients, setIngs]    = useState<Ingredient[]>([]);
  const [userId,      setUserId]  = useState('anon');
  const [books,       setBooks]   = useState<[string, RecipeBook[]][]>([]);
  const [loading,     setLoading] = useState(true);

  const [modalBook, setModal]    = useState<RecipeBook | null>(null);
  const [modalVis,  setModalVis] = useState(false);

  /* map for quick id→ingredient lookup */
  const ingredientMap = useMemo(() => {
    const m = new Map<number, Ingredient>();
    ingredients.forEach((i) => m.set(i.id, i));
    return m;
  }, [ingredients]);

  /* 1 ▸ fetch drinks + ingredients (S3) */
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

  /* 2 ▸ get current user id */
  useEffect(() => {
    (async () => {
      try {
        const { username } = await getCurrentUser();
        setUserId(username || 'anon');
      } catch { /* guest */ }
    })();
  }, []);

  /* 3 ▸ load cached or generate recipe-books */
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

  /* ––––– SLOT-CONFIG PUBLISHER ––––– */
  const publishSlotMessage = async (payload: any) => {
  try {
    // Convert payload to JSON string and verify structure
    const messageStr = JSON.stringify(payload);
    console.log('Publishing to MQTT:', SLOT_CONFIG_TOPIC, messageStr);
    
    await pubsub.publish({
      topics: [SLOT_CONFIG_TOPIC],
      message: { 
        // Wrap in 'message' key to match AWS IoT Core format
        message: messageStr 
      },
    });
  } catch (error) {
    console.error('Publish error:', error);
    throw error; // Propagate error to handleApply
  }
};

// Then update applyBookToDevice to handle errors properly:
const applyBookToDevice = useCallback(async (book: RecipeBook) => {
  try {
    const padded = Array.from({ length: 15 }, (_, i) => 
      i < book.ingredientIds.length ? book.ingredientIds[i] : 0
    );

    // Send batch updates with confirmation logging
    await Promise.all(padded.map((ingId, index) => 
      publishSlotMessage({
        action: 'SET_SLOT',
        slot: index + 1,
        ingredientId: ingId,
        timestamp: Date.now()
      })
    ));

    // Final verification request
    await publishSlotMessage({ action: 'GET_CONFIG' });
    console.log('Slot config update complete');
  } catch (error) {
    console.error('Failed to apply book:', error);
    throw error; // Let modal handle the error state
  }
}, [publishSlotMessage]);

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
/*                    generateBooks – builds all sections                     */
/* -------------------------------------------------------------------------- */
function generateBooks(
  drinks: Drink[],
  ingredientMap: Map<number, Ingredient>,
): [string, RecipeBook[]][] {
  /* helper to get base spirit */
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
      pool, starterUsed,
      `starter_${spirit}`,
      `${spirit[0].toUpperCase()}${spirit.slice(1)} Starter Kit`,
      `Load-out for all things ${spirit}.`,
    );
    if (b) starterBooks.push(b);
  });
  while (starterBooks.length < 10) {
    const extra = buildBookDistinct(
      drinks, starterUsed,
      `starter_extra_${starterBooks.length}`,
      `Starter Mix #${starterBooks.length + 1}`,
      'Additional starter kit.',
    );
    if (!extra) break;
    starterBooks.push(extra);
  }

  /* 2 ▸ Bartender Favourites */
  const favUsed  = new Set<number>();
  const favBooks: RecipeBook[] = [];
  const catMap = new Map<string, Drink[]>();
  drinks.forEach((d) => {
    const key = d.category?.trim() || 'Misc';
    (catMap.get(key) ?? catMap.set(key, []).get(key)!)?.push(d);
  });
  catMap.forEach((pool, cat) => {
    const b = buildBookDistinct(
      pool, favUsed,
      `fav_${cat.toLowerCase().replace(/\s+/g, '_')}`,
      `${cat} Picks`,
      `Popular ${cat.toLowerCase()} cocktails.`,
    );
    if (b) favBooks.push(b);
  });
  while (favBooks.length < 4) {
    const extra = buildBookDistinct(
      drinks, favUsed,
      `fav_auto_${favBooks.length}`,
      `Fan Favourites #${favBooks.length + 1}`,
      'Randomly generated favourites.',
    );
    if (!extra) break;
    favBooks.push(extra);
  }

  /* 3 ▸ Party Packs */
  const partyBooks: RecipeBook[] = [];
  const names = shuffle([
    'Game-Night Mix', 'Game-Day Pack', 'Brunch Favourites',
    'Late-Night Blend', 'Party Essentials', 'Classics Party Pack',
  ]);

  const spiritSet = (list: Drink[]) =>
    new Set(list.map(spiritOf).filter(Boolean) as string[]);

  let idx = 0, attempts = 0, bestSoFar: RecipeBook | null = null;
  while (partyBooks.length < 4 && attempts < 30) {
    const b = buildBookDistinct(
      drinks, new Set<number>(),
      `party_${idx}`,
      names[idx % names.length],
      'Mixed-spirit party load-out.',
    );
    attempts++; idx++;
    if (!b) break;
    const bases = spiritSet(b.drinks);
    if (!bestSoFar || bases.size > spiritSet(bestSoFar.drinks).size) bestSoFar = b;
    if (bases.size < 3) continue;   // need ≥3 spirit bases
    partyBooks.push(b);
  }
  if (partyBooks.length === 0 && bestSoFar) partyBooks.push(bestSoFar);
  while (partyBooks.length < 3) {
    const extra = buildBookDistinct(
      drinks, new Set<number>(),
      `party_auto_${partyBooks.length}`,
      `Party Mix #${partyBooks.length + 1}`,
      'Extra party load-out.',
    );
    if (!extra || spiritSet(extra.drinks).size < 3) break;
    partyBooks.push(extra);
  }

  return [
    ['Starter Kits',         starterBooks],
    ['Bartender Favourites', favBooks],
    ['Party Packs',          partyBooks],
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
  bookOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
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
