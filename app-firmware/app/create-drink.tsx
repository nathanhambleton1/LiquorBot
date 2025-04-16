// -----------------------------------------------------------------------------
// File: create-drink.tsx
// Description: Custom‑drink creator with dynamic ingredient rows, delete buttons,
//              per‑ingredient volume controls, and smart name‑collision hinting
//              against drinks.json already stored on S3.
// Author: Nathan Hambleton
// Updated: April 16 2025
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { Amplify } from 'aws-amplify';
import { getUrl } from 'aws-amplify/storage';
import config from '../src/amplifyconfiguration.json';

Amplify.configure(config);

// ---------- TYPES ----------
interface Ingredient {
  id: number;
  name: string;
  type: 'Alcohol' | 'Mixer' | 'Sour' | 'Sweet' | 'Misc';
  description: string;
}

interface RecipeRow {
  id: number;
  volume: number; // oz
}

interface DrinkMeta {
  id: number;
  name: string;
}

// ---------- MAIN ----------
export default function CreateDrinkScreen() {
  const router = useRouter();

  // Drink name
  const [drinkName, setDrinkName] = useState('');

  // Existing drinks from drinks.json
  const [allDrinks, setAllDrinks] = useState<DrinkMeta[]>([]);
  const [loadingDrinks, setLoadingDrinks] = useState(true);

  // Ingredient catalogue
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  // Form rows
  const [rows, setRows] = useState<RecipeRow[]>([{ id: 0, volume: 1.5 }]);

  // Picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = ['All', 'Alcohol', 'Mixer', 'Sour', 'Sweet', 'Misc'];

  // ---------- FETCH DATA ----------
  useEffect(() => {
    // Ingredients first
    (async () => {
      setLoadingIngredients(true);
      try {
        const { url } = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const list: Ingredient[] = await (await fetch(url)).json();
        list.sort((a, b) => a.name.localeCompare(b.name));
        setIngredients(list);
      } catch (err) {
        console.error('Error loading ingredients:', err);
      } finally {
        setLoadingIngredients(false);
      }
    })();

    // Drinks meta (name check)
    (async () => {
      setLoadingDrinks(true);
      try {
        const { url } = await getUrl({ key: 'drinkMenu/drinks.json' });
        const list: DrinkMeta[] = await (await fetch(url)).json();
        setAllDrinks(list);
      } catch (err) {
        console.error('Error loading drinks list:', err);
      } finally {
        setLoadingDrinks(false);
      }
    })();
  }, []);

  // ---------- NAME‑CONFLICT CHECK ----------
  const matchingDrink = useMemo(() => {
    if (drinkName.trim() === '') return null;
    const lc = drinkName.trim().toLowerCase();
    return allDrinks.find((d) => d.name.toLowerCase() === lc) ?? null;
  }, [drinkName, allDrinks]);

  // ---------- HELPERS ----------
  const ingName = (id: number) =>
    id ? ingredients.find((i) => i.id === id)?.name ?? '' : '';

  const filteredIngredients = ingredients
    .filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((i) => selectedCategory === 'All' || i.type === selectedCategory);

  // ---------- ROW ACTIONS ----------
  const openPicker = (idx: number) => {
    setEditingIndex(idx);
    setPickerVisible(true);
  };

  const assignIngredient = (ingredientId: number) => {
    if (editingIndex === null) return;
    const next = [...rows];
    next[editingIndex].id = ingredientId;
    if (editingIndex === rows.length - 1) next.push({ id: 0, volume: 1.5 });
    setRows(next);
    setPickerVisible(false);
    setSearchQuery('');
  };

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next.length ? next : [{ id: 0, volume: 1.5 }]);
  };

  const adjustVol = (idx: number, delta: number) =>
    setRows((p) =>
      p.map((r, i) =>
        i === idx
          ? { ...r, volume: Math.max(0, Number((r.volume + delta).toFixed(2))) }
          : r,
      ),
    );

  const setVolDirect = (idx: number, txt: string) => {
    const num = parseFloat(txt);
    if (!isNaN(num)) {
      setRows((p) => p.map((r, i) => (i === idx ? { ...r, volume: num } : r)));
    }
  };

  // ---------- SAVE ----------
  const handleSave = () => {
    const final = rows.filter((r) => r.id !== 0);
    console.log('Drink Created:', { drinkName, ingredients: final });
    router.back();
  };

  // ---------- UI ----------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Close */}
      <TouchableOpacity style={styles.closeButton} onPress={() => router.push('/menu')}>
        <Ionicons name="close" size={30} color="#DFDCD9" />
      </TouchableOpacity>

      <Text style={styles.headerText}>Custom Drink</Text>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* DRINK NAME */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Drink Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Vodka Cranberry"
            placeholderTextColor="#4F4F4F"
            value={drinkName}
            onChangeText={setDrinkName}
          />
          {matchingDrink && (
            <Text style={styles.nameHint}>
              Heads up — “{matchingDrink.name}” already exists in the menu. Feel
              free to check it out or continue creating your own version.
            </Text>
          )}
        </View>

        {/* INGREDIENT ROWS */}
        <View style={styles.ingredientsSection}>
          <Text style={styles.label}>Ingredients</Text>

          {rows.map((row, idx) => (
            <View key={idx} style={styles.rowContainer}>
              {/* Select box */}
              <View style={styles.ingredientRow}>
                <TouchableOpacity
                  style={styles.ingredientBox}
                  onPress={() => openPicker(idx)}
                >
                  <Text
                    style={[
                      styles.ingredientBoxText,
                      row.id !== 0 && styles.ingredientBoxTextSelected,
                    ]}
                  >
                    {ingName(row.id) || 'Select Ingredient'}
                  </Text>
                  <Ionicons
                    name={row.id === 0 ? 'add' : 'pencil'}
                    size={16}
                    color="#808080"
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
                {/* Delete */}
                <TouchableOpacity onPress={() => removeRow(idx)} style={styles.deleteBtn}>
                  <Ionicons name="close" size={22} color="#d44a4a" />
                </TouchableOpacity>
              </View>

              {/* Volume */}
              <View style={styles.volumeRow}>
                <TouchableOpacity onPress={() => adjustVol(idx, -0.25)} style={styles.volBtn}>
                  <Ionicons name="remove" size={18} color="#DFDCD9" />
                </TouchableOpacity>
                <TextInput
                  style={styles.volumeInput}
                  keyboardType="decimal-pad"
                  value={row.volume.toFixed(2)}
                  onChangeText={(txt) => setVolDirect(idx, txt)}
                  maxLength={5}
                />
                <TouchableOpacity onPress={() => adjustVol(idx, 0.25)} style={styles.volBtn}>
                  <Ionicons name="add" size={18} color="#DFDCD9" />
                </TouchableOpacity>
                <Text style={styles.volumeUnit}>oz</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity onPress={() => setRows((p) => [...p, { id: 0, volume: 1.5 }])}>
            <Text style={styles.addIngredientText}>+ Add another ingredient</Text>
          </TouchableOpacity>
        </View>

        {/* SAVE */}
        <TouchableOpacity
          style={[styles.saveButton, drinkName.trim() === '' && { opacity: 0.4 }]}
          disabled={drinkName.trim() === ''}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save Drink</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* INGREDIENT PICKER MODAL */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent={false}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setPickerVisible(false)}
          >
            <Ionicons name="close" size={30} color="#DFDCD9" />
          </TouchableOpacity>

          <Text style={styles.modalHeaderText}>Select Ingredient</Text>

          {/* Categories */}
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

          {/* Search */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color="#4F4F4F" style={styles.searchIcon} />
            <TextInput
              style={styles.searchBar}
              placeholder="Search Ingredients"
              placeholderTextColor="#4F4F4F"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Ingredient list */}
          {loadingIngredients ? (
            <Text style={styles.loadingText}>Loading ingredients…</Text>
          ) : (
            <FlatList
              data={filteredIngredients}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.ingredientItem}
                  onPress={() => assignIngredient(item.id)}
                >
                  <Text style={styles.ingredientText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 80, paddingHorizontal: 20 },
  closeButton: { position: 'absolute', top: 75, left: 20, zIndex: 999, padding: 10 },
  headerText: { fontSize: 28, color: '#DFDCD9', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  contentContainer: { paddingVertical: 20 },
  formGroup: { marginBottom: 20 },
  label: { color: '#DFDCD9', marginBottom: 5, fontSize: 16 },
  input: { backgroundColor: '#1F1F1F', color: '#DFDCD9', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 },
  nameHint: { color: '#4F4F4F', fontSize: 12, marginTop: 5 },
  // rows
  ingredientsSection: { marginBottom: 30 },
  rowContainer: { marginBottom: 20 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center' },
  ingredientBox: { backgroundColor: '#1F1F1F', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', flex: 1 },
  ingredientBoxText: { color: '#4F4F4F', fontSize: 16, flex: 1 },
  ingredientBoxTextSelected: { color: '#DFDCD9' },
  deleteBtn: { marginLeft: 10, padding: 6 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  volBtn: { backgroundColor: '#1F1F1F', padding: 8, borderRadius: 8 },
  volumeInput: { backgroundColor: '#1F1F1F', marginHorizontal: 10, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, color: '#DFDCD9', fontSize: 16, minWidth: 60, textAlign: 'center' },
  volumeUnit: { color: '#4F4F4F', fontSize: 16, marginLeft: 6, marginTop: 10 },
  addIngredientText: { color: '#4F4F4F', fontSize: 14, marginTop: 5 },
  saveButton: { backgroundColor: '#CE975E', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  // modal
  modalContainer: { flex: 1, backgroundColor: '#141414', padding: 20 },
  modalCloseButton: { position: 'absolute', top: 30, left: 20, zIndex: 10 },
  modalHeaderText: { fontSize: 20, fontWeight: 'bold', color: '#DFDCD9', textAlign: 'center', marginTop: 10, marginBottom: -20 },
  horizontalPickerContainer: { alignItems: 'center', paddingVertical: 5 },
  horizontalPicker: { flexDirection: 'row', alignItems: 'center' },
  categoryButton: { marginTop: 40, paddingVertical: 10, paddingHorizontal: 5, marginHorizontal: 15 },
  categoryButtonContent: { alignItems: 'center' },
  categoryButtonText: { color: '#4F4F4F', fontSize: 14 },
  selectedCategoryText: { color: '#CE975E' },
  underline: { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, marginTop: 10 },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  loadingText: { color: '#DFDCD9', textAlign: 'center', margin: 10 },
  ingredientItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333333' },
  ingredientText: { color: '#DFDCD9', fontSize: 16 },
});
