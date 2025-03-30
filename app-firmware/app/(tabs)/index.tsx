import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, ImageBackground, Text, View, Animated, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons'; // Import Ionicons for the arrow

export default function Index() {
  const router = useRouter();
  const glowAnimation = useRef(new Animated.Value(1)).current;
  const [modalVisible, setModalVisible] = useState(false); // State for modal visibility

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
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="hardware-chip" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Modal for device information */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Device Information</Text>
            <Text style={styles.modalText}>Connected to LiquorBot #001</Text>
            <Text style={styles.modalText}>Status: Online</Text>
            <Pressable style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.overlay}>
        <Text style={styles.title}>LiquorBot</Text>
        <View style={styles.connectionRow}>
          <Animated.View
            style={[
              styles.greenDot,
              {
                transform: [{ scale: glowAnimation }], // Apply the animation
                shadowOpacity: glowAnimation.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.3, 0.8], // Glow intensity
                }),
              },
            ]}
          />
          <Text style={styles.connectionText}>Connected to LiquorBot #001</Text>
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
  greenDot: {
    width: 8, // Size of the green dot
    height: 8,
    borderRadius: 5, // Make it circular
    backgroundColor: '#63d44a', // Green color
    marginRight: 8, // Add spacing between the dot and the text
    shadowColor: '#00FF00', // Green glow color
    shadowOffset: { width: 0, height: 0 }, // Center the shadow
    shadowRadius: 5, // Larger radius for a soft glow
    shadowOpacity: 0.6, // Glow intensity
    elevation: 5, // Add elevation for Android shadow support
  },
  connectionText: {
    fontSize: 18, // Smaller font size
    color: '#4F4F4F', // Darker text color
  },
  menuButton: {
    position: 'absolute',
    bottom: 90, // Position the button at the bottom
    alignSelf: 'center', // Center the button horizontally
    backgroundColor: '#CE975E', // Light background color
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 10, // Rounded corners
    flexDirection: 'row', // Arrange text and arrow in a row
    alignItems: 'center', // Align items vertically
  },
  menuButtonText: {
    color: '#141414', // Dark text color
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8, // Add spacing between the text and the arrow
  },
  arrowIcon: {
    marginLeft: 5, // Add spacing between the arrow and the text
  },
  wifiIconContainer: {
    position: 'absolute',
    top: 115, // Adjust the top position
    right: 50, // Adjust the right position
    zIndex: 10, // Ensure it appears above other elements
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: '#CE975E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
