import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons'; // Import Ionicons for the X icon
import { useRouter } from 'expo-router';

export default function DeviceSettings() {
  const router = useRouter();
  const [slots, setSlots] = useState(Array(15).fill('')); // 15 slots initialized to empty
  const [connected, setConnected] = useState(true); // Connection status
  const [modalVisible, setModalVisible] = useState(false); // Modal visibility
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null); // Track which slot is being edited
  const [searchQuery, setSearchQuery] = useState(''); // Search query for ingredients
  const [selectedCategory, setSelectedCategory] = useState('All'); // Selected category for filtering

  const ingredients = [
    'Vodka',
    'Rum',
    'Tequila',
    'Whiskey',
    'Gin',
    'Triple Sec',
    'Lime Juice',
    'Grenadine',
    'Orange Juice',
    'Cranberry Juice',
    'Soda Water',
    'Tonic Water',
    'Cola',
    'Lemonade',
    'Simple Syrup',
  ].sort(); // Alphabetically sorted ingredient list

  const categories = ['All', 'Liquor', 'Sour', 'Sweet']; // Example categories

  const handleSlotChange = (value: string, index: number) => {
    const updatedSlots = [...slots];
    updatedSlots[index] = value;
    setSlots(updatedSlots);
  };

  const filteredIngredients = ingredients
    .filter((ingredient) =>
      ingredient.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((ingredient) => {
      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Liquor') return ['Vodka', 'Rum', 'Tequila', 'Whiskey', 'Gin', 'Triple Sec'].includes(ingredient);
      if (selectedCategory === 'Sour') return ['Lime Juice'].includes(ingredient);
      if (selectedCategory === 'Sweet') return ['Grenadine', 'Orange Juice', 'Cranberry Juice', 'Simple Syrup', 'Cola', 'Lemonade'].includes(ingredient);
      return false;
    });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* X Icon Button */}
        <TouchableOpacity style={styles.closeButton} onPress={() => router.push('/')}>
          <Ionicons name="close" size={30} color="#DFDCD9" />
        </TouchableOpacity>

        {/* Header Text */}
        <Text style={styles.headerText}>Device Settings</Text>

        {/* Connection Status */}
        <View style={styles.connectionBox}>
          <Ionicons
            name="bluetooth-outline"
            size={24}
            color="#DFDCD9" // Light grey color
            style={styles.bluetoothIcon}
          />
          <Text style={styles.liquorBotText}>LiquorBot #001</Text>
          <View style={styles.connectionStatusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: connected ? '#63d44a' : '#d44a4a' }, // Green for connected, red for disconnected
              ]}
            />
            <Text style={styles.connectionStatusText}>
              {connected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.connectionButton}
            onPress={() => setConnected(!connected)}
          >
            <Text style={styles.connectionButtonText}>
              {connected ? 'Disconnect' : 'Connect Again'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Slots Configuration */}
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
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Categories */}
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
              placeholder="Search Ingredients"
              placeholderTextColor="#4F4F4F"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Ingredient List */}
          <FlatList
            data={filteredIngredients}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.ingredientItem}
                onPress={() => {
                  if (selectedSlot !== null) {
                    handleSlotChange(item, selectedSlot);
                  }
                  setModalVisible(false);
                  setSearchQuery(''); // Reset search query
                }}
              >
                <Text style={styles.ingredientText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414', // Black background
  },
  closeButton: {
    position: 'absolute',
    top: 80, // Adjust top position
    left: 25, // Adjust left position
  },
  headerText: {
    position: 'absolute',
    top: 80, // Adjust top position
    alignSelf: 'center', // Center the text horizontally
    fontSize: 24, // Large font size
    color: '#FFFFFF', // White text color
    fontWeight: 'bold', // Bold text
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
    fontSize: 24, // Larger font size
    color: '#DFDCD9', // White text color
    fontWeight: 'bold',
    textAlign: 'left', // Align to the left
    width: '100%',
  },
  connectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusDot: {
    width: 6, // Smaller width
    height: 6, // Smaller height
    borderRadius: 3, // Adjusted for smaller size
    marginRight: 5, // Reduced margin
    marginTop: 5, // Reduced margin
  },
  connectionStatusText: {
    fontSize: 14, // Smaller font size
    color: '#4F4F4F', // Darker text color
    textAlign: 'left', // Align to the left
    width: '100%',
    marginTop: 5, // Add spacing below the main text
  },
  connectionButton: {
    backgroundColor: '#CE975E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 20, // Added margin to move the button down
  },
  connectionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bluetoothIcon: {
    position: 'absolute',
    top: 20, // Adjust top position
    right: 20, // Adjust right position
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
    fontSize: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15, // Adjusted margin for better spacing
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
