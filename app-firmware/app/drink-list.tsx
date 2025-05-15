// -----------------------------------------------------------------------------
// File: custom-drink-list.tsx
// Description: Shows the signed‑in user’s CustomRecipe drinks and lets them
//              create new ones, edit existing recipes, or delete them.
// Author: Nathan Hambleton
// Created: May 15 2025
// -----------------------------------------------------------------------------

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  UIManager,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import { getUrl } from 'aws-amplify/storage';
import config from '../src/amplifyconfiguration.json';

import { deleteCustomRecipe } from '../src/graphql/mutations';

Amplify.configure(config);
const client = generateClient();

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const LIST_CUSTOM_RECIPES = /* GraphQL */ `
  query ListCustomRecipes {
    listCustomRecipes {
      items {
        id
        name
        description
        image
        ingredients {
          ingredientID
          amount
          priority
        }
        createdAt
      }
    }
  }
`;

/* ──────────────────────────────── TYPES ──────────────────────────────── */
type CustomDrink = {
  id: string;          // GraphQL id
  name: string;
  description?: string;
  imageKey?: string | null;
  image: string;       // resolved URL
  ingredients: string; // “id:amt:prio,…”
};

/* ──────────────────────────────── SCREEN ─────────────────────────────── */
export default function CustomDrinkListScreen() {
  const router              = useRouter();
  const isFocused           = useIsFocused();
  const scrollRef           = useRef<ScrollView>(null);
  const [drinks, setDrinks] = useState<CustomDrink[]>([]);
  const [loading, setLoading] = useState(true);

  const placeholderURL =
    'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';

  /* ------------ fetch on mount & refocus ------------ */
  async function fetchCustomDrinks() {
    setLoading(true);
    try {
      const res: any = await client.graphql({
        query: LIST_CUSTOM_RECIPES,
        authMode: 'userPool',   // owner‑based auth → just this user’s items
      });

      const items: any[] =
        (res.data?.listCustomRecipes?.items as any[]) ?? [];

      const resolved: CustomDrink[] = await Promise.all(
        items.map(async (item) => {
          let imageURL = placeholderURL;
          if (item.image) {
            try {
              const { url } = await getUrl({ key: item.image });
              imageURL = url.toString();
            } catch {}
          }

          const ingredientsStr = Array.isArray(item.ingredients)
            ? item.ingredients
                .map(
                  (ri: any) =>
                    `${Number(ri.ingredientID)}:${Number(ri.amount)}:${Number(
                      ri.priority ?? 1,
                    )}`,
                )
                .join(',')
            : '';

          return {
            id: item.id,
            name: item.name ?? 'Untitled',
            description: item.description ?? '',
            imageKey: item.image ?? null,
            image: imageURL,
            ingredients: ingredientsStr,
          };
        }),
      );

      setDrinks(resolved);
    } catch (e) {
      console.error('Custom drink load error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCustomDrinks(); }, []);
  useEffect(() => { isFocused && fetchCustomDrinks(); }, [isFocused]);

  /* ----------------------- DELETE HELPER ---------------------- */
  async function handleDelete(drink: CustomDrink) {
    Alert.alert(
      'Delete Drink',
      `Delete “${drink.name}” permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.graphql({
                query: deleteCustomRecipe,
                variables: { input: { id: drink.id } },
                authMode: 'userPool',
              });
              setDrinks((prev) => prev.filter((d) => d.id !== drink.id));
            } catch (e) {
              console.error('Delete failed', e);
              Alert.alert('Delete failed – see console.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  }

  /* ────────────────────────── RENDER ITEM ───────────────────────── */
  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

  function DrinkCard({ drink }: { drink: CustomDrink }) {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

    return (
      <AnimatedTouchable
        activeOpacity={0.9}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() =>
          router.push({
            pathname: '/create-drink',
            params: {
              edit: '1',
              recipeId: drink.id,
              name: drink.name,
              desc: drink.description ?? '',
              ingredients: drink.ingredients,
              imageKey: drink.imageKey ?? '',
            },
          })
        }
        style={[styles.card, { transform: [{ scale }] }]}
      >
        {/* delete button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(drink)}
        >
          <Ionicons name="trash" size={22} color="#d44a4a" />
        </TouchableOpacity>

        {/* edit button */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() =>
            router.push({
              pathname: '/create-drink',
              params: {
                edit: '1',
                recipeId: drink.id,
                name: drink.name,
                desc: drink.description ?? '',
                ingredients: drink.ingredients,
                imageKey: drink.imageKey ?? '',
              },
            })
          }
        >
          <Ionicons name="create-outline" size={22} color="#CE975E" />
        </TouchableOpacity>

        <Image
          source={{ uri: drink.image }}
          style={styles.cardImage}
          resizeMode="contain"
        />
        <Text style={styles.cardTitle}>{drink.name}</Text>
      </AnimatedTouchable>
    );
  }

  /* ────────────────────────────── UI ──────────────────────────── */
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#CE975E" />
        <Text style={styles.loadingText}>Loading your drinks…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={30} color="#DFDCD9" />
        </TouchableOpacity>

        <Text style={styles.headerText}>My Drinks</Text>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/create-drink')}
        >
          <Ionicons name="add" size={32} color="#CE975E" />
        </TouchableOpacity>
      </View>

      {/* GRID */}
      {drinks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            You haven’t created any drinks yet.{'\n'}Tap the “+” to make one!
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.grid}>
            {drinks.map((d) => (
              <DrinkCard key={d.id} drink={d} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/* ──────────────────────────── STYLES ─────────────────────────── */
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 60) / 2; // 20 px padding + 20 gap

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },

  /* ---------------- header ---------------- */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 28,
    color: '#DFDCD9',
    fontWeight: 'bold',
  },
  backBtn: { padding: 5 },
  addBtn: { padding: 5 },

  /* ---------------- grid ---------------- */
  scrollContainer: { flexGrow: 1, padding: 20, paddingTop: 10 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  /* card */
  card: {
    width: CARD_W,
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    marginBottom: 25,
    alignItems: 'center',
    paddingVertical: 10,
    overflow: 'visible',
  },
  cardImage: {
    width: '80%',
    height: 150,
  },
  cardTitle: {
    color: '#DFDCD9',
    fontSize: 16,
    marginBottom: 10,
    paddingHorizontal: 5,
    textAlign: 'center',
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    padding: 4,
  },
  editBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    padding: 4,
  },

  /* loaders / empty */
  loadingScreen: {
    flex: 1,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#DFDCD9', marginTop: 10 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#4F4F4F',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
