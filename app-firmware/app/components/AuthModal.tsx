// ────────────────────────────────── AuthModal.tsx ──────────────────────────────────
import React, { useContext, useRef, useEffect, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthModalContext } from './AuthModalContext';
import SignIn         from '../auth/sign-in';
import SignUp         from '../auth/sign-up';
import ForgotPassword from '../auth/forgot-password';
import ConfirmCode    from '../auth/confirm-code';

/* ───────────────────────── constants ───────────────────────── */
const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const MAX_SHEET_HEIGHT = WINDOW_HEIGHT * 0.9;   // default height (90 % of screen)
const MAX_STRETCH      = WINDOW_HEIGHT * 0.97;  // upward stretch limit
const SLIDE_DURATION   = 280;                   // ms

export default function AuthModal() {
  const insets = useSafeAreaInsets();
  const ctx    = useContext(AuthModalContext);
  if (!ctx) return null;
  const { visible, screen, close } = ctx;

  /* pick which page to show */
  let Content: JSX.Element | null = null;
  if      (screen === 'signIn'        ) Content = <SignIn  modalMode />;
  else if (screen === 'signUp'        ) Content = <SignUp  modalMode />;
  else if (screen === 'forgotPassword') Content = <ForgotPassword modalMode />;
  else if (screen === 'confirmCode'   ) Content = <ConfirmCode    modalMode />;

  /* animated values – all JS-driven (useNativeDriver: false) */
  const translateY  = useRef(new Animated.Value(MAX_SHEET_HEIGHT + 40)).current;
  const sheetHeight = useRef(new Animated.Value(MAX_SHEET_HEIGHT)).current;

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [canClose, setCanClose]           = useState(false);

  /* gate backdrop taps for 250 ms after open */
  useEffect(() => {
    if (!visible) return;
    setCanClose(false);
    const t = setTimeout(() => setCanClose(true), 250);
    return () => clearTimeout(t);
  }, [visible]);

  /* slide IN when visible */
  useEffect(() => {
    if (!visible) return;

    translateY.setValue(MAX_SHEET_HEIGHT + 40);
    sheetHeight.setValue(MAX_SHEET_HEIGHT);

    Animated.timing(translateY, {
      toValue        : 0,
      duration       : SLIDE_DURATION,
      easing         : Easing.out(Easing.cubic),
      useNativeDriver: false,   // JS-driven
    }).start();
  }, [visible, translateY, sheetHeight]);

  const slideOutAndClose = () => {
    Animated.timing(translateY, {
      toValue        : MAX_SHEET_HEIGHT + 40,
      duration       : SLIDE_DURATION,
      easing         : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => finished && close());
  };

  /* ───────── drag handler (handle-only) ───────── */
  const pan = useRef(
    PanResponder.create({
      /* only start if the user touched the handle area (first 40 px) */
      onStartShouldSetPanResponder: (evt, _g) => evt.nativeEvent.locationY < 40,
      onMoveShouldSetPanResponder : (_, g)    => Math.abs(g.dy) > 2,
      onPanResponderGrant         : () => {
        setScrollEnabled(false);
        translateY.stopAnimation();
        translateY.extractOffset();
        sheetHeight.stopAnimation();
      },
      onPanResponderMove          : (_, g) => {
        if (g.dy >= 0) {
          translateY.setValue(g.dy);
          sheetHeight.setValue(MAX_SHEET_HEIGHT);
        } else {
          translateY.setValue(0);
          sheetHeight.setValue(Math.min(MAX_SHEET_HEIGHT - g.dy, MAX_STRETCH));
        }
      },
      onPanResponderRelease       : (_, g) => {
        translateY.flattenOffset();
        setScrollEnabled(true);

        const shouldClose = g.dy > 120 || g.vy > 1.2;
        if (shouldClose) {
          slideOutAndClose();
          return;
        }

        Animated.parallel([
          Animated.spring(translateY,  { toValue: 0, useNativeDriver: false }),
          Animated.spring(sheetHeight, { toValue: MAX_SHEET_HEIGHT, useNativeDriver: false }),
        ]).start();
      },
      onPanResponderTerminate     : () => {
        translateY.flattenOffset();
        setScrollEnabled(true);
        Animated.parallel([
          Animated.spring(translateY,  { toValue: 0, useNativeDriver: false }),
          Animated.spring(sheetHeight, { toValue: MAX_SHEET_HEIGHT, useNativeDriver: false }),
        ]).start();
      },
    })
  ).current;

  /* dim-background opacity */
  const overlayOpacity = translateY.interpolate({
    inputRange : [0, WINDOW_HEIGHT * 0.7],
    outputRange: [0.7, 0],
    extrapolate: 'clamp',
  });

  /* ───────────────────────── render ───────────────────────── */
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={slideOutAndClose}
    >
      <View style={styles.container} pointerEvents="box-none">
        {/* backdrop */}
        <Pressable
          disabled={!canClose}
          onPress={slideOutAndClose}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </Pressable>

        {/* bottom-sheet */}
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
          {/* drag handle (pan handlers attached here) */}
          <View style={styles.handleBox} {...pan.panHandlers}>
            <View style={styles.handle} hitSlop={{ top: 8, bottom: 8 }} />
          </View>

          {/* page body */}
          <ScrollView
            scrollEnabled={scrollEnabled}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
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

  sheet: {
    backgroundColor     : '#141414',
    borderTopLeftRadius : 24,
    borderTopRightRadius: 24,
    overflow            : 'hidden',
    shadowColor   : '#000',
    shadowOffset  : { width: 0, height: -4 },
    shadowOpacity : 0.18,
    shadowRadius  : 16,
    elevation     : 16,
  },

  handleBox: { alignItems: 'center', height: 48, paddingTop: 12 },
  handle   : {
    width          : 48,
    height         : 6,
    borderRadius   : 3,
    backgroundColor: '#444',
    marginVertical : 8,
  },

  content: { paddingHorizontal: 8, paddingBottom: 24 },
});
