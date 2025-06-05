// -----------------------------------------------------------------------------
// File: connectivity-settings.tsx      (REPLACEMENT – 27 May 2025)
// Purpose:  • Wi-Fi + BLE onboarding with 3-step progress modal
//           • Hand-shake-only path when device already has Wi-Fi
//           • Filters duplicates → Wi-Fi row hides matching BLE signal
//           • Pull-to-refresh scan, live status, checkmark animations
// -----------------------------------------------------------------------------
import React, {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, FlatList, Modal,
  PermissionsAndroid, Platform, ActivityIndicator, TextInput,
  Alert, Animated, RefreshControl, Linking,
} from 'react-native';
import Ionicons                      from '@expo/vector-icons/Ionicons';
import { BleManager, BleError, Characteristic } from 'react-native-ble-plx';
import WifiManager                   from 'react-native-wifi-reborn';
import { Buffer }                    from 'buffer';
import { useRouter }                 from 'expo-router';
import { useLiquorBot }              from './components/liquorbot-provider';

// ───────── BLE Service & Char UUIDs ─────────
const SERVICE_UUID          = 'e0be0301-718e-4700-8f55-a24d6160db08';
const SSID_CHAR_UUID        = 'e0be0302-718e-4700-8f55-a24d6160db08';
const PASS_CHAR_UUID        = 'e0be0303-718e-4700-8f55-a24d6160db08';
const WIFI_STATUS_CHAR_UUID = 'e0be0304-718e-4700-8f55-a24d6160db08';
(global as any).Buffer = (global as any).Buffer || Buffer;

/*────────── Types ──────────*/
interface BleDevice  { id: string; name: string }
interface DeviceItem { id: string; name: string; code: string; type: 'ble' | 'wifi' }

/*────────────────────────────────────────────────────────────────────────────*/
export default function ConnectivitySettings() {
  const router = useRouter();

  // ───── LiquorBot global state ─────
  const {
    isConnected, liquorbotId, setLiquorbotId, reconnect,
  } = useLiquorBot();

  /*──────── BLE state ────────*/
  const [bleDevices, setBleDevices]           = useState<BleDevice[]>([]);
  const [isScanning, setIsScanning]           = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<any | null>(null);
  const [currentConnectingId, setCurrentConnectingId] = useState<string | null>(null);
  const hasShownBtOffAlertRef = { current: false };

  /*──────── Wi-Fi modal ──────*/
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [ssid, setSsid]                         = useState('');
  const [password, setPassword]                 = useState('');
  const [wifiList, setWifiList]                 = useState<string[]>([]);
  const [wifiLoading, setWifiLoading]           = useState(false);
  const [wifiError, setWifiError]               = useState<string | null>(null);
  const [wifiSubmitting, setWifiSubmitting]     = useState(false);

  /*──────── 3-step progress modal ─────*/
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressStep, setProgressStep]       = useState<0 | 1 | 2 | 3>(0); // 0 = hidden

  /*──────── Manual ID Entry modal ─────*/
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualId, setManualId]                 = useState('');
  const [manualError, setManualError]           = useState('');

  /*──────── Managers / refs ─────*/
  const managerRef            = useRef<BleManager | null>(null);
  const getManager            = () => (managerRef.current ||= new BleManager());
  const disconnectSubRef      = useRef<any | null>(null);
  const statusMonitorRef      = useRef<any | null>(null);
  const failsafeTimeoutRef    = useRef<NodeJS.Timeout | null>(null);
  const extractLiquorBotId    = (name: string) => name.split('-')[1] || 'UNKNOWN';

  /*──────── Permission helpers ─────*/
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
      { title: 'Location', message: 'Needed to scan nearby Wi-Fi networks', buttonPositive: 'OK' },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  /*──────── BLE scan ────────*/
  const scanForDevices = useCallback(async () => {
    const manager = getManager();
    if (Platform.OS === 'android' && !(await requestBluetoothPermissions())) {
      Alert.alert('Bluetooth permissions required'); return;
    }
    setIsScanning(true);
    // already-connected peripherals first
    const pre = await manager.connectedDevices([SERVICE_UUID]);
    setBleDevices(pre.map(d => ({ id: d.id, name: d.name || 'LiquorBot' })));

    manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, (err, device) => {
      if (err || !device?.name?.match(/^LiquorBot-[A-F0-9]{6}$/i)) return;
      setBleDevices(prev => (prev.some(d => d.id === device.id) ? prev : [...prev, {
        id: device.id, name: device.name!,
      }]));
    });
    setTimeout(() => { manager.stopDeviceScan(); setIsScanning(false); }, 10000);
  }, []);

  useEffect(() => {
    const sub = getManager().onStateChange(
      (state) => {
        if (state === 'PoweredOn') {
          hasShownBtOffAlertRef.current = false;   // reset so future off → on → off still shows
          scanForDevices();
        } else {
          getManager().stopDeviceScan();
          setBleDevices([]);
          setIsScanning(false);

          // ─── iOS-only helper popup ────────────────────────────────
          if (
            Platform.OS === 'ios' &&
            state === 'PoweredOff' &&
            !hasShownBtOffAlertRef.current
          ) {
            hasShownBtOffAlertRef.current = true;
            Alert.alert(
              'Bluetooth is Off',
              'LiquorBot needs Bluetooth to pair. Please enable Bluetooth in Control Center or Settings.',
              [
                { text: 'OK', style: 'default' },
                {
                  text: 'Settings',
                  onPress: () => Linking.openURL('App-Prefs:root=Bluetooth'),
                },
              ],
            );
          }
        }
      },
      true,
    );
    return () => {
      sub.remove();
      getManager().stopDeviceScan();
    };
  }, [scanForDevices]);

  /*──────── Quick hand-shake (device already on Wi-Fi) ─────*/
  const quickHandshakeAndDisconnect = async (device: any) => {
    const char  = await device.readCharacteristicForService(SERVICE_UUID, WIFI_STATUS_CHAR_UUID);
    const ready = Buffer.from(char.value, 'base64').toString('utf8') === '1';
    if (!ready) return false;  // needs credentials

    await device.cancelConnection();                // kick central
    const newCode = extractLiquorBotId(device.name || '');
    setLiquorbotId(newCode);
    reconnect();
    Alert.alert('Connected', `LiquorBot ${newCode} is online via Wi-Fi`);
    return true;
  };

  /*──────── Connect BLE device ─────*/
  const handleConnectDevice = async (devId: string) => {
    try {
      setCurrentConnectingId(devId);
      const manager  = getManager();
      const existing = (await manager.connectedDevices([SERVICE_UUID])).find(d => d.id === devId);
      const device   = existing ?? await manager.connectToDevice(devId, { requestMTU: 256 });
      if (!existing) await device.discoverAllServicesAndCharacteristics();
      setConnectedDevice(device);

      if (await quickHandshakeAndDisconnect(device)) { setCurrentConnectingId(null); return; }
      // needs Wi-Fi creds
      setWifiModalVisible(true);
    } catch (e: any) {
      Alert.alert('Connection Failed', e.message ?? 'Unknown error');
    } finally {
      setCurrentConnectingId(null);
    }
  };

  /*──────── Send Wi-Fi credentials ─────*/
  const sendWifiCredentials = async () => {
    if (!connectedDevice) return;
    setWifiSubmitting(true);

    try {
      // cleanup old subs
      disconnectSubRef.current?.remove?.();
      statusMonitorRef.current?.remove?.();
      if (failsafeTimeoutRef.current) clearTimeout(failsafeTimeoutRef.current);

      // write SSID / PW
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, SSID_CHAR_UUID, Buffer.from(ssid, 'utf8').toString('base64'),
      );
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID, PASS_CHAR_UUID, Buffer.from(password, 'utf8').toString('base64'),
      );

      setWifiModalVisible(false);
      setPassword('');
      setProgressStep(1);           // Step 1 – connecting to Wi-Fi
      setProgressVisible(true);

      const finishSuccess = async () => {
        statusMonitorRef.current?.remove?.();
        disconnectSubRef.current?.remove?.();
        if (failsafeTimeoutRef.current) clearTimeout(failsafeTimeoutRef.current);

        setProgressStep(3);         // Step 3 – finalising
        const newCode = extractLiquorBotId(connectedDevice.name || '');
        setLiquorbotId(newCode);
        await reconnect();          // MQTT heartbeat check
        setWifiSubmitting(false);

        setTimeout(() => {          // brief pause then hide modal
          setProgressVisible(false);
          setProgressStep(0);
          Alert.alert('Success!', `LiquorBot ${newCode} is now online 🎉`);
        }, 700);
      };

      // --- monitor char for “1” → Wi-Fi + AWS ready ------------------------
      statusMonitorRef.current = connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID, WIFI_STATUS_CHAR_UUID,
        async (_err: BleError | null, char: Characteristic | null) => {
          if (!char?.value) return;
          const v = Buffer.from(char.value, 'base64').toString('utf8');
          if (v === '1') {
            setProgressStep(2);     // Step 2 – connecting to server
            await connectedDevice.cancelConnection();
            finishSuccess();
          }
        },
      );

      // --- also treat a clean disconnect as success (device kicked central) --
      disconnectSubRef.current = connectedDevice.onDisconnected((_e: BleError | null) => {
        // if status char already said ready we’re done; otherwise keep waiting
      });

      // --- failsafe: wrong creds → timeout -------------------------------
      failsafeTimeoutRef.current = setTimeout(async () => {
        setProgressVisible(false);
        setProgressStep(0);
        setWifiSubmitting(false);
        Alert.alert('Error', 'Device stayed on BLE – likely wrong credentials.');
      }, 30000);
    } catch (e: any) {
      setWifiSubmitting(false);
      setProgressVisible(false);
      setProgressStep(0);
      Alert.alert('Error', e.message ?? 'Failed to send credentials');
    }
  };

  /*──────── Wi-Fi list (Android) ─────*/
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
      setWifiError(e.message ?? 'Scan failed');
    } finally { setWifiLoading(false); }
  };

  /*──────── Derived device list (Wi-Fi hides duplicate BLE) ─────*/
  const devices: DeviceItem[] = useMemo(() => {
    const wifiRows: DeviceItem[] = isConnected ? [{
      id: `wifi-${liquorbotId}`, name: 'LiquorBot', code: liquorbotId, type: 'wifi',
    }] : [];
    const wifiCodes = new Set(wifiRows.map(r => r.code));
    const bleRows  = bleDevices
      .map(d => ({
        id: d.id,
        name: d.name,
        code: d.name.split('-')[1] ?? d.id.slice(-5),
        type: 'ble' as const,
      }))
      .filter(d => !wifiCodes.has(d.code));
    return [...wifiRows, ...bleRows];
  }, [isConnected, liquorbotId, bleDevices]);

  /*──────── Anim intro ─────*/
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  useEffect(() => { if (wifiModalVisible) loadWifiList(); }, [wifiModalVisible]);

  // ───── Manual LiquorBot ID entry ─────
  const handleManualSubmit = async () => {
    const id = manualId.trim().toUpperCase();
    if (!id.match(/^[A-F0-9]{3,}$/)) {
      setManualError('Enter a valid LiquorBot ID (e.g. 123ABC)');
      return;
    }
    setManualError('');
    setLiquorbotId(id);
    reconnect();
    Alert.alert('Manual Entry', `LiquorBot ID set to ${id}`);
    setManualId('');
  };

  /*────────────────── UI ──────────────────*/
  const StepRow = ({ n, label }: { n: 1 | 2 | 3; label: string }) => {
    let icon = <ActivityIndicator size="small" color="#CE975E"/>;
    if (progressStep > n)               icon = <Ionicons name="checkmark-circle" size={22} color="#63d44a"/>;
    else if (progressStep < n)          icon = <Ionicons name="ellipse-outline" size={20} color="#4F4F4F"/>;
    return (
      <View style={styles.stepRow}>
        {icon}
        <Text style={styles.stepLabel}>{label}</Text>
      </View>
    );
  };

  const displayId = liquorbotId === '000' ? 'N/A' : (liquorbotId || 'UNKNOWN');
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
          <Text style={styles.statusText}>
            {isConnected
              ? `Connected - LiquorBot ID: ${displayId}`
              : `Disconnected - LiquorBot ID: ${displayId}`}
          </Text>
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
        {!isScanning && !devices.length && (
          <Text style={styles.scanningText}>No devices found – pull to rescan</Text>
        )}

        <FlatList
          data={devices}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deviceRow}
              disabled={item.type === 'wifi' || !!currentConnectingId}
              onPress={() => item.type === 'ble' && handleConnectDevice(item.id)}
            >
              {currentConnectingId === item.id && (
                <ActivityIndicator size="small" color="#CE975E" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.deviceName}>
                {item.name}{' '}
                <Text style={{ color: '#4F4F4F', fontSize: 12 }}>({item.code})</Text>
              </Text>
              <Ionicons name={item.type === 'wifi' ? 'wifi' : 'bluetooth'} size={18} color="#DFDCD9" />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          ListFooterComponent={
            !isScanning ? (
              <View style={{ alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center' }}>
                <Text style={styles.manualHintText}>
                  Can't find your LiquorBot? {' '}
                </Text>
                <TouchableOpacity onPress={() => setManualModalVisible(true)}>
                  <Text style={styles.manualGoldBtnText}>Enter ID manually</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          refreshControl={(
            <RefreshControl refreshing={false} onRefresh={scanForDevices}
              tintColor="transparent" colors={['transparent']} />
          )}
        />

        {/* Manual ID Entry Modal */}
        <Modal
          visible={manualModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setManualModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <TouchableOpacity style={styles.modalClose} onPress={() => setManualModalVisible(false)}>
                <Ionicons name="close" size={22} color="#DFDCD9" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Enter LiquorBot ID</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 123ABC"
                placeholderTextColor="#4F4F4F"
                value={manualId}
                onChangeText={t => { setManualId(t); setManualError(''); }}
                autoCapitalize="characters"
                maxLength={12}
                editable={!isScanning}
              />
              {!!manualError && (
                <Text style={styles.manualError}>{manualError}</Text>
              )}
              <TouchableOpacity
                style={[styles.modalBtn, { marginTop: 10 }]}
                onPress={async () => {
                  const id = manualId.trim().toUpperCase();
                  if (!id.match(/^[A-F0-9]{3,}$/)) {
                    setManualError('Enter a valid LiquorBot ID (e.g. 123ABC)');
                    return;
                  }
                  setManualError('');
                  setLiquorbotId(id);
                  reconnect();
                  Alert.alert('Manual Entry', `LiquorBot ID set to ${id}`);
                  setManualId('');
                  setManualModalVisible(false);
                }}
                disabled={!manualId.trim()}
              >
                <Text style={styles.modalBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {!!manualError && !isScanning && (
          <Text style={styles.manualError}>{manualError}</Text>
        )}
      </Animated.View>

      {/* ─── Wi-Fi credentials modal ────────────────────────────── */}
      <Modal visible={wifiModalVisible} transparent animationType="fade"
             onRequestClose={() => setWifiModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setWifiModalVisible(false)}>
              <Ionicons name="close" size={22} color="#DFDCD9" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Configure Wi-Fi</Text>

            <TextInput
              placeholder="SSID" placeholderTextColor="#4F4F4F"
              value={ssid} onChangeText={setSsid}
              style={styles.input} autoCapitalize="none"
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
                    data={wifiList} keyExtractor={(i, idx) => i + idx}
                    style={styles.wifiList} nestedScrollEnabled
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
              placeholder="Password" placeholderTextColor="#4F4F4F"
              secureTextEntry value={password} onChangeText={setPassword}
              style={styles.input}
            />

            <TouchableOpacity
              style={[styles.modalBtn, wifiSubmitting && { opacity: 0.6 }]}
              disabled={wifiSubmitting}
              onPress={sendWifiCredentials}
            >
              {wifiSubmitting
                ? <ActivityIndicator size="small" color="#141414" />
                : <Text style={styles.modalBtnText}>Connect Device</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── 3-step progress modal ─────────────────────────────── */}
      <Modal visible={progressVisible} transparent animationType="fade">
        <View style={styles.progressBackdrop}>
          <View style={styles.progressBox}>
            <Text style={styles.modalTitle}>Setting up LiquorBot…</Text>
            <StepRow n={1} label="Connecting to Wi-Fi" />
            <StepRow n={2} label="Connecting to Server" />
            <StepRow n={3} label="Finalising Setup" />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/*────────────────── Styles ──────────────────*/
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#141414', paddingTop: 100, paddingHorizontal: 20 },
  closeButton:{ position: 'absolute', top: 70, left: 20 },
  headerText: { position: 'absolute', top: 70, alignSelf: 'center', fontSize: 24, color: '#FFFFFF', fontWeight: 'bold' },

  statusBox:  { backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20, marginBottom: 20, marginTop: 20 },
  statusTitle:{ color: '#DFDCD9', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  statusRow:  { flexDirection: 'row', alignItems: 'center' },
  statusDot:  { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { color: '#4F4F4F', fontSize: 14 },

  scanningRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  scanningText:{ color: '#4F4F4F', textAlign: 'center', marginBottom: 10, marginLeft: 10 },

  deviceRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 14, paddingHorizontal: 10, backgroundColor: '#1F1F1F',
                borderRadius: 10, marginBottom: 12 },
  deviceName: { color: '#DFDCD9', fontSize: 16 },

  /* Wi-Fi modal */
  modalBackdrop:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox:    { backgroundColor: '#1F1F1F', borderRadius: 15, padding: 20, width: '80%' },
  modalClose:  { position: 'absolute', right: 10, top: 10, padding: 4 },
  modalTitle:  { color: '#CE975E', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },

  input:       { backgroundColor: '#141414', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 15,
                 color: '#DFDCD9', marginBottom: 12 },

  wifiList:    { maxHeight: 160, marginBottom: 12, borderRadius: 10, backgroundColor: '#141414' },
  wifiRow:     { paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth,
                 borderBottomColor: '#2A2A2A' },
  wifiName:    { color: '#DFDCD9' },

  modalBtn:    { backgroundColor: '#CE975E', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  modalBtnText:{ color: '#141414', fontWeight: 'bold' },

  wifiLoadingRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  wifiLoadingText:{ color: '#4F4F4F', marginLeft: 8 },
  wifiRefresh:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  wifiRefreshText:{ color: '#4F4F4F', marginLeft: 6 },

  /* progress modal */
  progressBackdrop:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  progressBox:    { backgroundColor: '#1F1F1F', borderRadius: 15, padding: 25, width: '80%' },
  stepRow:        { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  stepLabel:      { color: '#DFDCD9', marginLeft: 12, fontSize: 15 },

  /* manual entry bar */
  manualBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 8,
    color: '#DFDCD9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  manualBtn: {
    backgroundColor: '#CE975E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnText: {
    color: '#141414',
    fontWeight: 'bold',
    fontSize: 12,
  },
  manualDeviceInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginRight: 0,
    fontSize: 16,
    color: '#DFDCD9',
  },
  manualError: {
    color: '#d44a4a',
    marginTop: 2,
    marginLeft: 4,
    fontSize: 13,
  },
  manualHintText: {
    color: '#4f4f4f',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '400',
  },
  manualGoldBtnText: {
    color: '#CE975E',
    fontSize: 14,
  },
});
