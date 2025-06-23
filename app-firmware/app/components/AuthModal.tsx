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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthModalContext } from './AuthModalContext';
import SignIn         from '../auth/sign-in';
import SignUp         from '../auth/sign-up';
import ForgotPassword from '../auth/forgot-password';
import ConfirmCode    from '../auth/confirm-code';

/* ───────────────────────── static & dynamic sizes ───────────────────────── */
const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const MAX_SHEET_HEIGHT = WINDOW_HEIGHT * 0.80;      // 80 % of screen

export default function AuthModal() {
  const insets = useSafeAreaInsets();
  const ctx    = useContext(AuthModalContext);
  if (!ctx) return null;
  const { visible, screen, close } = ctx;

  /* pick the current page */
  let Content: JSX.Element | null = null;
  if      (screen === 'signIn'        ) Content = <SignIn modalMode />;
  else if (screen === 'signUp'        ) Content = <SignUp modalMode />;
  else if (screen === 'forgotPassword') Content = <ForgotPassword modalMode />;
  else if (screen === 'confirmCode'   ) Content = <ConfirmCode modalMode />;

  /* ───────── drag state ───────── */
  const translateY = useRef(new Animated.Value(0)).current;
  const [scrollEnabled, setScrollEnabled] = useState(true);

  /* ───────── “backdrop clickable?” state ───────── */
  const [canClose, setCanClose] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setCanClose(false);                         // ① block taps right after opening
    const t = setTimeout(() => setCanClose(true), 250);
    return () => clearTimeout(t);
  }, [visible]);

  /* reset position every time the modal opens */
  useEffect(() => { if (visible) translateY.setValue(0); }, [visible]);

  /* pan-handler */
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder     : () => true,
      onMoveShouldSetPanResponder      : (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant              : () => { setScrollEnabled(false); translateY.stopAnimation(); translateY.extractOffset(); },
      onPanResponderMove               : (_, g) => translateY.setValue(g.dy > 0 ? g.dy : g.dy / 3),
      onPanResponderRelease            : (_, g) => {
        translateY.flattenOffset();
        setScrollEnabled(true);
        const offScreen = g.dy > 120 || g.vy > 1.2;
        Animated.spring(translateY, {
          toValue       : offScreen ? WINDOW_HEIGHT : 0,
          bounciness    : offScreen ? 0 : 4,
          useNativeDriver: true,
        }).start(() => offScreen && close());
      },
      onPanResponderTerminate          : () => {
        translateY.flattenOffset();
        setScrollEnabled(true);
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.container} pointerEvents="box-none">
        {/* backdrop (only closes when canClose === true) */}
        <Pressable
          disabled={!canClose}
          onPress={close}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </Pressable>

        {/* bottom-sheet */}
        <Animated.View
          {...pan.panHandlers}
          onStartShouldSetResponderCapture={() => true}   /* ② prevent tap-through */
          style={[
            styles.sheet,
            {
              height        : MAX_SHEET_HEIGHT,
              paddingBottom : (Platform.OS === 'ios' ? 24 : 16) + insets.bottom,
              transform     : [{ translateY }],
            },
          ]}
        >
          {/* drag handle */}
          <View style={styles.handleBox}>
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
    backgroundColor   : '#141414',
    borderTopLeftRadius : 24,
    borderTopRightRadius: 24,
    shadowColor : '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius : 16,
    elevation    : 16,
  },

  handleBox: { alignItems: 'center', height: 40 },
  handle   : { width: 48, height: 6, borderRadius: 3, backgroundColor: '#444', marginVertical: 8 },

  content: { paddingHorizontal: 8, paddingBottom: 24 },
});
