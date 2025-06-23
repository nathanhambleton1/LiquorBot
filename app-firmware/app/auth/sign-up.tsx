import React, { useState, useRef, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, signIn } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthModalContext } from '../components/AuthModalContext';

const client = generateClient();
const dummyPwd = 'DummyPa$$word123!';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRegex = /^[A-Za-z0-9_]+$/;
const DEBOUNCE_MS = 400;

const LIST_USERNAMES = /* GraphQL */ `
  query Check($username: String!) {
    listUserProfiles(filter: { username: { eq: $username } }, limit: 1) {
      items { id }
    }
  }
`;

const isUsernameTaken = async (name: string): Promise<boolean> => {
  const res: any = await client.graphql({
    query: LIST_USERNAMES,
    variables: { username: name },
  });
  if (res?.data?.listUserProfiles?.items?.length) return true;

  try {
    await signIn({ username: name, password: dummyPwd });
    return true;
  } catch (e: any) {
    const n = e?.name;
    return n === 'NotAuthorizedException' || n === 'UserNotConfirmedException';
  }
};

export default function SignUp({ modalMode }: { modalMode?: boolean }) {
  const router = useRouter();
  const authModal = useContext(AuthModalContext);

  const [username, setUsername] = useState('');
  const [usernameValid, setUsernameValid] = useState<boolean | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestion, setUsernameSuggestion] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [passwordValidity, setPasswordValidity] = useState({
    minLength: false, upper: false, lower: false, number: false, symbol: false,
  });

  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);

  const [birthday, setBirthday] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleBirthdayInput = (t: string) => {
    let s = t.replace(/[^0-9]/g, '');
    if (s.length > 2 && s.length <= 4) s = `${s.slice(0, 2)}/${s.slice(2)}`;
    else if (s.length > 4) s = `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4, 8)}`;
    if (s.length > 10) s = s.slice(0, 10);
    setBirthday(s);
  };

  const mdyToDash = (mdy: string) => (mdy.length === 10 ? mdy.replace(/\//g, '-') : '');

  const isAtLeast21 = (d: string) => {
    if (!d) return false;
    const [m, dd, y] = d.split('-').map(Number);
    const b = new Date(y, m - 1, dd), t = new Date();
    const a = t.getFullYear() - b.getFullYear();
    return a > 21 || (a === 21 && (t.getMonth() > b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() >= b.getDate())));
  };

  const validatePassword = (p: string) =>
    p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[!@#$%^&*(),.?":{}|<>]/.test(p);

  const handlePasswordChange = (p: string) => {
    setPassword(p);
    setPasswordValidity({
      minLength: p.length >= 8,
      upper: /[A-Z]/.test(p),
      lower: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
      symbol: /[!@#$%^&*(),.?":{}|<>]/.test(p),
    });
  };

  const validateEmailFormat = (e: string) => emailRegex.test(e);

  const startUsernameCheck = (name: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setUsername(name);
    setUsernameAvailable(null);
    setUsernameSuggestion('');

    const trimmed = name.trim();
    if (!trimmed) { setIsCheckingUsername(false); setUsernameValid(null); return; }

    const isFormatOk = usernameRegex.test(trimmed);
    setUsernameValid(isFormatOk);
    if (!isFormatOk) { setIsCheckingUsername(false); return; }

    debounceRef.current = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const taken = await isUsernameTaken(trimmed);
        setUsernameAvailable(!taken);

        if (taken) {
          let suggestion = '';
          for (let i = 1; i <= 999; i++) {
            const candidate = `${trimmed}${i}`;
            if (!(await isUsernameTaken(candidate))) { suggestion = candidate; break; }
          }
          setUsernameSuggestion(suggestion);
        }
      } catch {
        setUsernameAvailable(null);
        setUsernameSuggestion('');
      } finally {
        setIsCheckingUsername(false);
      }
    }, DEBOUNCE_MS);
  };

  const handleSignUp = async () => {
    setErrorMessage('');
    if (!username.trim()) return setErrorMessage('Username is required.');
    if (!usernameRegex.test(username.trim())) return setErrorMessage('Username may contain only letters, numbers, and underscores.');
    if (usernameAvailable === false) return setErrorMessage('Username already taken.');
    if (!validatePassword(password)) return setErrorMessage('Password must be at least 8 characters long and include lowercase, uppercase, numerals, and symbols.');
    if (!email.trim() || !validateEmailFormat(email.trim())) return setErrorMessage('Please enter a valid e‑mail address (e.g., name@example.com).');
    if (!isAtLeast21(mdyToDash(birthday))) return setErrorMessage('You must be at least 21.');

    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: username.trim(),
        password,
        options: { userAttributes: { email: email.trim(), birthdate: mdyToDash(birthday) } },
      });
      if (isSignUpComplete) {
        if (modalMode && authModal?.open) authModal.open('confirmCode');
        else router.push({ pathname: './confirm-code', params: { username, password, fromSignup: '1' } });
        return;
      }
      if (nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        if (modalMode && authModal?.open) authModal.open('confirmCode');
        else router.push({ pathname: './confirm-code', params: { username, password, fromSignup: '1' } });
        return;
      }
      setErrorMessage('Additional sign-up step required (not implemented).');
    } catch (e: any) {
      setErrorMessage(e?.message || 'Something went wrong');
    }
  };

  const Inner = (
    <View style={modalMode ? styles.modalContainer : styles.container}>
      <Text style={[styles.title, modalMode && { color: '#DFDCD9' }]}>Sign Up</Text>

      {/* Username Input */}
      <Text style={[styles.label, modalMode && { color: '#aaa' }]}>Username</Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          value={username}
          onChangeText={startUsernameCheck}
          style={[
            styles.input,
            modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
            (usernameValid === false || usernameAvailable === false) && styles.inputError,
          ]}
          autoCapitalize="none"
          placeholder="Username"
          placeholderTextColor="#666"
        />
        {isCheckingUsername && (
          <ActivityIndicator
            size="small"
            color="#CE975E"
            style={{ position: 'absolute', right: 12, top: '50%', marginTop: -8 }}
          />
        )}
      </View>
      {username && usernameValid === false && (
        <Text style={styles.error}>Only letters, numbers, and underscores are allowed.</Text>
      )}
      {username && usernameValid && usernameAvailable === false && (
        <Text style={styles.suggestion}>
          {usernameSuggestion
            ? `Username already taken – try "${usernameSuggestion}".`
            : 'Username already taken'}
        </Text>
      )}
      {username && usernameValid && usernameAvailable === true && (
        <Text style={[styles.suggestion, { color: 'green' }]}>Username available ✓</Text>
      )}

      {/* Password Input */}
      <Text style={[styles.label, modalMode && { color: '#aaa' }]}>Password</Text>
      <View>
        <TextInput
          value={password}
          onChangeText={handlePasswordChange}
          style={[
            styles.input,
            modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
          ]}
          secureTextEntry={!isPasswordVisible}
          onFocus={() => setIsPasswordFocused(true)}
          onBlur={() => setIsPasswordFocused(false)}
          placeholder="Password"
          placeholderTextColor="#666"
        />
        <TouchableOpacity style={styles.eyeIcon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
          <Ionicons name={isPasswordVisible ? 'eye' : 'eye-off'} size={24} color={modalMode ? '#aaa' : '#4F4F4F'} />
        </TouchableOpacity>
      </View>
      {isPasswordFocused && (
        <View style={{ marginBottom: 10 }}>
          {(['minLength', 'upper', 'lower', 'number', 'symbol'] as const).map(k => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={passwordValidity[k] ? 'checkmark' : 'close'} size={12} color={passwordValidity[k] ? 'green' : 'red'} />
              <Text style={{ color: '#4f4f4f', marginLeft: 8, fontSize: 12 }}>
                {k === 'minLength' ? 'At least 8 characters' :
                  k === 'upper' ? 'Contains uppercase' :
                    k === 'lower' ? 'Contains lowercase' :
                      k === 'number' ? 'Contains a number' :
                        'Contains a special symbol'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Email Input */}
      <Text style={[styles.label, modalMode && { color: '#aaa' }]}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        onBlur={() => { setEmailTouched(true); setEmailValid(validateEmailFormat(email.trim())); }}
        style={[
          styles.input,
          modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
          emailTouched && emailValid === false && styles.inputError,
        ]}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="Email"
        placeholderTextColor="#666"
      />
      {emailTouched && email && emailValid === false && (
        <Text style={styles.error}>Invalid e‑mail format. Try "name@example.com".</Text>
      )}

      {/* Birthday Input */}
      <Text style={[styles.label, modalMode && { color: '#aaa' }]}>Birthday</Text>
      <TextInput
        value={birthday}
        onChangeText={handleBirthdayInput}
        style={[
          styles.input,
          modalMode && { backgroundColor: '#181818', color: '#DFDCD9', borderColor: '#333', borderWidth: 1 },
          !isAtLeast21(mdyToDash(birthday)) && birthday.length === 10 && styles.inputError,
        ]}
        keyboardType="numeric"
        placeholder="MM/DD/YYYY"
        placeholderTextColor="#666"
        maxLength={10}
      />
      {!isAtLeast21(mdyToDash(birthday)) && birthday.length === 10 && (
        <Text style={styles.error}>You must be at least 21 years old.</Text>
      )}

      {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <TouchableOpacity style={[styles.button, modalMode && { backgroundColor: '#CE975E' }]} onPress={handleSignUp}>
        <Text style={[styles.buttonText, modalMode && { color: '#232323' }]}>Sign Up</Text>
      </TouchableOpacity>
      <View style={styles.signInContainer}>
        <Text style={[styles.signInText, modalMode && { color: '#aaa' }]}>Already have an account?{' '}
          <Text style={[styles.signInLink, modalMode && { color: '#CE975E' }]} onPress={() => modalMode && authModal?.open ? authModal.open('signIn') : router.push('/auth/sign-in')}>
            Sign In
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, resizeMode: 'cover' },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  modalContainer: { backgroundColor: '#141414', borderRadius: 18, padding: 12 },
  title: { fontSize: 48, color: '#fff', marginBottom: 24, fontWeight: 'bold' },
  label: { fontSize: 16, color: '#fff', marginTop: 10 },
  input: { backgroundColor: 'rgba(20, 20, 20, 0.5)', marginVertical: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, fontSize: 16, color: '#DFDCD9' },
  inputError: { borderColor: 'red', borderWidth: 1 },
  suggestion: { fontSize: 12, color: '#4F4F4F', marginTop: -4, marginBottom: 4 },
  button: { backgroundColor: '#CE975E', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold' },
  error: { color: 'red', marginTop: 8 },
  signInContainer: { marginTop: 60, alignItems: 'center' },
  signInText: { fontSize: 14, color: '#fff' },
  signInLink: { color: '#CE975E', fontWeight: 'bold' },
  eyeIcon: { position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -12 }] },
});