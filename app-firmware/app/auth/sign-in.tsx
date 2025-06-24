// -----------------------------------------------------------------------------
// File: sign-in.tsx
// Description: Handles the sign-in process and then routes to a one-time
//              session-loading screen that caches Cognito groups.
// Author: Nathan Hambleton
// Updated: 27 May 2025
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { AuthModalContext } from '../components/AuthModalContext';

export default function SignIn({ modalMode }: { modalMode?: boolean }) {
  const router = useRouter();
  const authModal = useContext(AuthModalContext);

  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [error,    setError]            = useState('');
  const [isLoading, setIsLoading]       = useState(true);
  const [isPasswordVisible, setIsPwVis] = useState(false);

  /* ── already signed-in? jump straight to tabs ── */
  useEffect(() => {
    (async () => {
      try {
        if (await getCurrentUser()) {
          if (modalMode && authModal?.close) authModal.close();
          else router.replace('/(tabs)');
        }
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, []);

  /* ───────────────────────── sign-in ───────────────────────── */
  const onSignInPress = async () => {
    setError('');
    setIsLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({ username, password });

      if (isSignedIn) {
        // Wait for Cognito session to be available before proceeding
        try {
          await getCurrentUser(); // Ensures session is ready
        } catch {}
        if (modalMode && authModal?.open) {
          authModal.open('sessionLoading', {
            onFinish: () => authModal.close(),
            modalMode: true,
          });
        } else {
          router.replace('/auth/session-loading');
        }
        return;
      }

      if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        if (modalMode && authModal?.open) authModal.open('confirmCode', { username, password });
        else router.push({ pathname: './confirm-code', params: { username, password } });
        return;
      }

      setError('Additional authentication required (not implemented yet).');
    } catch (e: any) {
      if (e?.code === 'UserNotConfirmedException') {
        if (modalMode && authModal?.open) authModal.open('confirmCode', { username, password });
        else router.push({ pathname: './confirm-code', params: { username, password } });
        return;
      }
      setError(e?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  /* ───────────────────────── UI ───────────────────────── */
  if (isLoading) {
    return (
      <View style={[modalMode ? styles.modalContainer : styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  const Inner = (
    <View style={modalMode ? styles.modalContainer : styles.container}>
      <Text style={[styles.title, modalMode && { color: '#DFDCD9' }]}>Sign In</Text>
      <Text style={[styles.label, modalMode && { color: '#aaa' }]}>Username</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        style={[
          styles.input,
          modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
        ]}
        autoCapitalize="none"
        placeholder="Username"
        placeholderTextColor="#666"
      />
      <Text style={[styles.label, modalMode && { color: '#aaa' }]}>Password</Text>
      <View style={styles.inputContainer}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          style={[
            styles.input,
            modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
          ]}
          secureTextEntry={!isPasswordVisible}
          placeholder="Password"
          placeholderTextColor="#666"
        />
        <TouchableOpacity
          onPress={() => setIsPwVis(!isPasswordVisible)}
          style={styles.eyeIcon}
        >
          <MaterialIcons
            name={isPasswordVisible ? 'visibility' : 'visibility-off'}
            size={24}
            color={modalMode ? '#aaa' : '#4f4f4f'}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => modalMode && authModal?.open ? authModal.open('forgotPassword') : router.push('./forgot-password')}
        style={styles.forgotPassword}
      >
        <Text style={[styles.forgotPasswordText, modalMode && { color: '#CE975E' }]}>Forgot Password?</Text>
      </TouchableOpacity>
      {!!error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}
      <TouchableOpacity style={[styles.button, modalMode && { backgroundColor: '#CE975E' }]} onPress={onSignInPress}>
        <Text style={[styles.buttonText, modalMode && { color: '#232323' }]}>Sign In</Text>
      </TouchableOpacity>
      <View style={styles.signUpContainer}>
        <Text style={[styles.signUpText, modalMode && { color: '#aaa' }]}>Don’t have an account?{' '}
          <Text style={[styles.signUpLink, modalMode && { color: '#CE975E' }]} onPress={() => modalMode && authModal?.open ? authModal.open('signUp') : router.push('/auth/sign-up')}>
            Sign Up
          </Text>
        </Text>
      </View>
    </View>
  );

  if (modalMode) {
    return <View style={styles.modalContainer}>{Inner}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.background}>
        {Inner}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: 'cover' },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  modalContainer: { backgroundColor: '#141414', borderRadius: 18, padding: 12 },
  title:              { fontSize: 48, color: '#fff', marginBottom: 24, fontWeight: 'bold' },
  label:              { fontSize: 16, color: '#fff', marginTop: 10 },
  input:              { backgroundColor: 'rgba(20,20,20,0.5)', marginVertical: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, fontSize: 16, color: '#DFDCD9' },
  inputContainer:     { position: 'relative' },
  eyeIcon:            { position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -12 }] },
  button:             { backgroundColor: '#CE975E', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText:         { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold' },
  forgotPassword:     { alignSelf: 'flex-end', marginBottom: 16 },
  forgotPasswordText: { color: '#CE975E', fontSize: 14, fontWeight: 'bold' },
  signUpContainer:    { marginTop: 100, alignItems: 'center' },
  signUpText:         { fontSize: 14, color: '#fff' },
  signUpLink:         { color: '#CE975E', fontWeight: 'bold' },
});
