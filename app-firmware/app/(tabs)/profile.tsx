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
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Amplify (v6) import
import {
  fetchUserAttributes,
  updateUserAttributes,
  getCurrentUser
} from 'aws-amplify/auth';
import { getUrl, uploadData } from 'aws-amplify/storage';
import * as ImagePicker from 'expo-image-picker';

// ---------- TYPES ---------- //
/**
 * This is the shape of a single Cognito user attribute
 * returned by `fetchUserAttributes()` in Amplify v6.
 */
interface CognitoUserAttribute {
  Name: string;
  Value: string;
}

/**
 * The shape of our local user state. Note we allow `profilePicture`
 * to be either string or null.
 */
interface UserState {
  username: string;
  email: string;
  profilePicture: string | null; 
}

/**
 * The shape of data passed to our popup (title + content).
 */
interface PopupData {
  title: string;
  content: string;
}

/**
 * The Ionicon names we plan on using. (You can expand this if needed.)
 * Alternatively, you can do: 
 *   type IconName = keyof typeof Ionicons.glyphMap;
 * and then use `IconName` below.
 */
type IconName =
  | 'create-outline'
  | 'heart-outline'
  | 'time-outline'
  | 'settings-outline'
  | 'help-circle-outline'
  | 'log-out-outline';

/**
 * The shape of each button object in `buttons`.
 */
interface ProfileButton {
  title: string;
  icon: IconName;   // or `keyof typeof Ionicons.glyphMap`
  content: string;
}

// ---------- MAIN COMPONENT ---------- //
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileScreen() {
  const [user, setUser] = useState<UserState>({
    username: 'Loading...',
    email: 'Loading...',
    profilePicture: null,
  });

  // Local states for user profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');

  // For popups: store either null or an object
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // 1) get user from Cognito
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        // username is a field on the Cognito user
        const { username } = currentUser;

        // 2) fetch user attributes from Cognito
        // fetchUserAttributes() in Amplify v6 returns an array of { Name: string; Value: string }
        const attributesObject: Partial<Record<string, string>> = await fetchUserAttributes();
        const attributesArray: CognitoUserAttribute[] = Object.entries(attributesObject).map(([Name, Value]) => ({ Name, Value: Value ?? '' }));

        // define helpers to find attribute by Name
        const findAttr = (attrName: string) =>
          attributesArray.find((attr) => attr.Name === attrName)?.Value ?? '';

        // pull out the relevant attributes
        const emailValue = findAttr('email');
        const firstNameValue = findAttr('given_name');   // or 'name'
        const lastNameValue = findAttr('family_name');   // or 'family_name'
        const birthdayValue = findAttr('birthdate');     // or 'custom:birthday' if it's custom

        // 3) set user info in state
        setUser({
          username: username || 'Guest',
          email: emailValue || 'No email provided',
          profilePicture: null,  // We'll fetch or assign below
        });

        setFirstName(firstNameValue);
        setLastName(lastNameValue);
        setBirthday(birthdayValue);

        // 4) fetch profile pic from S3
        try {
          const { url } = await getUrl({
            path: `public/profilePictures/${username}.jpg`,
            options: { validateObjectExistence: false },
          });
          // If url is truthy, set user’s profilePicture
          if (url) {
            setUser((prevUser) => ({
              ...prevUser,
              profilePicture: url.toString(),
            }));
          }
        } catch (err) {
          console.log('No existing profile pic or error fetching it:', err);
        }
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

  // The button data for the bottom list
  const buttons: ProfileButton[] = [
    { title: 'Edit Profile', icon: 'create-outline', content: 'Edit your profile details below.' },
    { title: 'Liked Drinks', icon: 'heart-outline', content: 'View your liked drinks.' },
    { title: 'Pour History', icon: 'time-outline', content: 'View your pour history.' },
    { title: 'Settings', icon: 'settings-outline', content: 'Adjust your app settings.' },
    { title: 'Help', icon: 'help-circle-outline', content: 'Get help and support.' },
    { title: 'Sign Out', icon: 'log-out-outline', content: 'Sign out of your account.' },
  ];

  // Open the popup
  const openPopup = (data: PopupData) => {
    setPopupData(data);
    setPopupVisible(true);
    slideAnim.setValue(SCREEN_WIDTH);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  // Close the popup
  const closePopup = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 100,
      useNativeDriver: false,
    }).start(() => setPopupVisible(false));
  };

  // PanResponder for swiping popup away
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

  // Save changes to Cognito
  const handleSaveProfile = async () => {
    try {
      // update these attributes in Cognito
      await updateUserAttributes({
        userAttributes: {
          given_name: firstName,
          family_name: lastName,
          birthdate: birthday,
        },
      });
      console.log('User attributes updated in Cognito.');

      closePopup();
    } catch (error) {
      console.log('Error updating user attributes:', error);
    }
  };

  // Handle picking & uploading a profile pic
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
        await uploadData({ path: s3Path, data: blob });

        const { url } = await getUrl({ path: s3Path });
        // Now set the new S3 url as user’s pic
        setUser((prevUser) => ({
          ...prevUser,
          profilePicture: url.toString(),
        }));
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
    }
  };

  // Render the content of the popup
  const renderPopupContent = () => {
    if (!popupData) return null; // Type-check safe

    if (popupData.title === 'Edit Profile') {
      return (
        <View style={styles.popupContent}>
          <Text style={styles.popupText}>
            {popupData.content}
          </Text>

          {/* First Name */}
          <Text style={[styles.popupText, { marginTop: 20 }]}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter first name"
            placeholderTextColor="#666"
            value={firstName}
            onChangeText={setFirstName}
          />

          {/* Last Name */}
          <Text style={[styles.popupText, { marginTop: 20 }]}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter last name"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={setLastName}
          />

          {/* Birthday */}
          <Text style={[styles.popupText, { marginTop: 20 }]}>Birthday</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#666"
            value={birthday}
            onChangeText={setBirthday}
          />

          {/* Save / Cancel */}
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

    // For non–“Edit Profile” popups
    return <Text style={styles.popupText}>{popupData.content}</Text>;
  };

  return (
    <View style={styles.container}>

      {/* Top user info */}
      <View style={styles.userInfoContainer}>
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

      {/* Scroll with buttons */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.buttonContainer}>
          {buttons.map((button, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.button}
              onPress={() => openPopup({ title: button.title, content: button.content })}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name={button.icon}   // typed as IconName
                  size={24}
                  color="#CE975E"
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>{button.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Animated Popup */}
      {popupVisible && popupData && (
        <Animated.View
          style={[styles.popup, { transform: [{ translateX: slideAnim }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.popupHeader}>
            <TouchableOpacity onPress={closePopup}>
              <Ionicons name="arrow-back" size={24} color="#DFDCD9" />
            </TouchableOpacity>
            <Text style={styles.popupTitle}>{popupData.title}</Text>
            <View style={{ width: 24 }} />
          </View>

          {renderPopupContent()}
        </Animated.View>
      )}
    </View>
  );
}

// ------------------ STYLES ------------------ //
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
