import React, { useContext } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Platform, Pressable, ScrollView } from 'react-native';
import { AuthModalContext, AuthScreen } from './AuthModalContext';
import SignIn from '../auth/sign-in';
import SignUp from '../auth/sign-up';
import ForgotPassword from '../auth/forgot-password';
import ConfirmCode from '../auth/confirm-code';

export default function AuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) return null;
  const { visible, screen, close } = ctx;

  let Content = null;
  if (screen === 'signIn') Content = <SignIn modalMode />;
  else if (screen === 'signUp') Content = <SignUp modalMode />;
  else if (screen === 'forgotPassword') Content = <ForgotPassword modalMode />;
  else if (screen === 'confirmCode') Content = <ConfirmCode modalMode />;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <Pressable style={styles.overlay} onPress={close}>
        <View style={styles.gap} />
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
            <TouchableOpacity style={styles.closeBtn} onPress={close} accessibilityLabel="Close auth modal">
              <View style={styles.arrowDown} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {Content}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  gap: {
    height: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    minHeight: '55%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
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
    backgroundColor: '#ccc',
    marginTop: 8,
    marginBottom: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#888',
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
});
