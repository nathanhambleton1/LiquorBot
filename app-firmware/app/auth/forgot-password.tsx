// -----------------------------------------------------------------------------
// File: forgot-password.tsx
// Description: Handles the password reset process for the LiquorBot app. 
//              Includes functionality for requesting a reset code and 
//              confirming the password reset. Integrates with AWS Amplify 
//              for authentication.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { AuthModalContext } from '../components/AuthModalContext';

const BG_TOP = '#4f4f4f';
const BG_BTM = '#000';

export default function ForgotPassword({ modalMode }: { modalMode?: boolean }) {
  const router = useRouter();
  const authModal = useContext(AuthModalContext);

  // Step can be "REQUEST" (username only) or "CONFIRM" (code + new password).
  const [step, setStep] = useState<'REQUEST' | 'CONFIRM'>('REQUEST');

  const [username, setUsername] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1) Request password reset
  const onRequestResetPress = async () => {
    try {
      setErrorMessage('');
      setInfoMessage('');
      const output = await resetPassword({ username });
      // Check what step Amplify suggests next:
      switch (output.nextStep.resetPasswordStep) {
        case 'CONFIRM_RESET_PASSWORD_WITH_CODE':
          setInfoMessage(`A confirmation code has been sent to your email.`);
          setStep('CONFIRM');
          break;
        case 'DONE':
          setInfoMessage(`Password reset process is already done. Try signing in.`);
          break;
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Something went wrong');
    }
  };

  // 2) Confirm password reset
  const onConfirmResetPress = async () => {
    try {
      setErrorMessage('');
      setInfoMessage('');
      await confirmResetPassword({
        username,
        confirmationCode,
        newPassword,
      });
      setInfoMessage('Password successfully reset! Please sign in with your new password.');
      setTimeout(() => {
        if (modalMode && authModal?.open) authModal.open('signIn');
        else router.push('/auth/sign-in');
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Something went wrong');
    }
  };

  if (modalMode) {
    return (
      <View style={styles.modalContainer}>
        <Text style={[styles.title, { color: '#DFDCD9' }]}>Forgot Password</Text>
        {step === 'REQUEST' && (
          <>
            {/* Username Input */}
            <Text style={styles.label}>Username</Text>
            <TextInput
              onChangeText={setUsername}
              value={username}
              style={[
                styles.input,
                modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
              ]}
              autoCapitalize="none"
              placeholder="Enter your username"
              placeholderTextColor="#666"
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

            {/* Submit Button */}
            <TouchableOpacity style={styles.button} onPress={onRequestResetPress}>
              <Text style={styles.buttonText}>Send Reset Code</Text>
            </TouchableOpacity>

            {/* Back to Sign In Link */}
            <View style={styles.navRow}>
              <Text style={styles.navText}>Back to </Text>
              <Text
                style={styles.navLink}
                onPress={() => {
                  if (modalMode && authModal?.open) authModal.open('signIn');
                  else router.replace('/auth/sign-in');
                }}
              >
                Sign In
              </Text>
            </View>
          </>
        )}

        {step === 'CONFIRM' && (
          <>
            {/* Confirmation Code Input */}
            <Text style={styles.label}>Confirmation Code</Text>
            <TextInput
              onChangeText={setConfirmationCode}
              value={confirmationCode}
              style={[
                styles.input,
                modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
              ]}
              autoCapitalize="none"
              placeholder="Enter 6-digit code"
              placeholderTextColor="#666"
              keyboardType="number-pad"
            />

            {/* New Password Input */}
            <Text style={styles.label}>New Password</Text>
            <TextInput
              onChangeText={setNewPassword}
              value={newPassword}
              secureTextEntry
              style={[
                styles.input,
                modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
              ]}
              placeholder="Enter new password"
              placeholderTextColor="#666"
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

            {/* Confirm Reset Button */}
            <TouchableOpacity style={styles.button} onPress={onConfirmResetPress}>
              <Text style={styles.buttonText}>Confirm Reset</Text>
            </TouchableOpacity>

            {/* Back to Sign In Link */}
            <View style={styles.navRow}>
              <Text style={styles.navText}>Back to </Text>
              <Text
                style={styles.navLink}
                onPress={() => {
                  if (modalMode && authModal?.open) authModal.open('signIn');
                  else router.replace('/auth/sign-in');
                }}
              >
                Sign In
              </Text>
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.background, { backgroundColor: '#232323' }]}> 
      <View style={styles.container}>
        {/* Back Arrow */}
        {!modalMode && (
          <TouchableOpacity style={styles.backArrow} onPress={() => router.replace('/auth/sign-in')}>
            <Ionicons name="chevron-back-outline" size={28} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Forgot Password</Text>

        {step === 'REQUEST' && (
          <>
            {/* Username Input */}
            <Text style={styles.label}>Username</Text>
            <TextInput
              onChangeText={setUsername}
              value={username}
              style={styles.input}
              autoCapitalize="none"
              placeholder="Enter your username"
              placeholderTextColor="#666"
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

            {/* Submit Button */}
            <TouchableOpacity style={styles.button} onPress={onRequestResetPress}>
              <Text style={styles.buttonText}>Send Reset Code</Text>
            </TouchableOpacity>

            {/* Back to Sign In Link */}
            <View style={styles.navRow}>
              <Text style={styles.navText}>Back to </Text>
              <Text
                style={styles.navLink}
                onPress={() => {
                  if (modalMode && authModal?.open) authModal.open('signIn');
                  else router.replace('/auth/sign-in');
                }}
              >
                Sign In
              </Text>
            </View>
          </>
        )}

        {step === 'CONFIRM' && (
          <>
            {/* Confirmation Code Input */}
            <Text style={styles.label}>Confirmation Code</Text>
            <TextInput
              onChangeText={setConfirmationCode}
              value={confirmationCode}
              style={styles.input}
              autoCapitalize="none"
              placeholder="Enter 6-digit code"
              placeholderTextColor="#666"
              keyboardType="number-pad"
            />

            {/* New Password Input */}
            <Text style={styles.label}>New Password</Text>
            <TextInput
              onChangeText={setNewPassword}
              value={newPassword}
              secureTextEntry
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor="#666"
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

            {/* Confirm Reset Button */}
            <TouchableOpacity style={styles.button} onPress={onConfirmResetPress}>
              <Text style={styles.buttonText}>Confirm Reset</Text>
            </TouchableOpacity>

            {/* Back to Sign In Link */}
            <View style={styles.navRow}>
              <Text style={styles.navText}>Back to </Text>
              <Text
                style={styles.navLink}
                onPress={() => {
                  if (modalMode && authModal?.open) authModal.open('signIn');
                  else router.replace('/auth/sign-in');
                }}
              >
                Sign In
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background:            { flex: 1, backgroundColor: 'rgba(20,20,20,0)' },
  container:             { flex: 1, padding: 24, justifyContent: 'center' },
  backArrow:             { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  title:                 { fontSize: 36, color: '#fff', marginBottom: 24, fontWeight: 'bold', textAlign: 'center' },
  label:                 { fontSize: 16, color: '#fff', marginTop: 12, marginBottom: 4 },
  input:                 { backgroundColor: 'rgba(20, 20, 20, 0.5)', marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, fontSize: 16, color: '#DFDCD9' },
  button:                { backgroundColor: '#CE975E', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText:            { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold' },
  error:                 { color: 'red', marginBottom: 8 },
  info:                  { color: '#CE975E', marginBottom: 10 },
  modalContainer:        { backgroundColor: 'rgba(20,20,20,0)', borderRadius: 18, padding: 12 },
  navRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  navText: { color: '#aaa', fontSize: 16, fontWeight: 'normal' },
  navLink: { color: '#CE975E', fontSize: 16, fontWeight: 'bold', marginLeft: 2 },
});