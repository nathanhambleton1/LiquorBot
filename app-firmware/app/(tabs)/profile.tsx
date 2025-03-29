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
  TextInput,           // <-- IMPORTANT: import TextInput
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import * as ImagePicker from 'expo-image-picker';
import { getUrl, uploadData } from 'aws-amplify/storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileScreen() {
  const [user, setUser] = useState<{
    username: string;
    email: string;
    profilePicture: string | null;
  }>({
    username: 'Loading...',
    email: 'Loading...',
    profilePicture: null,
  });

  // New: Local states for user profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState<{ title: string; content: string } | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = await getCurrentUser();
        const { username } = currentUser;
        const { email } = await fetchUserAttributes();

        // Try to fetch existing profile pic from S3
        let existingProfilePicture: string | null = null;
        try {
          const { url } = await getUrl({
            path: `public/profilePictures/${username}.jpg`,
            options: { validateObjectExistence: false },
          });
          existingProfilePicture = url.toString();
        } catch (err) {
          console.log('No existing profile pic or error fetching it:', err);
        }

        setUser({
          username: username || 'Guest',
          email: email || 'No email provided',
          profilePicture: existingProfilePicture,
        });

        // OPTIONAL: If you already store firstName, lastName, birthdate in Cognito attributes,
        // you could set them here by reading from "fetchUserAttributes()" results:
        // setFirstName(...);
        // setLastName(...);
        // setBirthday(...);

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

  // When "Save" is pressed in Edit Profile
  const handleSaveProfile = async () => {
    // If you want to store firstName/lastName/birthday in Cognito:
    // import { Auth } from 'aws-amplify'
    // let newAttributes = {
    //   'given_name': firstName,
    //   'family_name': lastName,
    //   'birthdate': birthday,
    // };
    // await Auth.updateUserAttributes(await Auth.currentAuthenticatedUser(), newAttributes);

    // For now, we'll just log them. Or you can store them in local state, etc.
    console.log('Saving user profile: ', { firstName, lastName, birthday });

    closePopup();
  };

  // Renders Edit Profile form or fallback text
  const renderPopupContent = () => {
    if (popupData?.title === 'Edit Profile') {
      return (
        <View style={styles.popupContent}>
          <Text style={styles.popupText}>
            {popupData.content}
          </Text>

          {/* ---- First Name ---- */}
          <Text style={[styles.popupText, { marginTop: 20 }]}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter first name"
            placeholderTextColor="#666"
            value={firstName}
            onChangeText={setFirstName}
          />

          {/* ---- Last Name ---- */}
          <Text style={[styles.popupText, { marginTop: 20 }]}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter last name"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={setLastName}
          />

          {/* ---- Birthday ---- */}
          <Text style={[styles.popupText, { marginTop: 20 }]}>Birthday</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#666"
            value={birthday}
            onChangeText={setBirthday}
          />

          {/* ---- Save and Cancel Buttons ---- */}
          <View style={styles.saveCancelRow}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={closePopup}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    // If it's not Edit Profile, just show the original content
    return <Text style={styles.popupText}>{popupData?.content}</Text>;
  };

  // Handle picking and uploading profile picture
  const handleProfilePictureUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        const localUri = result.assets[0].uri;
        const response = await fetch(localUri);
        const blob = await response.blob();

        const s3Path = `public/profilePictures/${user.username}.jpg`;

        await uploadData({
          path: s3Path,
          data: blob,
        });

        const { url } = await getUrl({ path: s3Path });
        setUser((prevUser) => ({
          ...prevUser,
          profilePicture: url.toString(),
        }));
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* User Info Section */}
      <View style={styles.userInfoContainer}>
        {/* Profile Picture */}
        <TouchableOpacity onPress={handleProfilePictureUpload}>
          <Image
            source={
              user.profilePicture
                ? { uri: user.profilePicture }
                : require('../../assets/images/default-profile.png')
            }
            style={styles.profilePicture}
          />
        </TouchableOpacity>
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
    textAlign: 'center',
  },
  emailText: {
    color: '#4F4F4F',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  scrollContainer: {
    paddingHorizontal: 20,
  },
  buttonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
    width: '100%',
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
  },
  popupContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  popupText: {
    color: '#DFDCD9',
    fontSize: 16,
    textAlign: 'center',
  },
  // Add a consistent style for the new text inputs:
  input: {
    width: '80%',
    borderWidth: 1,
    borderColor: '#CE975E',
    borderRadius: 8,
    padding: 10,
    color: '#DFDCD9',
    fontSize: 16,
    marginTop: 5,
  },
  saveCancelRow: {
    flexDirection: 'row',
    marginTop: 30,
  },
  saveButton: {
    backgroundColor: '#CE975E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 10,
  },
  saveButtonText: {
    color: '#141414',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#DFDCD9',
    fontSize: 16,
    fontWeight: '600',
  },
});
