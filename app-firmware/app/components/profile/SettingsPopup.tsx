// ---------------------------------------------------------------------------
// SettingsPopup – user‑tweakable preferences (kept locally with AsyncStorage)
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

const KEYS = {
  notifications: 'pref_notifications',
  useWifi:       'pref_useWifi',
  units:         'pref_units',           // 'oz' | 'ml'
};

export default function SettingsPopup() {
  // ------------- state -------------
  const [notifications, setNotifications] = useState(false);
  const [useWifi,       setUseWifi]       = useState(false);
  const [units,         setUnits]         = useState<'oz' | 'ml'>('oz');

  // ------------- permission helpers -------------
  const checkNotificationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const status = await new Promise<Record<string, boolean>>((resolve) => {
        PushNotificationIOS.checkPermissions((permissions) => {
          resolve({ alert: permissions.alert || false });
        });
      });
      return status.alert === true;
    } else if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;
      if (typeof apiLevel === 'number' && apiLevel >= 33) {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        return granted;
      }
      return true; // Android <13 doesn't require permission
    }
    return false;
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const result = await PushNotificationIOS.requestPermissions();
      return result.alert === true;
    } else if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;
      if (typeof apiLevel === 'number' && apiLevel >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true; // Android <13 doesn't require permission
    }
    return false;
  };

  // ------------- persistence -------------
  const loadPrefs = async () => {
    try {
      const vals = await AsyncStorage.multiGet(Object.values(KEYS));
      const prefs = {
        notifications: vals.find(([k]) => k === KEYS.notifications)?.[1] === '1',
        useWifi: vals.find(([k]) => k === KEYS.useWifi)?.[1] === '1',
        units: vals.find(([k]) => k === KEYS.units)?.[1] === 'ml' ? 'ml' : 'oz',
      };

      // Sync notifications with actual permission
      if (prefs.notifications) {
        const hasPermission = await checkNotificationPermission();
        if (!hasPermission) {
          prefs.notifications = false;
          await save(KEYS.notifications, '0');
        }
      }

      setNotifications(prefs.notifications);
      setUseWifi(prefs.useWifi);
      setUnits(prefs.units as 'oz' | 'ml');
    } catch {}
  };

  const save = (k: string, v: string) => AsyncStorage.setItem(k, v).catch(()=>{});

  // ------------- notifications toggle handler -------------
  const handleNotificationsToggle = async (v: boolean) => {
    setNotifications(v); // Optimistic UI update
    try {
      if (v) {
        const hasPermission = await checkNotificationPermission();
        if (!hasPermission) {
          const granted = await requestNotificationPermission();
          if (!granted) {
            setNotifications(false);
            await save(KEYS.notifications, '0');
            return;
          }
        }
        await save(KEYS.notifications, '1');
      } else {
        await save(KEYS.notifications, '0');
      }
    } catch (error) {
      setNotifications(!v); // Revert on error
      await save(KEYS.notifications, v ? '0' : '1');
    }
  };

  // ------------- initial load -------------
  useEffect(() => { loadPrefs(); }, []);

  // ------------- UI components -------------
  const PrefRow = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v:boolean)=>void }) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        trackColor={{ false: '#555', true: '#CE975E' }}
        thumbColor="#DFDCD9"
        ios_backgroundColor="#555"
        onValueChange={onValueChange}
        value={value}
      />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      <PrefRow
        label="Push Notifications"
        value={notifications}
        onValueChange={handleNotificationsToggle}
      />
      <PrefRow
        label="Use Wi‑Fi Instead of Bluetooth"
        value={useWifi}
        onValueChange={(v)=>{ setUseWifi(v); save(KEYS.useWifi, v?'1':'0'); }}
      />

      {/* units picker */}
      <Text style={[styles.label, { marginTop: 25, marginBottom: 10 }]}>Default Measurement Units</Text>
      <View style={styles.unitRow}>
        {['oz', 'ml'].map((u) => (
          <TouchableOpacity
            key={u}
            style={[styles.unitBtn, units === u && styles.unitBtnActive]}
            onPress={() => { setUnits(u as 'oz'|'ml'); save(KEYS.units, u); }}
          >
            <Text style={styles.unitText}>{u.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ---------------- styles ----------------
const styles = StyleSheet.create({
  row:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                backgroundColor:'#1F1F1F', padding:15, borderRadius:10, marginBottom:15 },
  label:      { color:'#DFDCD9', fontSize:16 },
  unitRow:    { flexDirection:'row', justifyContent:'space-between' },
  unitBtn:    { flex:1, paddingVertical:12, borderRadius:10, backgroundColor:'#1F1F1F', marginHorizontal:5,
                alignItems:'center' },
  unitBtnActive:{ backgroundColor:'#CE975E' },
  unitText:   { color:'#DFDCD9', fontSize:16, fontWeight:'600' },
});
