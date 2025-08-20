// -----------------------------------------------------------------------------
// File: menu.tsx
// Description: Displays the drink menu for the LiquorBot app, including drink
//              details, categories, search / filter, and IoT integration for
//              pouring drinks.  Adds a “make-able” filter toggle that limits
//              the list to drinks that can be prepared with the ingredients
//              currently loaded on the ESP32 (pulled via MQTT) **and now
//              injects the user’s CustomRecipe items pulled from the GraphQL
//              API so they show up alongside built-in drinks.  *NEW:* every
//              successful pour is persisted to the PouredDrink model so it can
//              be shown in the pour-history popup.
//              
//              *27 May 2025 FIX*: ensure the slot‑configuration request is sent
//              every time the menu gains focus so that the “only makeable”
//              filter never shows an empty list due to a missed config reply.
//              A retry timer adds further redundancy.
// Author: Nathan Hambleton
// Updated: May 28 2025 – redundant get‑config requests on screen focus
// -----------------------------------------------------------------------------
import React, { useRef, useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  Text, View, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, LayoutAnimation, Platform, UIManager, Animated,
  TextInput, Modal, Switch, ActivityIndicator, Alert,
  PanResponder,
  RefreshControl,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import Ionicons      from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage  from '@react-native-async-storage/async-storage';

// Amplify & PubSub
import { Amplify }   from 'aws-amplify';
import { PubSub }    from '@aws-amplify/pubsub';
import config        from '../../src/amplifyconfiguration.json';

// GraphQL & Auth
import { generateClient, GraphQLResult } from 'aws-amplify/api';
import { createLikedDrink, deleteLikedDrink, createPouredDrink } from '../../src/graphql/mutations';
import { listLikedDrinks } from '../../src/graphql/queries';
import { getCurrentUser }  from 'aws-amplify/auth';
import { getUrl }          from 'aws-amplify/storage';

// LiquorBot context
import { useLiquorBot } from '../components/liquorbot-provider';
import * as Haptics from 'expo-haptics';
import { AuthModalContext } from '../components/AuthModalContext';
import { BlurView } from 'expo-blur';

import { ToastAndroid, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

Amplify.configure(config);
const client = generateClient();

const pubsub = new PubSub({
  region  : 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

// ─── constants ────────────────────────────────────────────────────────────────
/** payload understood by device-firmware & DeviceSettings screen */
const GET_CONFIG = { action: 'GET_CONFIG' };

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const LIST_CUSTOM_RECIPES_WITH_ING = /* GraphQL */ `
  query ListCustomRecipes {
    listCustomRecipes {
      items {
        id
        name
        description
        image
        owner
        ingredients { ingredientID amount priority }
        createdAt
      }
    }
  }
`;

// Set a constant for filter modal blur intensity (match tab bar/buttons for consistency)
const FILTER_MODAL_BLUR_INTENSITY = 70;

// --------------------------- TYPES ---------------------------
type Drink = {
  id: number;
  name: string;
  category: string;
  description?: string;
  image: string;
  ingredients?: string;
  isCustom?: boolean;
  recipeId?: string;
  imageKey?: string | null;
  owner?: string | null;
};

type BaseIngredient = { id: number; name: string; type: string };

type ParsedIngredient = {
  id: number;
  name: string;
  amount: number;
  priority: number;
};

// ------------ HELPERS ------------
function parseIngredientString(
  ingredientString: string,
  allIngredients: BaseIngredient[],
): ParsedIngredient[] {
  if (!ingredientString) return [];
  return ingredientString.split(',').map((chunk) => {
    const [idStr, amountStr, priorityStr] = chunk.split(':');
    const id = parseInt(idStr, 10);
    const amount = parseFloat(amountStr);
    const priority = parseInt(priorityStr, 10);
    const ingObj = allIngredients.find((ing) => ing.id === id);
    const name = ingObj ? ingObj.name : `Ingredient #${id}`;
    return { id, name, amount, priority };
  });
}

// Helper to get local file path for a drink image
function getLocalDrinkImagePath(drinkId: number, imageUrl: string) {
  const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
  return `${FileSystem.cacheDirectory || FileSystem.documentDirectory}drink-images/drink_${drinkId}.${ext}`;
}

// Helper to check if local image exists and return correct source
function getDrinkImageSource(drink: Drink): Promise<{ uri: string }> {
  if (!drink.image) return Promise.resolve({ uri: '' });
  const localUri = getLocalDrinkImagePath(drink.id, drink.image);
  return FileSystem.getInfoAsync(localUri)
    .then((info) => info.exists ? { uri: localUri } : null)
    .then(async (hit) => {
      if (hit) return hit;                          // cached OK
      /* ① try basename from S3 key – works for pre-v1 caches */
      const basename = drink.image.split('/').pop()!.split('?')[0];
      const altUri   = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}drink-images/${basename}`;
      const altInfo  = await FileSystem.getInfoAsync(altUri).catch(()=>({exists:false}));
      if (altInfo.exists) return { uri: altUri };

      /* ② nothing local – download and store under the *correct* filename */
      await FileSystem.makeDirectoryAsync(
        localUri.substring(0, localUri.lastIndexOf('/')),
        { intermediates: true },
      );
      await FileSystem.downloadAsync(drink.image, localUri);
      return { uri: localUri };
    })
  .catch(() => ({ uri: drink.image }));           // totally offline
}

const toNumericId = (uuid: string) =>
  2_000_000 + parseInt(uuid.slice(-6), 36);

/* -------------------------------------------------------------------------- */
/*                              SINGLE DRINK CARD                             */
/* -------------------------------------------------------------------------- */

interface DrinkItemProps {
  drink: Drink;
  isExpanded: boolean;
  isLiked: boolean;
  isMakeable: boolean;
  toggleFavorite: (id: number) => Promise<void>;
  onExpand: (id: number) => void;
  onCollapse: () => void;
  allIngredients: BaseIngredient[];
  onExpandedLayout?: (layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  currentUserId: string | null;
}

// ────────────────────────── helpers ──────────────────────────
function buildSlotCommand(
  ingredientString: string,
  slots: number[],      // current slot -> ingredientId map, length 15
  qty: number,          // quantity selected on the UI
): string {
  if (!ingredientString) return '';

  return ingredientString
    .split(',')                                // id:amt:prio  …
    .map(chunk => {
      const [idStr, amtStr, prioStr] = chunk.split(':');
      const ingId   = Number(idStr);
      const amount  = Number(amtStr) * qty;    // multiply by user’s qty
      const prio    = Number(prioStr);

      // look up which slot holds this ingredient ID
      const slotIdx = slots.findIndex(id => id === ingId);
      if (slotIdx === -1) {
        console.warn(`Ingredient ${ingId} not loaded – skipping`);
        return null;                           // skip missing ingredients
      }

      const slotNum = slotIdx + 1;             // slots are 1‑based on ESP
      return `${slotNum}:${amount}:${prio}`;
    })
    .filter(Boolean)                           // drop nulls
    .join(',');
}

function DrinkItem({
  drink,
  isExpanded,
  isLiked,
  toggleFavorite,
  onExpand,
  onCollapse,
  allIngredients,
  onExpandedLayout,
  currentUserId,
}: DrinkItemProps) {
  const [animValue] = useState(new Animated.Value(isExpanded ? 1 : 0));
  const [quantity, setQuantity] = useState(1);
  const { isConnected, slots, liquorbotId } = useLiquorBot();
  const [logging, setLogging] = useState(false); // prevent double-taps
  const [statusAnim] = useState(new Animated.Value(0));
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [scheduledNotificationId, setScheduledNotificationId] = useState<string | null>(null);
  const isDrinkMakeable = (drink: Drink) => {
    if (!drink.ingredients) return false;
    const needed = drink.ingredients
      .split(',')
      .map((c) => parseInt(c.split(':')[0], 10));
    return needed.every((id) => slots.includes(id));
  };
  const isMakeable = isDrinkMakeable(drink);

  const triggerStatus = (type: 'success' | 'error', message: string) => {
    setCountdown(null); // Clear countdown when showing a status
    setStatusType(type);
    setStatusMessage(message);
    statusAnim.setValue(1);
    Animated.timing(statusAnim, {
      toValue: 0,
      duration: 5000,
      useNativeDriver: false,
    }).start(() => setStatusType(null));
  };

  const parsedIngredients = parseIngredientString(
    drink.ingredients ?? '',
    allIngredients,
  );

  const router = useRouter();

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  /* --------------- pour-drink helpers --------------- */
  async function publishDrinkCommand() {
    const cmd = buildSlotCommand(drink.ingredients ?? '', slots, quantity);
    if (!cmd) throw new Error('No valid ingredients to pour');

    await pubsub.publish({
      topics: [`liquorbot/liquorbot${liquorbotId}/publish`],
      message: cmd,
    });
  }

  // 👇 NEW – log to GraphQL
  async function logPouredDrink(userID: string | null) {
    if (!userID) return;
    await client.graphql({
      query: createPouredDrink,
      variables: {
        input: {
          userID,
          drinkID: drink.id,
          drinkName: drink.name,
          volume: quantity,
          timestamp: new Date().toISOString(),
        },
      },
      authMode: 'userPool',
    });
    console.log('PouredDrink stored.');
  }

  function startCountdown(sec: number) {
    setStatusType(null); // Clear status when starting a countdown
    setStatusMessage('');
    setCountdown(Math.ceil(sec));
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(id);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handlePourDrink() {
    setCountdown(null); // clear any leftover timer
    if (logging || !isMakeable) return;
    if (!isConnected) { 
      console.warn('LiquorBot is not connected.'); 
      triggerStatus('error', 'LiquorBot is not connected.');
      return;
    }

    setLogging(true);

    try {
      await publishDrinkCommand();
      console.log(`Pouring ${drink.name} (${quantity})`);
    } catch (error) {
      console.error('Pour Failed', error);
      setLogging(false);
      triggerStatus('error', 'Pour Failed – please try again.');
    }
  }

  /* ------------------------------------------------------------------ */
  /*                      DRAG-TO-POUR  (clone of ActionRow)            */
  /* ------------------------------------------------------------------ */
  function PourSlider({
    canPour,
    onPour,
    isPouring,
    statusDone,
  }: {
    canPour: boolean;
    onPour: () => Promise<void>;
    isPouring: boolean;
    statusDone: 'success' | 'error' | null;
  }) {
    const CIRCLE = 48;
    const x        = useRef(new Animated.Value(0)).current;
    const progress = useRef(new Animated.Value(0)).current;
    const [rowW, setRowW] = useState(0);
    const [done, setDone] = useState(false);
    const [bounce, setBounce] = useState(false);
    const [successAnim] = useState(new Animated.Value(0));

    /* colours */
    const baseGray   = '#1F1F1F';
    const goldBorder = '#CE975E';
    const circleGold = '#CE975E';
    const circleGreen= '#63d44a';
    const circleRed  = '#D9534F';

    /* icon to show inside circle */
    const iconName = done
      ? 'checkmark'
      : isPouring
      ? 'sync'
      : 'chevron-forward';         // ◀︎▶︎ drag cue

    /* circle colour */
    const circleColor = !canPour
      ? '#4F4F4F' // gray out if not pourable
      : done
      ? statusDone === 'error'
        ? circleRed
        : circleGreen
      : circleGold;

    /* icon color */
    const iconColor = !canPour ? '#9E9E9E' : '#141414';

    // Animate green flash on success
    useEffect(() => {
      if (statusDone === 'success') {
        successAnim.setValue(1);
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }).start();
      }
    }, [statusDone]);

    // Animated border and circle color
    const animatedBorderColor = successAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [baseGray, circleGreen],
    });
    const animatedCircleColor = successAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [circleColor, circleGreen],
    });

    /* drag responder */
    const responder = useMemo(
      () =>
        PanResponder.create({
          // --- Use same logic as DeviceSettings for robust horizontal drag ---
          onStartShouldSetPanResponderCapture: () => canPour && !isPouring,
          onMoveShouldSetPanResponderCapture: (_, gestureState) => {
            return (
              canPour &&
              !isPouring &&
              Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
              Math.abs(gestureState.dx) > 4
            );
          },
          onMoveShouldSetPanResponder: (_, gestureState) => {
            return (
              canPour &&
              !isPouring &&
              Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
              Math.abs(gestureState.dx) > 4
            );
          },
          onStartShouldSetPanResponder: () => canPour && !isPouring,
          onPanResponderTerminationRequest: () => false,
          onPanResponderMove: (_, g) => {
            if (!rowW) return;
            const max = rowW - CIRCLE - 12;
            const pos = Math.max(0, Math.min(g.dx, max));
            x.setValue(pos);
            progress.setValue(pos / max);
          },
          onPanResponderRelease: () => {
            if (!rowW) return;
            const max = rowW - CIRCLE - 4;
            x.stopAnimation(async (pos) => {
              /* threshold = 90 % */
              if (pos >= max * 0.9) {
                setDone(true);
                // Haptic feedback: longer success vibration when pour starts
                if (Platform.OS === 'ios') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Animated.timing(x, {
                  toValue: 0,
                  duration: 350,
                  useNativeDriver: true,
                }).start(async () => {
                  try {
                    await onPour();
                  } finally {
                    /* let success/fail spinner run */
                    setTimeout(() => {
                      Animated.timing(x, {
                        toValue: 0,
                        duration: 350,
                        useNativeDriver: true,
                      }).start(() => {
                        progress.setValue(0);
                        setDone(false);
                      });
                    }, 600);
                  }
                });
              } else {
                Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(
                  () => progress.setValue(0),
                );
              }
            });
          },
        }),
      [rowW, canPour, isPouring],
    );

    /* bounce prompt on simple press */
    const handleTap = () => {
      if (bounce || !canPour || isPouring) return;
      setBounce(true);
      Animated.sequence([
        Animated.timing(x, { toValue: 12, duration: 60, useNativeDriver: true }),
        Animated.spring(x, { toValue: 0, friction: 5, tension: 50, useNativeDriver: true }),
      ]).start(() => setBounce(false));
    };

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.pourRow}
        onLayout={(e) => setRowW(e.nativeEvent.layout.width)}
        onPress={handleTap}
      >

        {/* --- Dynamic slider label --- */}
        <Animated.Text
          style={[
            styles.pourLabel,
            {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.35],
              }),
            },
            (!canPour || isPouring) && { color: '#4F4F4F' },
          ]}
        >
          {(!isConnected)
            ? 'Not Connected'
            : (!isMakeable)
              ? 'Missing Ingredients'
              : isPouring
                ? 'Pouring…'
                : 'Slide to Pour'}
        </Animated.Text>

        {/* draggable circle */}
        <Animated.View
          {...responder.panHandlers}
          style={[
            styles.pourCircle,
            {
              transform: [{ translateX: x }],
              backgroundColor: animatedCircleColor,
              borderWidth: 2,
              borderColor: animatedBorderColor,
            },
          ]}
        >
          {isPouring ? (
            <ActivityIndicator size="small" color={iconColor} />
          ) : (
            <Ionicons name={iconName} size={26} color={iconColor} />
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  // ADD NEW useEffect FOR ETA-BASED LOGGING (log pour on ETA, not just on success)
  useEffect(() => {
    if (!logging) return;
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        triggerStatus('error', 'No response from device');
        setLogging(false);
      }
    }, 30_000);

    const sub = pubsub
      .subscribe({ topics: [`liquorbot/liquorbot${liquorbotId}/receive`] })
      .subscribe({
        next: async (evt: any) => {
          if (!isMounted) return;
          const raw = evt?.value ?? evt;
          const payload: any =
            typeof raw === 'string'
              ? (() => { try { return JSON.parse(raw) } catch { return { message: raw } } })()
              : raw;
          const status = (payload.status ?? payload.result ?? payload.message ?? (typeof payload === 'string' ? payload : '')).toString().toLowerCase().trim();
          const isSuccess = status === 'success' || payload.success === true;

          // --- NEW: handle ETA ---
          if (status === 'eta' && typeof payload.eta === 'number') {
            // 1) schedule the notification for payload.eta seconds from now:
            const notificationId = await Notifications.scheduleNotificationAsync({
              content: {
                title: 'LiquorBot: Drink Ready!',
                body: `Your ${drink.name} has been poured, Enjoy!`,
              },
              trigger: { type: 'timeInterval', seconds: payload.eta, repeats: false } as any, // type workaround
            });
            // 2) store notificationId in state so you can cancel it
            setScheduledNotificationId(notificationId);
            // 3) start your countdown UI as before
            startCountdown(payload.eta);
            // 4) you can log the pour immediately on ETA
            try {
              const user = await getCurrentUser();
              await logPouredDrink(user?.username ?? null);
            } catch (e) {
              console.warn('✓ pour logged locally – failed to store in DB', e);
            }
            return; // wait for success/fail next
          }
          // -----------------------

          if (isSuccess) {
            // only show the in-app Alert if the app is frontmost
            if (AppState.currentState === 'active') {
              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Drink Ready', 'Your drink is ready! Enjoy.');
              } else if (Platform.OS === 'android') {
                ToastAndroid.show('Your drink is ready! Enjoy.', ToastAndroid.LONG);
              }
            }
            // (optional) cancel the pending ETA notification
            if (scheduledNotificationId) {
              await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
              setScheduledNotificationId(null);
            }
            triggerStatus('success', 'Success! Your drink was poured – enjoy.');
            setCountdown(null); // clear countdown on success
            try {
              const user = await getCurrentUser();
              await logPouredDrink(user?.username ?? null);
            } catch (e) {
              console.warn('✓ pour logged locally – failed to store in DB', e);
            }
            // --- (no need to schedule another notification here) ---
            setLogging(false);
            clearTimeout(timeoutId);
          } else if (['fail', 'failed', 'error'].includes(status)) {
            const reason =
              typeof payload === 'object' && payload?.error
                ? ` – ${payload.error}`
                : '';
            triggerStatus('error', `Pour Failed${reason}.`);
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
            // Cancel any pending notification if pour failed
            if (scheduledNotificationId) {
              await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
              setScheduledNotificationId(null);
            }
            setLogging(false);
            clearTimeout(timeoutId);
          }
        },
        error: (err: any) => {
          console.error('MQTT receive‑topic error:', err);
          triggerStatus('error', 'Error receiving device response.');
          setLogging(false);
          clearTimeout(timeoutId);
        },
      });

    return () => {
      isMounted = false;
      sub.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [logging, liquorbotId, scheduledNotificationId]);

  const handleToggleLike = () => toggleFavorite(drink.id);
  const canEdit = drink.isCustom && currentUserId && currentUserId === drink.owner;

  /* ---------------------------- RENDER --------------------------- */

  if (isExpanded) {
    // Gray effect for non-makeable drinks (expanded)
    const grayStyle = !isMakeable ? { opacity: 0.4 } : {};
    const grayIconStyle = !isMakeable ? { opacity: 0.4 } : {};
    const [imgSource, setImgSource] = useState<{ uri: string }>({ uri: '' });
    useEffect(() => {
      let mounted = true;
      getDrinkImageSource(drink).then(src => { if (mounted) setImgSource(src); });
      return () => { mounted = false; };
    }, [drink]);
    return (
      <Animated.View
        onLayout={(e) => onExpandedLayout?.(e.nativeEvent.layout)}
        style={[
          styles.box,
          styles.expandedBox,
          {
            transform: [
              {
                scale: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                }),
              },
            ],
          },
        ]}
      >
        {/* close & heart buttons */}
        <TouchableOpacity onPress={onCollapse} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#DFDCD9" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleToggleLike}
          style={styles.expandedFavoriteButton}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? '#CE975E' : '#4F4F4F'}
            style={grayIconStyle}
          />
        </TouchableOpacity>

        {canEdit && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              let extraParams: any = {};
              const idxs = getGlassAndColourIdx(drink.imageKey ?? '');
              if (idxs) {
                extraParams.glassIdx = idxs.glassIdx;
                extraParams.colourIdx = idxs.colourIdx;
              }
              router.push({
                pathname: '/create-drink',
                params: {
                  edit: '1',
                  recipeId: drink.recipeId ?? drink.id,
                  name: drink.name,
                  desc: drink.description ?? '',
                  ingredients: drink.ingredients ?? '',
                  imageKey: drink.imageKey ?? '',
                  ...extraParams,
                },
              });
            }}
          >
            <Ionicons name="create-outline" size={22} color="#DFDCD9" />
          </TouchableOpacity>
        )}

        {/* content */}
        <View style={styles.expandedContent}>
          <View style={styles.expandedTitleContainer}>
            <Text style={[styles.expandedboxText, grayStyle]}>{drink.name}</Text>
            <Text style={[styles.expandedcategoryText, grayStyle]}>{drink.category}</Text>
          </View>
          {imgSource.uri ? (
            <Image source={imgSource} style={[styles.expandedImage, grayStyle]} />
          ) : null}
        </View>

        <View style={styles.expandeddetailContainer}>
          {parsedIngredients.length === 0 ? (
            <Text style={[styles.expandeddescriptionText, grayStyle]}>
              No ingredients found.
            </Text>
          ) : (
            <Text style={styles.expandeddescriptionText}>
              Contains{' '}
              {parsedIngredients
                .map((item, i) =>
                  i === parsedIngredients.length - 1 && i !== 0
                    ? `and ${item.name}`
                    : item.name,
                )
                .join(', ')}
              .
            </Text>
          )}
        </View>

        {/* qty + button */}
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            onPress={() => setQuantity((q) => Math.min(3, q + 1))}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* --- DRAG-TO-POUR SLIDER ---------------------------------- */}
        <PourSlider
          canPour={isMakeable && isConnected}
          isPouring={logging}
          statusDone={statusType}
          onPour={handlePourDrink}
        />
        {statusType ? (
          <Text
            style={[
              styles.statusMessageOverlay,
              statusType === 'error' ? styles.errorText : styles.successText,
            ]}
          >
            {statusMessage}
          </Text>
        ) : countdown !== null ? (
          <Text style={[styles.statusMessageOverlay, styles.successText]}>
            {countdown}s remaining…
          </Text>
        ) : null}
      </Animated.View>
    );
  }

  /* ---------------------- collapsed card ----------------------- */
  // Gray effect for non-makeable drinks (collapsed)
  const grayStyle = !isDrinkMakeable(drink) ? { opacity: 0.4 } : {};
  const grayIconStyle = !isDrinkMakeable(drink) ? { opacity: 0.4 } : {};
  const [imgSource, setImgSource] = useState<{ uri: string }>({ uri: '' });
  useEffect(() => {
    let mounted = true;
    getDrinkImageSource(drink).then(src => { if (mounted) setImgSource(src); });
    return () => { mounted = false; };
  }, [drink]);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        (LayoutAnimation.configureNext(
          LayoutAnimation.Presets.easeInEaseOut,
        ),
        onExpand(drink.id))
      }
      style={styles.box}
    >
      <TouchableOpacity onPress={handleToggleLike} style={styles.favoriteButton}>
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={24}
          color={isLiked ? '#CE975E' : '#4F4F4F'}
          style={grayIconStyle}
        />
      </TouchableOpacity>
      {imgSource.uri ? (
        <Image
          source={imgSource}
          style={[styles.image, grayStyle]}
        />
      ) : null}
      <Text style={[styles.boxText, grayStyle]}>{drink.name}</Text>
      <Text style={[styles.categoryText, grayStyle]}>{drink.category}</Text>
    </TouchableOpacity>
  );
}

// Helper to get glassIdx and colourIdx from imageKey (same logic as DrinkList)
function getGlassAndColourIdx(imageKey?: string | null): { glassIdx: number; colourIdx: number } | null {
  if (!imageKey) return null;
  const glassTypes = ['rocks', 'highball', 'martini', 'coupe', 'margarita'];
  const colors = ['white', 'amber', 'red', 'green', 'blue'];
  for (let g = 0; g < glassTypes.length; g++) {
    for (let c = 0; c < colors.length; c++) {
      if (imageKey.endsWith(`${glassTypes[g]}_${colors[c]}.png`)) {
        return { glassIdx: g, colourIdx: c };
      }
      if (imageKey === `drinkMenu/drinkPictures/${glassTypes[g]}_${colors[c]}.png`) {
        return { glassIdx: g, colourIdx: c };
      }
    }
  }
  for (let g = 0; g < glassTypes.length; g++) {
    if (imageKey.includes(glassTypes[g])) {
      return { glassIdx: g, colourIdx: 0 };
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                               MAIN MENU SCREEN                             */
/* -------------------------------------------------------------------------- */

export default function MenuScreen() {
  const router = useRouter();
  const authModal = useContext(AuthModalContext); // FIXED
  const scrollViewRef = useRef<ScrollView>(null);
  const { isConnected, slots, liquorbotId, isAdmin } = useLiquorBot();
  const isFocused = useIsFocused();

  // --- MQTT receive topic logger for debugging pour results ---
  React.useEffect(() => {
    if (!liquorbotId) return;
    const topic = `liquorbot/liquorbot${liquorbotId}/receive`;
    const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
      next: (evt) => {
        console.log('[MenuScreen] MQTT receive topic message:', evt);
      },
      error: (err) => {
        console.error('[MenuScreen] MQTT receive topic error:', err);
      },
    });
    return () => sub.unsubscribe();
  }, [liquorbotId]);

  /* ------------------------- STATE ------------------------- */
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [allowedStd,   setAllowedStd]   = useState<number[] | null>(null);   // 🛠
  const [allowedCustom,setAllowedCustom]= useState<string[] | null>(null);
  const [allIngredients, setAllIngredients] = useState<BaseIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFocusedTime = useRef<number>(0);
  const [refreshCustom, setRefreshCustom] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [configReceived, setConfigReceived] = useState(false);

  // category & search
  const categories = ['All', 'Vodka', 'Rum', 'Tequila', 'Whiskey'];
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // make-able filter
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [onlyMakeable, setOnlyMakeable] = useState(false); // default off
  const [alphabetical, setAlphabetical] = useState(false);
  const [onlyCustom, setOnlyCustom] = useState(false);

  // expand / likes / user
  const [expandedDrink, setExpandedDrink] = useState<number | null>(null);
  const [userID, setUserID] = useState<string | null>(null);
  const [likedDrinks, setLikedDrinks] = useState<number[]>([]);

  /* ------------------------------------------------------------------ */
  /*                       NEW: sign-in prompt helper                    */
  /* ------------------------------------------------------------------ */
  const promptSignIn = useCallback(() => {
    if (authModal?.open) {
      authModal.open('signIn');
    } else {
      Alert.alert(
        'Sign in required',
        'Please sign in to view details and use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('../auth/sign-in') },
        ],
      );
    }
  }, [router, authModal]);

  /* ------------------------------------------------------------------ */
  /*                       NEW: guarded expand handler                  */
  /* ------------------------------------------------------------------ */
  const handleExpand = (id: number) => {
    if (!userID) {
      promptSignIn();
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDrink(id);
  };                                                                         // ★ NEW ★

  /* ------------------------------------------------------------------ */
  /*                       Slot-config redundancy                        */
  /* ------------------------------------------------------------------ */
  const requestSlotConfig = useCallback(async () => {
    if (!liquorbotId || !isConnected) return;
    try {
      await pubsub.publish({
        topics: [`liquorbot/liquorbot${liquorbotId}/slot-config`],
        message: GET_CONFIG,
      });
      console.log('[Menu] Requested slot configuration');
      lastFocusedTime.current = Date.now(); // Update last request time
    } catch (err) {
      console.error('[Menu] Failed to request slot config', err);
    }
  }, [liquorbotId, isConnected]);

  useEffect(() => {
    if (!liquorbotId) return;
    const topic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
    const sub   = pubsub.subscribe({ topics:[topic] }).subscribe({
      next: async ({ value }) => {
        const { action, slots, drinkIDs, customRecipeIDs } = value as any;

        // Always set configReceived true on ANY CURRENT_CONFIG, even if slots is empty or all zeros
        if (action === 'CURRENT_CONFIG') {
          setConfigReceived(true);
        }

        /* existing MENU_UPDATE handling (unchanged) */
        if (action !== 'MENU_UPDATE') return;
        setAllowedStd(drinkIDs ?? []);
        setAllowedCustom(customRecipeIDs ?? []);
        await AsyncStorage.setItem(
          `allowedDrinks-${liquorbotId}`,
          JSON.stringify({ drinkIDs, customRecipeIDs, updatedAt: Date.now() }),
        );
      },
      error: console.error,
    });
    return () => sub.unsubscribe();
  }, [liquorbotId]);

  useEffect(() => setConfigReceived(false), [liquorbotId]);


  // Automatically re-request config when screen is focused
  useEffect(() => {
    if (!isFocused) return;

    // Add a 500ms delay before requesting slot config
    const delayTimer = setTimeout(() => {
      // Only request if it's been at least 1 second since last request
      const timeSinceLastFocus = Date.now() - lastFocusedTime.current;
      if (timeSinceLastFocus > 1000) {
        requestSlotConfig();
        // Only send one request, skip retry
        return;
      }

      // Otherwise, schedule a single retry after 2s
      const retryTimer = setTimeout(() => {
        if (!configReceived) requestSlotConfig();
      }, 2000);
      // Clean up retry timer if effect re-runs
      return () => clearTimeout(retryTimer);
    }, 500);

    // Clean up delay timer if effect re-runs
    return () => clearTimeout(delayTimer);
  }, [isFocused, configReceived, requestSlotConfig]);

  // If the grid is empty for >5 s, prod both config & event refresh
  useEffect(() => {
    if (!isFocused || configReceived) return; // updated guard

    // only care when nothing is showing
    if (renderedDrinks.length) return;

    const t = setTimeout(() => {
      requestSlotConfig();            // MQTT side
      setRefreshCustom(p => !p);      // GraphQL / Custom side
    }, 5000);

    return () => clearTimeout(t);
  }, [isFocused, drinks.length, requestSlotConfig, configReceived]);


  useEffect(() => {
    (async () => {
      try {
        // Always load from cache first for instant UI
        const [dJson, iJson] = await AsyncStorage.multiGet([
          'drinksJson',
          'ingredientsJson',
        ]);
        const drinksStr       = dJson?.[1] ?? null;
        const ingredientsStr  = iJson?.[1] ?? null;

        if (drinksStr && ingredientsStr) {
          const builtIn = JSON.parse(drinksStr);
          setDrinks(prev => {
            const customs = prev.filter(d => d.isCustom);
            return [...builtIn, ...customs];
          });
          setAllIngredients(JSON.parse(ingredientsStr));
          setLoading(false);
        }

        // In background, check for updates using S3 Last-Modified
        async function getLastModified(url: string): Promise<string | null> {
          try {
            const res = await fetch(url, { method: 'HEAD' });
            const lastMod = res.headers.get('Last-Modified');
            return lastMod;
          } catch {
            return null;
          }
        }

        const [drinksUrl, ingUrl] = await Promise.all([
          getUrl({ key: 'drinkMenu/drinks.json' }),
          getUrl({ key: 'drinkMenu/ingredients.json' }),
        ]);
        const [remoteDrinksMod, remoteIngMod] = await Promise.all([
          getLastModified(drinksUrl.url.toString()),
          getLastModified(ingUrl.url.toString()),
        ]);
        const [localDrinksMod, localIngMod] = await AsyncStorage.multiGet([
          'drinksJsonLastMod',
          'ingredientsJsonLastMod',
        ]);

        let updated = false;
        if (!localDrinksMod[1] || localDrinksMod[1] !== remoteDrinksMod) {
          const res = await fetch(drinksUrl.url);
          const newDrinks = await res.text();
          await AsyncStorage.setItem('drinksJson', newDrinks);
          await AsyncStorage.setItem('drinksJsonLastMod', remoteDrinksMod || '');
          setDrinks(prev => {
            const customs = prev.filter(d => d.isCustom);
            return [...JSON.parse(newDrinks), ...customs];
          });
          updated = true;
        }
        if (!localIngMod[1] || localIngMod[1] !== remoteIngMod) {
          const res = await fetch(ingUrl.url);
          const newIngs = await res.text();
          await AsyncStorage.setItem('ingredientsJson', newIngs);
          await AsyncStorage.setItem('ingredientsJsonLastMod', remoteIngMod || '');
          setAllIngredients(JSON.parse(newIngs));
          updated = true;
        }
        if (updated) setLoading(false); // ensure spinner is hidden if update was slow
      } catch (e) {
        console.warn('Cache read/update error', e);
      }
    })();
  }, []);


  /* ------------------ live refresh of allowed drinks ------------------ */
  useEffect(() => {
    if (!isFocused || !liquorbotId) return;

    (async () => {
      try {
        /* 1. ask the GraphQL API for *my* event that matches this LiquorBot-ID   */
        const response = (await client.graphql({
          query: /* GraphQL */ `
            query MyCurrentEvent($id:Int!) {
              listEvents(filter:{
                liquorbotId:{eq:$id},
                or:[
                  {owner:{eq:"$ctx.identity.username"}},
                  {guestOwners:{contains:"$ctx.identity.username"}}
                ]
              }) { items { id drinkIDs customRecipeIDs updatedAt } }
            }`,
          variables: { id: Number(liquorbotId) },
          authMode: 'userPool',
        })) as GraphQLResult<{
          listEvents: {
            items: {
              id: number;
              drinkIDs: number[];
              customRecipeIDs: string[];
              updatedAt: string;
            }[];
          };
        }>;
        const data = response.data;

        const ev = data?.listEvents?.items?.[0];
        if (!ev) return;                           // nothing found (unlikely)

        /* 2. update state + cache only if something actually changed            */
        const needsUpdate =
          JSON.stringify(ev.drinkIDs)        !== JSON.stringify(allowedStd)   ||
          JSON.stringify(ev.customRecipeIDs) !== JSON.stringify(allowedCustom);

        if (needsUpdate) {
          setAllowedStd(ev.drinkIDs        ?? []);
          setAllowedCustom(ev.customRecipeIDs ?? []);
          await AsyncStorage.setItem(
            `allowedDrinks-${liquorbotId}`,
            JSON.stringify({
              drinkIDs:        ev.drinkIDs        ?? [],
              customRecipeIDs: ev.customRecipeIDs ?? [],
              updatedAt:       ev.updatedAt,
            }),
          );
        }
      } catch (e) {
        console.warn('[Menu] live refresh failed – using local cache', e);
      }
    })();
  }, [isFocused, liquorbotId]);

  useEffect(() => {
    if (!liquorbotId) { setAllowedStd(null); setAllowedCustom(null); return; }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`allowedDrinks-${liquorbotId}`);
        if (!raw) { setAllowedStd(null); setAllowedCustom(null); return; }
        const { drinkIDs = [], customRecipeIDs = [] } = JSON.parse(raw);
        setAllowedStd(drinkIDs);
        setAllowedCustom(customRecipeIDs);
      } catch { /* ignore */ }
    })();
  }, [liquorbotId, isFocused]);

  // (Removed: force ON for non-admins. Now default is OFF for everyone)

  useEffect(() => {
    const subscription = pubsub.subscribe({
      topics: [`liquorbot/liquorbot${liquorbotId}/publish`],
    }).subscribe({
      next: (data) => {
        // Handle the incoming message as needed
      },
      error: (error) => console.error('Publish topic subscription error:', error),
    });

    return () => subscription.unsubscribe();
  }, [liquorbotId]);

  // Load saved filter options on mount
  useEffect(() => {
    (async () => {
      if (!isAdmin) return;
      try {
        const savedFilters = await AsyncStorage.getItem('filterOptions');
        if (savedFilters) {
          const { onlyMakeable, alphabetical, onlyCustom } = JSON.parse(savedFilters);
          setOnlyMakeable(onlyMakeable);
          setAlphabetical(alphabetical);
          setOnlyCustom(onlyCustom);
        }
      } catch (e) {
        console.error('Failed to load filter options', e);
      }
    })();
  }, []);

  // Save filter options whenever they change
  useEffect(() => {
    (async () => {
      if (!isAdmin) return;
      try {
        const filterOptions = JSON.stringify({ onlyMakeable, alphabetical, onlyCustom });
        await AsyncStorage.setItem('filterOptions', filterOptions);
      } catch (e) {
        console.error('Failed to save filter options', e);
      }
    })();
  }, [onlyMakeable, alphabetical, onlyCustom]);

  // is a drink makeable?
  const isDrinkMakeable = (drink: Drink) => {
    if (!drink.ingredients) return false;
    const needed = drink.ingredients
      .split(',')
      .map((c) => parseInt(c.split(':')[0], 10));
    return needed.every((id) => slots.includes(id));
  };

  // glow anim for status dot
  const glowAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [glowAnim]);

  /* ----- base drinks & ingredient catalogue (S3 JSON) ----- */
  useEffect(() => {
    if (drinks.length && allIngredients.length) return;
    (async () => {
      try {
        const [drinksUrl, ingUrl] = await Promise.all([
          getUrl({ key: 'drinkMenu/drinks.json' }),
          getUrl({ key: 'drinkMenu/ingredients.json' }),
        ]);
        const [drinksRes, ingRes] = await Promise.all([
          fetch(drinksUrl.url),
          fetch(ingUrl.url),
        ]);
        const [dText, iText] = await Promise.all([drinksRes.text(), ingRes.text()]);

        await AsyncStorage.multiSet([
          ['drinksJson',       dText],
          ['ingredientsJson',  iText],
        ]);

        setDrinks(prev => {
          const customs = prev.filter(d => d.isCustom);
          return [...JSON.parse(dText), ...customs];
        });
        setAllIngredients(JSON.parse(iText));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [drinks.length, allIngredients.length]);

  /* ----------------- Cognito username / ID ----------------- */
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        user?.username && setUserID(user.username);
      } catch {
        setUserID(null);   // not signed in
      }
    })();
    // Listen for auth modal close to refresh user state
    if (authModal) {
      const unsub = authModal;
      // Listen for modal close and re-check user
      const interval = setInterval(async () => {
        try {
          const user = await getCurrentUser();
          if (user?.username !== userID) setUserID(user?.username ?? null);
        } catch {
          setUserID(null);
        }
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [authModal]);

  /* -------------------- liked drinks ----------------------- */
  useEffect(() => {
    if (!userID) return;
    (async () => {
      try {
        const res = await client.graphql({
          query: listLikedDrinks,
          variables: { filter: { userID: { eq: userID } } },
          authMode: 'userPool',
        });
        setLikedDrinks(
          res.data?.listLikedDrinks?.items.map((i: any) => i.drinkID) || [],
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, [userID]);

  // Efficiently refresh liked drinks on focus
  useEffect(() => {
    if (!userID) return;
    if (!isFocused) return;
    (async () => {
      try {
        const res = await client.graphql({
          query: listLikedDrinks,
          variables: { filter: { userID: { eq: userID } } },
          authMode: 'userPool',
        });
        setLikedDrinks(
          res.data?.listLikedDrinks?.items.map((i: any) => i.drinkID) || [],
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, [userID, isFocused]);

  /* -------- Pull the user’s CustomRecipe items ---------- */
  useEffect(() => {
   if (!isAdmin && (!allowedCustom || !allowedCustom.length)) return;

   (async () => {
     try {
       const { data } = await client.graphql({
         query: LIST_CUSTOM_RECIPES_WITH_ING,
         // Filter by the specific IDs we’re allowed to show
         variables: {
           filter: { id: { in: allowedCustom } },
           limit : 1000,
         },
         authMode: 'apiKey',        // 👈 guests can read via public rule
       }) as { data: any };

       const items = data.listCustomRecipes.items as any[];
       const placeholder =
         'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';

       const custom: Drink[] = await Promise.all(items.map(async (item, idx) => {
         const ingredientsString = (item.ingredients ?? [])
           .map((ri: any) => `${Number(ri.ingredientID)}:${Number(ri.amount)}:${Number(ri.priority ?? 1)}`)
           .join(',');

         let imageUrl = placeholder;
         if (item.image) {
           try { imageUrl = (await getUrl({ key: item.image })).url.toString(); }
           catch { /* keep placeholder */ }
         }

         const numericId = toNumericId(item.id);

         return {
           id        : numericId,   // keep clear of std-drink IDs
           name      : item.name,
           category  : 'Custom',
           description: item.description ?? '',
           image     : imageUrl,
           ingredients: ingredientsString,
           isCustom  : true,
           recipeId  : item.id,
           imageKey  : item.image ?? null,
           owner     : item.owner ?? null,
         };
       }));

       // always merge with the baked-in drinks
       setDrinks(prev => {
         const builtIn = prev.filter(d => !d.isCustom);
         return [...builtIn, ...custom];
       });
     } catch (e) {
      console.error('Error loading custom drinks', e);
     }
   })();
 }, [allowedCustom, refreshCustom, isAdmin, userID]);

  // Add refresh on screen focus
  useEffect(() => {
    if (isFocused && userID) {
      setRefreshCustom(prev => !prev);
    }
  }, [isFocused]);

  /* -------------------- favourite toggle -------------------- */
  async function toggleFavorite(drinkId: number) {
    if (!userID) {                                                               // ★ NEW ★
      promptSignIn();
      return;
    }
    if (likedDrinks.includes(drinkId)) {
      try {
        const res = await client.graphql({
          query: listLikedDrinks,
          variables: { filter: { userID: { eq: userID }, drinkID: { eq: drinkId } } },
          authMode: 'userPool',
        });
        const existing = res.data?.listLikedDrinks?.items?.[0];
        existing &&
          (await client.graphql({
            query: deleteLikedDrink,
            variables: { input: { id: existing.id } },
            authMode: 'userPool',
          }));
        setLikedDrinks((p) => p.filter((id) => id !== drinkId));
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        await client.graphql({
          query: createLikedDrink,
          variables: { input: { userID, drinkID: drinkId } },
          authMode: 'userPool',
        });
        setLikedDrinks((p) => [...p, drinkId]);
      } catch (e) {
        console.error(e);
      }
    }
  }

  /* ---------------------- FILTER LOGIC ---------------------- */
  const loadedIds = slots.filter((id) => id > 0);
  const canMake = (drink: Drink) =>
    onlyMakeable ? isDrinkMakeable(drink) : true;

  const inAllowed = (d: Drink) => {
    /* Admins can see EVERYTHING when “Show only makeable drinks” is OFF */
    if (isAdmin && !onlyMakeable) return true;

    /* Guests – or admins who enabled that toggle – keep the event limits */
    if (!allowedStd && !allowedCustom) return true;

    return d.isCustom
      ? allowedCustom?.includes(d.recipeId ?? '') ?? false
      : allowedStd?.includes(d.id) ?? false;
  };


  let filteredDrinks = drinks
    .filter(inAllowed)
    .filter(
      (d) =>
        (!onlyCustom || d.category === 'Custom') &&
        (selectedCategory === 'All' || d.category === selectedCategory) &&
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        canMake(d),
    );

  // Sort makeable drinks to the top for everyone
  filteredDrinks.sort((a, b) => {
    const aMakeable = isDrinkMakeable(a) ? 1 : 0;
    const bMakeable = isDrinkMakeable(b) ? 1 : 0;
    if (aMakeable !== bMakeable) return bMakeable - aMakeable; // makeable first
    if (alphabetical) return a.name.localeCompare(b.name);
    return 0;
  });

  // (Optional: If you want to keep the admin event-drink sorting, you can re-apply it here, but makeable drinks will always be on top)

  // keep expanded card on left column
  const renderedDrinks = [...filteredDrinks];
  if (expandedDrink != null) {
    const i = renderedDrinks.findIndex((d) => d.id === expandedDrink);
    i !== -1 &&
      i % 2 === 1 &&
      renderedDrinks.splice(i - 1, 0, renderedDrinks.splice(i, 1)[0]);
  }

  const handleExpandedLayout = (layout: { y: number }) =>
    scrollViewRef.current?.scrollTo({ y: layout.y, animated: true });

  /* ---------------------- initial loader --------------------- */
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Loading drinks…</Text>
      </View>
    );
  }

  /* ---------------------------- UI --------------------------- */
  return (
    <View style={styles.container}>
      {/* ------------ HEADER ------------ */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Drinks</Text>

        <View style={styles.connectionRow}>
          <Animated.View
            style={[
              styles.greenDot,
              {
                backgroundColor: isConnected ? '#63d44a' : '#B81A1A',
                transform: [{ scale: glowAnim }],
                shadowColor: isConnected ? '#00FF00' : '#B81A1A',
              },
            ]}
          />
          <Text style={styles.subHeaderText}>
            {isConnected ? 'LiquorBot Connected' : 'LiquorBot Disconnected'}
          </Text>
        </View>

        {isAdmin && (
          <TouchableOpacity
            style={styles.editIconContainer}
            onPress={() => router.push('/create-drink')}
          >
            <Ionicons name="create-outline" size={30} color="#CE975E" />
          </TouchableOpacity>
        )}
      </View>

      {/* ------------ CATEGORY PICKER ------------ */}
      <View style={styles.horizontalPickerContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalPicker}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={styles.categoryButton}
            >
              <View style={styles.categoryButtonContent}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === cat && styles.selectedCategoryText,
                  ]}
                >
                  {cat}
                </Text>
                {selectedCategory === cat && <View style={styles.underline} />}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ------------ SEARCH + FILTER ------------ */}
      <View style={styles.searchBarContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#4F4F4F"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchBar}
          placeholder="Search"
          placeholderTextColor="#4F4F4F"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          style={styles.filterIcon}
        >
          <Ionicons
            name="funnel-outline"
            size={20}
            color={onlyMakeable ? '#CE975E' : '#4F4F4F'}
          />
        </TouchableOpacity>
      </View>

      {/* ------------ DRINK GRID ------------ */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: expandedDrink ? 100 : 80 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={async () => {
              setLoading(true);
              setConfigReceived(false); // force config to be re-fetched
              await requestSlotConfig();
              setLoading(false);
            }}
            colors={["#CE975E"]}
          />
        }
      >
        {!userID ? (
          /* ---------- guest view ---------- */
          <View style={styles.noDrinksContainer}>
            <Text style={styles.noDrinksText}>
              <Text>
                <Text
                  style={styles.goldenSignInText}
                  onPress={() => router.push('../auth/sign-in')}
                >
                  Sign in
                </Text>
                {` to view and explore the drink menu!`}
              </Text>
            </Text>
          </View>
        ) : renderedDrinks.length === 0 ? (
          /* ---------- no drinks ---------- */
          <View style={styles.noDrinksContainer}>
            <Text style={styles.noDrinksText}>
              Oops, no drinks here! Check your filters, internet connection, or wait for an event to start.
            </Text>
          </View>
        ) : (
          /* ---------- drink grid ---------- */
          <View style={styles.grid}>
            {renderedDrinks.map((drink) => (
              <DrinkItem
                key={drink.id}
                drink={drink}
                isExpanded={expandedDrink === drink.id}
                isLiked={likedDrinks.includes(drink.id)}
                toggleFavorite={toggleFavorite}
                onExpand={handleExpand}
                onCollapse={() => setExpandedDrink(null)}
                allIngredients={allIngredients}
                onExpandedLayout={(layout) =>
                  scrollViewRef.current?.scrollTo({ y: layout.y, animated: true })
                }
                isMakeable={isDrinkMakeable(drink)}
                currentUserId={userID}
              />
            ))}
          </View>
        )}
      </ScrollView>

  {/* ------------ FILTER POPUP ------------ */}
  {filterModalVisible && (
  <Modal
    visible={filterModalVisible}
    transparent
    animationType="fade"
    onRequestClose={() => setFilterModalVisible(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={[styles.filterModal, { overflow: 'hidden', backgroundColor: 'transparent' }]}> 
        {/* Glassy blur background for filter modal */}
        <BlurView intensity={FILTER_MODAL_BLUR_INTENSITY} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]} />

        <TouchableOpacity
          style={styles.modalCloseButton}
          onPress={() => setFilterModalVisible(false)}
        >
          <Ionicons name="close" size={24} color="#DFDCD9" />
        </TouchableOpacity>

        <Text style={styles.filterModalTitle}>Filter Options</Text>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Show only makeable drinks</Text>
          <Switch
            value={onlyMakeable}
            onValueChange={setOnlyMakeable}
            trackColor={{ false: '#4F4F4F', true: '#CE975E' }}
            thumbColor="#DFDCD9"
          />
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Sort drinks alphabetically</Text>
          <Switch
            value={alphabetical}
            onValueChange={setAlphabetical}
            trackColor={{ false: '#4F4F4F', true: '#CE975E' }}
            thumbColor="#DFDCD9"
          />
        </View>
        {isAdmin && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Show only my custom drinks</Text>
            <Switch
              value={onlyCustom}
              onValueChange={setOnlyCustom}
              trackColor={{ false: '#4F4F4F', true: '#CE975E' }}
              thumbColor="#DFDCD9"
            />
          </View>
        )}
      </View>
    </View>
  </Modal>
)}
    </View> 
  ); 
}     
// -------------------------------- STYLES --------------------------------
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  headerContainer: { paddingTop: 80, paddingHorizontal: 20, marginBottom: 10 },
  headerText: { color: '#DFDCD9', fontWeight: 'bold', fontSize: 36, textAlign: 'left' },
  subHeaderText: { color: '#4F4F4F', fontSize: 18, textAlign: 'left', marginTop: 0 },
  connectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  greenDot: { width: 8, height: 8, borderRadius: 5, marginRight: 8, shadowOffset: { width: 0, height: 0 }, shadowRadius: 5, shadowOpacity: 0.6, elevation: 5 },
  horizontalPickerContainer: { alignItems: 'center', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingVertical: 5, marginBottom: -10 },
  horizontalPicker: { flexDirection: 'row', alignItems: 'center' },
  categoryButton: { paddingVertical: 10, paddingHorizontal: 15, marginHorizontal: 5 },
  categoryButtonContent: { alignItems: 'center' },
  selectedCategoryText: { color: '#CE975E' },
  underline: { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },
  categoryButtonText: { color: '#4F4F4F' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginHorizontal: 20, marginVertical: 10, marginBottom: 10 },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  scrollContainer: { flexGrow: 1, padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  box: { width: '45%', marginBottom: 25, alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, overflow: 'visible', position: 'relative', paddingVertical: 10 },
  expandedBox: { width: '100%', height: 450, padding: 20, marginBottom: 25, overflow: 'visible' },
  favoriteButton: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  expandedFavoriteButton: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  closeButton: { position: 'absolute', top: 10, left: 10, zIndex: 2 },
  image: { top: -5, left: -15, width: '90%', height: 160, marginBottom: 10 },
  expandedboxText: { color: '#DFDCD9', fontSize: 24, marginBottom: 10, textAlign: 'left', alignSelf: 'flex-start' },
  expandedImage: { marginTop: 0, width: 200, height: 200, borderRadius: 10, marginLeft: -30 },
  expandedcategoryText: { color: '#CE975E', fontSize: 14, textAlign: 'left', alignSelf: 'flex-start' },
  expandeddescriptionText: { color: '#4F4F4F', fontSize: 14, textAlign: 'left', alignSelf: 'flex-start' },
  expandedContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandedTitleContainer: { flex: 1, marginTop: 50, marginRight: 10, alignSelf: 'flex-start' },
  expandeddetailContainer: { flex: 1, marginTop: 10, marginRight: 10 },
  boxText: { color: '#DFDCD9', fontSize: 18, paddingLeft: 10, marginBottom: 0, textAlign: 'left', alignSelf: 'flex-start', paddingRight: 10, },
  categoryText: { color: '#CE975E', fontSize: 14, marginBottom: 10, paddingLeft: 10, textAlign: 'left', alignSelf: 'flex-start' },
  quantityContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  quantityButton: { backgroundColor: '#4f4f4f', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5, alignItems: 'center' },
  quantityButtonText: { color: '#FFFFFF', fontSize: 20 },
  quantityText: { color: '#FFFFFF', fontSize: 20, marginHorizontal: 20 },
  spinner: { marginLeft: 10 },
  editIconContainer: { position: 'absolute', top: 85, right: 30 },
  loadingScreen: { flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#DFDCD9', fontSize: 18 },
  filterIcon: { marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  filterModal: { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20 },
  filterModalTitle: { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', marginBottom: 20, alignSelf: 'center' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filterLabel: { color: '#DFDCD9', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  modalCloseButton: { position: 'absolute', top: 15, right: 15 },
  disabledButton: { backgroundColor: '#4F4F4F' },
  disabledButtonText: { color: '#9E9E9E' },
  statusMessage: { textAlign: 'center', fontSize: 10, },
  errorText: { color: '#D9534F' },
  successText: { color: '#63d44a' },
  buttonArea: { width: '100%', alignItems: 'center', position: 'relative' },
  statusMessageOverlay: { position: 'absolute', top: '100%', marginTop: -4, fontSize: 10, textAlign: 'center' },
  editButton: { position: 'absolute', top: 10, left: 45, zIndex: 2 },
  goldenSignInText: {
    color: '#CE975E',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noDrinksContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  noDrinksText: { color: '#4f4f4f', fontSize: 12, textAlign: 'center' },
  pourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginTop: -10,
    marginBottom: 20,
    position: 'relative',
  },
  pourLabel: {
    color: '#DFDCD9',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  pourCircle: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});