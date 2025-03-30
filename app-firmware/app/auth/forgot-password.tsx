import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';

export default function ForgotPassword() {
  const router = useRouter();

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
        router.push('/auth/sign-in');
      }, 1500);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Something went wrong');
    }
  };

  return (
    <View style={styles.container}>
      {/* Back Arrow */}
      <TouchableOpacity style={styles.backArrow} onPress={() => router.replace('/auth/sign-in')}>
        <Ionicons name="chevron-back-outline" size={28} color="#fff" />
      </TouchableOpacity>

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
          />

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

          {/* Submit Button */}
          <TouchableOpacity style={styles.button} onPress={onRequestResetPress}>
            <Text style={styles.buttonText}>Send Reset Code</Text>
          </TouchableOpacity>
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
          />

          {/* New Password Input */}
          <Text style={styles.label}>New Password</Text>
          <TextInput
            onChangeText={setNewPassword}
            value={newPassword}
            secureTextEntry
            style={styles.input}
          />

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

          {/* Confirm Reset Button */}
          <TouchableOpacity style={styles.button} onPress={onConfirmResetPress}>
            <Text style={styles.buttonText}>Confirm Reset</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 24,
    justifyContent: 'center',
  },
  backArrow: {
    position: 'absolute',
    top: 24,
    left: 16,
    zIndex: 10,
  },
  backArrowText: {
    fontSize: 24,
    color: '#CE975E', // Gold color for the back arrow
    fontWeight: 'bold',
  },
  title: {
    fontSize: 36,
    color: '#fff',
    marginBottom: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#141414',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#DFDCD9',
  },
  button: {
    backgroundColor: '#CE975E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#DFDCD9',
    fontSize: 18,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
  info: {
    color: '#CE975E',
    marginBottom: 10,
  },
});
