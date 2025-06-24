// ---------------------------------------------------------------------------
// SettingsPopup – user-tweakable preferences (kept locally with AsyncStorage)
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react';
import { useUnits } from '../UnitsContext';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView,
  Platform, PermissionsAndroid, Alert, Animated, Vibration,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { deleteUser } from '@aws-amplify/auth';
import * as Haptics from 'expo-haptics';

const KEYS = {
  notifications: 'pref_notifications',
  useWifi:       'pref_useWifi',
  units:         'pref_units',           // 'oz' | 'ml'
};

export default function SettingsPopup({ signOut }: { signOut: () => void }) {
  // ────────────── Version (from app.json) ──────────────
  const APP_VERSION = '1.0.4';

  // ───────────────────────────── state ─────────────────────────────
  const [notifications, setNotifications] = useState(false);
  const { units, setUnits } = useUnits();

  // ─────────── Animated values for the Danger-Zone dropdown ───────────
  const [isDangerCollapsed, setIsDangerCollapsed] = useState(true);
  const arrowAnim   = useRef(new Animated.Value(0)).current;      // rotates chevron

  const toggleDanger = () => {
    const toVal = isDangerCollapsed ? 1 : 0;
    Animated.parallel([
      Animated.timing(arrowAnim,   { toValue: toVal, duration: 200, useNativeDriver: true }),
    ]).start();
    setIsDangerCollapsed(!isDangerCollapsed);
  };

  const rotateInterpolate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // ───────────────── permission helpers ─────────────────
  const checkNotificationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const status = await new Promise<Record<string, boolean>>((resolve) => {
        PushNotificationIOS.checkPermissions((permissions) => {
          resolve({ alert: permissions.alert || false });
        });
      });
      return status.alert === true;
    }
    if (Platform.OS === 'android') {
      const api = Platform.Version as number;
      if (api >= 33) {
        return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      return true; // Android <13
    }
    return false;
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const res = await PushNotificationIOS.requestPermissions();
      return res.alert === true;
    }
    if (Platform.OS === 'android') {
      const api = Platform.Version as number;
      if (api >= 33) {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return res === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }
    return false;
  };

  // ───────────────────── persistence helpers ─────────────────────
  const save = (k: string, v: string) => AsyncStorage.setItem(k, v).catch(()=>{});
  // notification preferences only; units are managed by UnitsContext
  const loadPrefs = async () => {
    try {
      const vals = await AsyncStorage.multiGet([KEYS.notifications]);
      const notif = vals.find(([k]) => k === KEYS.notifications)?.[1] === '1';
      if (notif && !(await checkNotificationPermission())) {
        await save(KEYS.notifications, '0');
        setNotifications(false);
      } else {
        setNotifications(notif);
      }
    } catch {}
  };
  useEffect(() => { loadPrefs(); }, []);

  // ────────── push-notifications toggle handler ──────────
  const handleNotificationsToggle = async (v: boolean) => {
    setNotifications(v);  // optimistic
    try {
      if (v) {
        if (!(await checkNotificationPermission()) &&
            !(await requestNotificationPermission())) {
          setNotifications(false);
          await save(KEYS.notifications, '0');
          return;
        }
        await save(KEYS.notifications, '1');
      } else {
        await save(KEYS.notifications, '0');
      }
    } catch {
      setNotifications(!v);
      await save(KEYS.notifications, v ? '0' : '1');
    }
  };

  // ───────────────────── UI helpers ─────────────────────
  const PrefRow = ({ label, value, onValueChange }:
    { label: string; value: boolean; onValueChange: (v:boolean)=>void }) => (
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

  const handleDeleteAccount = async () => {
    // Strong, long vibration warning before showing the delete confirmation
    if (Platform.OS === 'android') {
      Vibration.vibrate(1000); // 1 second continuous vibration
    } else if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    Alert.alert(
      'Delete Account?',
      'This is permanent and will erase all of your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser();
              signOut();
            } catch (e) {
              Alert.alert('Error', 'Account deletion failed. Please try again.');
              console.error(e);
            }
          },
        },
      ],
    );
  };

  // ─────────────────────────── render ───────────────────────────
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      <PrefRow
        label="Push Notifications"
        value={notifications}
        onValueChange={handleNotificationsToggle}
      />



      {/* units picker */}
      <Text style={[styles.label, { marginTop: 25, marginBottom: 10 }]}>  
        Default Measurement Units
      </Text>
      <View style={styles.unitRow}>
        {(['oz','ml'] as const).map(u => (
          <TouchableOpacity
            key={u}
            style={[styles.unitBtn, units === u && styles.unitBtnActive]}
            onPress={() => setUnits(u)}
          >
            <Text style={styles.unitText}>{u.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Version info */}
      <View style={styles.versionRow}>
        <Ionicons name="information-circle-outline" size={16} color="#888" style={{marginRight:6}} />
        <Text style={styles.versionText}>App Version {APP_VERSION}</Text>
      </View>

      {/* ────────────── Danger Zone ────────────── */}
      <View style={styles.dangerZoneContainer}>
        {/* header / toggle */}
        <TouchableOpacity
          style={styles.dangerHeaderRow}
          activeOpacity={0.8}
          onPress={toggleDanger}
        >
          <Ionicons name="warning-outline" size={18} color="#ff7a7a" />
          <Text style={styles.dangerZoneHeader}>Danger Zone</Text>
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <Ionicons name="chevron-down" size={20} color="#ff7a7a" />
          </Animated.View>
        </TouchableOpacity>

        {!isDangerCollapsed && (
          <View style={styles.dangerContent}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteAccount}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color="#DFDCD9" />
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─────────────────────────── styles ───────────────────────────
const styles = StyleSheet.create({
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 10,
    alignSelf: 'flex-end',
  },
  versionText: {
    color: '#888',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  // preference rows
  row:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                backgroundColor:'#1F1F1F', padding:15, borderRadius:10, marginBottom:15 },
  label:      { color:'#DFDCD9', fontSize:16 },

  // units picker
  unitRow:          { flexDirection:'row', justifyContent:'space-between' },
  unitBtn:          { flex:1, paddingVertical:12, borderRadius:10, backgroundColor:'#1F1F1F',
                      marginHorizontal:5, alignItems:'center' },
  unitBtnActive:    { backgroundColor:'#CE975E' },
  unitText:         { color:'#DFDCD9', fontSize:16, fontWeight:'600' },

  // danger zone container
  dangerZoneContainer:{ marginTop:30, borderRadius:12, overflow:'hidden',
                        borderWidth:1, borderColor:'#ff4a4a' },

  // header
  dangerHeaderRow:   { flexDirection:'row', alignItems:'center',
                       justifyContent:'space-between', paddingVertical:14,
                       paddingHorizontal:18, backgroundColor:'#2B1111' },
  dangerZoneHeader:  { color:'#ff7a7a', fontSize:16, fontWeight:'bold', letterSpacing:0.5 },

  // animated drop-down content
  dangerContent:     { backgroundColor:'#190909', padding:18 },

  deleteButton:      { flexDirection:'row', alignItems:'center', justifyContent:'center',
                       backgroundColor:'#d44a4a', borderRadius:10, paddingVertical:14 },
  deleteButtonText:  { color:'#DFDCD9', fontSize:16, fontWeight:'bold', marginLeft:6 },
});
