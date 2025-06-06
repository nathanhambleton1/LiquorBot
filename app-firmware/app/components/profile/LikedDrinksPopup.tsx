// ---------------------------------------------------------------------------
// LikedDrinksPopup – shows list of liked drinks
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Amplify } from 'aws-amplify';
import config from '../../../src/amplifyconfiguration.json';

import { generateClient } from 'aws-amplify/api';
import { listLikedDrinks, listCustomRecipes } from '../../../src/graphql/queries';
import { getCurrentUser } from 'aws-amplify/auth';
import { getUrl } from 'aws-amplify/storage';
import { deleteLikedDrink } from '../../../src/graphql/mutations';
import { useFocusEffect } from '@react-navigation/native';

export type Drink = {
  id: number;
  name: string;
  category: string;
  image: string;
  ingredients: string;
  description?: string; // Added description property
};

Amplify.configure(config);
const client = generateClient();

/* ──────────────────────────── TYPES ──────────────────────────── */
type Props = {
  /** Optionally pre-resolved drink objects from the parent.
      If none supplied (or empty) the component will fetch everything itself. */
  drinks?: Drink[];
};

/* ──────────────────────────── HELPERS ──────────────────────────── */
// Converts a UUID to a numeric ID for CustomRecipe items
const toNumericId = (uuid: string) =>
  2_000_000 + parseInt(uuid.slice(-6), 36);

/* ---------------------------------------------------------------------------
   This version is fully backward-compatible:
   • If the parent still passes <LikedDrinksPopup drinks={…}/> we render that.
   • Otherwise we pull the user’s liked-drink IDs, merge the stock JSON catalogue
     with the user’s CustomRecipe items, and build our own list.
--------------------------------------------------------------------------- */
export default function LikedDrinksPopup({ drinks: external = [] }: Props) {
  const [drinks,   setDrinks]   = useState<Drink[]>(external);
  const [loading,  setLoading]  = useState(external.length === 0);
  const [error,    setError]    = useState<string | null>(null);

  // Refetch logic extracted for reuse
  const fetchLikedDrinks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user  = await getCurrentUser();
      if (!user)  { setDrinks([]); setLoading(false); return; }

      /* 1️⃣ which drink IDs has the user liked? */
      const likedRes = await client.graphql({
        query: listLikedDrinks,
        variables: { filter: { userID: { eq: user.username } } },
        authMode: 'userPool',
      });
      const likedIds: number[] =
        likedRes.data?.listLikedDrinks?.items?.map((i: any) => i.drinkID) ?? [];

      if (likedIds.length === 0) { setDrinks([]); setLoading(false); return; }

      /* 2️⃣ grab the stock menu JSON */
      const stockUrl  = await getUrl({ key: 'drinkMenu/drinks.json' });
      const stock: Drink[] = await (await fetch(stockUrl.url)).json();

      /* 3️⃣ pull *all* CustomRecipes that correspond to my liked IDs */
      const likedCustomIds = likedIds.filter(id => id >= 2_000_000);
      let custom: Drink[] = [];
      if (likedCustomIds.length) {
        const { data } = await client.graphql({
          query: listCustomRecipes,
          variables: { limit: 1000 },
          authMode : 'apiKey',
        }) as { data: any };
        const placeholder =
          'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';
        custom = await Promise.all(
          (data.listCustomRecipes.items as any[])
            .filter((item: any) => likedCustomIds.includes(toNumericId(item.id)))
            .map(async (item: any): Promise<Drink> => {
              const ingStr = Array.isArray(item.ingredients)
                ? item.ingredients
                    .map((ri: any) =>
                      `${ri.ingredientID}:${ri.amount}:${ri.priority ?? 1}`,
                    )
                    .join(',')
                : '';
              let imageUrl = placeholder;
              if (item.image) {
                try { imageUrl = (await getUrl({ key: item.image })).url.toString(); }
                catch {}
              }
              return {
                id         : toNumericId(item.id),
                name       : item.name,
                category   : 'Custom',
                description: item.description ?? '',
                image      : imageUrl,
                ingredients: ingStr,
              };
            }),
        );
      }

      /* 4️⃣ merge → pick only the liked ones */
      const catalogue  = [...stock, ...custom];
      const liked      = catalogue.filter(d => likedIds.includes(d.id));
      setDrinks(liked);

      /* 5️⃣ clean up likes that no longer exist */
      const orphanIds = likedIds.filter(id => !liked.some(d => d.id === id));
      for (const oid of orphanIds) {
        try {
          const res = await client.graphql({
            query: listLikedDrinks,
            variables: { filter: { userID: { eq: user.username }, drinkID: { eq: oid } } },
            authMode: 'userPool',
          });
          const rec = res.data?.listLikedDrinks?.items?.[0];
          rec && await client.graphql({
            query: deleteLikedDrink,
            variables: { input: { id: rec.id } },
            authMode: 'userPool',
          });
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      console.error(e);
      setError('Couldn’t load liked drinks.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Use effect for initial load (if not provided by parent)
  useEffect(() => {
    if (external.length > 0) return;
    fetchLikedDrinks();
  }, [external, fetchLikedDrinks]);

  // Refetch on page focus
  useFocusEffect(
    React.useCallback(() => {
      if (external.length > 0) return;
      fetchLikedDrinks();
    }, [external, fetchLikedDrinks])
  );

  async function removeLiked(drinkId: number) {
    try {
      const user = await getCurrentUser();
      const res  = await client.graphql({
        query: listLikedDrinks,
        variables: { filter: { userID: { eq: user.username }, drinkID: { eq: drinkId } } },
        authMode: 'userPool',
      });
      const rec = res.data?.listLikedDrinks?.items?.[0];
      if (rec) {
        await client.graphql({
          query: deleteLikedDrink,
          variables: { input: { id: rec.id } },
          authMode: 'userPool',
        });
        setDrinks(prev => prev.filter(d => d.id !== drinkId));
      }
    } catch (e) {
      console.error('Failed to remove like', e);
    }
  }

  /* ─────────────────────────── RENDER ─────────────────────────── */
  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#CE975E" />
      </View>
    );

  if (error)
    return <Text style={styles.emptyText}>{error}</Text>;

  if (drinks.length === 0)
    return <Text style={styles.emptyText}>You haven’t liked any drinks yet.</Text>;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 70 }}>
      {drinks.map((d) => (
        <View key={d.id} style={styles.item}>
          <Image source={{ uri: d.image }} style={styles.img} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.name}>{d.name}</Text>
            <Text style={styles.cat}>{d.category}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="heart" size={24} color="#CE975E" style={{ marginRight: 6 }} />
            <Ionicons
              name="close"
              size={22}
              color="#8A8A8A"
              onPress={() => removeLiked(d.id)}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────────────────────────── styles ─────────────────────────── */
const styles = StyleSheet.create({
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText:  { color: '#DFDCD9', fontSize: 16, textAlign: 'center', marginTop: 30 },
  item:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F',
                borderRadius: 10, marginBottom: 10, padding: 10 },
  img:        { width: 60, height: 60, borderRadius: 8 },
  name:       { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
  cat:        { color: '#CE975E', fontSize: 14 },
});