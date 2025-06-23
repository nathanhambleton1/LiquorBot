import React, { useContext, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';

import { AuthModalContext, AuthScreen } from './AuthModalContext';
import SignIn           from '../auth/sign-in';
import SignUp           from '../auth/sign-up';
import ForgotPassword   from '../auth/forgot-password';
import ConfirmCode      from '../auth/confirm-code';

export default function AuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) return null;
  const { visible, screen, close } = ctx;

  // Decide which inner component to render
  let Content: JSX.Element | null = null;
  if (screen === 'signIn')          Content = <SignIn  modalMode />;
  else if (screen === 'signUp')     Content = <SignUp  modalMode />;
  else if (screen === 'forgotPassword') Content = <ForgotPassword modalMode />;
  else if (screen === 'confirmCode')    Content = <ConfirmCode    modalMode />;

  // ────────────────────────────────────────
  // Drag-to-dismiss behaviour
  // ────────────────────────────────────────
  const translateY   = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);      // only allow downward drag
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > 120 || g.vy > 1.2;
        if (shouldClose) {
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(close);                            // close after animation
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      {/* dark overlay – tap outside to dismiss */}
      <Pressable style={styles.overlay} onPress={close}>
        {/* small gap so iOS swipe-down bar isn’t covered  */}
        <View style={styles.gap} />

        {/* bottom sheet */}
        <Pressable onPress={e => e.stopPropagation()}>
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              {Content}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,20,20,0.7)',
    justifyContent: 'flex-end',
  },
  gap: {
    height: Platform.OS === 'ios' ? 32 : 16,
  },
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    minHeight: '55%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
  },
  handleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
});
