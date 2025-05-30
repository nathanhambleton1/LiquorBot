// -----------------------------------------------------------------------------
// File: sign-in.tsx
// Description: Handles the sign-in process and then routes to a one-time
//              session-loading screen that caches Cognito groups.
// Author: Nathan Hambleton
// Updated: 27 May 2025
// -----------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ImageBackground, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { MaterialIcons } from '@expo/vector-icons';

export default function SignIn() {
  const router = useRouter();

  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [error,    setError]            = useState('');
  const [isLoading, setIsLoading]       = useState(true);
  const [isPasswordVisible, setIsPwVis] = useState(false);

  /* ── already signed-in? jump straight to tabs ── */
  useEffect(() => {
    (async () => {
      try { if (await getCurrentUser()) router.replace('/(tabs)'); }
      catch {}
      finally { setIsLoading(false); }
    })();
  }, []);

  /* ───────────────────────── sign-in ───────────────────────── */
  const onSignInPress = async () => {
    setError('');
    try {
      const { isSignedIn, nextStep } = await signIn({ username, password });

      if (isSignedIn) {
        router.replace('/auth/session-loading');      // 👈 NEW
        return;
      }

      if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        router.push({ pathname: './confirm-code', params: { username, password } });
        return;
      }

      setError('Additional authentication required (not implemented yet).');
    } catch (e: any) {
      if (e?.code === 'UserNotConfirmedException') {
        router.push({ pathname: './confirm-code', params: { username, password } });
        return;
      }
      setError(e?.message || 'Something went wrong');
    }
  };

  /* ───────────────────────── UI ───────────────────────── */
  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImageBackground
        source={require('@/assets/images/dark-gradient.png')}
        style={[styles.background, { backgroundColor: '#141414' }]}
        resizeMode="cover"
        blurRadius={5}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Sign In</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry={!isPasswordVisible}
            />
            <TouchableOpacity
              onPress={() => setIsPwVis(!isPasswordVisible)}
              style={styles.eyeIcon}
            >
              <MaterialIcons
                name={isPasswordVisible ? 'visibility' : 'visibility-off'}
                size={24}
                color="#4f4f4f"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push('./forgot-password')}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {!!error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={onSignInPress}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>
              Don’t have an account?{' '}
              <Text style={styles.signUpLink} onPress={() => router.push('/auth/sign-up')}>
                Sign Up
              </Text>
            </Text>
          </View>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background:         { flex: 1 },
  container:          { flex: 1, justifyContent: 'center', padding: 24 },
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
