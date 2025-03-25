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
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import TopView from '../components/TopView';

import { Amplify } from 'aws-amplify';
import { PubSub } from '@aws-amplify/pubsub';
import config from '../../src/amplifyconfiguration.json';
import { fetchAuthSession } from 'aws-amplify/auth';
import API from '@aws-amplify/api';                  // For API.graphql(...)
import Auth from '@aws-amplify/auth';
import { graphqlOperation } from '@aws-amplify/api-graphql'; // For graphqlOperation(...)
import { createFavorite, deleteFavorite } from '../../src/graphql/mutations';
import { listFavorites } from '../../src/graphql/queries';

// If you haven’t set up Amplify elsewhere, do it here:
Amplify.configure(config);

// Create a PubSub instance for AWS IoT – old code style or pass creds via AWS exports
const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});
// --- END ADDED ---

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// Define a type for a drink object
type Drink = {
  id: number;
  name: string;
  category: string;
  description: string;
  image: any; // or ImageSourcePropType
};

interface DrinkItemProps {
  drink: Drink;
  isExpanded: boolean;
  toggleFavorite: (id: number) => void;
  onExpand: (id: number) => void;
  onCollapse: () => void;
  favorites: number[];
  onExpandedLayout?: (layout: { x: number; y: number; width: number; height: number }) => void;
}

const drinks: Drink[] = [
  {
    id: 1,
    name: 'Margarita',
    category: 'Tequila',
    image: require('@/assets/images/drink_pics/margarita.png'),
    description: 'A refreshing cocktail made with tequila, lime juice, and triple sec.',
  },
  {
    id: 2,
    name: 'Mojito',
    category: 'Rum',
    image: require('@/assets/images/drink_pics/mojito.png'),
    description: 'A classic Cuban cocktail made with rum, mint, lime, sugar, and soda water.',
  },
  {
    id: 3,
    name: 'Old Fashioned',
    category: 'Whiskey',
    image: require('@/assets/images/drink_pics/old_fashioned.png'),
    description: 'A timeless cocktail made with whiskey, sugar, bitters, and a twist of citrus rind.',
  },
  {
    id: 4,
    name: 'Cosmopolitan',
    category: 'Vodka',
    image: require('@/assets/images/drink_pics/cosmo.png'),
    description: 'A stylish cocktail made with vodka, triple sec, cranberry juice, and lime juice.',
  },
  {
    id: 5,
    name: 'Pina Colada',
    category: 'Rum',
    image: require('@/assets/images/drink_pics/pina_colada.png'),
    description: 'A tropical cocktail made with rum, coconut cream, and pineapple juice.',
  },
  {
    id: 6,
    name: 'Whiskey Sour',
    category: 'Whiskey',
    image: require('@/assets/images/drink_pics/whiskey_sour.png'),
    description: 'A tangy cocktail made with whiskey, lemon juice, and sugar.',
  },
  {
    id: 7,
    name: 'Martini',
    category: 'Vodka',
    image: require('@/assets/images/drink_pics/martini.png'),
    description: 'A classic cocktail made with gin or vodka and vermouth, garnished with an olive.',
  },
  {
    id: 8,
    name: 'Bloody Mary',
    category: 'Vodka',
    image: require('@/assets/images/drink_pics/bloody_mary.png'),
    description: 'A savory cocktail made with vodka, tomato juice, and various spices.',
  },
];

const categories = ['All', 'Vodka', 'Rum', 'Tequila', 'Whiskey'];

function DrinkItem({
  drink,
  isExpanded,
  toggleFavorite,
  onExpand,
  onCollapse,
  favorites,
  onExpandedLayout,
}: DrinkItemProps) {
  const [animValue] = useState(new Animated.Value(isExpanded ? 1 : 0));

  // We'll track how many servings user wants
  const [quantity, setQuantity] = useState(1);

  // For demonstration, subscription usage. Not strictly necessary if you just want to publish.
  const incrementQuantity = () => {
    setQuantity((prev) => (prev < 3 ? prev + 1 : prev));
  };
  const decrementQuantity = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : prev));
  };

  // 1) Animate expand/collapse
  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  // 2) Publish to IoT when user hits “Pour Drink”
  async function handlePourDrink() {
    try {
      const randomCode = Math.floor(1000 + Math.random() * 9000); // some random 4-digit
      await pubsub.publish({
        topics: ['liquorbot/publish'],
        message: { code: randomCode, drinkName: drink.name, quantity },
      });
      console.log(`Published code=${randomCode}, drink="${drink.name}", qty=${quantity}`);
    } catch (err) {
      console.error('Error publishing PubSub message:', err);
    }
  }

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
        {/* Close Button */}
        <TouchableOpacity
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onCollapse();
          }}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color="#DFDCD9" />
        </TouchableOpacity>

        {/* Favorite Button */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(drink.id);
          }}
          style={styles.expandedFavoriteButton}
        >
          <Ionicons
            name={favorites.includes(drink.id) ? 'heart' : 'heart-outline'}
            size={24}
            color={favorites.includes(drink.id) ? '#CE975E' : '#4F4F4F'}
          />
        </TouchableOpacity>

        {/* Drink Information and Image */}
        <View style={styles.expandedContent}>
          <View style={styles.expandedTitleContainer}>
            <Text style={styles.expandedboxText}>{drink.name}</Text>
            <Text style={styles.expandedcategoryText}>{drink.category}</Text>
          </View>
          <Image source={drink.image} style={styles.expandedImage} />
        </View>

        <View style={styles.expandeddetailContainer}>
          <Text style={styles.expandeddescriptionText}>{drink.description}</Text>
        </View>

        {/* Quantity */}
        <View style={styles.quantityContainer}>
          <TouchableOpacity onPress={decrementQuantity} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity onPress={incrementQuantity} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Pour Drink Button */}
        <TouchableOpacity style={styles.button} onPress={handlePourDrink}>
          <Text style={styles.buttonText}>Pour Drink</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  } else {
    // Collapsed card
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
        {/* Favorite Button */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(drink.id);
          }}
          style={styles.favoriteButton}
        >
          <Ionicons
            name={favorites.includes(drink.id) ? 'heart' : 'heart-outline'}
            size={24}
            color={favorites.includes(drink.id) ? '#CE975E' : '#4F4F4F'}
          />
        </TouchableOpacity>
        {/* Drink Image */}
        <Image source={drink.image} style={styles.image} />
        {/* Drink Info */}
        <Text style={styles.boxText}>{drink.name}</Text>
        <Text style={styles.categoryText}>{drink.category}</Text>
      </TouchableOpacity>
    );
  }
}

export default function MenuScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [expandedDrink, setExpandedDrink] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  // --- ADDED FROM OLD CODE ---
  const [latestMessage, setLatestMessage] = useState('');
  useEffect(() => {
    // On mount, log the Identity ID (just to confirm we’re authenticated).
    (async () => {
      try {
        const info = await fetchAuthSession();
        console.log('Cognito Identity ID:', info.identityId);
      } catch (error) {
        console.error('Error fetching Cognito Identity ID:', error);
      }
    })();

    // Subscribe to messages from IoT
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
  // --- END ADDED ---

  async function toggleFavorite(drinkId: number) {
    // 1) Immediately update local UI
    setFavorites((prev) =>
      prev.includes(drinkId)
        ? prev.filter((favId) => favId !== drinkId)
        : [...prev, drinkId]
    );
  
    try {
      // 2) Get the current user’s sub (unique ID)
      const user = await (Auth as any).currentAuthenticatedUser();
      const userSub = user.attributes.sub; // or user?.username if you prefer, but sub is more reliable
  
      // 3) Check if a Favorite already exists for this user & drink
      // We'll treat the drinkId as a string in the DB to match the Favorite schema's `drinkID: ID!`
      const existing = await (API as any).graphql(
        graphqlOperation(listFavorites, {
          filter: {
            userSub: { eq: userSub },
            drinkID: { eq: String(drinkId) },
          },
        })
      );
  
      // 4) If exists, delete; otherwise create a new Favorite
      const items = existing?.data?.listFavorites?.items || [];
      if (items.length > 0) {
        // There's already one -> delete it
        const favoriteId = items[0].id; // the ID of the Favorite object
        await (API as any).graphql(
          graphqlOperation(deleteFavorite, {
            input: { id: favoriteId },
          })
        );
      } else {
        // Need to create it
        await (API as any).graphql(
          graphqlOperation(createFavorite, {
            input: {
              userSub,
              drinkID: String(drinkId),
            },
          })
        );
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // OPTIONAL: if you want to roll back local state upon error:
      // setFavorites(prev => prev.includes(drinkId) ? prev.filter(i => i !== drinkId) : [...prev, drinkId]);
    }
  }

  const filteredDrinks =
    selectedCategory === 'All'
      ? drinks
      : drinks.filter((drink) => drink.category === selectedCategory);

  // If the expanded drink is in an odd index, shift it to appear on the left column
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

  return (
    <View style={styles.container}>
      <TopView title="Menu" noBorderRadius />
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
              favorites={favorites}
              onExpandedLayout={handleExpandedLayout}
            />
          ))}
        </View>
      </ScrollView>

      {/* OPTIONAL: Show the latest IoT message at bottom */}
      {latestMessage ? (
        <View style={{ padding: 10, backgroundColor: '#333' }}>
          <Text style={{ color: '#fff' }}>Latest IoT Message: {latestMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  horizontalPickerContainer: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  horizontalPicker: {
    flexDirection: 'row',
    marginTop: 10,
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
    fontFamily: 'AzoMonoTest',
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
    fontFamily: 'AzoMonoTest',
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  expandeddescriptionText: {
    color: '#4F4F4F',
    fontSize: 14,
    fontFamily: 'AzoMonoTest',
    textAlign: 'left',
    alignSelf: 'flex-start',
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
    marginTop: 50,
    marginRight: 10,
  },
  boxText: {
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
    paddingLeft: 10,
    marginBottom: 0,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: '#CE975E',
    fontSize: 14,
    fontFamily: 'AzoMonoTest',
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
    fontFamily: 'AzoMonoTest',
  },
  quantityText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'AzoMonoTest',
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
    fontFamily: 'AzoMonoTest',
  },
});
