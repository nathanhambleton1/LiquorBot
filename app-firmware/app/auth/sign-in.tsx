// app/auth/sign-in.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
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

      <TextInput
        placeholder="Username" // Updated placeholder
        onChangeText={setUsername} // Updated to setUsername
        value={username} // Updated to username
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        onChangeText={setPassword}
        value={password}
        style={styles.input}
        secureTextEntry
      />

      {!!error && <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>}

      <Button title="Sign In" onPress={onSignInPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
});
