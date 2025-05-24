// -----------------------------------------------------------------------------
// File: connectivity-settings.tsx      (REPLACEMENT – 24 May 2025)
// Purpose:  • Show Wi-Fi-connected LiquorBots + nearby BLE peripherals
//           • Filter duplicates → Wi-Fi row hides matching BLE signal
//           • Scan / connect BLE, send Wi-Fi creds
//           • Promote unit code to provider ID after first Wi-Fi join
//           • Spinner in “Connect Device” button while waiting
//           • Pull-to-refresh BLE scan still works
// -----------------------------------------------------------------------------
import React, {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, FlatList, Modal,
  PermissionsAndroid, Platform, ActivityIndicator, TextInput,
  Alert, Animated, RefreshControl,
} from 'react-native';
import Ionicons        from '@expo/vector-icons/Ionicons';
import { BleManager }  from 'react-native-ble-plx';
import WifiManager     from 'react-native-wifi-reborn';
import { Buffer }      from 'buffer';
import { useRouter }   from 'expo-router';
import { useLiquorBot } from './components/liquorbot-provider';

// BLE Service & Char UUIDs ----------------------------------------------------
const SERVICE_UUID   = 'e0be0301-718e-4700-8f55-a24d6160db08';
const SSID_CHAR_UUID = 'e0be0302-718e-4700-8f55-a24d6160db08';
const PASS_CHAR_UUID = 'e0be0303-718e-4700-8f55-a24d6160db08';
(global as any).Buffer = (global as any).Buffer || Buffer;

/* ────────── Types ──────────*/
interface BleDevice   { id: string; name: string }
interface DeviceItem  { id: string; name: string; code: string; type: 'ble' | 'wifi' }

/* ──────────────────────────*/
export default function ConnectivitySettings() {
  const router = useRouter();

  // --- LiquorBot global state -----------------------------------------------
  const {
    isConnected,
    liquorbotId,
    setLiquorbotId,
    reconnect,
  } = useLiquorBot();

  /*────────── BLE state ──────────*/
  const [bleDevices,      setBleDevices]      = useState<BleDevice[]>([]);
  const [isScanning,      setIsScanning]      = useState(false);
  const [isConnecting,    setIsConnecting]    = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<any | null>(null);

  /*────────── Wi-Fi modal ──────────*/
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [ssid,     setSsid]     = useState('');
  const [password, setPassword] = useState('');
  const [wifiList, setWifiList] = useState<string[]>([]);

  /* spinner while sending creds */
  const [wifiSubmitting, setWifiSubmitting] = useState(false);

  /*────────── Managers / refs ──────*/
  const managerRef = useRef<BleManager | null>(null);
  const getManager = () => { if (!managerRef.current) managerRef.current = new BleManager(); return managerRef.current; };

  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiError,   setWifiError]   = useState<string | null>(null);
  const disconnectSubscriptionRef = useRef<any | null>(null);
  const disconnectTimeoutRef      = useRef<NodeJS.Timeout | null>(null);

  /*────────── Permissions helpers ──────────*/
  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  };
  const requestWifiPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES ??
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      { title: 'Location permission', message: 'Needed to scan nearby Wi-Fi networks', buttonPositive: 'OK' },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  /*────────── BLE scan ──────────*/
  const scanForDevices = useCallback(async () => {
    const manager = getManager();
    if (Platform.OS === 'android' && !(await requestBluetoothPermissions())) {
      Alert.alert('Bluetooth permissions required'); return;
    }

    setIsScanning(true);

    // include already-connected peripherals first
    const preConnected = await manager.connectedDevices([SERVICE_UUID]);
    const initial = preConnected.map(d => ({ id: d.id, name: d.name || 'LiquorBot' }));
    setBleDevices(initial);

    // live scan
    manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, (err, device) => {
      if (err || !device?.name?.startsWith('LiquorBot')) return;
      setBleDevices(prev => (prev.find(d => d.id === device.id) ? prev
        : [...prev, { id: device.id, name: device.name! }]));
    });

    setTimeout(() => { manager.stopDeviceScan(); setIsScanning(false); }, 15000);
  }, []);

  useEffect(() => {
    const manager = getManager();
    const stateSub = manager.onStateChange((state) => {
      if (state === 'PoweredOn') scanForDevices();
      else { manager.stopDeviceScan(); setIsScanning(false); setBleDevices([]); }
    }, true);
    return () => { stateSub.remove(); manager.stopDeviceScan(); };
  }, [scanForDevices]);

  /*────────── Connect (BLE) & Wi-Fi creds ──────────*/
  const handleConnectDevice = async (devId: string) => {
    try {
      setIsConnecting(true);
      const manager = getManager();
      const existing = (await manager.connectedDevices([SERVICE_UUID])).find(d => d.id === devId);
      const device   = existing ?? await manager.connectToDevice(devId, { requestMTU: 256 });
      if (!existing) await device.discoverAllServicesAndCharacteristics();
      setConnectedDevice(device);
      setWifiModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', `Connection failed: ${e.message ?? e}`);
    } finally { setIsConnecting(false); }
  };

  const checkIfDeviceConnected = async (deviceId: string) => {
    const connected = await getManager().connectedDevices([SERVICE_UUID]);
    return connected.some(d => d.id === deviceId);
  };

  const sendWifiCredentials = async () => {
    if (!connectedDevice) return;
    setWifiSubmitting(true);                              // ← NEW (start spinner)
    try {
      // Clear any previous listeners/timeout
      disconnectSubscriptionRef.current?.remove();
      if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);

      // --- send creds --------------------------------------------------------
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, SSID_CHAR_UUID, Buffer.from(ssid, 'utf8').toString('base64'),
      );
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, PASS_CHAR_UUID, Buffer.from(password, 'utf8').toString('base64'),
      );

      setWifiModalVisible(false);
      setPassword('');

      // --- wait for BLE disconnect (device rebooted onto Wi-Fi) --------------
      const onDisconnected = async (error: any) => {
        disconnectSubscriptionRef.current?.remove();
        setWifiSubmitting(false);                         // ← NEW (stop spinner)

        if (error) {
          Alert.alert('Error', 'Device disconnected unexpectedly.');
          return;
        }

        // Promote unit code to global provider ID
        const newCode = connectedDevice.id.slice(-5);
        setLiquorbotId(newCode);
        reconnect();
        Alert.alert('Success!', `Device ${newCode} is now online!`);
      };
      disconnectSubscriptionRef.current = connectedDevice.onDisconnected(onDisconnected);

      // --- timeout handler ---------------------------------------------------
      disconnectTimeoutRef.current = setTimeout(async () => {
        if (await checkIfDeviceConnected(connectedDevice.id))
          Alert.alert('Error', 'Invalid credentials – device stayed on BLE.');
        disconnectSubscriptionRef.current?.remove();
        setWifiSubmitting(false);                         // ← NEW (stop spinner)
      }, 15000);
    } catch (e: any) {
      setWifiSubmitting(false);                           // ← NEW (stop spinner)
      Alert.alert('Error', e.message ?? 'Failed to send credentials');
    }
  };

  /*────────── Wi-Fi scan (Android) ──────────*/
  const loadWifiList = async () => {
    if (Platform.OS !== 'android') return;
    setWifiLoading(true); setWifiError(null); setWifiList([]);
    try {
      if (!(await requestWifiPermissions())) throw new Error('Permission denied');
      await WifiManager.setEnabled(true);
      const list = Platform.Version >= 33
        ? await WifiManager.reScanAndLoadWifiList()
        : await WifiManager.loadWifiList();
      const ssids = list.map((n: any) => n.SSID)
        .filter((s: string) => !!s && s !== '<unknown ssid>')
        .sort((a: string, b: string) => a.localeCompare(b));
      if (!ssids.length) setWifiError('No networks found');
      setWifiList(ssids);
    } catch (e: any) {
      console.warn('Wi-Fi scan failed', e);
      setWifiError(e.message ?? 'Scan failed');
    } finally { setWifiLoading(false); }
  };

  /*────────── Derived device list (Wi-Fi + BLE) ──────────*/
  const devices: DeviceItem[] = useMemo(() => {
    // 1️⃣  Build Wi-Fi row(s) – right now that’s only the active provider
    const wifiRows: DeviceItem[] = isConnected ? [{
      id: `wifi-${liquorbotId}`,
      name: 'LiquorBot',
      code: liquorbotId,            // 5-digit provider ID
      type: 'wifi',
    }] : [];

    // 2️⃣  Collect all Wi-Fi codes so we can suppress matching BLE signals
    const wifiCodes = new Set(wifiRows.map(r => r.code));

    // 3️⃣  Build BLE rows, skipping any whose 5-digit code is already in wifiCodes
    const bleRows: DeviceItem[] = bleDevices
      .map(d => ({ id: d.id, name: d.name, code: d.id.slice(-5), type: 'ble' as const }))
      .filter(d => !wifiCodes.has(d.code));   // ← duplicate-filter

    // 4️⃣  Wi-Fi first, BLE after
    return [...wifiRows, ...bleRows];
  }, [isConnected, liquorbotId, bleDevices]);

  /*────────── Effects ──────────*/
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start(); }, []);
  useEffect(() => { if (wifiModalVisible) loadWifiList(); }, [wifiModalVisible]);

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
        {isScanning && (
          <View style={styles.scanningRow}>
            <ActivityIndicator size="small" color="#CE975E" />
            <Text style={styles.scanningText}>Scanning…</Text>
          </View>
        )}
        {!isScanning && !bleDevices.length && !isConnected && (
          <Text style={styles.scanningText}>No devices found – pull to rescan</Text>
        )}

        <FlatList
          data={devices}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deviceRow}
              disabled={item.type === 'wifi' || isConnecting}
              onPress={() => item.type === 'ble' && handleConnectDevice(item.id)}
            >
              <Text style={styles.deviceName}>
                {item.name}{' '}
                <Text style={{ color: '#4F4F4F', fontSize: 12 }}>({item.code})</Text>
              </Text>
              <Ionicons
                name={item.type === 'wifi' ? 'wifi' : 'bluetooth'}
                size={18}
                color="#DFDCD9"
              />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          refreshControl={(
            <RefreshControl
              refreshing={false}
              onRefresh={scanForDevices}
              tintColor="transparent"
              colors={['transparent']}
            />
          )}
        />
      </Animated.View>

      {/* ─── Wi-Fi modal ─────────────────────────────────────────── */}
      <Modal
        visible={wifiModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWifiModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setWifiModalVisible(false)}>
              <Ionicons name="close" size={22} color="#DFDCD9" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Configure Wi-Fi</Text>

            <TextInput
              placeholder="SSID"
              placeholderTextColor="#4F4F4F"
              value={ssid}
              onChangeText={setSsid}
              style={styles.input}
              autoCapitalize="none"
            />

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
                      <TouchableOpacity style={styles.wifiRow} onPress={() => setSsid(item)}>
                        <Text style={styles.wifiName}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            )}

            <TextInput
              placeholder="Password"
              placeholderTextColor="#4F4F4F"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />

            {/* Connect button with spinner */}
            <TouchableOpacity
              style={[styles.modalBtn, wifiSubmitting && { opacity: 0.6 }]}
              disabled={wifiSubmitting}
              onPress={sendWifiCredentials}
            >
              {wifiSubmitting
                ? <ActivityIndicator size="small" color="#141414" />   /* spinner colour contrasts btn */
                : <Text style={styles.modalBtnText}>Connect Device</Text>}
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
  scanningText: { color: '#4F4F4F', textAlign: 'center', marginBottom: 10, marginLeft: 10 },
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
