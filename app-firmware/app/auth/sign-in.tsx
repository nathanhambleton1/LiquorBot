// -----------------------------------------------------------------------------
// File: sign-in.tsx
// Description: Handles the sign-in process for the LiquorBot app. Includes 
//              functionality for user authentication and navigation to the 
//              main app upon successful login. Integrates with AWS Amplify 
//              for authentication.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { MaterialIcons } from '@expo/vector-icons';

export default function SignIn() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        router.replace('/(tabs)');
        return;
      }
    } catch (err) {
    } finally {
      setIsLoading(false);
    }
  };

  const onSignInPress = async () => {
    setError('');
    try {
      await signIn({ username, password });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#CE975E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        onChangeText={setUsername}
        value={username}
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          onChangeText={setPassword}
          value={password}
          style={styles.input}
          secureTextEntry={!isPasswordVisible}
        />
        <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeIcon}>
          <MaterialIcons name={isPasswordVisible ? 'visibility' : 'visibility-off'} size={24} color="#4f4f4f" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.push('./forgot-password')}
        style={styles.forgotPassword}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      {!!error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={onSignInPress}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>
          Don&apos;t have an account?{' '}
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
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#DFDCD9',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#CE975E',
    fontSize: 14,
    fontWeight: 'bold',
  },
  signUpContainer: {
    marginTop: 100,
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
