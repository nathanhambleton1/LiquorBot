// -----------------------------------------------------------------------------
// File: sign‑up.tsx
// Description: Handles user registration and first‑login profile creation.
//              ‑ Amplify v6 (Gen 1) compatible – no Cognito custom attributes.
//              ‑ Role/bio/picture are stored in the GraphQL UserProfile table.
// Author: Nathan Hambleton
// -----------------------------------------------------------------------------
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, confirmSignUp, signIn } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import { createUserProfile as createUserProfileMutation } from '../../src/graphql/mutations';
import { Ionicons } from '@expo/vector-icons';

const client = generateClient();

export default function SignUp() {
  const router = useRouter();

  /** UI state */
  const [step, setStep] = useState<'REGISTER' | 'ROLE_SELECTION' | 'CONFIRM'>('REGISTER');
  const [selectedRole, setSelectedRole] = useState<'EventAttendee' | 'LiquorBotOwner' | 'EventCoordinator' | ''>('');

  /** form fields */
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [email, setEmail]         = useState('');
  const [birthday, setBirthday]   = useState('');          // MM/DD/YYYY
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  /** confirm‑code */
  const [confirmationCode, setConfirmationCode] = useState('');

  /** messages */
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage,  setInfoMessage]  = useState('');
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);

  /* ───────────────────────── helpers ───────────────────────── */

  /** keep MM/DD/YYYY as the user types */
  const handleBirthdayInput = (text: string) => {
    let t = text.replace(/[^0-9]/g, '');
    if (t.length > 2 && t.length <= 4)        t = `${t.slice(0,2)}/${t.slice(2)}`;
    else if (t.length > 4)                    t = `${t.slice(0,2)}/${t.slice(2,4)}/${t.slice(4,8)}`;
    if (t.length > 10) t = t.slice(0, 10);
    setBirthday(t);
  };

  const mdyToDash = (mdy: string) => mdy.length === 10 ? mdy.replace(/\//g, '-') : '';

  const isAtLeast21 = (dashDate: string) => {
    if (!dashDate) return false;
    const [m,d,y] = dashDate.split('-').map(Number);
    const bday    = new Date(y, m-1, d);
    const today   = new Date();
    const age     = today.getFullYear() - bday.getFullYear();
    return age > 21 || (age === 21 && (
      today.getMonth() > bday.getMonth() ||
      (today.getMonth() === bday.getMonth() && today.getDate() >= bday.getDate())
    ));
  };

  /* ───────────────────────── register flow ───────────────────────── */

  /** first page → just validate fields, then show role selector */
  const onSignUpPress = () => {
    setErrorMessage(''); setInfoMessage('');
    const dash = mdyToDash(birthday);
    if (!isAtLeast21(dash)) { setErrorMessage('You must be at least 21.'); return; }
    setStep('ROLE_SELECTION');
  };

  /** after role picked → actual Cognito sign‑up (standard attrs only) */
  const onSubmitRolePress = async () => {
    try {
      setErrorMessage(''); setInfoMessage('');
      const { isSignUpComplete, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
            birthdate: mdyToDash(birthday),
          },
        },
      });
      if (!isSignUpComplete && nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        setInfoMessage('A confirmation code has been sent to your email.');
        setStep('CONFIRM');
      } else {
        setInfoMessage('Sign‑up complete! You can sign in now.');
      }
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Sign‑up error');
    }
  };

  /** confirm code → sign‑in → create UserProfile row */
  const onConfirmSignUpPress = async () => {
    try {
      setErrorMessage(''); setInfoMessage('');
      await confirmSignUp({ username, confirmationCode });
      await signIn({ username, password });           // establish session

      // create UserProfile (ignore if duplicate)
      await client.graphql({
        query: createUserProfileMutation,
        variables: {
          input: {
            username,
            role: selectedRole,
            bio: '',
            profilePicture: '',
          },
        },
      }).catch(() => {});

      setConfirmationSuccess(true);
      setInfoMessage('Your account has been confirmed!');
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Confirmation error');
    }
  };

  /* ───────────────────────── UI ───────────────────────── */

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      {/* ────────── REGISTER SCREEN ────────── */}
      {step === 'REGISTER' && (
        <>
          <Text style={styles.label}>Username</Text>
          <TextInput value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" />

          <Text style={styles.label}>Password</Text>
          <View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry={!isPasswordVisible}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
              <Ionicons name={isPasswordVisible ? 'eye' : 'eye-off'} size={24} color="#4F4F4F" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>Birthday</Text>
          <TextInput
            value={birthday}
            onChangeText={handleBirthdayInput}
            style={[
              styles.input,
              !isAtLeast21(mdyToDash(birthday)) && birthday.length === 10 ? styles.inputError : null,
            ]}
            keyboardType="numeric"
            placeholder="MM/DD/YYYY"
            placeholderTextColor="#666"
            maxLength={10}
          />
          {!isAtLeast21(mdyToDash(birthday)) && birthday.length === 10 && (
            <Text style={styles.error}>You must be at least 21 years old.</Text>
          )}

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          {!!infoMessage  && <Text style={[styles.info, styles.smallInfoMessage]}>{infoMessage}</Text>}

          <TouchableOpacity style={styles.button} onPress={onSignUpPress}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ────────── ROLE SELECTION ────────── */}
      {step === 'ROLE_SELECTION' && (
        <View>
          <Text style={styles.title}>Select Your Role</Text>

          {(['EventAttendee','LiquorBotOwner','EventCoordinator'] as const).map(role => (
            <TouchableOpacity
              key={role}
              style={[styles.roleOption, selectedRole === role && styles.selectedRoleOption]}
              onPress={() => setSelectedRole(role)}
            >
              <Ionicons
                name={role === 'EventAttendee' ? 'people'
                      : role === 'LiquorBotOwner' ? 'home'
                      : 'briefcase'}
                size={32}
                color="#CE975E"
              />
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleText}>{role.replace(/([A-Z])/g,' $1').trim()}</Text>
                <Text style={styles.roleDescription}>
                  {role === 'EventAttendee'   && 'Join events and enjoy LiquorBot services.'}
                  {role === 'LiquorBotOwner'  && 'Manage your personal LiquorBot at home.'}
                  {role === 'EventCoordinator'&& 'Organize events and manage services.'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          {!!infoMessage  && <Text style={[styles.info, styles.smallInfoMessage]}>{infoMessage}</Text>}

          <TouchableOpacity style={styles.button} onPress={onSubmitRolePress} disabled={!selectedRole}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ────────── CONFIRM CODE ────────── */}
      {step === 'CONFIRM' && (
        confirmationSuccess ? (
          <>
            <Ionicons name="checkmark-circle" size={48} color="#44e627" style={{ alignSelf:'center', marginVertical:24 }} />
            <Text style={[styles.info, styles.confirmationMessage]}>{infoMessage}</Text>
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/auth/sign-in')}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Confirmation Code</Text>
            <TextInput
              value={confirmationCode}
              onChangeText={setConfirmationCode}
              style={styles.input}
              keyboardType="number-pad"
            />

            {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            {!!infoMessage  && <Text style={[styles.info, styles.smallInfoMessage]}>{infoMessage}</Text>}

            <TouchableOpacity style={styles.button} onPress={onConfirmSignUpPress}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </>
        )
      )}

      {/* back link */}
      {!confirmationSuccess && (
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>
            Already have an account?{' '}
            <Text style={styles.signUpLink} onPress={() => router.replace('/auth/sign-in')}>
              Sign In
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}

/* ───────────────────────── styles ───────────────────────── */
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#000', justifyContent:'center', padding:24 },
  title:{ fontSize:48, color:'#fff', marginBottom:24, fontWeight:'bold' },
  label:{ fontSize:16, color:'#fff', marginTop:10 },
  input:{ backgroundColor:'#141414', marginVertical:8, paddingHorizontal:16, paddingVertical:12, borderRadius:8, fontSize:16, color:'#DFDCD9' },
  inputError:{ borderColor:'red', borderWidth:1 },
  button:{ backgroundColor:'#CE975E', paddingVertical:12, borderRadius:8, alignItems:'center', marginTop:20 },
  buttonText:{ color:'#DFDCD9', fontSize:18, fontWeight:'bold' },
  error:{ color:'red', marginTop:8 },
  info:{ color:'#CE975E', marginTop:8 },
  confirmationMessage:{ fontSize:20, color:'#fff', textAlign:'center', marginBottom:16 },
  smallInfoMessage:{ fontSize:14, color:'#DFDCD9', textAlign:'center', marginTop:16 },
  signUpContainer:{ marginTop:60, alignItems:'center' },
  signUpText:{ fontSize:14, color:'#fff' },
  signUpLink:{ color:'#CE975E', fontWeight:'bold' },
  roleOption:{ flexDirection:'row', alignItems:'center', backgroundColor:'#141414', padding:16, borderRadius:8, marginVertical:8, borderWidth:2, borderColor:'transparent' },
  selectedRoleOption:{ borderColor:'#CE975E' },
  roleTextContainer:{ marginLeft:14, flex:1 },
  roleText:{ fontSize:18, color:'#DFDCD9' },
  roleDescription:{ fontSize:14, color:'#4F4F4F', marginTop:4 },
  eyeIcon:{ position:'absolute', right:16, top:'50%', transform:[{ translateY:-12 }] },
});
