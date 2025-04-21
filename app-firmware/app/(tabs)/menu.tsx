// -----------------------------------------------------------------------------
// File: menu.tsx
// Description: Displays the drink menu for the LiquorBot app, including drink
//              details, categories, search / filter, and IoT integration for
//              pouring drinks.  Adds a “make‑able” filter toggle that limits
//              the list to drinks that can be prepared with the ingredients
//              currently loaded on the ESP32 (pulled via MQTT) **and now
//              injects the user’s CustomRecipe items pulled from the GraphQL
//              API so they show up alongside built‑in drinks.**
// Author: Nathan Hambleton
// Updated: Apr 19 2025 – Show user‑created drinks on the menu
// -----------------------------------------------------------------------------
import { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

// Amplify & PubSub
import { Amplify } from 'aws-amplify';
import { PubSub } from '@aws-amplify/pubsub';
import config from '../../src/amplifyconfiguration.json';

// GraphQL & Auth
import { generateClient } from 'aws-amplify/api';
import {
  createLikedDrink,
  deleteLikedDrink,
} from '../../src/graphql/mutations';
import {
  listLikedDrinks,
  listCustomRecipes,     // 👈 NEW
} from '../../src/graphql/queries';
import { getCurrentUser } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';

// LiquorBot context
import { useLiquorBot } from '../components/liquorbot-provider';

Amplify.configure(config);
const client = generateClient();

const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

const SLOT_CONFIG_TOPIC = 'liquorbot/liquorbot001/slot-config';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// --------------------------- TYPES ---------------------------
type Drink = {
  id: number;
  name: string;
  category: string;
  description?: string;
  image: string;
  ingredients?: string; // “id:amount:priority,id:amount:priority,…”
};

type BaseIngredient = { id: number; name: string; type: string };

type ParsedIngredient = {
  id: number;
  name: string;
  amount: number;
  priority: number;
};

// ------------ HELPERS ------------
function parseIngredientString(
  ingredientString: string,
  allIngredients: BaseIngredient[],
): ParsedIngredient[] {
  if (!ingredientString) return [];
  return ingredientString.split(',').map((chunk) => {
    const [idStr, amountStr, priorityStr] = chunk.split(':');
    const id = parseInt(idStr, 10);
    const amount = parseFloat(amountStr);
    const priority = parseInt(priorityStr, 10);
    const ingObj = allIngredients.find((ing) => ing.id === id);
    const name = ingObj ? ingObj.name : `Ingredient #${id}`;
    return { id, name, amount, priority };
  });
}

/* -------------------------------------------------------------------------- */
/*                              SINGLE DRINK CARD                             */
/* -------------------------------------------------------------------------- */

interface DrinkItemProps {
  drink: Drink;
  isExpanded: boolean;
  isLiked: boolean;
  toggleFavorite: (id: number) => Promise<void>;
  onExpand: (id: number) => void;
  onCollapse: () => void;
  allIngredients: BaseIngredient[];
  onExpandedLayout?: (layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

function DrinkItem({
  drink,
  isExpanded,
  isLiked,
  toggleFavorite,
  onExpand,
  onCollapse,
  allIngredients,
  onExpandedLayout,
}: DrinkItemProps) {
  const [animValue] = useState(new Animated.Value(isExpanded ? 1 : 0));
  const [quantity, setQuantity] = useState(1);
  const { isConnected, forceDisconnect } = useLiquorBot();

  const parsedIngredients = parseIngredientString(
    drink.ingredients ?? '',
    allIngredients,
  );

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  /* --------------- pour‑drink helpers (unchanged) --------------- */
  async function publishDrinkCommand() {
    try {
      await pubsub.publish({
        topics: ['liquorbot/publish'],
        message: { content: drink.ingredients ?? '' },
      });
      console.log(`Published command="${drink.ingredients}"`);
    } catch (error) {
      console.error('Error publishing PubSub message:', error);
    }
  }
  async function handlePourDrink() {
    try {
      if (!isConnected) {
        console.warn('LiquorBot is not connected. Aborting.');
        return;
      }
      let responded = false;
      const sub = pubsub
        .subscribe({ topics: ['liquorbot/heartbeat'] })
        .subscribe({
          next: (resp: any) => {
            if (resp?.content === 'OK') {
              responded = true;
              sub.unsubscribe();
              publishDrinkCommand();
            }
          },
          error: () => {
            sub.unsubscribe();
            forceDisconnect();
          },
        });
      await pubsub.publish({
        topics: ['liquorbot/heartbeat'],
        message: { content: 'CHECK' },
      });
      setTimeout(
        () => !responded && (sub.unsubscribe(), forceDisconnect()),
        2000,
      );
    } catch (err) {
      console.error(err);
    }
  }

  const handleToggleLike = () => toggleFavorite(drink.id);

  /* ---------------------------- RENDER --------------------------- */
  if (isExpanded) {
    return (
      <Animated.View
        onLayout={(e) => onExpandedLayout?.(e.nativeEvent.layout)}
        style={[
          styles.box,
          styles.expandedBox,
          {
            transform: [
              {
                scale: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          },
        ]}
      >
        {/* close & heart buttons */}
        <TouchableOpacity onPress={onCollapse} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#DFDCD9" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleToggleLike}
          style={styles.expandedFavoriteButton}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? '#CE975E' : '#4F4F4F'}
          />
        </TouchableOpacity>

        {/* content */}
        <View style={styles.expandedContent}>
          <View style={styles.expandedTitleContainer}>
            <Text style={styles.expandedboxText}>{drink.name}</Text>
            <Text style={styles.expandedcategoryText}>{drink.category}</Text>
          </View>
          <Image source={{ uri: drink.image }} style={styles.expandedImage} />
        </View>

        <View style={styles.expandeddetailContainer}>
          {parsedIngredients.length === 0 ? (
            <Text style={styles.expandeddescriptionText}>
              No ingredients found.
            </Text>
          ) : (
            <Text style={styles.expandeddescriptionText}>
              Contains{' '}
              {parsedIngredients
                .map((item, i) =>
                  i === parsedIngredients.length - 1 && i !== 0
                    ? `and ${item.name}`
                    : item.name,
                )
                .join(', ')}
              .
            </Text>
          )}
        </View>

        {/* qty + button */}
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            onPress={() => setQuantity((q) => Math.min(3, q + 1))}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handlePourDrink}>
          <Text style={styles.buttonText}>Pour Drink</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  /* ---------------------- collapsed card ----------------------- */
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        (LayoutAnimation.configureNext(
          LayoutAnimation.Presets.easeInEaseOut,
        ),
        onExpand(drink.id))
      }
      style={styles.box}
    >
      <TouchableOpacity onPress={handleToggleLike} style={styles.favoriteButton}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={24}
          color={isLiked ? '#CE975E' : '#4F4F4F'}
        />
      </TouchableOpacity>
      <Image source={{ uri: drink.image }} style={styles.image} />
      <Text style={styles.boxText}>{drink.name}</Text>
      <Text style={styles.categoryText}>{drink.category}</Text>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------------------------- */
/*                               MAIN MENU SCREEN                             */
/* -------------------------------------------------------------------------- */

export default function MenuScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { isConnected } = useLiquorBot();

  /* ------------------------- STATE ------------------------- */
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [allIngredients, setAllIngredients] = useState<BaseIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  // category & search
  const categories = ['All', 'Vodka', 'Rum', 'Tequila', 'Whiskey']; // “Custom” drinks still appear under “All”
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // make‑able filter
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [onlyMakeable, setOnlyMakeable] = useState(false);
  const [alphabetical, setAlphabetical] = useState(false);
  const [onlyCustom, setOnlyCustom] = useState(false);

  // slot‑config
  const [slots, setSlots] = useState<number[]>(Array(15).fill(0));

  // expand / likes / user
  const [expandedDrink, setExpandedDrink] = useState<number | null>(null);
  const [userID, setUserID] = useState<string | null>(null);
  const [likedDrinks, setLikedDrinks] = useState<number[]>([]);
  const [customFetched, setCustomFetched] = useState(false);

  // glow anim for status dot
  const glowAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [glowAnim]);

  /* ----- base drinks & ingredient catalogue (S3 JSON) ----- */
  useEffect(() => {
    (async () => {
      try {
        const [drinksUrl, ingUrl] = await Promise.all([
          getUrl({ key: 'drinkMenu/drinks.json' }),
          getUrl({ key: 'drinkMenu/ingredients.json' }),
        ]);
        const [drinksRes, ingRes] = await Promise.all([
          fetch(drinksUrl.url),
          fetch(ingUrl.url),
        ]);
        setDrinks(await drinksRes.json());
        setAllIngredients(await ingRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ----------------- Cognito username / ID ----------------- */
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        user?.username && setUserID(user.username);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  /* -------------------- liked drinks ----------------------- */
  useEffect(() => {
    if (!userID) return;
    (async () => {
      try {
        const res = await client.graphql({
          query: listLikedDrinks,
          variables: { filter: { userID: { eq: userID } } },
          authMode: 'userPool',
        });
        setLikedDrinks(
          res.data?.listLikedDrinks?.items.map((i: any) => i.drinkID) || [],
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, [userID]);

  /* -------- NEW: pull the user’s CustomRecipe items ---------- */
  useEffect(() => {
    if (!userID || customFetched) return;

    (async () => {
      try {
        const res = await client.graphql({
          query: listCustomRecipes,
          authMode: 'userPool', // owner‑based auth will return only the user’s items
        });

        const custom: Drink[] =
          res.data?.listCustomRecipes?.items?.map(
            (item: any, idx: number): Drink => {
              // Keep IDs unique by offsetting into a high range
              const numericId = 1_000_000 + idx;

              // Convert {ingredientID, amount, priority}[] → "id:amt:prio,id:amt:prio"
              const ingredientsString = Array.isArray(item.ingredients)
                ? item.ingredients
                    .map(
                      (ri: any) =>
                        `${Number(ri.ingredientID)}:${Number(
                          ri.amount,
                        )}:${Number(ri.priority ?? 1)}`,
                    )
                    .join(',')
                : '';

              return {
                id: numericId,
                name: item.name ?? `Custom #${idx + 1}`,
                category: 'Custom',
                description: item.description ?? '',
                image:
                  'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png', // fallback image
                ingredients: ingredientsString,
              };
            },
          ) ?? [];

        // Merge without clobbering earlier fetch results
        setDrinks((prev) => [...prev, ...custom]);
        setCustomFetched(true);
      } catch (e) {
        console.error('Error loading custom drinks', e);
      }
    })();
  }, [userID, customFetched]);

  /* --------------------- MQTT: slot config ------------------- */
  useEffect(() => {
    const sub = pubsub.subscribe({ topics: [SLOT_CONFIG_TOPIC] }).subscribe({
      next: (data) => {
        const msg = (data as any)?.value ?? data;
        if (msg.action === 'CURRENT_CONFIG' && Array.isArray(msg.slots)) {
          setSlots(msg.slots.map((id: any) => Number(id) || 0));
        }
      },
      error: (e) => console.error('slot‑config sub error', e),
    });

    isConnected &&
      pubsub
        .publish({
          topics: [SLOT_CONFIG_TOPIC],
          message: { action: 'GET_CONFIG' },
        })
        .catch(console.error);

    return () => sub.unsubscribe();
  }, [isConnected]);

  /* -------------------- favourite toggle -------------------- */
  async function toggleFavorite(drinkId: number) {
    if (!userID) return;
    if (likedDrinks.includes(drinkId)) {
      try {
        const res = await client.graphql({
          query: listLikedDrinks,
          variables: { filter: { userID: { eq: userID }, drinkID: { eq: drinkId } } },
        });
        const existing = res.data?.listLikedDrinks?.items?.[0];
        existing &&
          (await client.graphql({
            query: deleteLikedDrink,
            variables: { input: { id: existing.id } },
            authMode: 'userPool',
          }));
        setLikedDrinks((p) => p.filter((id) => id !== drinkId));
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        await client.graphql({
          query: createLikedDrink,
          variables: { input: { userID, drinkID: drinkId } },
          authMode: 'userPool',
        });
        setLikedDrinks((p) => [...p, drinkId]);
      } catch (e) {
        console.error(e);
      }
    }
  }

  /* ---------------------- FILTER LOGIC ---------------------- */
  const loadedIds = slots.filter((id) => id > 0);
  const canMake = (drink: Drink) => {
    if (!onlyMakeable) return true;
    if (!drink.ingredients || loadedIds.length === 0) return false;
    const needed = drink.ingredients
      .split(',')
      .map((c) => parseInt(c.split(':')[0], 10));
    return needed.every((id) => loadedIds.includes(id));
  };

  let filteredDrinks = drinks.filter(
    (d) =>
      (!onlyCustom || d.category === 'Custom') &&
      (selectedCategory === 'All' || d.category === selectedCategory) &&
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      canMake(d),
  );
  if (alphabetical) {
    filteredDrinks.sort((a, b) => a.name.localeCompare(b.name));
  }

  // keep expanded card on left column
  const renderedDrinks = [...filteredDrinks];
  if (expandedDrink != null) {
    const i = renderedDrinks.findIndex((d) => d.id === expandedDrink);
    i !== -1 &&
      i % 2 === 1 &&
      renderedDrinks.splice(i - 1, 0, renderedDrinks.splice(i, 1)[0]);
  }

  const handleExpandedLayout = (layout: { y: number }) =>
    scrollViewRef.current?.scrollTo({ y: layout.y, animated: true });

  /* ---------------------- initial loader --------------------- */
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Loading drinks…</Text>
      </View>
    );
  }

  /* ---------------------------- UI --------------------------- */
  return (
    <View style={styles.container}>
      {/* ------------ HEADER ------------ */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Drinks</Text>

        <View style={styles.connectionRow}>
          <Animated.View
            style={[
              styles.greenDot,
              {
                backgroundColor: isConnected ? '#63d44a' : '#B81A1A',
                transform: [{ scale: glowAnim }],
                shadowColor: isConnected ? '#00FF00' : '#B81A1A',
              },
            ]}
          />
          <Text style={styles.subHeaderText}>LiquorBot #001</Text>
        </View>

        <TouchableOpacity
          style={styles.editIconContainer}
          onPress={() => router.push('/create-drink')}
        >
          <Ionicons name="create-outline" size={30} color="#CE975E" />
        </TouchableOpacity>
      </View>

      {/* ------------ CATEGORY PICKER ------------ */}
      <View style={styles.horizontalPickerContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalPicker}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={styles.categoryButton}
            >
              <View style={styles.categoryButtonContent}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === cat && styles.selectedCategoryText,
                  ]}
                >
                  {cat}
                </Text>
                {selectedCategory === cat && <View style={styles.underline} />}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ------------ SEARCH + FILTER ------------ */}
      <View style={styles.searchBarContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#4F4F4F"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchBar}
          placeholder="Search"
          placeholderTextColor="#4F4F4F"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          style={styles.filterIcon}
        >
          <Ionicons
            name="funnel-outline"
            size={20}
            color={onlyMakeable ? '#CE975E' : '#4F4F4F'}
          />
        </TouchableOpacity>
      </View>

      {/* ------------ DRINK GRID ------------ */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: expandedDrink ? 100 : 80 },
        ]}
      >
        <View style={styles.grid}>
          {renderedDrinks.map((drink) => (
            <DrinkItem
              key={drink.id}
              drink={drink}
              isExpanded={expandedDrink === drink.id}
              isLiked={likedDrinks.includes(drink.id)}
              toggleFavorite={toggleFavorite}
              onExpand={(id) => setExpandedDrink(id)}
              onCollapse={() => setExpandedDrink(null)}
              allIngredients={allIngredients}
              onExpandedLayout={handleExpandedLayout}
            />
          ))}
        </View>
      </ScrollView>

      {/* ------------ FILTER POPUP ------------ */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setFilterModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#DFDCD9" />
            </TouchableOpacity>
            <Text style={styles.filterModalTitle}>Filter Options</Text>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>
                Only show drinks I can make
              </Text>
              <Switch
                value={onlyMakeable}
                onValueChange={setOnlyMakeable}
                trackColor={{ false: '#4F4F4F', true: '#CE975E' }}
                thumbColor="#DFDCD9"
              />
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Sort alphabetically</Text>
              <Switch
                value={alphabetical}
                onValueChange={setAlphabetical}
                trackColor={{ false: '#4F4F4F', true: '#CE975E' }}
                thumbColor="#DFDCD9"
              />
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Only show my custom drinks</Text>
              <Switch
                value={onlyCustom}
                onValueChange={setOnlyCustom}
                trackColor={{ false: '#4F4F4F', true: '#CE975E' }}
                thumbColor="#DFDCD9"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// -------------------------------- STYLES --------------------------------
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  headerContainer: {
    paddingTop: 30,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerText: {
    color: '#DFDCD9',
    fontWeight: 'bold',
    fontSize: 36,
    textAlign: 'left',
  },
  subHeaderText: {
    color: '#4F4F4F',
    fontSize: 20,
    textAlign: 'left',
    marginTop: 0,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    marginRight: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 5,
    shadowOpacity: 0.6,
    elevation: 5,
  },
  horizontalPickerContainer: {
    alignItems: 'center',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 5,
    marginBottom: -10,
  },
  horizontalPicker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginHorizontal: 5,
  },
  categoryButtonContent: {
    alignItems: 'center',
  },
  selectedCategoryText: {
    color: '#CE975E',
  },
  underline: {
    height: 2,
    backgroundColor: '#CE975E',
    marginTop: 2,
    width: '100%',
  },
  categoryButtonText: {
    color: '#4F4F4F',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginHorizontal: 20,
    marginVertical: 10,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchBar: {
    flex: 1,
    color: '#DFDCD9',
    fontSize: 16,
    paddingVertical: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  box: {
    width: '45%',
    marginBottom: 25,
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    overflow: 'visible',
    position: 'relative',
    paddingVertical: 10,
  },
  expandedBox: {
    width: '100%',
    height: 500,
    padding: 20,
    marginBottom: 25,
    overflow: 'visible',
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  expandedFavoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  image: {
    top: -5,
    left: -15,
    width: '90%',
    height: 160,
    marginBottom: 10,
    transform: [{ rotate: '-7deg' }],
  },
  expandedboxText: {
    color: '#DFDCD9',
    fontSize: 24,
    marginBottom: 10,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  expandedImage: {
    marginTop: 20,
    width: 150,
    height: 150,
    borderRadius: 10,
  },
  expandedcategoryText: {
    color: '#CE975E',
    fontSize: 14,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  expandeddescriptionText: {
    color: '#4F4F4F',
    fontSize: 14,
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  expandedContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandedTitleContainer: {
    flex: 1,
    marginTop: 50,
    marginRight: 10,
    alignSelf: 'flex-start',
  },
  expandeddetailContainer: {
    flex: 1,
    marginTop: 40,
    marginRight: 10,
  },
  boxText: {
    color: '#DFDCD9',
    fontSize: 18,
    paddingLeft: 10,
    marginBottom: 0,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: '#CE975E',
    fontSize: 14,
    marginBottom: 10,
    paddingLeft: 10,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  quantityContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  quantityButton: {
    backgroundColor: '#4f4f4f',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  quantityText: {
    color: '#FFFFFF',
    fontSize: 20,
    marginHorizontal: 20,
  },
  button: {
    backgroundColor: '#CE975E',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    width: '100%',
    alignSelf: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  editIconContainer: {
    position: 'absolute',
    top: 40,
    right: 30,
  },
  loadingScreen: { flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#DFDCD9', fontSize: 18 },
  filterIcon: { marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  filterModal: { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20 },
  filterModalTitle: { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', marginBottom: 20, alignSelf: 'center' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filterLabel: { color: '#DFDCD9', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  modalCloseButton: { position: 'absolute', top: 15, right: 15 },
});
