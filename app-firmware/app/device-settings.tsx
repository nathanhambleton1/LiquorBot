// -----------------------------------------------------------------------------
// File: device-settings.tsx          (UPDATED – 05 Jun 2025)
// Purpose:  • Maintenance & slot-configuration
//           • “Connectivity” button navigates to /connectivity-settings
//           • Advanced-settings drop-down with Danger-Zone Wi-Fi disconnect
//           • Warn user if they’re in an event override when they tap “Disconnect”
// -----------------------------------------------------------------------------


import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Alert,
  Animated,
  PanResponder,
  Vibration,
} from 'react-native';
import Ionicons        from '@expo/vector-icons/Ionicons';
import { useRouter }   from 'expo-router';
import { useLiquorBot } from './components/liquorbot-provider';
import { getUrl }      from 'aws-amplify/storage';
import { Amplify }     from 'aws-amplify';
import config          from '../src/amplifyconfiguration.json';
import { PubSub }      from '@aws-amplify/pubsub';
import { generateClient }     from 'aws-amplify/api';
import { listEvents }         from '../src/graphql/queries';
import { deleteEvent }        from '../src/graphql/mutations';
import { getCurrentUser } from 'aws-amplify/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import IngredientSlotModal from './components/IngredientSlotModal';

// Helper for strong, long vibration
function strongVibration() {
  if (Platform.OS === 'android') {
    Vibration.vibrate(1000);
  } else if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

// -----------------------------------------------------------------------------
const client = generateClient();
Amplify.configure(config);
const pubsub = new PubSub({
  region:   'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface Ingredient {
  id: number;
  name: string;
  type: 'Alcohol' | 'Mixer' | 'Sour' | 'Sweet' | 'Misc';
  description: string;
}

/* ───── Undo-buffer helpers ───── */                            // 🆕
const getUndoKey = (user: string, botId: string) =>
  `undoConfig-${user}-${botId}`;

async function saveUndo(slots: number[], user: string, botId: string) { // 🆕
  try { await AsyncStorage.setItem(getUndoKey(user, botId), JSON.stringify(slots)); }
  catch { /* ignore */ }
}

async function popUndo(user: string, botId: string): Promise<number[]|null> { // 🆕
  try {
    const raw = await AsyncStorage.getItem(getUndoKey(user, botId));
    if (!raw) return null;
    await AsyncStorage.removeItem(getUndoKey(user, botId));
    return JSON.parse(raw) as number[];
  } catch { return null; }
}

// ----------------------------------------------------------------------------- 
export default function DeviceSettings() {
  const router = useRouter();

  /*────────── LiquorBot context ──────────*/
  const {
    isAdmin,            // determines access
    isConnected,        // online/offline flag
    liquorbotId,        // 3-digit ID string
    setLiquorbotId,     // function to set the LiquorBot ID
    isOverridden,       // true if user is currently in an event override
    restorePreviousId,  // to end the override
    clearPrevLiquorbotId,
    slotCount,          // <--- NEW: number of slots for this device
  } = useLiquorBot();

  /*────────── State ──────────*/
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<{ title: string; message: string } | null>(null);
  const [isMaintenanceCollapsed, setIsMaintenanceCollapsed] = useState(false); // open by default
  const maintenanceRot = useState(new Animated.Value(1))[0]; // open by default
  const [isAdvancedCollapsed, setIsAdvancedCollapsed] = useState(true); // open by default
  const advancedRot = useState(new Animated.Value(1))[0]; // open by default
  const [slots, setSlots] = useState<number[]>(Array(15).fill(0));
  const [volumes, setVolumes] = useState<number[]>(Array(15).fill(0)); // New: volumes for each slot
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);
  const [undoReady, setUndoReady] = useState(false);
  const [username, setUsername]   = useState('guest');  
  const [modalInitialTab, setModalInitialTab] = useState<'select' | 'volume'>('select'); // New state for modal tab
  const suppressUndo = useRef(false); // Prevent undo from being tracked during undo

  /*────────── Active-event helper ──────────*/
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOverridden || liquorbotId === '000') {      // nothing to track
      setActiveEventId(null);
      return;
    }
    (async () => {
      try {
        const nowISO = new Date().toISOString();
        const { data } = await client.graphql({
          query: listEvents,
          variables: {
            filter: {
              liquorbotId: { eq: Number(liquorbotId) },
              startTime:   { le: nowISO },              // has started
              endTime:     { ge: nowISO },              // not finished
            },
          },
          authMode: 'userPool',
        }) as { data: any };

        const ev = data?.listEvents?.items?.[0];
        setActiveEventId(ev?.id ?? null);
      } catch (e) {
        console.warn('Could not fetch active event', e);
        setActiveEventId(null);
      }
    })();
  }, [isOverridden, liquorbotId]);

      const handleEmptySystem = () => {
        router.push('/empty-system'); // Navigate to empty system page
      };

  useEffect(() => {
    (async () => {
      try { setUsername((await getCurrentUser()).username); }
      catch { /* guest – keep ‘guest’ */ }
    })();
  }, []);

  // On mount, check if an undo buffer exists for this user/device
  useEffect(() => {
    (async () => {
      try {
        const key = getUndoKey(username, liquorbotId);
        const val = await AsyncStorage.getItem(key);
        setUndoReady(!!val);
      } catch {}
    })();
  }, [username, liquorbotId]);

  /*────────── Animations ──────────*/
  const toggleMaintenance = () => {
    Animated.timing(maintenanceRot, {
      toValue: isMaintenanceCollapsed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setIsMaintenanceCollapsed(!isMaintenanceCollapsed);
  };
  const maintenanceRotate = maintenanceRot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const toggleAdvanced = () => {
    Animated.timing(advancedRot, {
      toValue: isAdvancedCollapsed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setIsAdvancedCollapsed(!isAdvancedCollapsed);
                  <ActionRow
                    label="Empty System"
                    icon="water"
                    onPress={handleEmptySystem}
                    info="Empty any slot for cleaning or maintenance."
                    onInfoPress={() => {
                      setSelectedInfo({
                        title: 'Empty System',
                        message: 'Select a slot to empty. Place a container under the output spout to collect the liquid. Use this before cleaning or swapping ingredients.'
                      });
                      setInfoModalVisible(true);
                    }}
                  />
  };
  const advancedRotate = advancedRot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  /*────────── MQTT maintenance helpers ──────────*/
  const maintenanceTopic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
  const publishMaintenance = async (msg: any) => {
    try {
      await pubsub.publish({ topics: [maintenanceTopic], message: msg });
    } catch (e) {
      console.error('Maintenance publish error', e);
    }
  };
  const bumpIfDisconnected = (fn: () => void) => {
    if (!isConnected) {
      Alert.alert('Connect to a device first');
      return;
    }
    fn();
  };
  const handleReadySystem = () => publishMaintenance({ action: 'READY_SYSTEM' });
  // Removed old handleEmptySystem to avoid redeclaration. Now handled by navigation to /empty-system
  const handleDeepClean = () => {
    strongVibration(); // Vibrate before showing the deep clean confirmation
    Alert.alert(
      'Deep Clean',
      'All ingredient containers must be empty.\n\n'
      + 'Place warm water in a spare container and attach it to Slot 1. Proceed with deep clean?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          style: 'destructive',
          onPress: () => publishMaintenance({ action: 'DEEP_CLEAN' }),
        },
      ]
    );
  };
  const handleCalibrate = () => {
    router.push('/calibration-setup'); // Navigate to calibration setup page
  };

  /*────────── Wi-Fi DISCONNECT helper ──────────*/
  const confirmDisconnect = () => {
    Alert.alert(
      'Disconnect LiquorBot?',
      'Kicking LiquorBot off Wi-Fi will reboot it into Bluetooth pairing mode. You’ll have to re-enter Wi-Fi credentials afterwards. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            publishMaintenance({ action: 'DISCONNECT_WIFI' });
            Alert.alert('Disconnecting…', 'LiquorBot is rebooting into Bluetooth mode.');
          },
        },
      ]
    );
  };

  /*────────── Fetch ingredients list ──────────*/
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ingUrl = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const resp = await fetch(ingUrl.url);
        const data = await resp.json();
        setIngredients(data);
      } catch (err) {
        console.error('S3 ingredients fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setSlots(s => s.slice(0, slotCount));
    setVolumes(v => v.slice(0, slotCount));
  }, [slotCount]);

  // Custom filteredIngredients: sort by ID for Alcohol/Mixer/Sour/Sweet, alpha for All/Misc
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  const [searchQuery, setSearchQuery] = useState(''); // Define searchQuery state
  const [selectedCategory, setSelectedCategory] = useState('All'); // Define selectedCategory state

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
      // For Misc or any other, sort alphabetically
      return a.name.localeCompare(b.name);
    });

  /*──────────────── Slot-config MQTT subscribe/publish ────────────────*/
  const slotTopic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null); 

  const publishSlot = (m: any) => 
    pubsub.publish({ topics: [slotTopic], message: m }).catch(console.error);

  useEffect(() => {
    if (!isConnected || liquorbotId === '000' || slotCount === 0) return;

    pubsub.publish({ topics:[slotTopic], message:{ action:'GET_VOLUMES' } })
      .catch(console.error);
    
    const sub = pubsub.subscribe({ topics: [slotTopic] }).subscribe({
      next: ({ value, ...rest }) => {
        const text = value ?? rest;                     // v5 or v6
        let msg: any;
        try {
          msg = typeof text === 'string' ? JSON.parse(text) : text;
        } catch {
          return;
        }
        if (!msg) return;

        if (msg.action === 'CURRENT_CONFIG' && Array.isArray(msg.slots)) {
          // Only show slots up to the device's slot count
          setSlots(msg.slots.slice(0, slotCount));
          setConfigLoading(false);
          if (retryIntervalRef.current) {
            clearInterval(retryIntervalRef.current);
            retryIntervalRef.current = null;
          }
        }

        if (msg.action === 'CURRENT_VOLUMES' && Array.isArray(msg.volumes)) {
          // Only show volumes up to the device's slot count
          setVolumes(msg.volumes.slice(0, slotCount));
          setConfigLoading(false);
        }

        if (msg.action === 'VOLUME_UPDATED' && 
            typeof msg.slot === 'number' && 
            typeof msg.volume === 'number' &&
            msg.slot < slotCount) {
          setVolumes(prev => {
            const next = [...prev];
            next[msg.slot] = msg.volume;
            return next;
          });
        }
      },
      error: err => console.error('slot-config sub error:', err),
    });

    const fetchConfig = () => {
      publishSlot({ action: 'GET_CONFIG' });
      publishSlot({ action: 'GET_VOLUMES' });
    };

    fetchConfig();
    retryIntervalRef.current = setInterval(fetchConfig, 1500);

    return () => {
      sub.unsubscribe();
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [isConnected, liquorbotId, slotCount]); // Added slotCount dependency

  const handleClearAll = () =>                                        
    bumpIfDisconnected(async () => {
      await saveUndo(slots.slice(0, slotCount), username, liquorbotId);
      setUndoReady(true);            
      publishSlot({ action: 'CLEAR_CONFIG' });
      setSlots(Array(slotCount).fill(0));
      setVolumes(Array(slotCount).fill(0)); // Clear volumes too
    });
  const handleSetSlot = (idx: number, id: number) => {
    setSlots(prev => {
      if (!suppressUndo.current) {            // snapshot *before* we mutate
        saveUndo(prev.slice(0, slotCount), username, liquorbotId);
        setUndoReady(true);
      }
      const next = [...prev];
      next[idx] = id;
      return next;
    });
    publishSlot({ action: 'SET_SLOT', slot: idx + 1, ingredientId: id });
  };
  const handleSetVolume = (idx: number, volume: number) => {
    setVolumes(prev => {
      const next = [...prev];
      next[idx] = volume;
      return next;
    });
    publishSlot({ action: 'SET_VOLUME', slot: idx, volume }); // idx is 0-based for ESP
  };

  /*────────── Ingredient helpers ──────────*/
  const categories = ['All', 'Alcohol', 'Mixer', 'Sour', 'Sweet', 'Misc'];
  const ingName = (id: number | string) =>
    ingredients.find(i => i.id === Number(id))?.name ?? '';

  const truncate = (str: string, n: number) => str && str.length > n ? str.slice(0, n - 1) + '…' : str;

  /*────────── Components ──────────*/
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
        <TouchableOpacity style={styles.ingredientItem} onPress={onPress}>
          <Text style={styles.ingredientText}>{item.name}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const ActionRow = ({
    label,
    icon,
    onPress,
    info,
    onInfoPress,
  }: {
    label: string;
    icon: any;
    onPress: () => void;
    info: string;
    onInfoPress: () => void;
  }) => {
    /* ───── constants & animated refs ───── */
    const CIRCLE     = 48;                         // Ø of the slider “logo”
    const x          = useRef(new Animated.Value(0)).current;
    const progress   = useRef(new Animated.Value(0)).current;   // 0-1
    const [rowW, setRowW] = useState(0);
    const [done, setDone] = useState(false);
    const [failed, setFailed] = useState(false);
    const [bouncing, setBouncing] = useState(false);

    /* ───── hide info + fade text while dragging ───── */
    const infoOpacity  = progress.interpolate({ inputRange: [0, 0.05], outputRange: [1, 0],  extrapolate: 'clamp' });
    const textOpacity  = progress.interpolate({ inputRange: [0, 1   ], outputRange: [1, 0.35]});
    const circleColor  = failed ? '#d44a4a' /* red */ : done ? '#63d44a' /* green */ : '#CE975E';

    /* ───── drag logic ───── */
    const responder = useMemo(() =>
      PanResponder.create({
        // Capture touches and prevent parent ScrollView from intercepting
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 4;
        },
        // Only set pan responder if horizontal movement is greater than vertical (prevents vertical scroll on iOS)
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 4;
        },
        onStartShouldSetPanResponder: () => true,
        // Prevent parent or other responders from taking the gesture
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          if (!rowW) return;
          const max = rowW - CIRCLE - 2;                          // 4 px padding left & right
          const pos = Math.max(0, Math.min(g.dx, max));
          x.setValue(pos);
          progress.setValue(pos / max);
        },
        onPanResponderRelease: () => {
          if (!rowW) return;
          const max = rowW - CIRCLE - 2;
          x.stopAnimation(pos => {
            if (pos >= max * 0.9) {                               // ── SUCCESS ──
              if (!isConnected) {
                setFailed(true);
                Animated.timing(x, { toValue: max, duration: 150, useNativeDriver: true }).start(() => {
                  setTimeout(() => {
                    Animated.timing(x, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
                      progress.setValue(0);
                      setFailed(false);
                    });
                  }, 600); // pause w/ red X
                });
                return;
              }
              setDone(true);
              Animated.timing(x, { toValue: max, duration: 150, useNativeDriver: true }).start(async () => {
                try { await onPress(); } catch {}
                setTimeout(() => {
                  Animated.timing(x, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
                    progress.setValue(0);
                    setDone(false);
                  });
                }, 600);                                           // pause w/ green tick
              });
            } else {                                              // ── cancel → snap back ──
              Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(() => progress.setValue(0));
            }
          });
        },
      })
    , [rowW]);

    // ───── Bounce animation on row press ─────
    const handleRowPress = () => {
      if (bouncing) return;
      setBouncing(true);
      Animated.sequence([
        Animated.timing(x, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.spring(x, { toValue: 0, friction: 5, tension: 50, useNativeDriver: true }),
      ]).start(() => setBouncing(false));
    };

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.actionRow}
        onLayout={e => setRowW(e.nativeEvent.layout.width)}
        onPress={handleRowPress}
      >

        {/* label */}
        <Animated.Text
          style={[styles.actionLabel, { opacity: textOpacity }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Animated.Text>

        {/* info button (fades away while dragging) */}
        <Animated.View style={{ opacity: infoOpacity }}>
          <TouchableOpacity onPress={onInfoPress}>
            <Ionicons name="information-circle-outline" size={20} color="#4F4F4F" />
          </TouchableOpacity>
        </Animated.View>

        {/* draggable circle */}
        <Animated.View
          {...responder.panHandlers}
          style={[
            styles.sliderCircle,
            { transform: [{ translateX: x }], backgroundColor: circleColor }
          ]}
        >
          <Ionicons name={failed ? 'close' : done ? 'checkmark' : icon} size={24} color="#141414" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  /*────────── Render ──────────*/
  // Debug: log slotCount, slots, and volumes before rendering
  console.log('[UI] slotCount:', slotCount, 'slots:', slots, 'volumes:', volumes);
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* close */}
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={30} color="#DFDCD9" />
        </TouchableOpacity>

        <Text style={styles.headerText}>Device Settings</Text>

        {/* connection box */}
        <TouchableOpacity
          style={styles.connectionBox}
          onPress={() => router.push('/connectivity-settings' as any)}
          activeOpacity={0.6}
        >
          <View style={styles.bluetoothIconContainer}>
            <Ionicons name="bluetooth-outline" size={24} color="#DFDCD9" />
          </View>
          <Text style={styles.liquorBotText}>LiquorBot</Text>
          <View style={styles.connectionStatusRow}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#63d44a' : '#d44a4a' }]} />
            <Text style={styles.connectionStatusText}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ─────────────────── MAINTENANCE ─────────────────── */}
        <View style={styles.maintenanceContainer}>
          <TouchableOpacity
            style={styles.maintenanceHeader}
            onPress={toggleMaintenance}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'column', flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.sectionHeader}>Maintenance</Text>
                <Animated.View style={{ transform: [{ rotate: maintenanceRotate }] }}>
                  <Ionicons name="chevron-down" size={20} color="#DFDCD9" />
                </Animated.View>
              </View>
              {isMaintenanceCollapsed && (
                <Text style={{ fontSize: 12, color: '#4F4F4F', marginTop: -10 }}>Click to expand</Text>
              )}
            </View>
          </TouchableOpacity>

          {!isMaintenanceCollapsed && (
            <Animated.View>
              <ActionRow
                label="Load Ingredients"
                icon="server"
                onPress={() => { strongVibration(); bumpIfDisconnected(handleReadySystem); }}
                info="Primes every tube so the first pour is instant."
                onInfoPress={() => {
                  setSelectedInfo({ title: "Load Ingredients", message: "Primes every tube so the first pour is instant." });
                  setInfoModalVisible(true);
                }}
              />
              <ActionRow
                label="Empty System"
                icon="server-outline"
                onPress={() => { strongVibration(); bumpIfDisconnected(handleEmptySystem); }}
                info="Pumps liquid back to its bottles for safe storage."
                onInfoPress={() => {
                  setSelectedInfo({ title: "Empty System", message: "Pumps liquid back to its bottles for safe storage." });
                  setInfoModalVisible(true);
                }}
              />
              <ActionRow
                label="Deep Clean"
                icon="water-outline"
                onPress={() => { strongVibration(); bumpIfDisconnected(handleDeepClean); }}
                info="Runs warm water through all tubes. Bottles must be empty."
                onInfoPress={() => {
                  setSelectedInfo({ title: "Deep Clean", message: "Runs warm water through all tubes. Bottles must be empty." });
                  setInfoModalVisible(true);
                }}
              />
              {/* Calibrate Button */}
              <ActionRow
                label="Calibrate"
                icon="speedometer-outline"
                onPress={() => { strongVibration(); bumpIfDisconnected(handleCalibrate); }}
                info="Calibrates pump speed for accurate pours. Follow on-screen instructions."
                onInfoPress={() => {
                  setSelectedInfo({ title: "Calibrate", message: "Calibrates the speed of the pumps to ensure accurate pours every time. Follow the on-screen instructions to complete calibration." });
                  setInfoModalVisible(true);
                }}
              />
            </Animated.View>
          )}
        </View>

        {/* ─────────────────── CONFIGURE SLOTS ─────────────────── */}
        <View style={styles.slotsContainer}>
          <View style={[styles.slotsHeaderContainer, { justifyContent: 'space-between' }]}> 
            <Text style={styles.sectionHeader}>Configure Slots</Text>
            <View style={{ flexDirection: 'row', marginLeft: 'auto' }}>
              {undoReady && (
                <TouchableOpacity
                  onPress={async () => {
                    if (!isConnected || !undoReady) return;
                    const prev = await popUndo(username, liquorbotId);
                    if (!prev) return;
                    suppressUndo.current = true;
                    setUndoReady(false);
                    await Promise.all(
                      prev.map((ingId, i) =>
                        publishSlot({ action: 'SET_SLOT', slot: i + 1, ingredientId: ingId })
                      )
                    );
                    await publishSlot({ action: 'GET_CONFIG' });
                    setSlots(prev);
                    setTimeout(() => { suppressUndo.current = false; }, 1500);
                  }}
                  disabled={!undoReady || !isConnected}
                  style={{ marginRight: 24, marginLeft: 0 }}
                >
                  <Text style={[
                    styles.clearAllButtonText,
                    !isConnected && { opacity: 0.5 },
                  ]}>
                    Undo
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClearAll} disabled={!isConnected}>
                <Text style={[
                  styles.clearAllButtonText,
                  !isConnected && { opacity: 0.5 },
                ]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Slot config loading overlay (local to slots box) */}
          {configLoading && (
            <View style={styles.slotsLoadingOverlay} pointerEvents="auto"> {/* Changed from none to auto */}
              <ActivityIndicator size="large" color="#CE975E" style={{ marginTop: 100 }} />
            </View>
          )}

          {!isConnected && (
            <Text style={styles.connectDeviceMessage}>Please connect a device to start configuring.</Text>
          )}

          {isConnected && slots.slice(0, slotCount).map((ingredientId, idx) => {
            // Determine color based on volume
            let volumeBg = '#232323'; // default gray
            let volumeTextColor = '#CE975E'; // default gold text
            let volumeButtonDisabled = false;
            let volumeButtonStyle = {};
            if (!ingName(ingredientId)) {
              // No ingredient: gray out and disable
              volumeBg = '#222';
              volumeTextColor = '#555';
              volumeButtonDisabled = true;
              volumeButtonStyle = { opacity: 0.5 };
            } else if (typeof volumes[idx] === 'number' && !configLoading) {
              if (volumes[idx] >= 1.5) {
                volumeBg = '#63d44a'; // green
                volumeTextColor = '#141414';
              } else if (volumes[idx] >= 0.5) {
                volumeBg = '#CE975E'; // yellow/orange
                volumeTextColor = '#141414';
              } else if (volumes[idx] > 0) {
                volumeBg = '#d44a4a'; // red
                volumeTextColor = '#141414';
              }
            }
            return (
              <View key={idx} style={styles.slotRow}>
                <Text style={styles.slotLabel}>Slot {idx + 1}</Text>
                <View style={styles.pickerButtonContainer}>
                  <TouchableOpacity
                    style={[styles.pickerButton, !isConnected && styles.pickerButtonDisconnected]}
                    onPress={() => {
                      if (!isConnected) {
                        setShowConnectPrompt(true);
                        setTimeout(() => setShowConnectPrompt(false), 2000);
                        return;
                      }
                      setSelectedSlot(idx);
                      setModalInitialTab('select');
                      setModalVisible(true);
                    }}
                  >
                    <Text style={[styles.pickerButtonText, ingName(ingredientId) && styles.selectedPickerButtonText]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {truncate(ingName(ingredientId), 14) || 'Select Ingredient'}
                    </Text>
                  </TouchableOpacity>
                  {ingName(ingredientId) && (
                    <TouchableOpacity
                      style={[styles.clearSlotOverlay, !isConnected && styles.clearSlotOverlayDisabled]}
                      onPress={() => {
                        if (isConnected) {
                          handleSetSlot(idx, 0);
                          setVolumes(prev => {
                            const next = [...prev];
                            next[idx] = 0;
                            return next;
                          });
                          // Send volume clear to microcontroller as well
                          publishSlot({ action: 'SET_VOLUME', slot: idx, volume: 0 });
                        }
                      }}
                      disabled={!isConnected}
                    >
                      <Text style={styles.clearSlotOverlayText}>X</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* Updated: Volume display is now a button with dynamic color, grayed out and disabled if no ingredient */}
                <TouchableOpacity
                  style={[styles.volumeButton, { backgroundColor: volumeBg }, volumeButtonStyle]}
                  onPress={() => {
                    if (volumeButtonDisabled) return;
                    setSelectedSlot(idx);
                    setModalInitialTab('volume');
                    setModalVisible(true);
                  }}
                  activeOpacity={volumeButtonDisabled ? 1 : 0.7}
                  disabled={volumeButtonDisabled}
                >
                  <Text style={[styles.volumeButtonText, { color: volumeTextColor }]}>{volumes[idx]?.toFixed(1)} L</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ─────────────────── ADVANCED SETTINGS / DANGER ZONE ─────────────────── */}
        {isConnected && (
          <View style={styles.advancedContainer}>
            <TouchableOpacity
              style={styles.advancedHeader}
              onPress={toggleAdvanced}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'column', flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.sectionHeader}>Advanced Settings</Text>
                  <Animated.View style={{ transform: [{ rotate: advancedRotate }] }}>
                    <Ionicons name="chevron-down" size={20} color="#DFDCD9" />
                  </Animated.View>
                </View>
                {isAdvancedCollapsed && (
                  <Text style={{ fontSize: 12, color: '#4F4F4F', marginTop: -10 }}>Click to expand</Text>
                )}
              </View>
            </TouchableOpacity>

            {!isAdvancedCollapsed && (
              <View style={styles.dangerZoneContainer}>
                <Text style={styles.dangerZoneHeader}>Danger Zone</Text>

                {/* Disconnect from Device button */}
                <TouchableOpacity
                  style={styles.disconnectButton}
                  onPress={async () => {
                  if (isOverridden) {
                    Alert.alert(
                      'In Event Mode',
                      'LiquorBot is currently running an event. You can wait until the event ends (you’ll be disconnected afterwards), delete the event and disconnect now (removes the event and disconnects all guests), or cancel to stay connected.',
                      [
                        {
                          text: 'Delete Event & Disconnect',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              if (activeEventId) {
                                await client.graphql({
                                  query: deleteEvent,
                                  variables: { input: { id: activeEventId } },
                                  authMode: 'userPool',
                                });
                              }
                            } catch (err) {
                              console.warn('Event deletion failed (continuing disconnect):', err);
                            } finally {
                              // Clear all device info and storage
                              await AsyncStorage.multiRemove([
                                'liquorbotId',
                                'allowedDrinks-' + liquorbotId,
                                'userGroups',
                              ]);
                              restorePreviousId();
                              setLiquorbotId('000');
                              setConfigLoading(false);
                              Alert.alert('Disconnected', 'Event deleted and device fully disconnected.');
                            }
                          },
                        },
                        {
                          text: 'Wait until event ends',
                          style: 'default',
                          onPress: () => {
                            clearPrevLiquorbotId();
                          },
                        },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  } else {
                    // simple disconnect if no override
                    await AsyncStorage.multiRemove([
                      'liquorbotId',
                      'allowedDrinks-' + liquorbotId,
                      'userGroups',
                    ]);
                    setLiquorbotId('000');
                    setConfigLoading(false);
                    Alert.alert('Disconnected', 'You have disconnected from the device.');
                  }
                }}
                >
                  <Text style={styles.disconnectButtonText}>Disconnect from Device</Text>
                </TouchableOpacity>

                {/* Disconnect from Wi-Fi button */}
                <TouchableOpacity style={styles.disconnectButton} onPress={() => confirmDisconnect()}>
                  <Text style={styles.disconnectButtonText}>Disconnect from Wi-Fi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {showConnectPrompt && (
          <View style={styles.connectPrompt}>
            <Text style={styles.connectPromptText}>Please connect a device first</Text>
          </View>
        )}
      </ScrollView>

      {/*────────── Info Modal (maintenance row details) ──────────*/}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.infoModalContainer}>
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>{selectedInfo?.title}</Text>
            <Text style={styles.infoModalText}>{selectedInfo?.message}</Text>
            <TouchableOpacity style={styles.infoModalButton} onPress={() => setInfoModalVisible(false)}>
              <Text style={styles.infoModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/*────────── Ingredient Selection Modal ──────────*/}
      <IngredientSlotModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setSelectedSlot(null); }}
        ingredients={ingredients}
        slots={slots}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
        handleSetSlot={handleSetSlot}
        handleSetVolume={handleSetVolume} // NEW PROP
        volumes={volumes} // NEW PROP
        loading={loading}
        categories={categories}
        ingName={ingName}
        initialTab={modalInitialTab} // Pass the initialTab prop
      />
    </View>
  );
}

/*────────────────── Styles ──────────────────*/
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  closeButton: { position: 'absolute', top: 70, left: 25, zIndex: 1001 },
  headerText: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContainer: { paddingTop: 130, paddingHorizontal: 20, paddingBottom: 20 },

  connectionBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    minHeight: 100,
  },
  liquorBotText: { fontSize: 24, color: '#DFDCD9', fontWeight: 'bold', textAlign: 'left', width: '100%' },
  connectionStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5, marginTop: 5 },
  connectionStatusText: { fontSize: 14, color: '#4F4F4F', textAlign: 'left', width: '100%', marginTop: 5 },
  bluetoothIconContainer: { position: 'absolute', top: 20, right: 20, zIndex: 999, padding: 10 },

  maintenanceContainer: { backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20, marginBottom: 20 },
  sectionHeader: { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  maintenanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  actionLabel: {
    color: '#DFDCD9',
    fontSize: 16,
    paddingLeft: 40,
    flex: 1,
    opacity: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    maxWidth: '100%',
    textAlignVertical: 'center',
    textAlign: 'left',
    includeFontPadding: false,
  },
  sliderCircle: {
    position: 'absolute',
    top: 5,
    left: 8,
    width: 35,
    height: 35,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#CE975E',
    opacity: 0.9,                 // a touch of transparency
  },

  slotsContainer: { backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20 },
  slotsHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  connectDeviceMessage: { color: '#d44a4a', fontSize: 12, textAlign: 'center', marginBottom: 25 },
  slotRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  slotLabel: { color: '#DFDCD9', fontSize: 16, marginRight: 10, width: 80 },
  pickerButtonContainer: { flex: 1, position: 'relative' },
  pickerButton: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerButtonDisconnected: { borderColor: '#d44a4a' },
  pickerButtonText: { color: '#4f4f4f', fontSize: 16 },
  selectedPickerButtonText: { color: '#dfdcd9' },
  clearSlotOverlay: { position: 'absolute', top: 6, right: 10, padding: 5 },
  clearSlotOverlayDisabled: { opacity: 0.5 },
  clearSlotOverlayText: { color: '#808080', fontSize: 14, fontWeight: 'bold' },

  /* advanced settings / danger zone */
  advancedContainer: { backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20, marginTop: 20, marginBottom: 20 },
  advancedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dangerZoneContainer: { marginTop: 15, padding: 15, borderWidth: 1, borderColor: '#d44a4a', borderRadius: 10 },
  dangerZoneHeader: { color: '#d44a4a', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  disconnectButton: {
    backgroundColor: '#d44a4a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  disconnectButtonText: { color: '#DFDCD9', fontSize: 16, fontWeight: 'bold' },

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
  connectPromptText: { color: '#DFDCD9', fontSize: 14, textAlign: 'center' },
  clearAllButtonText: { color: '#4F4F4F', fontSize: 14, fontWeight: 'bold', },

  /* ingredient modal */
  modalContainer: { flex: 1, backgroundColor: '#141414', padding: 20 },
  modalCloseButton: { position: 'absolute', top: 30, left: 20, zIndex: 10 },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DFDCD9',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: -20,
  },
  horizontalPickerContainer: { alignItems: 'center', paddingVertical: 5 },
  horizontalPicker: { flexDirection: 'row', alignItems: 'center' },
  categoryButton: { marginTop: 40, paddingVertical: 10, paddingHorizontal: 5, marginHorizontal: 15 },
  categoryButtonContent: { alignItems: 'center' },
  categoryButtonText: { color: '#4F4F4F', fontSize: 14 },
  selectedCategoryText: { color: '#CE975E' },
  underline: { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    marginTop: 10,
  },
  searchIcon: { marginRight: 10 },
  searchBar: {
    flex: 1,
    color: '#DFDCD9',
    fontSize: 16,
    paddingVertical: 10,
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 15,
  },
  ingredientItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333333' },
  ingredientText: { color: '#DFDCD9', fontSize: 16 },

  /* info modal */
  infoModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  infoModalContent: { backgroundColor: '#1F1F1F', borderRadius: 15, padding: 20, width: '80%' },
  infoModalTitle: { color: '#CE975E', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  infoModalText: { color: '#DFDCD9', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  infoModalButton: {
    backgroundColor: '#CE975E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  infoModalButtonText: { color: '#141414', fontWeight: 'bold' },

  slotsLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,20,20,0.85)',
    justifyContent: 'flex-start', // align spinner to top
    alignItems: 'center',
    paddingTop: 10, // add space from the top
    zIndex: 10,
    borderRadius: 10,
  },
  volumeButton: {
    backgroundColor: '#232323', // changed to a gray color
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CE975E',
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    // Match height and vertical padding to pickerButton
    minHeight: 44,
    height: 44,
    // Remove margin if needed to stick to ingredient box
    marginTop: 0,
    marginBottom: 0,
  },
  volumeButtonText: {
    color: '#CE975E',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
