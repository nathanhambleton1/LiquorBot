// -----------------------------------------------------------------------------
// File: confirm-code.tsx               (fully rewritten – drop-in replacement)
// -----------------------------------------------------------------------------
// Confirms the account, then shows ✅ & a Sign-In button.
// • Always sends/ resends verification code on entry + on demand
// • Resend link restarts 30-s timer; larger hit-area via Pressable
// Author: Nathan Hambleton    Updated: Jun 23 2025
// -----------------------------------------------------------------------------
import React, {
  useState,
  useEffect,
  useRef,
  useContext,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  confirmSignUp,
  signIn,
  resendSignUpCode,
} from 'aws-amplify/auth';
import { Ionicons } from '@expo/vector-icons';
import { AuthModalContext } from '../components/AuthModalContext';


/* ───────────────────────── constants ───────────────────────── */
const RESEND_DELAY = 30;          // seconds
const COLOR_PRIMARY = '#CE975E';
const COLOR_TEXT    = '#DFDCD9';

/* ───────────────────────── component ───────────────────────── */
export default function ConfirmCode({ modalMode }: { modalMode?: boolean }) {
  const router  = useRouter();
  const { username, password: routePwd } =
    useLocalSearchParams<{ username?: string; password?: string }>();

  /* ───────── local state ───────── */
  const [confirmationCode, setConfirmationCode]   = useState('');
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage,  setInfoMessage]  = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const [timer, setTimer]       = useState(RESEND_DELAY);
  const [canResend, setCanResend] = useState(false);
  const [resendCount, setResendCount] = useState(0);      // forces timer reset
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pwd       = routePwd ?? '';
  const authModal = useContext(AuthModalContext);

  /* ───────── helper to (re)send verification code ───────── */
  const sendVerificationCode = async () => {
    if (!username) return;
    try {
      await resendSignUpCode({ username });
      setInfoMessage('A verification code has been sent to your email.');
      setErrorMessage('');
      setResendCount((c) => c + 1);          // trigger timer reset
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send code. Try again later.');
    }
  };

  // Ref for the confirmation code input
  const codeRef = useRef<TextInput>(null);

  /* ───── fix: prevent keyboard dismissal ───── */
  const handleInputPress = () => {
    Keyboard.dismiss(); // Dismiss any existing keyboard first
    setTimeout(() => codeRef.current?.focus(), 50); // Slight delay before refocusing
  };

  /* ───────── initial code send ───────── */
  useEffect(() => {
    sendVerificationCode();                  // unconditionally – Cognito throttles if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────── 30-s cooldown timer ───────── */
  useEffect(() => {
    if (confirmationSuccess) return;

    // reset & start countdown
    setCanResend(false);
    setTimer(RESEND_DELAY);
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
  }, [resendCount, confirmationSuccess]);

  /* ───────── actions ───────── */
  const handleConfirm = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setIsLoading(true);
    try {
      await confirmSignUp({ username: username!, confirmationCode });
      setConfirmationSuccess(true);
      setInfoMessage('Your account has been confirmed!');
    } catch (e: any) {
      if (
        (e?.code === 'NotAuthorizedException' || e?.name === 'NotAuthorizedException') &&
        /already.*confirmed/i.test(e?.message ?? '')
      ) {
        setConfirmationSuccess(true);
        setInfoMessage('Your account is already confirmed!');
      } else {
        setErrorMessage(e?.message ?? 'Confirmation error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;          // guard against multiple taps
    await sendVerificationCode();
  };

  const handleSignIn = async () => {
    if (!pwd) {
      modalMode && authModal?.open ? authModal.open('signIn') : router.replace('/auth/sign-in');
      return;
    }
    try {
      await signIn({ username: username!, password: pwd });
      modalMode && authModal?.close ? authModal.close() : router.replace('/auth/session-loading');
    } catch {
      modalMode && authModal?.open ? authModal.open('signIn') : router.replace('/auth/sign-in');
    }
  };

  /* ───────── reusable chunks ───────── */
  const ResendSection = () =>
    canResend ? (
      <Pressable onPress={handleResend}>
        <Text style={styles.resendText}>
          Didn&apos;t get a code? <Text style={styles.resendLink}>Tap here to resend.</Text>
        </Text>
      </Pressable>
    ) : (
      <Text style={styles.timerText}>
        Request another code in {timer} second{timer !== 1 ? 's' : ''}.
      </Text>
    );

  const ConfirmBody = () => (
    <>
      <Text style={styles.explanation}>
        We&apos;ve sent a 6-digit confirmation code. Please check your e-mail and enter it below.
      </Text>
      <Pressable onPress={handleInputPress}> {/* Wrap input in Pressable */}
        <TextInput
          ref={codeRef}
          value={confirmationCode}
          onChangeText={setConfirmationCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          placeholderTextColor="#666"
          style={[styles.input, modalMode && styles.border]}
          showSoftInputOnFocus={true}
        />
      </Pressable>

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      {!!infoMessage  && <Text style={styles.info}>{infoMessage}</Text>}

      <ResendSection />

      <TouchableOpacity
        style={styles.button}
        onPress={handleConfirm}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={COLOR_TEXT} />
        ) : (
          <Text style={styles.buttonText}>Confirm</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const SuccessBody = () => (
    <>
      <Ionicons
        name="checkmark-circle"
        size={48}
        color="#44e627"
        style={{ alignSelf: 'center', marginVertical: 24 }}
      />
      <Text style={[styles.info, styles.confirmationMessage]}>{infoMessage}</Text>
      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
    </>
  );

  /* ───────── render ───────── */
  const Inner = () => (
    confirmationSuccess ? <SuccessBody /> : <ConfirmBody />
  );

  if (modalMode) {
    return (
      <View style={styles.modalContainer}>
        <Text style={[styles.title, { color: COLOR_TEXT }]}>Confirm Account</Text>
        <Inner />

        {!confirmationSuccess && (
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>
              Need a different account?{' '}
              <Text
                style={styles.signInLink}
                onPress={() =>
                  modalMode && authModal?.open
                    ? authModal.open('signIn')
                    : router.replace('/auth/sign-in')
                }
              >
                Sign In
              </Text>
            </Text>
          </View>
        )}
      </View>
    );
  }

  /* ---- full-page version ---- */
  return (
    <View style={[styles.background, { backgroundColor: '#232323' }]}>
      <View style={styles.container}>
        <Text style={styles.title}>Confirm Account</Text>
        <Inner />
        {!confirmationSuccess && (
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>
              Need a different account?{' '}
              <Text
                style={styles.signInLink}
                onPress={() => router.replace('/auth/sign-in')}
              >
                Sign In
              </Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const styles = StyleSheet.create({
  /* layout */
  background:      { flex: 1, backgroundColor: '#232323' },
  container:       { flex: 1, justifyContent: 'center', padding: 24 },
  modalContainer:  { backgroundColor: '#141414', borderRadius: 18, padding: 12 },

  /* text + UI */
  title:           { fontSize: 42, color: '#fff', marginBottom: 24, fontWeight: 'bold' },
  label:           { fontSize: 16, color: '#fff', marginTop: 10 },
  input:           {
    backgroundColor: 'rgba(20,20,20,0.5)',
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: COLOR_TEXT,
  },
  border: {
    borderWidth: 1,
    borderColor: '#CE975E',
  },
  button:          {
    backgroundColor: COLOR_PRIMARY,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText:      { color: COLOR_TEXT, fontSize: 18, fontWeight: 'bold' },

  error:           { color: 'red', marginTop: 8 },
  info:            { color: COLOR_PRIMARY, marginTop: 8 },
  confirmationMessage: { fontSize: 20, color: '#fff', textAlign: 'center', marginBottom: 16 },

  signInContainer: { marginTop: 60, alignItems: 'center' },
  signInText:      { fontSize: 14, color: '#fff' },
  signInLink:      { color: COLOR_PRIMARY, fontWeight: 'bold' },

  explanation:     { color: '#aaa', fontSize: 14, marginBottom: 10, marginTop: 8, textAlign: 'center' },

  timerText:       { color: '#aaa', fontSize: 12, marginBottom: 10, textAlign: 'left' },
  resendText:      { color: '#aaa', fontSize: 12, marginBottom: 10, textAlign: 'left' },
  resendLink:      { color: COLOR_PRIMARY, fontWeight: 'bold' },
});
