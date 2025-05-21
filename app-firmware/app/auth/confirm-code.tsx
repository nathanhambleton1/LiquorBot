// -----------------------------------------------------------------------------
// File: confirm-code.tsx
// Description: Confirms the account, then shows ✅ & a Sign-In button.
//              • Accepts username & (optional) password from route params.
//              • Treats "already confirmed" as success.
// Author: Nathan Hambleton
// Updated: Apr 23 2025
// -----------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { confirmSignUp, signIn, resendSignUpCode } from 'aws-amplify/auth';
import { Ionicons } from '@expo/vector-icons';

export default function ConfirmCode() {
  const router = useRouter();
  const { username, password: routePwd, fromSignup } = 
    useLocalSearchParams<{ username?: string; password?: string; fromSignup?: string }>();

  const [confirmationCode, setConfirmationCode] = useState('');
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const pwd = routePwd ?? '';

  // Resend logic with sign-up context check
  useEffect(() => {
    const handleResend = async () => {
      if (!username || confirmationSuccess) return;
      
      try {
        // Only resend if NOT coming from sign-up flow
        if (fromSignup !== '1') {
          await resendSignUpCode({ username });
          setInfoMessage('A new verification code has been sent to your email.');
        }
      } catch (error: any) {
        if (error.name === 'InvalidParameterException' && 
            error.message.includes('already confirmed')) {
          setConfirmationSuccess(true);
          setInfoMessage('Your account is already confirmed!');
        } else {
          setErrorMessage(error.message || 'Failed to send new code. Try again later.');
        }
      }
    };

    handleResend();
  }, []);

  /* ───────────────────────── handlers ───────────────────────── */
  const doConfirm = async () => {
    setErrorMessage(''); 
    setInfoMessage('');
    try {
      await confirmSignUp({ username: username!, confirmationCode });
      setConfirmationSuccess(true);
      setInfoMessage('Your account has been confirmed!');
    } catch (e: any) {
      if ((e?.code === 'NotAuthorizedException' || e?.name === 'NotAuthorizedException') &&
          /already.*confirmed/i.test(e?.message ?? '')) {
        setConfirmationSuccess(true);
        setInfoMessage('Your account is already confirmed!');
        return;
      }
      setErrorMessage(e?.message ?? 'Confirmation error');
    }
  };

  const doSignIn = async () => {
    if (!pwd) {
      router.replace('/auth/sign-in');     // fall back if password missing
      return;
    }
    try {
      await signIn({ username: username!, password: pwd });
      router.replace('/(tabs)');
    } catch {
      router.replace('/auth/sign-in');
    }
  };

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <ImageBackground
      source={require('@/assets/images/dark-gradient.png')}
      style={styles.background}
      resizeMode="cover"
      blurRadius={5}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Confirm Account</Text>

        {confirmationSuccess ? (
          <>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color="#44e627"
              style={{ alignSelf: 'center', marginVertical: 24 }}
            />
            <Text style={[styles.info, styles.confirmationMessage]}>{infoMessage}</Text>
            <TouchableOpacity style={styles.button} onPress={doSignIn}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Confirmation Code</Text>
            <TextInput
              value={confirmationCode}
              onChangeText={setConfirmationCode}
              style={styles.input}
              keyboardType="number-pad"
              placeholder="Enter 6-digit code"
              placeholderTextColor="#666"
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

            <TouchableOpacity style={styles.button} onPress={doConfirm}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Back link */}
        {!confirmationSuccess && (
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>
              Need a different account?{' '}
              <Text style={styles.signInLink} onPress={() => router.replace('/auth/sign-in')}>
                Sign In
              </Text>
            </Text>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background:            { flex: 1, resizeMode: 'cover' },
  container:             { flex: 1, justifyContent: 'center', padding: 24 },
  title:                 { fontSize: 42, color: '#fff', marginBottom: 24, fontWeight: 'bold' },
  label:                 { fontSize: 16, color: '#fff', marginTop: 10 },
  input:                 { backgroundColor: 'rgba(20, 20, 20, 0.5)', marginVertical: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, fontSize: 16, color: '#DFDCD9' },
  button:                { backgroundColor: '#CE975E', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText:            { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold' },
  error:                 { color: 'red', marginTop: 8 },
  info:                  { color: '#CE975E', marginTop: 8 },
  confirmationMessage:   { fontSize: 20, color: '#fff', textAlign: 'center', marginBottom: 16 },
  signInContainer:       { marginTop: 60, alignItems: 'center' },
  signInText:            { fontSize: 14, color: '#fff' },
  signInLink:            { color: '#CE975E', fontWeight: 'bold' },
});