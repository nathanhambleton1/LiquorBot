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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Amplify } from 'aws-amplify';
import { PubSub } from '@aws-amplify/pubsub';
import config from '../../src/amplifyconfiguration.json';

// GRAPHQL & AUTH IMPORTS
import { generateClient } from 'aws-amplify/api';
import { createLikedDrink, deleteLikedDrink } from '../../src/graphql/mutations';
import { listLikedDrinks } from '../../src/graphql/queries';
import { getCurrentUser } from 'aws-amplify/auth';
import { fetchAuthSession } from 'aws-amplify/auth';

import { getUrl } from 'aws-amplify/storage';

Amplify.configure(config);
const client = generateClient();

const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// -- DRINK & INGREDIENT TYPES --
type Drink = {
  id: number;
  name: string;
  category: string;
  description?: string; // Not displayed but stored
  image: string;
  ingredients?: string; // e.g. "2:2.0:1,8:1.0:1,17:1.0:2"
};

type BaseIngredient = {
  id: number;
  name: string;
  type: string;
};

type ParsedIngredient = {
  id: number;
  name: string;   
  amount: number; 
  priority: number;
};

interface DrinkItemProps {
  drink: Drink;
  isExpanded: boolean;
  isLiked: boolean;
  toggleFavorite: (id: number) => Promise<void>;
  onExpand: (id: number) => void;
  onCollapse: () => void;
  allIngredients: BaseIngredient[];
  onExpandedLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
}

// Helper: parse "2:2.0:1,8:1.0:1,17:1.0:2" → array of { id, name, amount, priority }
function parseIngredientString(
  ingredientString: string,
  allIngredients: BaseIngredient[]
): ParsedIngredient[] {
  if (!ingredientString) return [];
  return ingredientString.split(',').map((chunk) => {
    const [idStr, amountStr, priorityStr] = chunk.split(':');
    const id = parseInt(idStr, 10);
    const amount = parseFloat(amountStr);
    const priority = parseInt(priorityStr, 10);

    const ingObj = allIngredients.find((ing) => ing.id === id);
    const name = ingObj ? ingObj.name : `Ingredient #${id} (not found)`;

    return { id, name, amount, priority };
  });
}

// Single drink component
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

  const incrementQuantity = () => setQuantity((prev) => (prev < 3 ? prev + 1 : prev));
  const decrementQuantity = () => setQuantity((prev) => (prev > 1 ? prev - 1 : prev));

  const parsedIngredients = parseIngredientString(drink.ingredients ?? '', allIngredients);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  async function handlePourDrink() {
    try {
      await pubsub.publish({
        topics: ['liquorbot/publish'],
        message: { content: drink.ingredients ?? '' },
      });
      console.log(`Published command="${drink.ingredients}"`);
    } catch (err) {
      console.error('Error publishing PubSub message:', err);
    }
  }

  function handleToggleLike() {
    toggleFavorite(drink.id);
  }

  if (isExpanded) {
    // Expanded card layout
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
        <TouchableOpacity
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onCollapse();
          }}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color="#DFDCD9" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleToggleLike();
          }}
          style={styles.expandedFavoriteButton}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? '#CE975E' : '#4F4F4F'}
          />
        </TouchableOpacity>

        <View style={styles.expandedContent}>
          <View style={styles.expandedTitleContainer}>
            <Text style={styles.expandedboxText}>{drink.name}</Text>
            <Text style={styles.expandedcategoryText}>{drink.category}</Text>
          </View>
          <Image source={{ uri: drink.image }} style={styles.expandedImage} />
        </View>

        <View style={styles.expandeddetailContainer}>
          {parsedIngredients.length === 0 ? (
            <Text style={styles.expandeddescriptionText}>No ingredients found.</Text>
          ) : (
            <Text style={styles.expandeddescriptionText}>
              Contains refreshing{' '}
              {parsedIngredients
                .map((item, index) => {
                  if (index === parsedIngredients.length - 1 && index !== 0) {
                    return `and ${item.name}`;
                  }
                  return item.name;
                })
                .join(', ')}.
            </Text>
          )}
        </View>

        <View style={styles.quantityContainer}>
          <TouchableOpacity onPress={decrementQuantity} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity onPress={incrementQuantity} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handlePourDrink}>
          <Text style={styles.buttonText}>Pour Drink</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  } else {
    // Collapsed card layout
    return (
      <TouchableOpacity
        key={drink.id}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onExpand(drink.id);
        }}
        activeOpacity={0.9}
        style={styles.box}
      >
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleToggleLike();
          }}
          style={styles.favoriteButton}
        >
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
}

export default function MenuScreen() {
  const scrollViewRef = useRef<ScrollView>(null);

  // Drinks & Ingredients from S3
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [allIngredients, setAllIngredients] = useState<BaseIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  // Category, expansions, search
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedDrink, setExpandedDrink] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  // For IoT messages
  const [latestMessage, setLatestMessage] = useState('');

  // Liked drinks
  const [userID, setUserID] = useState<string | null>(null);
  const [likedDrinks, setLikedDrinks] = useState<number[]>([]); // store the drink IDs

  // Glow animation for the green dot
  const glowAnimation = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnimation]);

  // Fetch drinks.json & ingredients.json from S3
  useEffect(() => {
    async function fetchDrinksFromS3() {
      try {
        const drinksUrl = await getUrl({ key: 'drinkMenu/drinks.json' });
        const response = await fetch(drinksUrl.url);
        const data = await response.json();
        setDrinks(data);
      } catch (error) {
        console.error('Error fetching drinks from S3:', error);
      }
    }

    async function fetchIngredientsFromS3() {
      try {
        const ingUrl = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const response = await fetch(ingUrl.url);
        const data = await response.json();
        setAllIngredients(data);
      } catch (error) {
        console.error('Error fetching ingredients from S3:', error);
      }
    }

    Promise.all([fetchDrinksFromS3(), fetchIngredientsFromS3()]).finally(() =>
      setLoading(false)
    );
  }, []);

  // Fetch user ID on mount
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user?.username) {
          setUserID(user.username);
        } else {
          console.warn('No authenticated user found');
        }
      } catch (err) {
        console.error('Error getting current user:', err);
      }
    })();
  }, []);

  // We'll define our "loadLikedDrinks" as a function so we can call it from multiple places
  async function loadLikedDrinks() {
    if (!userID) return;
    try {
      const res = await client.graphql({
        query: listLikedDrinks,
        variables: { filter: { userID: { eq: userID } } },
        authMode: 'userPool',
      });
      
      const items = res.data?.listLikedDrinks?.items || [];
      const justDrinkIDs = items.map((item: any) => item.drinkID);
      
      // Force state update
      setLikedDrinks([]);
      setLikedDrinks(justDrinkIDs);
      
    } catch (error) {
      console.error('Error loading liked drinks:', error);
    }
  }

  // Once we have userID, load that user's liked drinks
  useEffect(() => {
    if (userID) {
      loadLikedDrinks();
    }
  }, [userID]);

  // Subscribe to IoT messages (sample usage)
  useEffect(() => {
    (async () => {
      try {
        const info = await fetchAuthSession();
        console.log('Cognito Identity ID:', info.identityId);
      } catch (error) {
        console.error('Error fetching Cognito Identity ID:', error);
      }
    })();

    const subscription = pubsub.subscribe({ topics: ['messages'] }).subscribe({
      next: (data) => {
        console.log('Received message from IoT:', data);
        if (typeof data?.message === 'string') {
          setLatestMessage(data.message);
        } else {
          setLatestMessage(JSON.stringify(data));
        }
      },
      error: (error) => console.error('Subscription error:', error),
      complete: () => console.log('Subscription completed.'),
    });

    return () => subscription.unsubscribe();
  }, []);

  // Toggle a favorite (create or delete from DynamoDB)
  async function toggleFavorite(drinkId: number) {
    if (!userID) {
      console.warn('No user ID. Cannot toggle favorite.');
      return;
    }
  
    // If already liked, delete it
    if (likedDrinks.includes(drinkId)) {
      try {
        // 1) Find the existing LikedDrink record
        const fetchRes = await client.graphql({
          query: listLikedDrinks,
          variables: {
            filter: {
              userID: { eq: userID },
              drinkID: { eq: drinkId },
            },
          },
        });
        const existing = fetchRes.data?.listLikedDrinks?.items?.[0];
  
        if (!existing) {
          console.warn('No existing record found to delete — removing locally.');
          setLikedDrinks((prev) => prev.filter((id) => id !== drinkId));
          return;
        }
  
        // 2) Delete from DB - ADD authMode HERE
        await client.graphql({
          query: deleteLikedDrink,
          variables: { input: { id: existing.id } },
          authMode: 'userPool', // <-- Add this line
        });
  
        // 3) Update local state
        setLikedDrinks((prev) => prev.filter((id) => id !== drinkId));
      } catch (error) {
        console.error('Error deleting LikedDrink:', error);
      }
    } else {
      // Otherwise create it - ADD authMode HERE
      try {
        await client.graphql({
          query: createLikedDrink,
          variables: {
            input: {
              userID: userID,
              drinkID: drinkId,
            },
          },
          authMode: 'userPool', // <-- Add this line
        });
        setLikedDrinks((prev) => [...prev, drinkId]);
      } catch (error) {
        console.error('Error creating LikedDrink:', error);
      }
    }
  }

  // Categories to display up top
  const categories = ['All', 'Vodka', 'Rum', 'Tequila', 'Whiskey'];

  // Filter drinks by category & search
  const filteredDrinks = drinks.filter((drink) => {
    const matchesCategory =
      selectedCategory === 'All' || drink.category === selectedCategory;
    const matchesSearch = drink.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // If expanded, shift the expanded item up a row if it’s on the right side
  const renderedDrinks = [...filteredDrinks];
  if (expandedDrink != null) {
    const expandedIndex = renderedDrinks.findIndex((d) => d.id === expandedDrink);
    if (expandedIndex !== -1 && expandedIndex % 2 === 1) {
      const [expandedItem] = renderedDrinks.splice(expandedIndex, 1);
      renderedDrinks.splice(expandedIndex - 1, 0, expandedItem);
    }
  }

  const handleExpandedLayout = (layout: { y: number; height: number }) => {
    if (scrollViewRef.current && scrollViewHeight) {
      scrollViewRef.current.scrollTo({ y: layout.y, animated: true });
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#DFDCD9', fontSize: 18 }}>Loading drinks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Drinks</Text>
        <View style={styles.connectionRow}>
          <Animated.View
            style={[
              styles.greenDot,
              {
                transform: [{ scale: glowAnimation }],
                shadowOpacity: glowAnimation.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.3, 0.8],
                }),
              },
            ]}
          />
          <Text style={styles.subHeaderText}>LiquorBot #001</Text>
        </View>

        {/* Edit Icon in the top-right corner */}
        <TouchableOpacity
          style={styles.editIconContainer}
          onPress={() => console.log('Edit icon pressed')}
        >
          <Ionicons name="create-outline" size={30} color="#CE975E" />
        </TouchableOpacity>
      </View>

      {/* Horizontal category picker */}
      <View style={styles.horizontalPickerContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalPicker}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={styles.categoryButton}
            >
              <View style={styles.categoryButtonContent}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category && styles.selectedCategoryText,
                  ]}
                >
                  {category}
                </Text>
                {selectedCategory === category && <View style={styles.underline} />}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="#4F4F4F" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search"
          placeholderTextColor="#4F4F4F"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Drinks Grid */}
      <ScrollView
        ref={scrollViewRef}
        onLayout={() => setScrollViewHeight(500)}
        contentContainerStyle={[styles.scrollContainer, { paddingBottom: expandedDrink ? 100 : 80 }]}
      >
        <View style={styles.grid}>
          {renderedDrinks.map((drink) => (
            <DrinkItem
              key={drink.id}
              drink={drink}
              isExpanded={expandedDrink === drink.id}
              isLiked={likedDrinks.includes(drink.id)}
              toggleFavorite={toggleFavorite}
              onExpand={(id: number) => setExpandedDrink(id)}
              onCollapse={() => setExpandedDrink(null)}
              allIngredients={allIngredients}
              onExpandedLayout={handleExpandedLayout}
            />
          ))}
        </View>
      </ScrollView>

      {/* Latest IoT Message */}
      {latestMessage ? (
        <View style={{ padding: 10, backgroundColor: '#333' }}>
          <Text style={{ color: '#fff' }}>Latest IoT Message: {latestMessage}</Text>
        </View>
      ) : null}
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
    paddingTop: 80,
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
    backgroundColor: '#63d44a',
    marginRight: 8,
    shadowColor: '#00FF00',
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
    marginBottom: 40,
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
    marginBottom: 40,
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
    top: 100,
    right: 30,
  },
});
