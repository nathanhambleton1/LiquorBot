// app/auth/sign-up.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, confirmSignUp } from 'aws-amplify/auth';

export default function SignUp() {
  const router = useRouter();

  // We’ll alternate between "REGISTER" and "CONFIRM"
  const [step, setStep] = useState<'REGISTER' | 'CONFIRM'>('REGISTER');

  // Sign-up fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState(''); // NEW: store "MM/DD/YYYY" format

  // Confirmation code
  const [confirmationCode, setConfirmationCode] = useState('');

  // Feedback messages
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // -- (A) Helper to format user input as MM/DD/YYYY --
  const handleBirthdayInput = (text: string) => {
    // Only digits
    let formattedText = text.replace(/[^0-9]/g, '');

    // Insert slashes
    if (formattedText.length > 2 && formattedText.length <= 4) {
      formattedText = `${formattedText.slice(0, 2)}/${formattedText.slice(2)}`;
    } else if (formattedText.length > 4) {
      formattedText = `${formattedText.slice(0, 2)}/${formattedText.slice(2, 4)}/${formattedText.slice(4, 8)}`;
    }

    // Limit length to 10 total chars (MM/DD/YYYY)
    if (formattedText.length > 10) {
      formattedText = formattedText.slice(0, 10);
    }
    setBirthday(formattedText);
  };

  // -- (B) Convert "MM/DD/YYYY" => "MM-DD-YYYY" for Cognito
  const convertToServerDate = (mdy: string) => {
    if (mdy.length !== 10) return ''; // If user hasn't fully typed it
    return mdy.replace(/\//g, '-'); // Replace slashes with dashes
  };

  // -- (C) Register new user
  const onSignUpPress = async () => {
    try {
      setErrorMessage('');
      setInfoMessage('');

      // Convert birthday to "MM-DD-YYYY"
      const serverBirthday = convertToServerDate(birthday);

      // Validate if the user is at least 21 years old
      if (!isAtLeast21(serverBirthday)) {
        setErrorMessage('You must be at least 21 years old to create an account.');
        return;
      }

      const { isSignUpComplete, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
            birthdate: serverBirthday, // pass to Cognito
          },
        },
      });

      if (!isSignUpComplete && nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        setInfoMessage('A confirmation code has been sent to your email.');
        setStep('CONFIRM');
      } else {
        setInfoMessage('Sign-up complete! You can sign in now.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Something went wrong during sign-up');
    }
  };

  // Helper function to check if the user is at least 21 years old
  const isAtLeast21 = (serverBirthday: string): boolean => {
    if (!serverBirthday) return false;

    const [month, day, year] = serverBirthday.split('-').map(Number);
    const birthday = new Date(year, month - 1, day);
    const today = new Date();

    const age = today.getFullYear() - birthday.getFullYear();
    const isBirthdayPassedThisYear =
      today.getMonth() > birthday.getMonth() ||
      (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());

    return age > 21 || (age === 21 && isBirthdayPassedThisYear);
  };

  // -- (D) Confirm sign-up with code
  const onConfirmSignUpPress = async () => {
    try {
      setErrorMessage('');
      setInfoMessage('');
      await confirmSignUp({
        username,
        confirmationCode,
      });
      setInfoMessage('Your account has been confirmed! Please sign in.');
      setTimeout(() => router.replace('/auth/sign-in'), 1500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Something went wrong confirming sign-up');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      {step === 'REGISTER' && (
        <>
          {/* Username Field */}
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
          />

          {/* Password Field */}
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
          />

          {/* Email Field */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Birthday Field (MM/DD/YYYY) */}
          <Text style={styles.label}>Birthday</Text>
          <TextInput
            value={birthday}
            onChangeText={handleBirthdayInput}
            style={[
              styles.input,
              !isAtLeast21(convertToServerDate(birthday)) && birthday.length === 10
                ? styles.inputError
                : null,
            ]}
            keyboardType="numeric"
            placeholder="MM/DD/YYYY"
            placeholderTextColor="#666"
            maxLength={10}
          />
          {/* Real-time error message for underage users */}
          {!isAtLeast21(convertToServerDate(birthday)) && birthday.length === 10 && (
            <Text style={styles.error}>You must be at least 21 years old to create an account.</Text>
          )}

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

          <TouchableOpacity style={styles.button} onPress={onSignUpPress}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'CONFIRM' && (
        <>
          {/* Confirmation Code Field */}
          <Text style={styles.label}>Confirmation Code</Text>
          <TextInput
            value={confirmationCode}
            onChangeText={setConfirmationCode}
            style={styles.input}
            keyboardType="number-pad"
          />

          {!!errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          {!!infoMessage && <Text style={styles.info}>{infoMessage}</Text>}

          <TouchableOpacity style={styles.button} onPress={onConfirmSignUpPress}>
            <Text style={styles.buttonText}>Confirm Sign Up</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Back to Sign In */}
      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>
          Already have an account?{' '}
          <Text style={styles.signUpLink} onPress={() => router.replace('/auth/sign-in')}>
            Sign In
          </Text>
        </Text>
      </View>
    </View>
  );
}

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'left',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: -5,
    marginTop: 10,
    textAlign: 'left',
  },
  input: {
    backgroundColor: '#141414',
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#DFDCD9',
  },
  inputError: {
    borderColor: 'red',
    borderWidth: 1,
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
    marginTop: 8,
  },
  info: {
    color: '#CE975E',
    marginTop: 8,
  },
  signUpContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: '#fff',
  },
  signUpLink: {
    color: '#CE975E',
    fontWeight: 'bold',
  },
});
