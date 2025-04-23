// -----------------------------------------------------------------------------
// File: sign-up.tsx
// Description: Registration screen with live username-availability checking
//              (GraphQL → fallback Cognito probe) and suggestion generation.
// Author: Nathan Hambleton
// Updated: Apr 23 2025 – fixes “always-available” bug
// -----------------------------------------------------------------------------
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, signIn } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import { Ionicons } from '@expo/vector-icons';

const client = generateClient();
const dummyPwd = 'DummyPa$$word123!'; // meets Cognito rules

/* minimal query, no codegen needed */
const LIST_USERNAMES = /* GraphQL */ `
  query Check($username: String!) {
    listUserProfiles(filter: { username: { eq: $username } }, limit: 1) {
      items { id }
    }
  }
`;

export default function SignUp() {
  const router = useRouter();

  /* ───── UI state ───── */
  const [step, setStep] = useState<'REGISTER' | 'ROLE_SELECTION'>('REGISTER');
  const [selectedRole, setSelectedRole] =
    useState<'EventAttendee' | 'PersonalUse' | 'EventCoordinator' | ''>('');

  /* ───── form fields ───── */
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');

  /* username check results */
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestion, setUsernameSuggestion] = useState('');

  /* password helpers */
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [passwordValidity, setPasswordValidity] = useState({
    minLength: false,
    upper: false,
    lower: false,
    number: false,
    symbol: false,
  });

  const [errorMessage, setErrorMessage] = useState('');

  /* ───── helpers ───── */
  const handleBirthdayInput = (t: string) => {
    let s = t.replace(/[^0-9]/g, '');
    if (s.length > 2 && s.length <= 4) s = `${s.slice(0, 2)}/${s.slice(2)}`;
    else if (s.length > 4) s = `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4, 8)}`;
    if (s.length > 10) s = s.slice(0, 10);
    setBirthday(s);
  };
  const mdyToDash = (mdy: string) => (mdy.length === 10 ? mdy.replace(/\//g, '-') : '');
  const isAtLeast21 = (dash: string) => {
    if (!dash) return false;
    const [m, d, y] = dash.split('-').map(Number);
    const bday = new Date(y, m - 1, d);
    const today = new Date();
    const age = today.getFullYear() - bday.getFullYear();
    return (
      age > 21 ||
      (age === 21 &&
        (today.getMonth() > bday.getMonth() ||
          (today.getMonth() === bday.getMonth() && today.getDate() >= bday.getDate())))
    );
  };
  const validatePassword = (p: string) =>
    p.length >= 8 &&
    /[a-z]/.test(p) &&
    /[A-Z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(p);
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

  /* ───── username availability ───── */
  const checkUsernameAvailability = async (name: string) => {
    const clean = name.trim();
    if (!clean) { setUsernameAvailable(null); setUsernameSuggestion(''); return; }

    try {
      /* step 1 – look in UserProfile table */
      const res: any = await client.graphql({
        query: LIST_USERNAMES,
        variables: { username: clean },
      });
      let taken = res?.data?.listUserProfiles?.items?.length > 0;

      /* step 2 – if table empty, probe Cognito */
      if (!taken) {
        try {
          await signIn({ username: clean, password: dummyPwd });
          taken = true; // (should never actually succeed)
        } catch (e: any) {
          const n = e?.name;
          taken = n === 'NotAuthorizedException' || n === 'UserNotConfirmedException';
        }
      }

      setUsernameAvailable(!taken);

      /* generate first free suggestion if taken */
      if (taken) {
        for (let i = 1; i <= 999; i++) {
          const candidate = `${clean}${i}`;
          const r: any = await client.graphql({
            query: LIST_USERNAMES,
            variables: { username: candidate },
          });
          const free = r?.data?.listUserProfiles?.items?.length === 0;
          if (free) { setUsernameSuggestion(candidate); break; }
        }
      } else {
        setUsernameSuggestion('');
      }
    } catch {
      setUsernameAvailable(null);
      setUsernameSuggestion('');
    }
  };

  /* ───── first screen validation ───── */
  const onSignUpPress = () => {
    setErrorMessage('');
    if (!username.trim()) return setErrorMessage('Username is required.');
    if (usernameAvailable === false) return setErrorMessage('Username already taken.');
    if (!validatePassword(password))
      return setErrorMessage('Password must be at least 8 characters long and include lowercase, uppercase, numerals, and symbols.');
    if (!email.trim()) return setErrorMessage('Email is required.');
    if (!isAtLeast21(mdyToDash(birthday))) return setErrorMessage('You must be at least 21.');
    setStep('ROLE_SELECTION');
  };

  /* ───── register with Cognito ───── */
  const onSubmitRolePress = async () => {
    try {
      setErrorMessage('');
      const { isSignUpComplete, nextStep } = await signUp({
        username, password,
        options: { userAttributes: { email, birthdate: mdyToDash(birthday) } },
      });

      if (isSignUpComplete) {
        await signIn({ username, password });
        router.replace('/(tabs)');
        return;
      }
      if (nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        router.replace({ pathname: './confirm-code', params: { username, password, role: selectedRole, fromSignup: '1' } });
      }
    } catch (e: any) { setErrorMessage(e?.message ?? 'Sign-up error'); }
  };

  /* ───── UI ───── */
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      {step === 'REGISTER' && (
        <>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            onBlur={() => checkUsernameAvailability(username)}
            style={[styles.input, usernameAvailable === false && styles.inputError]}
            autoCapitalize="none"
          />
          {username && usernameAvailable === false && (
            <Text style={styles.suggestion}>
              {usernameSuggestion ? `Username already taken try: “${usernameSuggestion}”` : 'Username already taken'}
            </Text>
          )}
          {username && usernameAvailable === true && (
            <Text style={[styles.suggestion, { color: 'green' }]}>Username available ✓</Text>
          )}

          <Text style={styles.label}>Password</Text>
          <View>
            <TextInput
              value={password}
              onChangeText={handlePasswordChange}
              style={styles.input}
              secureTextEntry={!isPasswordVisible}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
              <Ionicons name={isPasswordVisible ? 'eye' : 'eye-off'} size={24} color="#4F4F4F" />
            </TouchableOpacity>
          </View>
          {isPasswordFocused && (
            <View style={{ marginBottom: 10 }}>
              {[
                ['minLength', 'At least 8 characters'],
                ['upper', 'Contains uppercase'],
                ['lower', 'Contains lowercase'],
                ['number', 'Contains a number'],
                ['symbol', 'Contains a special symbol'],
              ].map(([k, msg]) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={passwordValidity[k as keyof typeof passwordValidity] ? 'checkmark' : 'close'}
                    size={12}
                    color={passwordValidity[k as keyof typeof passwordValidity] ? 'green' : 'red'}
                  />
                  <Text style={{ color: '#4f4f4f', marginLeft: 8, fontSize: 12 }}>{msg}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Birthday</Text>
          <TextInput
            value={birthday}
            onChangeText={handleBirthdayInput}
            style={[
              styles.input,
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

          <TouchableOpacity style={styles.button} onPress={onSignUpPress}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'ROLE_SELECTION' && (
        <View>
          <Text style={styles.roleTitle}>Select Your Role</Text>
          <TouchableOpacity style={styles.backIcon} onPress={() => setStep('REGISTER')}>
            <Ionicons name="arrow-back" size={24} color="#CE975E" />
          </TouchableOpacity>

          {(['EventAttendee', 'PersonalUse', 'EventCoordinator'] as const).map(role => (
            <TouchableOpacity
              key={role}
              style={[styles.roleOption, selectedRole === role && styles.selectedRoleOption]}
              onPress={() => setSelectedRole(role)}
            >
              <Ionicons name={role === 'EventAttendee' ? 'people' : role === 'PersonalUse' ? 'home' : 'briefcase'} size={32} color="#CE975E" />
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleText}>{role.replace(/([A-Z])/g, ' $1').trim()}</Text>
                <Text style={styles.roleDescription}>
                  {role === 'EventAttendee' && 'Join events and enjoy LiquorBot services.'}
                  {role === 'PersonalUse' && 'Manage your personal LiquorBot at home.'}
                  {role === 'EventCoordinator' && 'Organize events and manage services.'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

          <TouchableOpacity style={styles.button} onPress={onSubmitRolePress} disabled={!selectedRole}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>
          Already have an account?{' '}
          <Text style={styles.signUpLink} onPress={() => router.replace('/auth/sign-in')}>Sign In</Text>
        </Text>
      </View>
    </View>
  );
}

/* ───── styles ───── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 24 },
  title: { fontSize: 48, color: '#fff', marginBottom: 24, fontWeight: 'bold' },
  label: { fontSize: 16, color: '#fff', marginTop: 10 },
  input: { backgroundColor: '#141414', marginVertical: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, fontSize: 16, color: '#DFDCD9' },
  inputError: { borderColor: 'red', borderWidth: 1 },
  suggestion: { fontSize: 12, color: '#4F4F4F', marginTop: -4, marginBottom: 4 },
  button: { backgroundColor: '#CE975E', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold' },
  error: { color: 'red', marginTop: 8 },
  signUpContainer: { marginTop: 60, alignItems: 'center' },
  signUpText: { fontSize: 14, color: '#fff' },
  signUpLink: { color: '#CE975E', fontWeight: 'bold' },
  roleOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', padding: 16, borderRadius: 8, marginVertical: 8, borderWidth: 2, borderColor: 'transparent' },
  selectedRoleOption: { borderColor: '#CE975E' },
  roleTextContainer: { marginLeft: 14, flex: 1 },
  roleText: { fontSize: 18, color: '#DFDCD9' },
  roleDescription: { fontSize: 14, color: '#4F4F4F', marginTop: 4 },
  eyeIcon: { position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -12 }] },
  backIcon: { marginBottom: 10, alignSelf: 'flex-start' },
  roleTitle: { fontSize: 36, color: '#fff', marginBottom: 16, fontWeight: 'bold', textAlign: 'left' },
});
