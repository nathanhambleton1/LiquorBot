import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileScreen() {
  const [user, setUser] = useState<{
    username: string;
    email: string;
    profilePicture: string | null;
  }>({
    username: 'Loading...',
    email: 'Loading...',
    profilePicture: null, // Add this field for the profile picture
  });
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState<{ title: string; content: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        console.log(await getCurrentUser());
        console.log(await fetchUserAttributes());
        const { username } = await getCurrentUser();
        const { email } = await fetchUserAttributes();
        setUser({
          username,
          email: email || 'No email provided',
          profilePicture: null, // Add logic to fetch profile picture if available
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUser({
          username: 'Guest',
          email: 'Not logged in',
          profilePicture: null,
        });
      }
    };
    fetchUserData();
  }, []);

  const buttons: { title: string; icon: keyof typeof Ionicons.glyphMap; content: string }[] = [
    { title: 'Edit Profile', icon: 'create-outline', content: 'Edit your profile details below.' },
    { title: 'Liked Drinks', icon: 'heart-outline', content: 'View your liked drinks.' },
    { title: 'Pour History', icon: 'time-outline', content: 'View your pour history.' },
    { title: 'Settings', icon: 'settings-outline', content: 'Adjust your app settings.' },
    { title: 'Help', icon: 'help-circle-outline', content: 'Get help and support.' },
    { title: 'Sign Out', icon: 'log-out-outline', content: 'Sign out of your account.' },
  ];

  const openPopup = (data: { title: string; content: string }) => {
    setPopupData(data);
    setPopupVisible(true);
    slideAnim.setValue(SCREEN_WIDTH);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  const closePopup = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 100,
      useNativeDriver: false,
    }).start(() => setPopupVisible(false));
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0) slideAnim.setValue(gestureState.dx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > SCREEN_WIDTH / 3) {
          closePopup();
        } else {
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const renderPopupContent = () => {
    if (popupData?.title === 'Edit Profile') {
      return (
        <View style={styles.popupContent}>
          <Text style={styles.popupText}>{popupData.content}</Text>
          {/* Add actual forms or other UI for editing here if needed */}
        </View>
      );
    }
    return <Text style={styles.popupText}>{popupData?.content}</Text>;
  };

  const handleProfilePictureUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
  
    if (!result.canceled) {
      setUser((prevUser) => ({
        ...prevUser,
        profilePicture: result.assets[0].uri, // Update the profile picture URI
      }));
    }
  };

  return (
    <View style={styles.container}>
      {/* User Info Section */}
      <View style={styles.userInfoContainer}>
        {/* Profile Picture */}
        <Image
          source={
            user.profilePicture
              ? { uri: user.profilePicture } // Use uploaded profile picture
              : require('../../assets/images/default-profile.png') // Corrected default profile picture path
          }
          style={styles.profilePicture}
        />
        <Text style={styles.usernameText}>{user.username}</Text>
        <Text style={styles.emailText}>{user.email}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.buttonContainer}>
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={styles.button}
              onPress={() => openPopup({ title: button.title, content: button.content })}
            >
              <View style={styles.buttonRow}>
                <Ionicons name={button.icon} size={24} color="#CE975E" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>{button.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {popupVisible && (
        <Animated.View
          style={[styles.popup, { transform: [{ translateX: slideAnim }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.popupHeader}>
            <TouchableOpacity onPress={closePopup}>
              <Ionicons name="arrow-back" size={24} color="#DFDCD9" />
            </TouchableOpacity>
            <Text style={styles.popupTitle}>{popupData?.title}</Text>
            <View style={{ width: 24 }} />
          </View>
          {renderPopupContent()}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  userInfoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  profilePicture: {
    width: 125,
    height: 125,
    borderRadius: 75,
    marginBottom: 20,
    marginTop: 20,
  },
  usernameText: {
    color: '#DFDCD9',
    fontSize: 24,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
  },
  emailText: {
    color: '#4F4F4F',
    fontSize: 16,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
    marginTop: 5,
  },
  scrollContainer: {
    paddingHorizontal: 20,
  },
  buttonContainer: {
    marginVertical: 20,
    alignItems: 'center', // Center the buttons horizontally
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 15, // Reduced horizontal padding
    marginBottom: 10,
    width: '100%', // Make the buttons less wide (90% of the container width)
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 15,
  },
  buttonText: {
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
  },
  popup: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#141414',
    elevation: 10,
    zIndex: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 75,
    backgroundColor: '#141414',
  },
  popupTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
  },
  popupContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupText: {
    color: '#DFDCD9',
    fontSize: 16,
    textAlign: 'center',
  },
});
