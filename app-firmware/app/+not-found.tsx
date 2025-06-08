// -----------------------------------------------------------------------------
// File: +not-found.tsx
// Description: Displays a custom 404 error screen for the LiquorBot app. 
//              Provides a link to navigate back to the home screen.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import { Image } from 'react-native';
import { Link, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const LOGO = require('@/assets/images/logo.png');

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <LinearGradient colors={["#4f4f4f", "#000"]} style={styles.container}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <ThemedText type="title" style={styles.title}>Page Not Found</ThemedText>
        <ThemedText style={styles.subtitle}>
          Sorry, this page doesn't exist or couldn't be loaded.
        </ThemedText>
        <ThemedText style={styles.info}>
          If you believe this is a mistake or keep seeing this screen, please contact support at
          <ThemedText style={styles.linkText}> nhambleton03@gmail.com</ThemedText>.
        </ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText type="link" style={{ color: '#CE975E', fontWeight: 'bold' }}>Go to home screen</ThemedText>
        </Link>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#CE975E',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#DFDCD9',
    marginBottom: 18,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: '#AAAAAA',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 20,
  },
  link: {
    marginTop: 10,
    paddingVertical: 15,
  },
  linkText: {
    color: '#CE975E',
    fontWeight: 'bold',
  },
});
