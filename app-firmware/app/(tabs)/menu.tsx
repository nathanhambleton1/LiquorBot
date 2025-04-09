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

// NEW IMPORT: getUrl from Storage
import { getUrl } from 'aws-amplify/storage';

import { fetchAuthSession } from 'aws-amplify/auth';

Amplify.configure(config);

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
  description?: string; // Still supported but not displayed in expanded card
  image: string;
  ingredients?: string; // Our new field: e.g. "2:2.0:1,8:1.0:1,17:1.0:2"
};

type BaseIngredient = {
  id: number;
  name: string;
  type: string;
};

// After parsing "2:2.0:1", we store:
type ParsedIngredient = {
  id: number;
  name: string;    // e.g. "Tequila"
  amount: number;  // e.g. 2.0
  priority: number;// e.g. 1
};

interface DrinkItemProps {
  drink: Drink;
  isExpanded: boolean;
  toggleFavorite: (id: number) => void;
  onExpand: (id: number) => void;
  onCollapse: () => void;
  allIngredients: BaseIngredient[];
  onExpandedLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
}

// Helper to parse "2:2.0:1,8:1.0:1,17:1.0:2" => array of {id, name, amount, priority}
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

// A single drink component
function DrinkItem({
  drink,
  isExpanded,
  toggleFavorite,
  onExpand,
  onCollapse,
  allIngredients,
  onExpandedLayout,
}: DrinkItemProps) {
  const [animValue] = useState(new Animated.Value(isExpanded ? 1 : 0));
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false); // Local state for like toggle

  const incrementQuantity = () => setQuantity((prev) => (prev < 3 ? prev + 1 : prev));
  const decrementQuantity = () => setQuantity((prev) => (prev > 1 ? prev - 1 : prev));

  // Parse ingredients once at render (or whenever allIngredients changes)
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
        message: { content: drink.ingredients ?? '' }, // Wrap the string in an object
      });
      console.log(`Published command="${drink.ingredients}"`);
    } catch (err) {
      console.error('Error publishing PubSub message:', err);
    }
  }

  const handleToggleLike = () => {
    setIsLiked((prev) => !prev); // Toggle the like state
    toggleFavorite(drink.id); // Call the parent toggle function
  };

  // When expanded, show large card
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
            handleToggleLike(); // Use the local toggle handler
          }}
          style={styles.expandedFavoriteButton}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'} // Change icon based on state
            size={24}
            color={isLiked ? '#CE975E' : '#4F4F4F'} // Change color based on state
          />
        </TouchableOpacity>

        <View style={styles.expandedContent}>
          <View style={styles.expandedTitleContainer}>
            <Text style={styles.expandedboxText}>{drink.name}</Text>
            <Text style={styles.expandedcategoryText}>{drink.category}</Text>
          </View>
          <Image source={{ uri: drink.image }} style={styles.expandedImage} />
        </View>

        {/* In place of the old "description", show the drink's ingredients */}
        <View style={styles.expandeddetailContainer}>
          {parsedIngredients.length === 0 ? (
            <Text style={styles.expandeddescriptionText}>
              No ingredients found.
            </Text>
          ) : (
            <Text style={styles.expandeddescriptionText}>
              Contains refreshing {parsedIngredients
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
    // Collapsed item
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
            handleToggleLike(); // Use the local toggle handler
          }}
          style={styles.favoriteButton}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'} // Change icon based on state
            size={24}
            color={isLiked ? '#CE975E' : '#4F4F4F'} // Change color based on state
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

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedDrink, setExpandedDrink] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [latestMessage, setLatestMessage] = useState('');

  // Create the animated value for the green dot
  const glowAnimation = useRef(new Animated.Value(1)).current;

  // Glow animation for the green dot
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

  // Fetch drinks.json
  useEffect(() => {
    async function fetchDrinksFromS3() {
      try {
        // 1. S3 key for your drinks
        const drinksUrl = await getUrl({
          key: 'drinkMenu/drinks.json',
          // options: { level: 'guest' }, // If needed
        });
        const response = await fetch(drinksUrl.url);
        const data = await response.json();
        setDrinks(data);
      } catch (error) {
        console.error('Error fetching drinks from S3:', error);
      }
    }

    // Also fetch ingredients.json
    async function fetchIngredientsFromS3() {
      try {
        const ingUrl = await getUrl({
          key: 'drinkMenu/ingredients.json',
          // options: { level: 'guest' },
        });
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

  // If you want to log the identity ID + subscribe to IoT
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

  // Handle toggle favorite
  function toggleFavorite(drinkId: number) {
    console.log(`Toggled favorite for drink ID: ${drinkId}`);
  }

  // A few sample categories
  const categories = ['All', 'Vodka', 'Rum', 'Tequila', 'Whiskey'];

  // Filter drinks based on category + search
  const filteredDrinks = drinks.filter((drink) => {
    const matchesCategory = selectedCategory === 'All' || drink.category === selectedCategory;
    const matchesSearch = drink.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Re-arrange if expanded (move the expanded item up a row if needed)
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
