// -----------------------------------------------------------------------------
// LikedDrinksPopup – shows (and lets you remove) every drink you’ve liked
// -----------------------------------------------------------------------------
//  ✅ One fetch per screen-focus → no more race conditions
//  ✅ Paginated pull of *all* liked CustomRecipe items
//  ✅ Request-sequence guard – stale responses are ignored
//  ✅ Deletes refresh the list, never “bounce back”
// -----------------------------------------------------------------------------

import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Amplify } from 'aws-amplify';
import config from '../../../src/amplifyconfiguration.json';

import { generateClient } from 'aws-amplify/api';
import { listLikedDrinks, listCustomRecipes } from '../../../src/graphql/queries';
import { deleteLikedDrink } from '../../../src/graphql/mutations';
import { getCurrentUser } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import { useFocusEffect } from '@react-navigation/native';

Amplify.configure(config);
const client = generateClient();

/* ─────────────────────────── TYPES ─────────────────────────── */
export type Drink = {
  id: number;
  name: string;
  category: string;
  image: string;
  ingredients: string;
  description?: string;
};

type Props = { drinks?: Drink[] };

/* ─────────────────────────── HELPERS ─────────────────────────── */
const toNumericId = (uuid: string) => 2_000_000 + parseInt(uuid.slice(-6), 36);

/** Pull *only* the CustomRecipe docs that match my liked IDs (handles pagination). */
async function fetchLikedCustomRecipes(likedCustomIds: number[]): Promise<Drink[]> {
  if (!likedCustomIds.length) return [];

  const placeholder =
    'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';
  const found: Drink[] = [];
  let nextToken: string | null = null;

  do {
    const { data } = (await client.graphql({
      query: listCustomRecipes,
      variables: { limit: 1000, nextToken },
      authMode: 'apiKey',
    })) as { data: any };

    nextToken = data.listCustomRecipes.nextToken ?? null;

    const pageMatches = data.listCustomRecipes.items.filter((item: any) =>
      likedCustomIds.includes(toNumericId(item.id))
    );

    const mapped = await Promise.all(
      pageMatches.map(async (item: any): Promise<Drink> => {
        const ingStr = Array.isArray(item.ingredients)
          ? item.ingredients
              .map(
                (ri: any) =>
                  `${ri.ingredientID}:${ri.amount}:${ri.priority ?? 1}`
              )
              .join(',')
          : '';

        let imageUrl = placeholder;
        if (item.image) {
          try {
            imageUrl = (await getUrl({ key: item.image })).url.toString();
          } catch {
            /* ignore */
          }
        }

        return {
          id: toNumericId(item.id),
          name: item.name,
          category: 'Custom',
          description: item.description ?? '',
          image: imageUrl,
          ingredients: ingStr,
        };
      })
    );

    found.push(...mapped);
  } while (nextToken && found.length < likedCustomIds.length);

  return found;
}

/* ─────────────────────────── COMPONENT ─────────────────────────── */
export default function LikedDrinksPopup({ drinks: external = [] }: Props) {
  const [drinks, setDrinks] = useState<Drink[]>(external);
  const [loading, setLoading] = useState(external.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** increments every time we fire a fetch; lets us ignore stale responses */
  const reqSeq = useRef(0);

  /* ---------- main fetch ---------- */
  const fetchLikedDrinks = useCallback(async () => {
    const mySeq = ++reqSeq.current;
    setLoading(true);
    setError(null);

    try {
      const user = await getCurrentUser();
      if (!user) {
        if (mySeq === reqSeq.current) setDrinks([]);
        return;
      }

      /* 1️⃣ which drink IDs has the user liked? */
      const likedRes = await client.graphql({
        query: listLikedDrinks,
        variables: {
          filter: { userID: { eq: user.username } },
          limit: 1000,
        },
        authMode: 'userPool',
      });
      const likedIds: number[] =
        likedRes.data?.listLikedDrinks?.items?.map((i: any) => i.drinkID) ?? [];

      if (likedIds.length === 0) {
        if (mySeq === reqSeq.current) setDrinks([]);
        return;
      }

      /* 2️⃣ stock drinks */
      const stockUrl = await getUrl({ key: 'drinkMenu/drinks.json' });
      const stock: Drink[] = await (await fetch(stockUrl.url)).json();

      /* 3️⃣ custom drinks that I liked */
      const likedCustomIds = likedIds.filter((id) => id >= 2_000_000);
      const custom = await fetchLikedCustomRecipes(likedCustomIds);

      /* 4️⃣ merge → keep liked only */
      const catalogue = [...stock, ...custom];
      const liked = catalogue.filter((d) => likedIds.includes(d.id));

      if (mySeq === reqSeq.current) setDrinks(liked);

      /* 5️⃣ clean orphan likes */
      const orphanIds = likedIds.filter((id) => !liked.some((d) => d.id === id));
      if (orphanIds.length) {
        for (const oid of orphanIds) {
          try {
            const res = await client.graphql({
              query: listLikedDrinks,
              variables: {
                filter: {
                  userID: { eq: user.username },
                  drinkID: { eq: oid },
                },
                limit: 1000,
              },
              authMode: 'userPool',
            });
            const rec = res.data?.listLikedDrinks?.items?.[0];
            if (rec) {
              await client.graphql({
                query: deleteLikedDrink,
                variables: { input: { id: rec.id } },
                authMode: 'userPool',
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.error(e);
      if (mySeq === reqSeq.current) setError('Couldn’t load liked drinks.');
    } finally {
      if (mySeq === reqSeq.current) setLoading(false);
    }
  }, []);

  /* ---------- refetch whenever this screen gains focus ---------- */
  useFocusEffect(
    useCallback(() => {
      if (external.length > 0) return;
      fetchLikedDrinks();
    }, [external, fetchLikedDrinks])
  );

  /* ---------- remove-like handler ---------- */
  async function removeLiked(drinkId: number) {
    setRemovingId(drinkId);
    try {
      const user = await getCurrentUser();
      const res = await client.graphql({
        query: listLikedDrinks,
        variables: {
          filter: { userID: { eq: user.username }, drinkID: { eq: drinkId } },
          limit: 1000,
        },
        authMode: 'userPool',
      });
      const rec = res.data?.listLikedDrinks?.items?.[0];
      if (rec) {
        await client.graphql({
          query: deleteLikedDrink,
          variables: { input: { id: rec.id } },
          authMode: 'userPool',
        });
        /* pull fresh list so state stays authoritative */
        await fetchLikedDrinks();
      }
    } catch (e) {
      console.error('Failed to remove like', e);
    } finally {
      setRemovingId(null);
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLikedDrinks();
    setRefreshing(false);
  }, [fetchLikedDrinks]);

  /* ─────────────────────────── RENDER ─────────────────────────── */
  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#CE975E" />
      </View>
    );
  }

  if (error) return <Text style={styles.emptyText}>{error}</Text>;

  if (drinks.length === 0)
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flex: 1, alignItems: 'center', padding: 20,marginTop: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#CE975E"]}
          />
        }
      >
        <Ionicons
          name="heart-outline"
          size={48}
          color="#CE975E"
          style={{ marginTop: 30 }}
        />
        <Text style={styles.emptyText}>You haven’t liked any drinks yet.</Text>
        <Text style={styles.emptySubText}>
          Explore the menu and tap the heart icon on your favorite drinks. They’ll
          show up here!
        </Text>
      </ScrollView>
    );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 70 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={["#CE975E"]}
        />
      }
    >
      {drinks.map((d) => (
        <View key={d.id} style={styles.item}>
          <Image source={{ uri: d.image }} style={styles.img} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.name}>{d.name}</Text>
            <Text style={styles.cat}>{d.category}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name="heart"
              size={24}
              color="#CE975E"
              style={{ marginRight: 6 }}
            />
            {removingId === d.id ? (
              <ActivityIndicator
                size="small"
                color="#8A8A8A"
                style={{ width: 22, height: 22 }}
              />
            ) : (
              <Ionicons
                name="close"
                size={22}
                color="#8A8A8A"
                onPress={() => removeLiked(d.id)}
              />
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────────────────────────── styles ─────────────────────────── */
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', marginTop: 80 },
  emptyText: {
    color: '#DFDCD9',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 30,
  },
  emptySubText: {
    color: '#B0AFAE',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 260,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
  },
  img: { width: 60, height: 60, borderRadius: 8 },
  name: { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
  cat: { color: '#CE975E', fontSize: 14 },
});
