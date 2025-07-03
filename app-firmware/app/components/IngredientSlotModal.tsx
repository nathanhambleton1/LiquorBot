import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  FlatList,
  Platform,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Ingredient {
  id: number;
  name: string;
  type: 'Alcohol' | 'Mixer' | 'Sour' | 'Sweet' | 'Misc';
  description: string;
}

interface IngredientSlotModalProps {
  visible: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  slots: number[];
  selectedSlot: number | null;
  setSelectedSlot: (idx: number | null) => void;
  handleSetSlot: (idx: number, id: number) => void;
  loading: boolean;
  categories: string[];
  ingName: (id: number | string) => string;
  initialTab?: 'select' | 'volume';
}

const AnimatedIngredientItem = ({
  item,
  index,
  onPress,
}: {
  item: Ingredient;
  index: number;
  onPress: () => void;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: index * 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            }),
          },
        ],
      }}
    >
      <TouchableOpacity style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333333' }} onPress={onPress}>
        <Text style={{ color: '#DFDCD9', fontSize: 16 }}>{item.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function IngredientSlotModal({
  visible,
  onClose,
  ingredients,
  slots,
  selectedSlot,
  setSelectedSlot,
  handleSetSlot,
  loading,
  categories,
  ingName,
  initialTab = 'select',
}: IngredientSlotModalProps) {
  const [modalTab, setModalTab] = useState<'select' | 'volume'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const slideAnim = useRef(new Animated.Value(initialTab === 'select' ? 0 : 1)).current;

  // Animate tab change
  const animateToTab = (tab: 'select' | 'volume') => {
    setModalTab(tab);
    Animated.timing(slideAnim, {
      toValue: tab === 'select' ? 0 : 1,
      duration: 100,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!visible) {
      setModalTab(initialTab);
      setSearchQuery('');
      slideAnim.setValue(initialTab === 'select' ? 0 : 1);
    } else {
      setModalTab(initialTab);
      Animated.timing(slideAnim, {
        toValue: initialTab === 'select' ? 0 : 1,
        duration: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, initialTab]);

  const filteredIngredients = ingredients
    .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(i => selectedCategory === 'All' || i.type === selectedCategory)
    .sort((a, b) => {
      const idSortTypes = ['Alcohol', 'Mixer', 'Sour', 'Sweet'];
      if (selectedCategory === 'All') {
        return a.name.localeCompare(b.name);
      }
      if (idSortTypes.includes(selectedCategory)) {
        return a.id - b.id;
      }
      return a.name.localeCompare(b.name);
    });

  // Animated sliding views for tab content
  const translateXSelect = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -400] });
  const translateXVolume = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#141414', padding: 20 }}>
        <TouchableOpacity style={{ position: 'absolute', top: 30, left: 20, zIndex: 10 }} onPress={onClose}>
          <Ionicons name="chevron-down" size={30} color="#DFDCD9" />
        </TouchableOpacity>
        {/* Tabs at the top */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, marginBottom: 10 }}>
          <TouchableOpacity
            style={{
              borderBottomWidth: modalTab === 'select' ? 2 : 0,
              borderBottomColor: '#CE975E',
              marginHorizontal: 20,
              paddingBottom: 6,
            }}
            onPress={() => animateToTab('select')}
          >
            <Text style={{ color: modalTab === 'select' ? '#CE975E' : '#DFDCD9', fontWeight: 'bold', fontSize: 16 }}>
              Select Ingredient
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              borderBottomWidth: modalTab === 'volume' ? 2 : 0,
              borderBottomColor: '#CE975E',
              marginHorizontal: 20,
              paddingBottom: 6,
            }}
            onPress={() => animateToTab('volume')}
          >
            <Text style={{ color: modalTab === 'volume' ? '#CE975E' : '#DFDCD9', fontWeight: 'bold', fontSize: 16 }}>
              Volume Info
            </Text>
          </TouchableOpacity>
        </View>
        {/* Animated tab content */}
        <View style={{ flex: 1, flexDirection: 'row', width: '200%' }}>
          <Animated.View style={{ width: '50%', transform: [{ translateX: translateXSelect }] }}>
            {/* category selector */}
            <View style={{ alignItems: 'center', paddingVertical: 5 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
              >
                {categories.map(category => (
                  <TouchableOpacity
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    style={{ paddingVertical: 10, paddingHorizontal: 5, marginHorizontal: 15 }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          color: selectedCategory === category ? '#CE975E' : '#4F4F4F',
                          fontSize: 14,
                        }}
                      >
                        {category}
                      </Text>
                      {selectedCategory === category && <View style={{ height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' }} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* search */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, marginTop: 10 }}>
              <Ionicons name="search" size={20} color="#4F4F4F" style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10, backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15 }}
                placeholder="Search Ingredients"
                placeholderTextColor="#4F4F4F"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            {/* ingredient list */}
            {loading ? (
              <Text style={{ color: '#DFDCD9', textAlign: 'center', margin: 10 }}>Loading ingredients...</Text>
            ) : (
              <FlatList
                data={filteredIngredients}
                keyExtractor={i => String(i.id)}
                renderItem={({ item, index }) => (
                  <AnimatedIngredientItem
                    item={item}
                    index={index}
                    onPress={() => {
                      // Prevent duplicate ingredient assignment
                      if (slots.includes(item.id)) {
                        Alert.alert('Duplicate Ingredient', 'This ingredient is already in a slot.');
                        return;
                      }
                      if (selectedSlot !== null) {
                        handleSetSlot(selectedSlot, item.id);
                        // Instead of closing, animate to volume tab
                        animateToTab('volume');
                      }
                    }}
                  />
                )}
              />
            )}
          </Animated.View>
          <Animated.View style={{ width: '50%', transform: [{ translateX: translateXVolume }] }}>
            {/* Volume Info tab content (placeholder) */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="water" size={48} color="#CE975E" style={{ marginBottom: 20 }} />
              <Text style={{ color: '#CE975E', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Volume Info</Text>
              <Text style={{ color: '#DFDCD9', fontSize: 16, textAlign: 'center', marginHorizontal: 20 }}>
                This tab will show detailed volume information and history for the selected slot in the future.
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
