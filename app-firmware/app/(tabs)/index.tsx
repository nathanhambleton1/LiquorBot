// -----------------------------------------------------------------------------
// File: index.tsx
// Description: Main home screen for the LiquorBot app. Displays connection 
//              status, navigation options, and a dynamic glow animation for 
//              visual feedback. Integrates with LiquorBot context for device 
//              connectivity and routing.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React, { useRef, useEffect } from 'react';
import { StyleSheet, ImageBackground, Text, View, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

// 1) Import the LiquorBot context hook:
import { useLiquorBot } from '../components/liquorbot-provider';

export default function Index() {
  const router = useRouter();
  const glowAnimation = useRef(new Animated.Value(1)).current;

  // 2) Grab the "isConnected" boolean from the context:
  const { isConnected } = useLiquorBot();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1.2, // Scale up slightly
          duration: 800, // Faster glow effect
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 1, // Scale back down
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnimation]);

  return (
    <ImageBackground
      source={require('@/assets/images/home-background.jpg')} // Add your background image
      style={styles.background}
      resizeMode="cover"
    >
      {/* WiFi Icon in the top-right corner */}
      <View style={styles.wifiIconContainer}>
        <TouchableOpacity onPress={() => router.push('/device-settings')}>
          <Ionicons name="hardware-chip" size={36} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.overlay}>
        <Text style={styles.title}>LiquorBot</Text>

        {/* 3) Use isConnected to decide color & text */}
        <View style={styles.connectionRow}>
          <Animated.View
            style={[
              styles.dot,
              {
                // If disconnected, we can switch color to red or gray:
                backgroundColor: isConnected ? '#63d44a' : '#B81A1A',
                transform: [{ scale: glowAnimation }],
                shadowColor: isConnected ? '#00FF00' : '#B81A1A',
                shadowOpacity: glowAnimation.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.3, 0.8],
                }),
              },
            ]}
          />
          <Text style={styles.connectionText}>
            {isConnected ? 'Connected to LiquorBot #001' : 'LiquorBot #001 Disconnected'}
          </Text>
        </View>
      </View>

      {/* Button to navigate to the Menu page */}
      <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/menu')}>
        <Text style={styles.menuButtonText}>Explore Drinks</Text>
        <Ionicons name="chevron-forward" size={20} color="#141414" style={styles.arrowIcon} />
      </TouchableOpacity>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 100, // Lower the text
    alignItems: 'flex-start', // Align text to the left
    width: '100%',
    paddingLeft: 20, // Add some padding from the left edge
  },
  title: {
    fontSize: 48, // Large font size
    color: '#DFDCD9', // White text color
    fontWeight: 'bold', // Bold text
    textAlign: 'left', // Align text to the left
  },
  connectionRow: {
    flexDirection: 'row', // Arrange the dot and text in a row
    alignItems: 'center', // Align items vertically
    marginTop: 10, // Add some spacing below the title
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    marginRight: 8,
    // shadow* styles come from your old greenDot style
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 5,
    shadowOpacity: 0.6,
    elevation: 5,
  },
  connectionText: {
    fontSize: 18,
    color: '#4F4F4F',
  },
  menuButton: {
    position: 'absolute',
    bottom: 130, // Position the button at the bottom
    alignSelf: 'center', // Center the button horizontally
    backgroundColor: '#CE975E', // Light background color
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 10, // Rounded corners
    flexDirection: 'row', // Arrange text and arrow in a row
    alignItems: 'center', // Align items vertically
  },
  menuButtonText: {
    color: '#141414',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8, 
  },
  arrowIcon: {
    marginLeft: 5,
  },
  wifiIconContainer: {
    position: 'absolute',
    top: 115,
    right: 40,
    zIndex: 10,
  },
});
