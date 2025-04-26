// -----------------------------------------------------------------------------
// File: explore.tsx
// Description: “Explore” page – showcases themed *Recipe Books* (ingredient
//              load-outs) that unlock sets of cocktails.  Books are generated
//              dynamically from drinks.json + ingredients.json and rendered
//              as scrollable cards that open a modal with details.
// Author: Nathan Hambleton
// Updated: Apr 26 2025 – infinite-loop drink carousel + auto-scroll
// -----------------------------------------------------------------------------

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  FlatList,
  Animated,
  Easing,
  Platform,
  UIManager,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Amplify } from 'aws-amplify';
import { getUrl } from 'aws-amplify/storage';
import config from '../../src/amplifyconfiguration.json';

Amplify.configure(config);
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

/* ------------------------------ TYPES ------------------------------ */
type Drink = {
  id: number;
  name: string;
  category: string;
  description?: string;
  image: string;
  ingredients?: string; // “id:amt:prio,…”
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

/* --------------------------- CONSTANTS ----------------------------- */
const MAX_INGS      = 15;
const MIN_DRINKS    = 3;
const CAROUSEL_LOOP = 30;     // duplicate list this many times = “infinite”
const ITEM_W        = 112;    // drink image width + right-margin
const AUTO_SPEED    = 36;     // px per second (increased for faster scrolling)
const placeholder   =
  'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';

/* --------------------- INFINITE DRINK CAROUSEL --------------------- */
function InfiniteDrinkCarousel({ drinks }: { drinks: Drink[] }) {
    if (drinks.length === 0) return null;
  
    const data = useMemo(
      () => Array.from({ length: CAROUSEL_LOOP }).flatMap(() => drinks),
      [drinks]
    );
  
    /* refs ------------------------------------------------------------ */
    const listRef     = useRef<FlatList>(null);
    const offsetRef   = useRef(0);
    const valRef      = useRef(new Animated.Value(0)).current; // ticker value
    const loopRef     = useRef<Animated.CompositeAnimation | null>(null);
    const resumeTO    = useRef<NodeJS.Timeout | null>(null);   // resume timer
  
    /* initial centering ---------------------------------------------- */
    useEffect(() => {
      const mid = Math.floor(data.length / 2);
      requestAnimationFrame(() =>
        listRef.current?.scrollToIndex({ index: mid, animated: false })
      );
    }, [data]);
  
    /* helper: start / stop loop -------------------------------------- */
    const startLoop = () => {
      loopRef.current = Animated.loop(
        Animated.timing(valRef, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      loopRef.current.start();
    };
    const stopLoop = () => loopRef.current?.stop();
  
    /* auto-scroll driver --------------------------------------------- */
    useEffect(() => {
      startLoop();
      const id = valRef.addListener(() => {
        offsetRef.current += AUTO_SPEED / 60;
        listRef.current?.scrollToOffset({
          offset: offsetRef.current,
          animated: false,
        });
      });
      return () => {
        valRef.removeListener(id);
        stopLoop();
      };
    }, []);
  
    /* keep pointer centred ------------------------------------------- */
    const handleScroll = ({
      nativeEvent: { contentOffset },
    }: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetRef.current = contentOffset.x;
  
      const total = data.length * ITEM_W;
      const pad   = drinks.length * ITEM_W;
  
      if (contentOffset.x < pad) {
        offsetRef.current += pad * (CAROUSEL_LOOP / 2);
        listRef.current?.scrollToOffset({ offset: offsetRef.current, animated: false });
      } else if (contentOffset.x > total - pad) {
        offsetRef.current -= pad * (CAROUSEL_LOOP / 2);
        listRef.current?.scrollToOffset({ offset: offsetRef.current, animated: false });
      }
    };
  
    /* pause on touch, resume after user stops ------------------------ */
    const handleTouchStart = () => {
      stopLoop();
      if (resumeTO.current) clearTimeout(resumeTO.current);
    };
  
    const scheduleResume = () => {
      if (resumeTO.current) clearTimeout(resumeTO.current);
      resumeTO.current = setTimeout(() => {
        valRef.setValue(0); // reset ticker
        startLoop();
      }, 500); // resume after 1.2 s of inactivity
    };
  
    /* renderer -------------------------------------------------------- */
    const renderItem = ({ item }: { item: Drink }) => (
      <View style={styles.modalDrink}>
        <Image source={{ uri: item.image }} style={styles.modalDrinkImg} />
        <Text style={styles.modalDrinkName}>{item.name}</Text>
      </View>
    );
  
    return (
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: ITEM_W, offset: i * ITEM_W, index: i })}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        /* user-interaction callbacks */
        onTouchStart={handleTouchStart}
        onScrollEndDrag={scheduleResume}
        onMomentumScrollEnd={scheduleResume}
        contentContainerStyle={{ paddingHorizontal: 0 }}
      />
    );
}

/* ------------------------ BOOK  MODAL ------------------------------ */
interface BookModalProps {
  book: RecipeBook | null;
  visible: boolean;
  onClose: () => void;
  ingredientMap: Map<number, Ingredient>;
}
function BookModal({ book, visible, onClose, ingredientMap }: BookModalProps) {
  if (!book) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={26} color="#DFDCD9" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>{book.name}</Text>
          <Text style={styles.modalSubtitle}>{book.description}</Text>

          <Text style={styles.sectionHeader}>Included Drinks</Text>
          {book.drinks.length <= 3 ? (
            /* static row when ≤3 drinks */
            <View style={{ flexDirection: 'row' }}>
              {book.drinks.map((d) => (
                <View key={d.id} style={styles.modalDrink}>
                  <Image source={{ uri: d.image }} style={styles.modalDrinkImg} />
                  <Text style={styles.modalDrinkName}>{d.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            /* infinite looping carousel */
            <InfiniteDrinkCarousel drinks={book.drinks} />
          )}

          <Text style={[styles.sectionHeader, { marginTop: 20 }]}>
            Ingredients to Load
          </Text>
          <View style={styles.ingList}>
            {book.ingredientIds.map((id) => (
              <Text key={id} style={styles.ingItem}>
                • {ingredientMap.get(id)?.name ?? `#${id}`}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ----------------------------- CARD ------------------------------- */
interface BookCardProps { book: RecipeBook; onPress: () => void }
function BookCard({ book, onPress }: BookCardProps) {
  return (
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
}

/* ------------------------- MAIN EXPLORE TAB ------------------------ */
export default function ExploreScreen() {
  const [drinks,      setDrinks]      = useState<Drink[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeBook,  setActiveBook]  = useState<RecipeBook | null>(null);
  const [modalVis,    setModalVis]    = useState(false);

  /* ---------- fetch data ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [drUrl, ingUrl] = await Promise.all([
          getUrl({ key: 'drinkMenu/drinks.json' }),
          getUrl({ key: 'drinkMenu/ingredients.json' }),
        ]);
        const [drRes, ingRes] = await Promise.all([fetch(drUrl.url), fetch(ingUrl.url)]);
        setDrinks(await drRes.json());
        setIngredients(await ingRes.json());
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  const ingredientMap = useMemo(() => {
    const m = new Map<number, Ingredient>();
    ingredients.forEach((ing) => m.set(ing.id, ing));
    return m;
  }, [ingredients]);

  /* ---------- build recipe books ---------- */
  const booksByCategory = useMemo(() => {
    if (!drinks.length) return [];

    const ingIds = (d: Drink) =>
      d.ingredients
        ? d.ingredients.split(',').map((c) => parseInt(c.split(':')[0], 10)).filter(Number.isFinite)
        : [];

    const catMap = new Map<string, Drink[]>();
    drinks.forEach((d) => {
      const key = d.category?.trim() || 'Mixed & Themed';
      if (!catMap.has(key)) catMap.set(key, []);
      catMap.get(key)!.push(d);
    });

    const result: [string, RecipeBook[]][] = [];
    catMap.forEach((catDrinks, cat) => {
      const books: RecipeBook[] = [];
      let working: Drink[]   = [];
      let ingSet  = new Set<number>();

      const flush = (idx: number) => {
        if (working.length >= MIN_DRINKS) {
          books.push({
            id: `${cat.toLowerCase().replace(/\s+/g, '_')}_${idx}`,
            name: `${cat} #${idx + 1}`,
            description: `Load-out for ${cat.toLowerCase()} cocktails.`,
            drinks: working,
            ingredientIds: Array.from(ingSet),
            image: working[0]?.image ?? placeholder,
          });
        } else if (books.length) {
          // merge leftovers forward
          const prev = books[books.length - 1];
          const merged = new Set([...prev.ingredientIds, ...ingSet]);
          if (merged.size <= MAX_INGS) {
            prev.drinks.push(...working);
            prev.ingredientIds = Array.from(merged);
          }
        }
        working = [];
        ingSet  = new Set();
      };

      catDrinks.forEach((drink) => {
        const ids = ingIds(drink);
        const union = new Set([...ingSet, ...ids]);
        if (union.size > MAX_INGS) flush(books.length);
        ids.forEach((id) => ingSet.add(id));
        working.push(drink);
      });
      flush(books.length);

      const valid = books.filter((b) => b.drinks.length >= MIN_DRINKS);
      if (valid.length) result.push([cat, valid]);
    });

    return result.sort((a, b) => a[0].localeCompare(b[0]));
  }, [drinks]);

  /* ---------- render ---------- */
  if (loading) {
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
        <Text style={styles.header}>Explore</Text>

        {booksByCategory.map(([cat, books]) => (
          <View key={cat}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{cat}</Text>
            </View>

            <FlatList
              horizontal
              data={books}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => (
                <BookCard
                  book={item}
                  onPress={() => { setActiveBook(item); setModalVis(true); }}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.booksRow}
            />
          </View>
        ))}
      </ScrollView>

      <BookModal
        book={activeBook}
        visible={modalVis}
        onClose={() => setModalVis(false)}
        ingredientMap={ingredientMap}
      />
    </View>
  );
}

/* ------------------------------ STYLES ----------------------------- */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = SCREEN_WIDTH * 0.55;
const CARD_H = CARD_W * 0.68;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  scroll:    { paddingBottom: 100 },
  header:    {
    color: '#DFDCD9', fontSize: 36, fontWeight: 'bold',
    paddingTop: 80, paddingHorizontal: 20, marginBottom: 10,
  },

  /* section */
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', paddingHorizontal: 20,
                  marginTop: 12, marginBottom: 4 },
  sectionTitle: { color: '#DFDCD9', fontSize: 24, fontWeight: '600' },

  /* cards */
  booksRow: { paddingLeft: 20, paddingVertical: 10, paddingRight: 10 },
  bookTile: {
    marginRight: 14, borderRadius: 12, backgroundColor: '#1F1F1F', padding: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  bookCard:   { width: CARD_W, height: CARD_H, borderRadius: 8,
                overflow: 'hidden', backgroundColor: '#1F1F1F' },
  bookImage:  { width: '100%', height: '100%', resizeMode: 'contain' },
  bookOverlay:{ ...StyleSheet.absoluteFillObject,
                backgroundColor: 'rgba(0,0,0,0.35)' },
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
  modalTitle:  { color: '#DFDCD9', fontSize: 24,
                 fontWeight: '600', marginBottom: 4 },
  modalSubtitle:{ color: '#4F4F4F', marginBottom: 16 },
  sectionHeader:{ color: '#CE975E', fontSize: 18, marginBottom: 8 },

  modalDrink:     { marginRight: 12, width: 100 },
  modalDrinkImg:  { width: 100, height: 100,
                    borderRadius: 8, marginBottom: 4, backgroundColor: 'transparent' },
  modalDrinkName: { color: '#DFDCD9', fontSize: 12, textAlign: 'center' },

  ingList: { marginTop: 4 },
  ingItem: { color: '#DFDCD9', fontSize: 14, marginBottom: 2 },
});
/* -------------------------------------------------------------------------- */
