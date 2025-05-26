// -----------------------------------------------------------------------------
// File: sign-in.tsx
// Description: Handles the sign-in process. If the account isn't confirmed it
//              routes to confirm-code screen and passes BOTH username & password.
// Author: Nathan Hambleton
// Updated: Apr 23 2025
// -----------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchAuthSession } from '@aws-amplify/auth';

export default function SignIn() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  /* ───────────────────────── check session ───────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const current = await getCurrentUser();
        if (current) router.replace('/(tabs)');
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  /* ───────────────────────── sign-in ───────────────────────── */
  const onSignInPress = async () => {
    setError('');
    try {
      const { isSignedIn, nextStep } = await signIn({ username, password });

      if (isSignedIn) {
        // 🔼 Force refresh session to get latest groups BEFORE redirect
        await fetchAuthSession({ forceRefresh: true }); 
        router.replace('/(tabs)');
        return;
      }

      if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        router.push({
          pathname: './confirm-code',
          params: { username, password },
        });
        return;
      }

      setError('Additional authentication required (not implemented yet).');
    } catch (e: any) {
      if (
        e?.name === 'UserNotConfirmedException' ||
        e?.code === 'UserNotConfirmedException'
      ) {
        router.push({
          pathname: './confirm-code',
          params: { username, password },
        });
        return;
      }
      setError(e?.message || 'Something went wrong');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <ImageBackground
      source={require('@/assets/images/dark-gradient.png')}
      style={styles.background}
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
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
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
            Don&apos;t have an account?{' '}
            <Text style={styles.signUpLink} onPress={() => router.push('/auth/sign-up')}>
              Sign Up
            </Text>
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background:          { flex: 1, resizeMode: 'cover' },
  container:           { flex: 1, justifyContent: 'center', padding: 24 },
  title:               { fontSize: 48, color: '#fff', marginBottom: 24, fontWeight: 'bold' },
  label:               { fontSize: 16, color: '#fff', marginBottom: -5, marginTop: 10 },
  input:               { backgroundColor: 'rgba(20, 20, 20, 0.5)', marginVertical: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, fontSize: 16, color: '#DFDCD9' },
  inputContainer:      { position: 'relative' },
  eyeIcon:             { position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -12 }] },
  button:              { backgroundColor: '#CE975E', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText:          { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold' },
  forgotPassword:      { alignSelf: 'flex-end', marginTop: 8, marginBottom: 16 },
  forgotPasswordText:  { color: '#CE975E', fontSize: 14, fontWeight: 'bold' },
  signUpContainer:     { marginTop: 100, alignItems: 'center' },
  signUpText:          { fontSize: 14, color: '#fff' },
  signUpLink:          { color: '#CE975E', fontWeight: 'bold' },
});
