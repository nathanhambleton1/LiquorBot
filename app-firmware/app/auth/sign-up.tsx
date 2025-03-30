import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, confirmSignUp } from 'aws-amplify/auth';

export default function SignUp() {
  const router = useRouter();

  // We’ll alternate between "REGISTER" (collect user details) and
  // "CONFIRM" (collect the confirmation code).
  const [step, setStep] = useState<'REGISTER' | 'CONFIRM'>('REGISTER');

  // Form fields for sign-up
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState(''); // Removed phoneNumber state

  // Form field for confirmation step
  const [confirmationCode, setConfirmationCode] = useState('');

  // For displaying messages
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // 1) Handle initial sign-up
  const onSignUpPress = async () => {
    try {
      setErrorMessage('');
      setInfoMessage('');
      const { isSignUpComplete, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });

      if (!isSignUpComplete && nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        // We now need to confirm sign-up with a code
        setInfoMessage('A confirmation code has been sent to your email.');
        setStep('CONFIRM');
      } else {
        // If nextStep says 'DONE', sign-up might be complete
        setInfoMessage('Sign-up complete! You can sign in now.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Something went wrong during sign-up');
    }
  };

  // 2) Handle confirmation of sign-up
  const onConfirmSignUpPress = async () => {
    try {
      setErrorMessage('');
      setInfoMessage('');
      await confirmSignUp({
        username,
        confirmationCode,
      });
      setInfoMessage('Your account has been confirmed! Please sign in.');
      // Optionally, navigate directly to sign-in
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

// Example styling
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
  button: {
    backgroundColor: '#CE975E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  backButton: {
    marginTop: 10,
    backgroundColor: 'gray',
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
  signUpButton: {
    backgroundColor: '#CE975E', // Gold color for the button
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8, // Rounded corners
    alignItems: 'center',
    marginTop: 20, // Adds spacing above the button
  },
  signUpButtonText: {
    color: '#141414', // Dark text color for contrast
    fontSize: 16,
    fontWeight: 'bold',
  },
  signUpContainer: {
    marginTop: 100, // Adds spacing above the section
    alignItems: 'center', // Centers the content horizontally
  },
  signUpText: {
    fontSize: 14, // Font size for the text
    color: '#fff', // White text color for "Back to"
  },
  signUpLink: {
    color: '#CE975E', // Gold color for "Sign In"
    fontWeight: 'bold', // Makes "Sign In" bold
  },
});
