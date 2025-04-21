// ---------------------------------------------------------------------------
// SettingsPopup – user‑tweakable preferences (kept locally with AsyncStorage)
// ---------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  haptics:       'pref_haptics',
  sounds:        'pref_sounds',
  notifications: 'pref_notifications',
  useWifi:       'pref_useWifi',
  units:         'pref_units',           // 'oz' | 'ml'
};

export default function SettingsPopup() {
  // ------------- state -------------
  const [haptics,       setHaptics]       = useState(false);
  const [sounds,        setSounds]        = useState(false);
  const [notifications, setNotifications]= useState(false);
  const [useWifi,       setUseWifi]       = useState(false);
  const [units,         setUnits]         = useState<'oz' | 'ml'>('oz');

  // ------------- persistence helpers -------------
  const loadPrefs = async () => {
    try {
      const vals = await AsyncStorage.multiGet(Object.values(KEYS));
      vals.forEach(([k, v]) => {
        if (v === null) return;
        switch (k) {
          case KEYS.haptics:       setHaptics(v === '1'); break;
          case KEYS.sounds:        setSounds(v === '1'); break;
          case KEYS.notifications: setNotifications(v === '1'); break;
          case KEYS.useWifi:       setUseWifi(v === '1'); break;
          case KEYS.units:         setUnits(v === 'ml' ? 'ml' : 'oz'); break;
        }
      });
    } catch {}
  };
  const save = (k: string, v: string) => AsyncStorage.setItem(k, v).catch(()=>{});

  // ------------- load once -------------
  useEffect(() => { loadPrefs(); }, []);

  // ------------- UI helpers -------------
  const PrefRow = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v:boolean)=>void }) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        trackColor={{ false: '#555', true: '#CE975E' }}
        thumbColor="#DFDCD9"
        ios_backgroundColor="#555"
        onValueChange={(v)=>{ onValueChange(v); }}
        value={value}
      />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
      <PrefRow
        label="Enable Haptics"
        value={haptics}
        onValueChange={(v)=>{ setHaptics(v); save(KEYS.haptics, v?'1':'0'); }}
      />
      <PrefRow
        label="Enable Sound Effects"
        value={sounds}
        onValueChange={(v)=>{ setSounds(v); save(KEYS.sounds, v?'1':'0'); }}
      />
      <PrefRow
        label="Push Notifications"
        value={notifications}
        onValueChange={(v)=>{ setNotifications(v); save(KEYS.notifications, v?'1':'0'); }}
      />
      <PrefRow
        label="Use Wi‑Fi Instead of Bluetooth (β)"
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
