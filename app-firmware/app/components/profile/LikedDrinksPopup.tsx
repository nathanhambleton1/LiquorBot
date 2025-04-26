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

  /* ───────── auto-fetch when nothing supplied ───────── */
  useEffect(() => {
    if (external.length > 0) return;    // parent already provided the list

    (async () => {
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

        /* 3️⃣ pull this user’s CustomRecipe items */
        const customRes = await client.graphql({
          query: listCustomRecipes,
          authMode: 'userPool',          // owner-based auth → only their recipes
        });

        const placeholder =
          'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';

        const custom: Drink[] = await Promise.all(
          (customRes.data?.listCustomRecipes?.items ?? []).map(
            async (item: any, idx: number): Promise<Drink> => {
              const numericId = 1_000_000 + idx;   // ✨ same mapping used in menu.tsx

              const ingStr = Array.isArray(item.ingredients)
                ? item.ingredients
                    .map(
                      (ri: any) =>
                        `${Number(ri.ingredientID)}:${Number(ri.amount)}:${Number(
                          ri.priority ?? 1,
                        )}`,
                    )
                    .join(',')
                : '';

              let imageUrl = placeholder;
              if (item.image) {
                try {
                  const { url } = await getUrl({ key: item.image });
                  imageUrl = url.toString();
                } catch {}
              }

              return {
                id: numericId,
                name: item.name ?? `Custom #${idx + 1}`,
                category: 'Custom',
                description: item.description ?? '',
                image: imageUrl,
                ingredients: ingStr,
              };
            },
          ),
        );

        /* 4️⃣ merge → pick only the liked ones */
        const catalogue  = [...stock, ...custom];
        const liked      = catalogue.filter(d => likedIds.includes(d.id));

        setDrinks(liked);
      } catch (e: any) {
        console.error(e);
        setError('Couldn’t load liked drinks.');
      } finally {
        setLoading(false);
      }
    })();
  }, [external]);

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
          <Ionicons name="heart" size={24} color="#CE975E" style={{ marginRight: 10 }} />
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