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
  const [slots, setSlots] = useState(Array(15).fill(''));
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);

  // Bluetooth states
  const [bluetoothModalVisible, setBluetoothModalVisible] = useState(false);
  const [discoveryModalVisible, setDiscoveryModalVisible] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const DEVICE_SERVICE_UUID = "1fb68313-bd17-4fd8-b615-554ddfd462d6";

  const manager = new BleManager();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ingUrl = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const response = await fetch(ingUrl.url);
        const data = await response.json();
        data.sort((a: Ingredient, b: Ingredient) => a.name.localeCompare(b.name));
        setIngredients(data);
      } catch (error) {
        console.error('Error fetching ingredients from S3:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    return true; // iOS permissions are handled differently
  };

  const scanForDevices = async () => {
    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) {
      console.log('Bluetooth permissions denied');
      return;
    }

    setIsScanning(true);
    setDiscoveredDevices([]);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log('Scan error:', error);
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
  };

  const categories = ['All', 'Alcohol', 'Mixer', 'Sour', 'Sweet', 'Misc'];

  const filteredIngredients = ingredients
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((item) => selectedCategory === 'All' || item.type === selectedCategory);

  const handleSlotChange = (value: string, index: number) => {
    const updatedSlots = [...slots];
    updatedSlots[index] = value;
    setSlots(updatedSlots);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.push('/')}>
          <Ionicons name="close" size={30} color="#DFDCD9" />
        </TouchableOpacity>

        <Text style={styles.headerText}>Device Settings</Text>

        <View style={styles.connectionBox}>
        <TouchableOpacity
          style={[styles.bluetoothIconContainer]}
          onPress={() => {
            setBluetoothModalVisible(true);
          }}
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

        <View style={styles.slotsContainer}>
          <Text style={styles.slotsHeader}>Configure Slots</Text>
          {slots.map((slot, index) => (
            <View key={index} style={styles.slotRow}>
              <Text style={styles.slotLabel}>Slot {index + 1}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  setSelectedSlot(index);
                  setModalVisible(true);
                }}
              >
                <Text style={[styles.pickerButtonText, slot && styles.selectedPickerButtonText]}>
                  {slot || 'Select Ingredient'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
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
            data={discoveredDevices.filter(device => device.name.startsWith('Liquorbot'))}
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
          {/* Close Button */}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}
          >
            <Ionicons name="close" size={30} color="#DFDCD9" />
          </TouchableOpacity>

          {/* Header Text */}
          <Text style={styles.modalHeaderText}>Select Ingredient</Text>

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
    minHeight: 100, // Ensure container is tall enough
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
    padding: 10, // Increased touch area
    backgroundColor: 'transparent', // Ensure it's visible during testing
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
  slotRow: {
    flexDirection: 'row', // Arrange items in a row
    alignItems: 'center', // Align items vertically
    marginBottom: 15, // Space between rows
  },
  slotLabel: {
    color: '#DFDCD9',
    fontSize: 16,
    marginRight: 10, // Space between label and button
    width: 80, // Fixed width for alignment
  },
  pickerButton: {
    flex: 1, // Take up remaining space
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  pickerButtonText: {
    color: '#4f4f4f', // Darker placeholder text color
    fontSize: 16,
  },
  selectedPickerButtonText: {
    color: '#dfdcd9', // Gold color for selected ingredient
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
    paddingVertical: 5, // Reduced vertical padding
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
  modalCloseButton: {
    position: 'absolute',
    top: 30,
    left: 20,
    zIndex: 10, // Ensure it appears above other elements
  },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DFDCD9',
    textAlign: 'center',
    marginTop: 10, // Reduced space below the close button
    marginBottom: -20, // Reduced space above the sort buttons
  },
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
});
