// app/auth/sign-in.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from 'aws-amplify/auth';

export default function SignIn() {
  const router = useRouter();

  const [username, setUsername] = useState(''); // Changed from email to username
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSignInPress = async () => {
    setError(''); // Reset error
    try {
      // Use username and password for sign-in
      await signIn({ username, password });
      // Redirect to main tabs (or profile, etc.)
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      {/* Username Label */}
      <Text style={styles.label}>Username</Text>
      <TextInput
        onChangeText={setUsername}
        value={username}
        style={styles.input}
      />

      {/* Password Label */}
      <Text style={styles.label}>Password</Text>
      <TextInput
        onChangeText={setPassword}
        value={password}
        style={styles.input}
        secureTextEntry
      />

      {/* Forgot Password Button */}
      <TouchableOpacity onPress={() => router.push('./forgot-password')} style={styles.forgotPassword}>
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      {!!error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}

      {/* Sign In Button */}
      <TouchableOpacity style={styles.button} onPress={onSignInPress}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      {/* Sign Up Section */}
      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>
          Don't have an account?{' '}
          <Text style={styles.signUpLink} onPress={() => router.push('./sign-up')}>
            Sign Up
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48, // Increased font size
    color: '#fff',
    marginBottom: 24,
    textAlign: 'left', // Align text to the left
    fontWeight: 'bold', // Make the text bold
  },
  input: {
    backgroundColor: '#141414', // Light grey background
    marginVertical: 12, // Increased vertical margin for spacing
    paddingHorizontal: 16, // Increased horizontal padding
    paddingVertical: 12, // Increased vertical padding for larger text boxes
    borderRadius: 8, // Slightly larger border radius for rounded corners
    fontSize: 16, // Larger font size for better readability
    color: '#DFDCD9', // Makes the entered text white
  },
  button: {
    backgroundColor: '#CE975E', // Gold color
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8, // Rounded corners
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#DFDCD9', // Dark text color for contrast
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16, // Font size for the labels
    color: '#fff', // White text color
    marginBottom: -5, // Spacing between label and input box
    marginTop: 10, // Spacing between label and input box
    textAlign: 'left', // Align text to the left
  },
  forgotPassword: {
    alignSelf: 'flex-end', // Aligns the button to the right
    marginTop: 8, // Adds spacing above the button
    marginBottom: 16, // Adds spacing below the button
  },
  forgotPasswordText: {
    color: '#CE975E', // Gold color for the text
    fontSize: 14, // Slightly smaller font size
    fontWeight: 'bold', // Makes the text bold
  },
  signUpContainer: {
    marginTop: 100, // Adds spacing above the sign-up section
    alignItems: 'center', // Centers the content horizontally
  },
  signUpText: {
    fontSize: 14, // Font size for the text
    color: '#fff', // White text color
  },
  signUpLink: {
    color: '#CE975E', // Gold color for the "Sign Up" text
    fontWeight: 'bold', // Makes the "Sign Up" text bold
  },
});
