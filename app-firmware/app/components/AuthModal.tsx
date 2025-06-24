// ────────────────────────────────── AuthModal.tsx ──────────────────────────────────
// Purpose : Bottom-sheet auth modal with true frosted-glass background.
// Notes   : • Uses expo-blur’s <BlurView> for the glass effect.
//           • Keeps existing drag, keyboard-aware, and session-loading logic.
//           • iOS → native blur   |   Android → tinted fallback + blur where supported.
//
// Replace your existing file entirely.
//
// Nathan Hambleton – Jun 23 2025
// ───────────────────────────────────────────────────────────────────────────────────
import React, {
  useContext,
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
  Easing,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { AuthModalContext } from './AuthModalContext';
import SignIn         from '../auth/sign-in';
import SignUp         from '../auth/sign-up';
import ForgotPassword from '../auth/forgot-password';
import ConfirmCode    from '../auth/confirm-code';
import SessionLoading from '../auth/session-loading';

/* ───────────────────────── constants ───────────────────────── */
const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const TARGET_HEIGHT  = WINDOW_HEIGHT * 0.9;   // 90 % of the screen
const MAX_STRETCH    = WINDOW_HEIGHT * 0.97;  // upward stretch limit
const SLIDE_DURATION = 500;                   // ms

export default function AuthModal() {
  const insets = useSafeAreaInsets();
  const ctx    = useContext(AuthModalContext);
  if (!ctx) return null;
  const { visible, screen, close, params } = ctx;

  /* refs that must survive re-renders */
  const translateY   = useRef(new Animated.Value(TARGET_HEIGHT + 40)).current;
  const sheetHeight  = useRef(new Animated.Value(TARGET_HEIGHT)).current;
  const maxHeightRef = useRef(TARGET_HEIGHT);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [canClose,      setCanClose]      = useState(false);
  const [kbdHeight,     setKbdHeight]     = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  /* tiny “shake” haptic on invalid drag while SessionLoading is active */
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0.7,duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
    ]).start();
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [shakeAnim]);

  /* helper so SessionLoading can auto-close smoothly */
  const handleSessionLoadingFinish = useCallback(() => {
    Animated.timing(translateY, {
      toValue        : maxHeightRef.current + 40,
      duration       : SLIDE_DURATION,
      easing         : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => finished && close());
  }, [close, translateY]);

  /* which page are we rendering? */
  const Content = (() => {
    switch (screen) {
      case 'signIn'        : return <SignIn         modalMode {...params} />;
      case 'signUp'        : return <SignUp         modalMode {...params} />;
      case 'forgotPassword': return <ForgotPassword modalMode {...params} />;
      case 'confirmCode'   : return <ConfirmCode    modalMode {...params} />;
      case 'sessionLoading': return (
        <SessionLoading
          modalMode
          onRequestCloseWithAnimation={handleSessionLoadingFinish}
          {...params}
        />
      );
      default              : return null;
    }
  })();

  /* keyboard listeners (push content up) */
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKbdHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbdHeight(0)
    );
    return () => {
      show.remove(); hide.remove();
    };
  }, []);

  /* reset position each time the modal is shown */
  useEffect(() => {
    if (!visible) return;
    maxHeightRef.current = TARGET_HEIGHT;
    translateY.setValue(TARGET_HEIGHT + 40);
    sheetHeight .setValue(TARGET_HEIGHT);

    Animated.timing(translateY, {
      toValue        : 0,
      duration       : SLIDE_DURATION,
      easing         : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [visible, translateY, sheetHeight]);

  /* gate backdrop taps for 250 ms after open */
  useEffect(() => {
    if (!visible) return;
    setCanClose(false);
    const t = setTimeout(() => setCanClose(true), 250);
    return () => clearTimeout(t);
  }, [visible]);

  /* slide-out helper */
  const slideOutAndClose = useCallback(() => {
    Animated.timing(translateY, {
      toValue        : maxHeightRef.current + 40,
      duration       : SLIDE_DURATION,
      easing         : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => finished && close());
  }, [close, translateY]);

  /* pan for normal screens */
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => e.nativeEvent.locationY < 40,
        onMoveShouldSetPanResponder : (_, g) => Math.abs(g.dy) > 2,

        onPanResponderGrant() {
          Keyboard.dismiss();
          setScrollEnabled(false);
          translateY.stopAnimation(); translateY.extractOffset();
          sheetHeight.stopAnimation();
        },

        onPanResponderMove(_, g) {
          const base = maxHeightRef.current;
          if (g.dy >= 0) {                // drag down
            translateY.setValue(g.dy);
            sheetHeight.setValue(base);
          } else {                        // drag up
            translateY.setValue(0);
            sheetHeight.setValue(Math.min(base - g.dy, MAX_STRETCH));
          }
        },

        onPanResponderRelease(_, g) {
          translateY.flattenOffset();
          setScrollEnabled(true);

          if (g.dy > 120 || g.vy > 1.2) return slideOutAndClose();

          Animated.parallel([
            Animated.spring(translateY,  { toValue: 0, useNativeDriver: false }),
            Animated.spring(sheetHeight, { toValue: maxHeightRef.current, useNativeDriver: false }),
          ]).start();
        },

        onPanResponderTerminate() {
          translateY.flattenOffset();
          setScrollEnabled(true);
          Animated.parallel([
            Animated.spring(translateY,  { toValue: 0, useNativeDriver: false }),
            Animated.spring(sheetHeight, { toValue: maxHeightRef.current, useNativeDriver: false }),
          ]).start();
        },
      }),
    [slideOutAndClose, translateY, sheetHeight]
  );

  /* pan that just “shakes” (sessionLoading blocks drag) */
  const fakePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => e.nativeEvent.locationY < 40,
        onMoveShouldSetPanResponder : () => true,
        onPanResponderGrant : triggerShake,
        onPanResponderMove  : () => {},
        onPanResponderRelease: () => {},
        onPanResponderTerminate: () => {},
      }),
    [triggerShake]
  );

  /* backdrop opacity */
  const overlayOpacity = translateY.interpolate({
    inputRange : [0, WINDOW_HEIGHT * 0.7],
    outputRange: [0.7, 0],
    extrapolate: 'clamp',
  });

  /* ───────────────────────── render ───────────────────────── */
  return (
    <Modal
      visible         = {visible}
      transparent
      animationType   = "none"
      onRequestClose  = {slideOutAndClose}
    >
      <View style={styles.container} pointerEvents="box-none">
        {/* backdrop */}
        <Pressable
          disabled={!canClose || screen === 'sessionLoading'}
          onPress={slideOutAndClose}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </Pressable>

        {/* bottom sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              height       : sheetHeight,
              paddingBottom: (Platform.OS === 'ios' ? 24 : 16) + insets.bottom,
              transform    : [{ translateY }],
            },
          ]}
        >
          {/* glassy blur background */}
          <BlurView
            intensity={60}
            tint="dark"
            style={styles.blur}
            pointerEvents="none"
          />

          {/* drag handle */}
          <Animated.View
            style={[
              styles.handleBox,
              { transform: [{ translateX: shakeAnim.interpolate({
                  inputRange: [-1, 0, 1], outputRange: [-8, 0, 8],
                }) }] },
            ]}
            {...(screen === 'sessionLoading' ? fakePan.panHandlers : pan.panHandlers)}
          >
            <View style={styles.handle} hitSlop={{ top: 8, bottom: 8 }} />
          </Animated.View>

          {/* page body */}
          <ScrollView
            scrollEnabled            = {scrollEnabled}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode      ="interactive"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 24 + kbdHeight },
            ]}
          >
            {Content}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  overlay  : { flex: 1, backgroundColor: 'rgba(20,20,20,0.7)' },

  // NOTE: keep bg transparent on iOS so blur shows through;
  //       Android gets a dark tint for consistent appearance.
  sheet: {
    backgroundColor     : Platform.OS === 'android'
                          ? 'rgba(20,20,20,0.85)'
                          : 'transparent',
    borderTopLeftRadius : 24,
    borderTopRightRadius: 24,
    overflow            : 'hidden',
    shadowColor         : '#000',
    shadowOffset        : { width: 0, height: -4 },
    shadowOpacity       : 0.18,
    shadowRadius        : 16,
    elevation           : 16,
  },

  blur      : {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius : 24,
    borderTopRightRadius: 24,
  },

  handleBox : { alignItems: 'center', height: 48, paddingTop: 12 },
  handle    : {
    width          : 48,
    height         : 6,
    borderRadius   : 3,
    backgroundColor: '#444',
    marginVertical : 8,
  },

  content   : { paddingHorizontal: 8, paddingBottom: 24 },
});
