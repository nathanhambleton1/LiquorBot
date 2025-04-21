// -----------------------------------------------------------------------------
// File: device-settings.tsx
// Description: Provides a user interface for configuring LiquorBot device 
//              settings, including slot assignments and connectivity. 
//              Integrates with AWS Amplify for ingredient data and uses 
//              PubSub (MQTT) to set/retrieve slot configuration on the ESP32.
// Author: Nathan Hambleton (modified for slot-config MQTT by ChatGPT)
// Created: March 1, 2025
// -----------------------------------------------------------------------------
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
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useLiquorBot } from './components/liquorbot-provider';
import { getUrl } from 'aws-amplify/storage';
import { BleManager } from 'react-native-ble-plx';

// --- Amplify & PubSub ---
import { Amplify } from 'aws-amplify';
import config from '../src/amplifyconfiguration.json';
import { PubSub } from '@aws-amplify/pubsub';

// Initialize Amplify & PubSub
Amplify.configure(config);
const pubsub = new PubSub({
  region: 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

const SLOT_CONFIG_TOPIC = 'liquorbot/liquorbot001/slot-config';

interface Ingredient {
  id: number;
  name: string;
  type: 'Alcohol' | 'Mixer' | 'Sour' | 'Sweet' | 'Misc';
  description: string;
}

interface BluetoothDevice {
  id: string;
  name: string;
}

export default function DeviceSettings() {
  const router = useRouter();
  const { isConnected } = useLiquorBot();
  
  /**
   * We'll store 15 slots by ingredient ID. If 0 => no assignment.
   */
  const [slots, setSlots] = useState<number[]>(Array(15).fill(0));

  // For ingredient selection modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // For searching/filtering ingredients
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Master ingredient list from S3
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);

  // "Please connect a device first" bubble
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);

  // Bluetooth states
  const [bluetoothModalVisible, setBluetoothModalVisible] = useState(false);
  const [discoveryModalVisible, setDiscoveryModalVisible] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const DEVICE_SERVICE_UUID = '1fb68313-bd17-4fd8-b615-554ddfd462d6';
  const manager = new BleManager();

  // Config loading state
  const [configLoading, setConfigLoading] = useState(false);

  // ---------------- FETCH INGREDIENTS FROM S3 ----------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Load the ingredients.json from S3
        const ingUrl = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const response = await fetch(ingUrl.url);
        const data = await response.json();

        // Sort them alphabetically by name
        data.sort((a: Ingredient, b: Ingredient) => a.name.localeCompare(b.name));
        setIngredients(data);
      } catch (error) {
        console.error('Error fetching ingredients from S3:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (ingredients.length > 0 && isConnected) {
      fetchCurrentConfig();
    }
  }, [ingredients, isConnected]);

  // ---------------- MQTT SUBSCRIBE & CONFIG HANDLERS ----------------
  useEffect(() => {
    // Subscribe to slot-config topic
    const subscription = pubsub.subscribe({ topics: [SLOT_CONFIG_TOPIC] }).subscribe({
      next: (data) => {
        const msg = ((data as any)?.value ?? data) as any;
      
        if (msg.action === 'CURRENT_CONFIG' && Array.isArray(msg.slots)) {
          // coerce any string IDs to numbers just in case
          setSlots(msg.slots.map((id: any) => Number(id) || 0));
          setConfigLoading(false);
          return;
        }
      
        if (msg.action === 'SET_SLOT' && typeof msg.slot === 'number') {
          setSlots((prev) => {
            const next = [...prev];
            next[msg.slot - 1] = Number(msg.ingredientId) || 0;
            return next;
          });
        }
      },
      error: (error) => {
        console.error('Slot-config subscription error:', error);
      },
      complete: () => {},
    });

    // Once we are connected, we ask the ESP for the latest config
    if (isConnected) {
      fetchCurrentConfig();
    }

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  /**
   * Publish a message to the slot-config topic
   */
  const publishSlotMessage = async (payload: any) => {
    try {
      await pubsub.publish({
        topics: [SLOT_CONFIG_TOPIC],
        message: payload,
      });
    } catch (error) {
      console.error('Error publishing slot-config message:', error);
    }
  };

  // Ask the ESP for its current slot config
  const fetchCurrentConfig = () => {
    if (!isConnected) return;
    setConfigLoading(true);
    publishSlotMessage({ action: 'GET_CONFIG' });
  };

  // Clears all slots on both app & device
  const handleClearAll = () => {
    if (!isConnected) {
      setShowConnectPrompt(true);
      setTimeout(() => setShowConnectPrompt(false), 2000);
      return;
    }
    publishSlotMessage({ action: 'CLEAR_CONFIG' });
    setSlots(Array(15).fill(0)); // local reset
  };

  // For setting a single slot
  const handleSetSlot = (slotIndex: number, ingredientId: number) => {
    const message = {
      action: 'SET_SLOT',
      slot: slotIndex + 1, // 1-based index in the ESP
      ingredientId,
    };
    publishSlotMessage(message);
  };

  // ---------------- BLUETOOTH HELPER METHODS (OPTIONAL) ----------------
  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
        granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true; // iOS or web
  };

  const scanForDevices = async () => {
    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) {
      return;
    }
    setIsScanning(true);
    setDiscoveredDevices([]);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        manager.stopDeviceScan();
        setIsScanning(false);
        return;
      }
      if (device?.name?.toLowerCase().includes('liquorbot')) {
        setDiscoveredDevices((prev) => [...prev, { id: device.id, name: device.name! }]);
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 5000);
  };

  const handleConnectDevice = (deviceId: string) => {
    setDiscoveryModalVisible(false);
    // your BLE connect flow here...
  };

  // ---------------- INGREDIENT FILTERING / MAPPING ----------------
  const categories = ['All', 'Alcohol', 'Mixer', 'Sour', 'Sweet', 'Misc'];

  const filteredIngredients = ingredients
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((item) => selectedCategory === 'All' || item.type === selectedCategory);

  /**
   * Return the ingredient name for a given ID.
   * If not found, we return a fallback message.
   */
  const getIngredientNameById = (id: number | string): string => {
    if (!id || ingredients.length === 0) return '';      // suppress while loading
    const numId = Number(id);
    const found = ingredients.find((ing) => ing.id === numId);
    return found ? found.name : '';                      // no “Unknown” flash
  };

  // User taps a slot => open the selection modal
  const handleSlotPress = (index: number) => {
    if (!isConnected) {
      setShowConnectPrompt(true);
      setTimeout(() => setShowConnectPrompt(false), 2000);
      return;
    }
    setSelectedSlot(index);
    setModalVisible(true);
  };

  // When user picks an ingredient from the modal
  const assignIngredientToSlot = (ingredientId: number) => {
    if (selectedSlot !== null) {
      // Update local state
      const newSlots = [...slots];
      newSlots[selectedSlot] = ingredientId;
      setSlots(newSlots);

      // Publish to ESP
      handleSetSlot(selectedSlot, ingredientId);

      // Close modal & clear search
      setModalVisible(false);
      setSearchQuery('');
    }
  };

  // ---------------- RENDER ----------------
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Close button => go back */}
        <TouchableOpacity style={styles.closeButton} onPress={() => router.push('/')}>
          <Ionicons name="close" size={30} color="#DFDCD9" />
        </TouchableOpacity>

        <Text style={styles.headerText}>Device Settings</Text>

        {/* Connection status box */}
        <View style={styles.connectionBox}>
          <TouchableOpacity
            style={styles.bluetoothIconContainer}
            onPress={() => setBluetoothModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="bluetooth-outline" size={24} color="#DFDCD9" />
          </TouchableOpacity>
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

        {/* Slots configuration box */}
        <View style={styles.slotsContainer}>
          <View style={styles.slotsHeaderContainer}>
            <Text style={styles.slotsHeader}>Configure Slots</Text>
            <TouchableOpacity onPress={handleClearAll} disabled={!isConnected}>
              <Text
                style={[
                  styles.clearAllButtonText,
                  !isConnected && { opacity: 0.5 },
                ]}
              >
                Clear All
              </Text>
            </TouchableOpacity>
          </View>

          {!isConnected && (
            <Text style={styles.connectDeviceMessage}>
              Please connect a device to start configuring.
            </Text>
          )}

          {slots.map((ingredientId, index) => {
            const ingredientName = getIngredientNameById(ingredientId);
            return (
              <View key={index} style={styles.slotRow}>
                <Text style={styles.slotLabel}>Slot {index + 1}</Text>
                <View style={styles.pickerButtonContainer}>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      !isConnected && styles.pickerButtonDisconnected,
                    ]}
                    onPress={() => handleSlotPress(index)}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        ingredientName !== '' && styles.selectedPickerButtonText,
                      ]}
                    >
                      {ingredientName || 'Select Ingredient'}
                    </Text>
                  </TouchableOpacity>
                  {ingredientName !== '' && (
                    <TouchableOpacity
                      style={[
                        styles.clearSlotOverlay,
                        !isConnected && styles.clearSlotOverlayDisabled,
                      ]}
                      onPress={() => isConnected && handleSetSlot(index, 0)}
                      disabled={!isConnected}
                    >
                      <Text style={styles.clearSlotOverlayText}>X</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* "Please connect a device first" bubble */}
        {showConnectPrompt && (
          <View style={styles.connectPrompt}>
            <Text style={styles.connectPromptText}>Please connect a device first</Text>
          </View>
        )}
      </ScrollView>

      {/* Bluetooth Connection Modal */}
      <Modal
        visible={bluetoothModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setBluetoothModalVisible(false)}
      >
        <View style={styles.bluetoothModalContainer}>
          <View style={styles.bluetoothModalContent}>
            <Text style={styles.bluetoothModalTitle}>Connect New Device</Text>
            <Text style={styles.bluetoothModalSubtitle}>
              You can only have one device connected at a time.
            </Text>
            <TouchableOpacity
              style={styles.bluetoothModalButton}
              onPress={() => {
                setBluetoothModalVisible(false);
                setDiscoveryModalVisible(true);
                scanForDevices();
              }}
            >
              <Text style={styles.bluetoothModalButtonText}>Setup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bluetoothModalCancelButton}
              onPress={() => setBluetoothModalVisible(false)}
            >
              <Text style={styles.bluetoothModalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Device Discovery Modal */}
      <Modal
        visible={discoveryModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setDiscoveryModalVisible(false)}
      >
        <View style={styles.discoveryModalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setDiscoveryModalVisible(false)}
          >
            <Ionicons name="close" size={30} color="#DFDCD9" />
          </TouchableOpacity>
          <Text style={styles.discoveryModalTitle}>Available Devices</Text>

          {isScanning ? (
            <View style={styles.scanningContainer}>
              <ActivityIndicator size="small" color="#CE975E" />
              <Text style={styles.scanningText}>Scanning for devices...</Text>
            </View>
          ) : (
            <Text style={styles.scanningText}>Tap a device to connect</Text>
          )}

          <FlatList
            data={discoveredDevices.filter((device) =>
              device.name.startsWith('Liquorbot')
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.deviceItem}
                onPress={() => handleConnectDevice(item.id)}
              >
                <Text style={styles.deviceName}>{item.name}</Text>
                <Ionicons name="bluetooth" size={20} color="#DFDCD9" />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.deviceList}
          />
        </View>
      </Modal>

      {/* Ingredient Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}
          >
            <Ionicons name="chevron-down" size={30} color="#DFDCD9" />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.modalHeaderText}>Select Ingredient</Text>

          {/* Category selector */}
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

          {/* Search bar */}
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
                  onPress={() => assignIngredientToSlot(item.id)}
                >
                  <Text style={styles.ingredientText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Loading overlay */}
      {configLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#CE975E" />
        </View>
      )}
    </View>
  );
}

// ------------------- STYLES -------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  closeButton: {
    position: 'absolute',
    top: 30,
    left: 25,
  },
  headerText: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContainer: {
    paddingTop: 90,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  connectionBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    minHeight: 100,
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
  bluetoothIconContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 999,
    padding: 10,
    backgroundColor: 'transparent',
  },
  slotsContainer: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
  },
  slotsHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  slotsHeader: {
    color: '#DFDCD9',
    fontSize: 20,
    fontWeight: 'bold',
  },
  connectDeviceMessage: {
    color: '#d44a4a',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 25,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  slotLabel: {
    color: '#DFDCD9',
    fontSize: 16,
    marginRight: 10,
    width: 80,
  },
  pickerButtonContainer: {
    flex: 1,
    position: 'relative',
  },
  pickerButton: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerButtonDisconnected: {
    borderColor: '#d44a4a',
  },
  pickerButtonText: {
    color: '#4f4f4f',
    fontSize: 16,
  },
  selectedPickerButtonText: {
    color: '#dfdcd9',
  },
  clearSlotOverlay: {
    position: 'absolute',
    top: 6,
    right: 10,
    backgroundColor: 'transparent',
    padding: 5,
  },
  clearSlotOverlayDisabled: {
    opacity: 0.5,
  },
  clearSlotOverlayText: {
    color: '#808080',
    fontSize: 14,
    fontWeight: 'bold',
  },
  connectPrompt: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#1F1F1F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CE975E',
  },
  connectPromptText: {
    color: '#DFDCD9',
    fontSize: 14,
    textAlign: 'center',
  },

  // 'Clear All' text
  clearAllButtonText: {
    color: '#4F4F4F',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 30,
    left: 20,
    zIndex: 10,
  },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DFDCD9',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: -20,
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
    marginTop: 40,
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginHorizontal: 15,
  },
  categoryButtonContent: {
    alignItems: 'center',
  },
  categoryButtonText: {
    color: '#4F4F4F',
    fontSize: 14,
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

  // Bluetooth modals
  bluetoothModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bluetoothModalContent: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  bluetoothModalTitle: {
    color: '#DFDCD9',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  bluetoothModalSubtitle: {
    color: '#4F4F4F',
    fontSize: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  bluetoothModalButton: {
    backgroundColor: '#CE975E',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  bluetoothModalButtonText: {
    color: '#141414',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bluetoothModalCancelButton: {
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4F4F4F',
  },
  bluetoothModalCancelButtonText: {
    color: '#DFDCD9',
    fontSize: 16,
  },
  discoveryModalContainer: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 20,
  },
  discoveryModalTitle: {
    fontSize: 24,
    color: '#DFDCD9',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 20,
  },
  scanningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  scanningText: {
    color: '#4F4F4F',
    textAlign: 'center',
    marginLeft: 10,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  deviceName: {
    color: '#DFDCD9',
    fontSize: 16,
  },
  deviceList: {
    paddingBottom: 20,
  },

  // Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
