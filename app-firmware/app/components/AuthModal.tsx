import React, { useContext, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';

import { AuthModalContext }   from './AuthModalContext';
import SignIn          from '../auth/sign-in';
import SignUp          from '../auth/sign-up';
import ForgotPassword  from '../auth/forgot-password';
import ConfirmCode     from '../auth/confirm-code';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.65;
const screenHeight = Dimensions.get('window').height;

export default function AuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) return null;
  const { visible, screen, close } = ctx;

  let Content = null;
  if (screen === 'signIn') Content = <SignIn modalMode />;
  else if (screen === 'signUp') Content = <SignUp modalMode />;
  else if (screen === 'forgotPassword') Content = <ForgotPassword modalMode />;
  else if (screen === 'confirmCode') Content = <ConfirmCode modalMode />;

  // Drag state for disabling ScrollView while dragging
  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const translateY = useRef(new Animated.Value(0)).current;

  // Reset translateY when modal opens
  React.useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  // PanResponder for the whole sheet
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture : (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        setScrollEnabled(false);
        translateY.stopAnimation();
        translateY.extractOffset();
      },
      onPanResponderMove: (_, g) => {
        translateY.setValue(g.dy > 0 ? g.dy : g.dy / 3);
      },
      onPanResponderRelease: (_, g) => {
        translateY.flattenOffset();
        setScrollEnabled(true);
        const shouldClose = g.dy > 120 || g.vy > 1.2;
        Animated.spring(translateY, {
          toValue: shouldClose ? screenHeight : 0,
          bounciness: shouldClose ? 0 : 4,
          useNativeDriver: true,
        }).start(() => shouldClose && close());
      },
      onPanResponderTerminate: () => {
        translateY.flattenOffset();
        setScrollEnabled(true);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  // Calculate overlay opacity based on translateY
  const overlayOpacity = translateY.interpolate({
    inputRange: [0, screenHeight * 0.7],
    outputRange: [0.7, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="auto">
        {/* The overlay is now animated for opacity only */}
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.gap} />
        <Pressable onPress={e => e.stopPropagation()} style={{ flex: 1 }}>
          <Animated.View
            {...handlePan.panHandlers}
            style={[
              styles.sheet,
              { minHeight: '55%', maxHeight: '90%', transform: [{ translateY }] },
            ]}
          >
            <View style={styles.handleContainer} pointerEvents="box-none">
              <View style={styles.handle} hitSlop={{ top: 8, bottom: 8 }} />
            </View>
            <ScrollView
              scrollEnabled={scrollEnabled}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              {Content}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </View>
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
    backgroundColor: 'transparent',
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
    position: 'relative',
    height: 40,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
    marginTop: 8,
    marginBottom: 8,
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
});
