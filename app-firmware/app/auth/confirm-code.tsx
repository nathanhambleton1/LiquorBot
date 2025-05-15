// -----------------------------------------------------------------------------
// File: confirm-code.tsx
// Description: Confirms the account, then shows ✅ & a Sign-In button.
//              • Accepts username & (optional) password from route params.
//              • Treats “already confirmed” as success.
// Author: Nathan Hambleton
// Updated: Apr 23 2025
// -----------------------------------------------------------------------------
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { confirmSignUp, signIn } from 'aws-amplify/auth';
import { Ionicons } from '@expo/vector-icons';

export default function ConfirmCode() {
  const router = useRouter();
  const { username, password: routePwd } =
    useLocalSearchParams<{ username?: string; password?: string }>();

  const [confirmationCode, setConfirmationCode] = useState('');
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const pwd = routePwd ?? '';

  /* ───────────────────────── handlers ───────────────────────── */
  const doConfirm = async () => {
    setErrorMessage(''); setInfoMessage('');
    try {
      await confirmSignUp({ username: username!, confirmationCode });
      setConfirmationSuccess(true);
      setInfoMessage('Your account has been confirmed!');
    } catch (e: any) {
      // if it was already confirmed, treat that as success
      if (
        (e?.code === 'NotAuthorizedException' || e?.name === 'NotAuthorizedException') &&
        /already.*confirmed/i.test(e?.message ?? '')
      ) {
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
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#000', justifyContent:'center', padding:24 },
  title:{ fontSize:42, color:'#fff', marginBottom:24, fontWeight:'bold' },
  label:{ fontSize:16, color:'#fff', marginTop:10 },
  input:{ backgroundColor:'#141414', marginVertical:12, paddingHorizontal:16, paddingVertical:12, borderRadius:8, fontSize:16, color:'#DFDCD9' },
  button:{ backgroundColor:'#CE975E', paddingVertical:12, borderRadius:8, alignItems:'center', marginTop:20 },
  buttonText:{ color:'#DFDCD9', fontSize:18, fontWeight:'bold' },
  error:{ color:'red', marginTop:8 },
  info:{ color:'#CE975E', marginTop:8 },
  confirmationMessage:{ fontSize:20, color:'#fff', textAlign:'center', marginBottom:16 },
  signInContainer:{ marginTop:60, alignItems:'center' },
  signInText:{ fontSize:14, color:'#fff' },
  signInLink:{ color:'#CE975E', fontWeight:'bold' },
});