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
  StyleSheet,
  useWindowDimensions,
  Image
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Slider from '@react-native-community/slider';

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
  const { width } = useWindowDimensions();
  const [modalTab, setModalTab] = useState<'select' | 'volume'>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [volumeOperation, setVolumeOperation] = useState<'new'|'add'|'subtract'>('new');
  const [volumeValue, setVolumeValue] = useState<number>(0);
  const [selectedUnit, setSelectedUnit] = useState<'L' | 'mL' | 'oz'>('L');
  const [selectedQuick, setSelectedQuick] = useState<null | 'large' | 'medium' | 'small'>(null);
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
  const translateXSelect = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const translateXVolume = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  // Helper to get the slider value for the selected unit
  const getSliderValue = () => {
    if (selectedUnit === 'L') return volumeValue;
    if (selectedUnit === 'mL') return volumeValue * 1000;
    if (selectedUnit === 'oz') return volumeValue * 33.814;
    return volumeValue;
  };

  // Helper to set the volume based on the selected unit
  const setSliderValue = (val: number) => {
    if (selectedUnit === 'L') setVolumeValue(Math.max(0, Math.min(5, parseFloat(val.toFixed(3)))));
    if (selectedUnit === 'mL') setVolumeValue(Math.max(0, Math.min(5, parseFloat((val / 1000).toFixed(3)))));
    if (selectedUnit === 'oz') setVolumeValue(Math.max(0, Math.min(5, parseFloat((val / 33.814).toFixed(3)))));
  };

  // Step size for each unit
  const getStep = () => {
    if (selectedUnit === 'L') return 0.01;
    if (selectedUnit === 'mL') return 1;
    if (selectedUnit === 'oz') return 0.1;
    return 0.01;
  };

  // Slider min/max for each unit
  const getMin = () => 0;
  const getMax = () => {
    if (selectedUnit === 'L') return 5;
    if (selectedUnit === 'mL') return 5000;
    if (selectedUnit === 'oz') return 169.07;
    return 5;
  };

  // Helper: preset values
  const quickPresets = {
    large: 1.75,
    medium: 1.54,
    small: 32 / 33.814,
  };

  // Watch volumeValue and deselect quick if not matching
  useEffect(() => {
    if (Math.abs(volumeValue - quickPresets.large) < 0.001) setSelectedQuick('large');
    else if (Math.abs(volumeValue - quickPresets.medium) < 0.001) setSelectedQuick('medium');
    else if (Math.abs(volumeValue - quickPresets.small) < 0.001) setSelectedQuick('small');
    else setSelectedQuick(null);
  }, [volumeValue]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#141414' }}>
        {/* Header with close button and tabs */}
        <View style={{ padding: 20, paddingBottom: 10 }}>
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
                Ingredient
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
                Volume
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab content container - FIXED LAYOUT */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View 
            style={{ 
              flex: 1, 
              flexDirection: 'row', 
              width: width * 2,
              transform: [{ translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -width]
              }) }]
            }}
          >
            {/* Ingredient Selection Tab */}
            <View style={{ width: width, paddingHorizontal: 20 }}>
              {/* Category selector */}
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
              
              {/* Search */}
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
              
              {/* Ingredient list */}
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
            </View>

            {/* Volume Tab */}
            <View style={{ width: width, paddingHorizontal: 20 }}>
              <View style={modalStyles.volumeContainer}>
                {/* Operation buttons */}
                <View style={modalStyles.volumeOpsRow}>
                  <TouchableOpacity onPress={() => setVolumeOperation('new')} style={[modalStyles.volumeOpButton, volumeOperation==='new' && modalStyles.volumeOpButtonActive]}>
                    <Text style={[modalStyles.volumeOpLabel, volumeOperation==='new' && modalStyles.volumeOpLabelActive]}>New</Text>
                    <Text style={modalStyles.volumeOpSubtext}>From empty container</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setVolumeOperation('add')} style={[modalStyles.volumeOpButton, volumeOperation==='add' && modalStyles.volumeOpButtonActive]}>
                    <Text style={[modalStyles.volumeOpLabel, volumeOperation==='add' && modalStyles.volumeOpLabelActive]}>Add</Text>
                    <Text style={modalStyles.volumeOpSubtext}>Add to container</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setVolumeOperation('subtract')} style={[modalStyles.volumeOpButton, volumeOperation==='subtract' && modalStyles.volumeOpButtonActive]}>
                    <Text style={[modalStyles.volumeOpLabel, volumeOperation==='subtract' && modalStyles.volumeOpLabelActive]}>Subtract</Text>
                    <Text style={modalStyles.volumeOpSubtext}>Remove from container</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Quick select images row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => setVolumeValue(quickPresets.large)}
                    style={{ alignItems: 'center', borderWidth: selectedQuick === 'large' ? 2 : 0, borderColor: '#CE975E', borderRadius: 8, padding: 4, width: 100 }}
                  >
                    <Image source={require('../../assets/images/large.png')} style={{ width: 120, height: 120, resizeMode: 'contain' }} />
                    <Text style={{ color: '#DFDCD9', fontSize: 16, marginTop: 10, textAlign: 'center', fontWeight: 'bold' }}>Large</Text>
                    <Text style={{ color: '#888', fontSize: 13, marginTop: 2, textAlign: 'center', paddingTop: 2 }}>1.75L</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setVolumeValue(quickPresets.medium)}
                    style={{ alignItems: 'center', borderWidth: selectedQuick === 'medium' ? 2 : 0, borderColor: '#CE975E', borderRadius: 8, padding: 4, width: 100 }}
                  >
                    <Image source={require('../../assets/images/medium.png')} style={{ width: 100, height: 100, resizeMode: 'contain' }} />
                    <Text style={{ color: '#DFDCD9', fontSize: 16, marginTop: 10, textAlign: 'center', fontWeight: 'bold' }}>Medium</Text>
                    <Text style={{ color: '#888', fontSize: 13, marginTop: 2, textAlign: 'center', paddingTop: 2 }}>1.54L</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setVolumeValue(quickPresets.small)}
                    style={{ alignItems: 'center', borderWidth: selectedQuick === 'small' ? 2 : 0, borderColor: '#CE975E', borderRadius: 8, padding: 4, width: 100 }}
                  >
                    <Image source={require('../../assets/images/small.png')} style={{ width: 80, height: 80, resizeMode: 'contain' }} />
                    <Text style={{ color: '#DFDCD9', fontSize: 16, marginTop: 10, textAlign: 'center', fontWeight: 'bold' }}>Small</Text>
                    <Text style={{ color: '#888', fontSize: 13, marginTop: 2, textAlign: 'center', paddingTop: 2 }}>32oz</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Item placeholders replaced with slider */}
                <View style={modalStyles.sliderContainer}>
                  <Text style={{ color: '#DFDCD9', fontSize: 14, marginBottom: 10, textAlign: 'center' }}>Set Volume</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <TouchableOpacity onPress={() => setSliderValue(getSliderValue() - getStep())} style={{ padding: 6 }}>
                      <Ionicons name="remove-circle-outline" size={24} color="#4F4F4F" />
                    </TouchableOpacity>
                    <Slider
                      style={{ flex: 1, height: 40 }}
                      minimumValue={getMin()}
                      maximumValue={getMax()}
                      step={getStep()}
                      minimumTrackTintColor="#CE975E"
                      maximumTrackTintColor="#4F4F4F"
                      thumbTintColor="#CE975E"
                      value={getSliderValue()}
                      onValueChange={setSliderValue}
                    />
                    <TouchableOpacity onPress={() => setSliderValue(getSliderValue() + getStep())} style={{ padding: 6 }}>
                      <Ionicons name="add-circle-outline" size={24} color="#4F4F4F" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end', marginTop: 0 }}>
                    <TouchableOpacity onPress={() => setSelectedUnit('mL')}>
                      <Text style={{ color: selectedUnit === 'mL' ? '#CE975E' : '#888', fontSize: 13, fontWeight: selectedUnit === 'mL' ? 'bold' : 'normal', textAlign: 'center' }}>{(volumeValue*1000).toFixed(0)} mL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSelectedUnit('L')}>
                      <Text style={{ color: selectedUnit === 'L' ? '#CE975E' : '#DFDCD9', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>{volumeValue.toFixed(2)} L</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setSelectedUnit('oz')}>
                      <Text style={{ color: selectedUnit === 'oz' ? '#CE975E' : '#888', fontSize: 13, fontWeight: selectedUnit === 'oz' ? 'bold' : 'normal', textAlign: 'center' }}>{(volumeValue*33.814).toFixed(1)} oz</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Save button */}
                <TouchableOpacity style={modalStyles.saveButton} onPress={() => {/* implement save */}}>
                  <Text style={modalStyles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  volumeContainer: { 
    flex: 1, 
    justifyContent: 'flex-start' 
  },
  volumeOpsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 20 
  },
  volumeOpButton: { 
    alignItems: 'center', 
    padding: 8,
    flex: 1,
    marginHorizontal: 4
  },
  volumeOpButtonActive: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
  },
  volumeOpLabel: { 
    color: '#DFDCD9', 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  volumeOpLabelActive: { 
    color: '#CE975E' 
  },
  volumeOpSubtext: { 
    color: '#4F4F4F', 
    fontSize: 10, 
    marginTop: 2,
    textAlign: 'center'
  },
  sliderContainer: { 
    marginVertical: 20 
  },
  sliderInput: { 
    backgroundColor: '#1F1F1F', 
    color: '#DFDCD9', 
    borderRadius: 10, 
    padding: 15, 
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 15
  },
  volumeValuesRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 15 
  },
  volumeValueText: { 
    color: '#DFDCD9', 
    fontSize: 14 
  },
  saveButton: { 
    backgroundColor: '#CE975E', 
    paddingVertical: 15, 
    borderRadius: 8, 
    alignItems: 'center',
    marginTop: 20
  },
  saveButtonText: { 
    color: '#141414', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
});