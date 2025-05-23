// -----------------------------------------------------------------------------
// File: connectivity-settings.tsx      (REPLACEMENT – 23 May 2025)
// Purpose:  • Scan & connect LiquorBot BLE peripherals
//           • Scan nearby Wi-Fi (Android) → auto-fill SSID
//           • Prompt for password and send creds over BLE
//           • Close button on Wi-Fi modal
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, FlatList, Modal,
  PermissionsAndroid, Platform, ActivityIndicator, TextInput, Alert, Animated, RefreshControl
} from 'react-native';
import Ionicons         from '@expo/vector-icons/Ionicons';
import { BleManager }   from 'react-native-ble-plx';
import WifiManager      from 'react-native-wifi-reborn';     // ← NEW
import { Buffer }       from 'buffer';
import { useRouter }    from 'expo-router';
import { useLiquorBot } from './components/liquorbot-provider';

// BLE Service & Char UUIDs ----------------------------------------------------
const SERVICE_UUID   = 'e0be0301-718e-4700-8f55-a24d6160db08';
const SSID_CHAR_UUID = 'e0be0302-718e-4700-8f55-a24d6160db08';
const PASS_CHAR_UUID = 'e0be0303-718e-4700-8f55-a24d6160db08';
(global as any).Buffer = (global as any).Buffer || Buffer;

// -----------------------------------------------------------------------------
interface BluetoothDevice { id: string; name: string }

// -----------------------------------------------------------------------------
export default function ConnectivitySettings() {
  const router = useRouter();
  const { isConnected } = useLiquorBot();

  /*────────── BLE state ──────────*/
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [isScanning,       setIsScanning]         = useState(false);
  const [isConnecting,     setIsConnecting]       = useState(false);
  const [connectedDevice,  setConnectedDevice]    = useState<any | null>(null);

  /*────────── Wi-Fi modal ──────────*/
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [ssid,     setSsid]     = useState('');
  const [password, setPassword] = useState('');
  const [wifiList, setWifiList] = useState<string[]>([]);          // ← NEW

  const managerRef = useRef<BleManager | null>(null);
  const getManager = () => {
    if (!managerRef.current) managerRef.current = new BleManager();
    return managerRef.current;
  };

  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiError,   setWifiError]   = useState<string | null>(null);

  /*────────── Permissions helpers ──────────*/
  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, // required for BLE-scan
    ]);
    return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  };

  const requestWifiPermissions = async () => {                       // ← NEW
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      // Android 13+ needs NEARBY_WIFI_DEVICES; older versions use LOCATION
      PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES ??
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission',
        message: 'Needed to scan nearby Wi-Fi networks',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  /*────────── BLE scan ──────────*/

  useEffect(() => {
    const manager = getManager();
    let isMounted = true;

    // Set up Bluetooth state listener
    const stateSubscription = manager.onStateChange(async (state) => {
      if (!isMounted) return;
      
      if (state === 'PoweredOn') {
        await scanForDevices();
      } else {
        manager.stopDeviceScan();
        setIsScanning(false);
        setDiscoveredDevices([]);
        if (state === 'PoweredOff') {
          Alert.alert('Bluetooth Off', 'Please enable Bluetooth to connect to devices');
        }
      }
    }, true); // Immediately emit current state

    return () => {
      isMounted = false;
      stateSubscription.remove();
      manager.stopDeviceScan();
    };
  }, []);

  const scanForDevices = async () => {
    const manager = getManager();
    if (Platform.OS === 'android' && !(await requestBluetoothPermissions())) {
      Alert.alert('Bluetooth permissions required');
      return;
    }
    setDiscoveredDevices([]); setIsScanning(true);
    manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, (err, device) => {
      if (err) { console.error(err); stopScan(); return; }
      if (device?.name?.startsWith('LiquorBot')) {
        setDiscoveredDevices(prev =>
          prev.some(d => d.id === device.id)
            ? prev
            : [...prev, { id: device.id, name: device.name! }].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
    });
    const stopScan = () => { manager.stopDeviceScan(); setIsScanning(false); };
    setTimeout(stopScan, 15_000);
  };

  /*────────── Connect & send Wi-Fi ──────────*/
  const handleConnectDevice = async (devId: string) => {
    try {
      setIsConnecting(true);
      const dev = await getManager().connectToDevice(devId, { requestMTU: 256 });
      await dev.discoverAllServicesAndCharacteristics();
      setConnectedDevice(dev);
      setWifiModalVisible(true);
    } catch (e: any) {
      console.error('BLE connect', e);
      Alert.alert('Connection failed', e?.message ?? 'Unknown error');
    } finally { setIsConnecting(false); }
  };

  const sendWifiCredentials = async () => {
    if (!connectedDevice) return;
    try {
      const ssidB64 = Buffer.from(ssid,     'utf8').toString('base64');
      const passB64 = Buffer.from(password, 'utf8').toString('base64');
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID, SSID_CHAR_UUID, ssidB64);
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID, PASS_CHAR_UUID, passB64);
      Alert.alert('Sent', 'Credentials transmitted – device will reboot and join Wi-Fi.');
      setWifiModalVisible(false);
      setPassword('');
    } catch (e: any) {
      console.error('Write creds', e);
      Alert.alert('Error', e?.message ?? 'Failed to send credentials');
    }
  };

  /*────────── Wi-Fi scan (Android only) ──────────*/
  const loadWifiList = async () => {
    if (Platform.OS !== 'android') return;   // iOS – nothing to do
    setWifiLoading(true);
    setWifiError(null);
    setWifiList([]);

    try {
        if (!(await requestWifiPermissions()))
        throw new Error('Location/Wi-Fi permission denied');

        // Some devices need Wi-Fi enabled first
        await WifiManager.setEnabled(true);

        // API 33+ has to re-scan every time; older can use cached list
        const list = Platform.Version >= 33
        ? await WifiManager.reScanAndLoadWifiList()
        : await WifiManager.loadWifiList();

        const ssids = list
        .map((n: any) => n.SSID)
        .filter((s: string) => !!s && s !== '<unknown ssid>')
        .sort((a: string, b: string) => a.localeCompare(b));

        if (!ssids.length) setWifiError('No networks found');
        setWifiList(ssids);
    } catch (e: any) {
        console.warn('Wi-Fi scan failed', e);
        setWifiError(e?.message ?? 'Scan failed');
    } finally { setWifiLoading(false); }
    };

  /*────────── Effects ──────────*/
  useEffect(() => {
    scanForDevices();
    return () => { getManager().stopDeviceScan(); };
  }, []);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start(); }, []);
  useEffect(() => { if (wifiModalVisible) loadWifiList(); }, [wifiModalVisible]);   // ← NEW

  /*────────── Render ──────────*/
  return (
    <View style={styles.container}>
      {/* close */}
      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={30} color="#DFDCD9" />
      </TouchableOpacity>
      <Text style={styles.headerText}>Connectivity</Text>

      {/* status */}
      <View style={styles.statusBox}>
        <Text style={styles.statusTitle}>Device Connectivity</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#63d44a' : '#d44a4a' }]} />
          <Text style={styles.statusText}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
        </View>
      </View>

      {/* device list */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {isScanning ? (
          <View style={styles.scanningRow}>
            <ActivityIndicator size="small" color="#CE975E" />
            <Text style={styles.scanningText}>Scanning…</Text>
          </View>
        ) : (
          <Text style={styles.scanningText}>
            {discoveredDevices.length ? 'Tap a device to connect' : 'No devices found – pull to rescan'}
          </Text>
        )}
        <FlatList
            data={discoveredDevices}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
                <TouchableOpacity
                style={styles.deviceRow}
                disabled={isConnecting}
                onPress={() => handleConnectDevice(item.id)}
                >
                <Text style={styles.deviceName}>
                    {item.name}{' '}
                    <Text style={{ color: '#4F4F4F', fontSize: 12 }}>
                    ({item.id.slice(-5)})
                    </Text>
                </Text>
                <Ionicons name="bluetooth" size={18} color="#DFDCD9" />
                </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            />
      </Animated.View>

      {/* ─── Wi-Fi modal ───────────────────────────────────────────── */}
        <Modal
        visible={wifiModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWifiModalVisible(false)}
        >
        <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>

            {/* close (X) */}
            <TouchableOpacity style={styles.modalClose} onPress={() => setWifiModalVisible(false)}>
                <Ionicons name="close" size={22} color="#DFDCD9" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Configure Wi-Fi</Text>

            {/* SSID textbox (always visible so user can type, or gets filled from list) */}
            <TextInput
                placeholder="SSID"
                placeholderTextColor="#4F4F4F"
                value={ssid}
                onChangeText={setSsid}
                style={styles.input}
                autoCapitalize="none"
            />

            {/* Android-only scan indicators / list */}
            {Platform.OS === 'android' && (
                <>
                {wifiLoading && (
                    <View style={styles.wifiLoadingRow}>
                    <ActivityIndicator size="small" color="#CE975E" />
                    <Text style={styles.wifiLoadingText}>Scanning Wi-Fi…</Text>
                    </View>
                )}

                {wifiError && !wifiLoading && (
                    <TouchableOpacity style={styles.wifiRefresh} onPress={loadWifiList}>
                    <Ionicons name="refresh" size={16} color="#DFDCD9" />
                    <Text style={styles.wifiRefreshText}>{wifiError} – tap to rescan</Text>
                    </TouchableOpacity>
                )}

                {!wifiLoading && wifiList.length > 0 && (
                    <FlatList
                    data={wifiList}
                    keyExtractor={(item, idx) => item + idx}
                    style={styles.wifiList}
                    nestedScrollEnabled
                    renderItem={({ item }) => (
                        <TouchableOpacity
                        style={styles.wifiRow}
                        onPress={() => setSsid(item)}
                        >
                        <Text style={styles.wifiName}>{item}</Text>
                        </TouchableOpacity>
                    )}
                    />
                )}
                </>
            )}

            {/* password */}
            <TextInput
                placeholder="Password"
                placeholderTextColor="#4F4F4F"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
            />

            {/* send creds */}
            <TouchableOpacity style={styles.modalBtn} onPress={sendWifiCredentials}>
                <Text style={styles.modalBtnText}>Connect Device</Text>
            </TouchableOpacity>
            </View>
        </View>
        </Modal>
    </View>
  );
}

/*────────────────── Styles ──────────────────*/
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#141414', paddingTop: 100, paddingHorizontal: 20 },
  closeButton:   { position: 'absolute', top: 70, left: 20 },
  headerText:    { position: 'absolute', top: 70, alignSelf: 'center', fontSize: 24, color: '#FFFFFF', fontWeight: 'bold' },

  statusBox:  { backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20, marginBottom: 20, marginTop: 20 },
  statusTitle:{ color: '#DFDCD9', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  statusRow:  { flexDirection: 'row', alignItems: 'center' },
  statusDot:  { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { color: '#4F4F4F', fontSize: 14 },

  scanningRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  scanningText: { color: '#4F4F4F', textAlign: 'center', marginLeft: 10, marginBottom: 10 },
  deviceRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 14, paddingHorizontal: 10, backgroundColor: '#1F1F1F',
                  borderRadius: 10, marginBottom: 12 },
  deviceName:   { color: '#DFDCD9', fontSize: 16 },

  modalBackdrop:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox:     { backgroundColor: '#1F1F1F', borderRadius: 15, padding: 20, width: '80%' },
  modalClose:   { position: 'absolute', right: 10, top: 10, padding: 4 },
  modalTitle:   { color: '#CE975E', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },

  input:        { backgroundColor: '#141414', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 15,
                  color: '#DFDCD9', marginBottom: 12 },

  wifiList:     { maxHeight: 160, marginBottom: 12, borderRadius: 10, backgroundColor: '#141414' },
  wifiRow:      { paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: '#2A2A2A' },
  wifiName:     { color: '#DFDCD9' },

  modalBtn:     { backgroundColor: '#CE975E', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  modalBtnText: { color: '#141414', fontWeight: 'bold' },
  wifiLoadingRow:{ flexDirection:'row',alignItems:'center',marginBottom:8 },
wifiLoadingText:{ color:'#4F4F4F',marginLeft:8 },
wifiRefresh:{ flexDirection:'row',alignItems:'center',marginBottom:8 },
wifiRefreshText:{ color:'#4F4F4F',marginLeft:6 },
});
