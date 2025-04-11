import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

// 1) Import the LiquorBot hook
import { useLiquorBot } from './components/liquorbot-provider';

// 2) Import getUrl for fetching from S3
import { getUrl } from 'aws-amplify/storage';

interface Ingredient {
  id: number;
  name: string;
  type: 'Alcohol' | 'Mixer' | 'Sour' | 'Sweet' | 'Misc';
  description: string;
}

export default function DeviceSettings() {
  const router = useRouter();
  const { isConnected } = useLiquorBot();

  const [slots, setSlots] = useState(Array(15).fill('')); // 15 slots
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // We'll store the fetched ingredients here
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch the S3 JSON once, just like in menu.tsx
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ingUrl = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const response = await fetch(ingUrl.url);
        const data = await response.json();

        // Sort them by name if desired
        data.sort((a: Ingredient, b: Ingredient) =>
          a.name.localeCompare(b.name)
        );

        setIngredients(data);
      } catch (error) {
        console.error('Error fetching ingredients from S3:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // The categories we want
  const categories = ['All', 'Alcohol', 'Mixer', 'Sour', 'Sweet', 'Misc'];

  // Filter logic: if "All", show everything; otherwise match item.type
  const filteredIngredients = ingredients
    .filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((item) => {
      if (selectedCategory === 'All') return true;
      return item.type === selectedCategory;
    });

  // When a user selects an ingredient, update that slot
  const handleSlotChange = (value: string, index: number) => {
    const updatedSlots = [...slots];
    updatedSlots[index] = value;
    setSlots(updatedSlots);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.push('/')}
        >
          <Ionicons name="close" size={30} color="#DFDCD9" />
        </TouchableOpacity>

        <Text style={styles.headerText}>Device Settings</Text>

        <View style={styles.connectionBox}>
          <Ionicons
            name="bluetooth-outline"
            size={24}
            color="#DFDCD9"
            style={styles.bluetoothIcon}
          />
          <Text style={styles.liquorBotText}>LiquorBot #001</Text>

          <View style={styles.connectionStatusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? '#63d44a' : '#d44a4a' },
              ]}
            />
            <Text style={styles.connectionStatusText}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>

        <View style={styles.slotsContainer}>
          <Text style={styles.slotsHeader}>Configure Slots</Text>
          {slots.map((slot, index) => (
            <View key={index} style={styles.slotBox}>
              <Text style={styles.slotLabel}>Slot {index + 1}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  setSelectedSlot(index);
                  setModalVisible(true);
                }}
              >
                <Text style={styles.pickerButtonText}>
                  {slot || 'Select Ingredient'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Full-Screen Modal for Ingredient Selection */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        // iOS-specific style that allows for swipe-down on iOS 13+
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Horizontal category selector */}
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
                        selectedCategory === category &&
                          styles.selectedCategoryText,
                      ]}
                    >
                      {category}
                    </Text>
                    {selectedCategory === category && (
                      <View style={styles.underline} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#4F4F4F"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchBar}
              placeholder="Search Ingredients"
              placeholderTextColor="#4F4F4F"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Ingredient list */}
          {loading ? (
            <Text style={{ color: '#DFDCD9', textAlign: 'center', margin: 10 }}>
              Loading ingredients...
            </Text>
          ) : (
            <FlatList
              data={filteredIngredients}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.ingredientItem}
                  onPress={() => {
                    if (selectedSlot !== null) {
                      handleSlotChange(item.name, selectedSlot);
                    }
                    setModalVisible(false);
                    setSearchQuery('');
                  }}
                >
                  <Text style={styles.ingredientText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  closeButton: {
    position: 'absolute',
    top: 80,
    left: 25,
  },
  headerText: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContainer: {
    paddingTop: 150,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  connectionBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  liquorBotText: {
    fontSize: 24,
    color: '#DFDCD9',
    fontWeight: 'bold',
    textAlign: 'left',
    width: '100%',
  },
  connectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
    marginTop: 5,
  },
  connectionStatusText: {
    fontSize: 14,
    color: '#4F4F4F',
    textAlign: 'left',
    width: '100%',
    marginTop: 5,
  },
  bluetoothIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  slotsContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
  },
  slotsHeader: {
    color: '#DFDCD9',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  slotBox: {
    marginBottom: 15,
  },
  slotLabel: {
    color: '#DFDCD9',
    fontSize: 16,
    marginBottom: 5,
  },
  pickerButton: {
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  pickerButtonText: {
    color: '#DFDCD9',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 20,
  },
  horizontalPickerContainer: {
    alignItems: 'center',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 5,
  },
  horizontalPicker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginHorizontal: 15,
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
    fontSize: 14,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    marginTop: 10,
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
  ingredientItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  ingredientText: {
    color: '#DFDCD9',
    fontSize: 16,
  },
});
