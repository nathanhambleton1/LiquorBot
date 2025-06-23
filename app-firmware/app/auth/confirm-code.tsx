// -----------------------------------------------------------------------------
// File: confirm-code.tsx
// Description: Confirms the account, then shows ✅ & a Sign-In button.
//              • Accepts username & (optional) password from route params.
//              • Treats "already confirmed" as success.
// Author: Nathan Hambleton
// Updated: Apr 23 2025
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { confirmSignUp, signIn, resendSignUpCode } from 'aws-amplify/auth';
import { Ionicons } from '@expo/vector-icons';
import { AuthModalContext } from '../components/AuthModalContext';

const BG_TOP = '#4f4f4f';
const BG_BTM = '#000';

export default function ConfirmCode({ modalMode }: { modalMode?: boolean }) {
  const router = useRouter();
  const { username, password: routePwd, fromSignup } = 
    useLocalSearchParams<{ username?: string; password?: string; fromSignup?: string }>();

  const [confirmationCode, setConfirmationCode] = useState('');
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(30); // 30 seconds industry standard
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pwd = routePwd ?? '';
  const authModal = useContext(AuthModalContext);

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

  // Timer logic
  useEffect(() => {
    if (confirmationSuccess) return;
    setCanResend(false);
    setTimer(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [infoMessage, confirmationSuccess]);

  const handleResendCode = async () => {
    if (!username) return;
    setCanResend(false);
    setTimer(30);
    setInfoMessage('');
    setErrorMessage('');
    try {
      await resendSignUpCode({ username });
      setInfoMessage('A new verification code has been sent to your email.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to resend code.');
    }
  };

  /* ───────────────────────── handlers ───────────────────────── */
  const doConfirm = async () => {
    setErrorMessage(''); 
    setInfoMessage('');
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const doSignIn = async () => {
    if (!pwd) {
      if (modalMode && authModal?.open) authModal.open('signIn');
      else router.replace('/auth/sign-in');
      return;
    }
    try {
      await signIn({ username: username!, password: pwd });
      if (modalMode && authModal?.close) authModal.close();
      else router.replace('/auth/session-loading');
    } catch {
      if (modalMode && authModal?.open) authModal.open('signIn');
      else router.replace('/auth/sign-in');
    }
  };

  /* ───────────────────────── UI ───────────────────────── */
  if (modalMode) {
    return (
      <View style={styles.modalContainer}>
        <Text style={[styles.title, { color: '#DFDCD9' }]}>Confirm Account</Text>

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
            {/* Explanatory text for user guidance */}
            <Text style={styles.explanation}>
              {`We've sent a 6-digit confirmation code. Please check your email inbox and enter the code below.`}
            </Text>
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

            {/* Timer and resend code UI */}
            {!canResend ? (
              <Text style={styles.timerText}>
                Request another code in {timer} second{timer !== 1 ? 's' : ''}.
              </Text>
            ) : (
              <Text style={styles.resendText} onPress={handleResendCode}>
                Didn't get a code? <Text style={styles.resendLink}>Tap here to resend.</Text>
              </Text>
            )}

            <TouchableOpacity style={styles.button} onPress={doConfirm} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#DFDCD9" />
              ) : (
                <Text style={styles.buttonText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Back link */}
        {!confirmationSuccess && (
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>
              Need a different account?{' '}
              <Text style={styles.signInLink} onPress={() => modalMode && authModal?.open ? authModal.open('signIn') : router.replace('/auth/sign-in')}>
                Sign In
              </Text>
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.background, { backgroundColor: '#232323' }]}> 
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
            {/* Explanatory text for user guidance */}
            <Text style={styles.explanation}>
              {`We've sent a 6-digit confirmation code. Please check your email inbox and enter the code below.`}
            </Text>
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

            {/* Timer and resend code UI */}
            {!canResend ? (
              <Text style={styles.timerText}>
                Request another code in {timer} second{timer !== 1 ? 's' : ''}.
              </Text>
            ) : (
              <Text style={styles.resendText} onPress={handleResendCode}>
                Didn't get a code? <Text style={styles.resendLink}>Tap here to resend.</Text>
              </Text>
            )}

            <TouchableOpacity style={styles.button} onPress={doConfirm} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#DFDCD9" />
              ) : (
                <Text style={styles.buttonText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Back link */}
        {!confirmationSuccess && (
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>
              Need a different account?{' '}
              <Text style={styles.signInLink} onPress={() => modalMode && authModal?.open ? authModal.open('signIn') : router.replace('/auth/sign-in')}>
                Sign In
              </Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background:            { flex: 1, backgroundColor: '#232323' },
  container:             { flex: 1, justifyContent: 'center', padding: 24 },
  modalContainer:        { backgroundColor: '#181818', borderRadius: 18, padding: 12 },
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
  explanation:           { color: '#aaa', fontSize: 14, marginBottom: 10, marginTop: 8, textAlign: 'center' },
  timerText:             { color: '#aaa', fontSize: 12, marginBottom: 10, textAlign: 'left' },
  resendText:            { color: '#aaa', fontSize: 12, marginBottom: 10, textAlign: 'left' },
  resendLink:            { color: '#CE975E', fontWeight: 'bold', textDecorationLine: 'underline' },
});