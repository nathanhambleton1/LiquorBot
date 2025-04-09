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

// Amplify (v6) imports
import {
  getCurrentUser,
  fetchUserAttributes,
  updateUserAttributes,
} from 'aws-amplify/auth';
import { getUrl, uploadData } from 'aws-amplify/storage';
import * as ImagePicker from 'expo-image-picker';

// (A) GraphQL API client + queries/mutations
import { Amplify } from 'aws-amplify';
import config from '../../src/amplifyconfiguration.json';
import { generateClient } from 'aws-amplify/api';
import { listLikedDrinks } from '../../src/graphql/queries';
import { deleteLikedDrink } from '../../src/graphql/mutations';  // <-- added import

// (B) Import the Amplify UI hook for sign-out
import { useAuthenticator } from '@aws-amplify/ui-react-native';

// Import Hub for event listening
import { Hub } from '@aws-amplify/core';

// Configure Amplify for this screen
Amplify.configure(config);
const client = generateClient();

// ---------- TYPES ----------
interface CognitoUserAttribute {
  Name: string;
  Value: string;
}

interface UserState {
  username: string;
  email: string;
  profilePicture: string | null;
}

interface PopupData {
  title: string;
  content: string;
}

type IconName =
  | 'create-outline'
  | 'heart-outline'
  | 'time-outline'
  | 'settings-outline'
  | 'help-circle-outline'
  | 'log-out-outline';

interface ProfileButton {
  title: string;
  icon: IconName;
  content: string;
}

// Drink type, matching your S3 JSON structure
interface Drink {
  id: number;
  name: string;
  category: string;
  description?: string;
  image: string;
  ingredients?: string;
}

// For storing the "LikedDrink" record info in memory, so we can delete it when unliking
interface LikedDrinkRecord {
  id: string;       // The DynamoDB record ID
  drinkID: number;
  userID: string;
}

// ---------- MAIN COMPONENT ----------
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

  // Popup states
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // All Drinks from S3
  const [drinks, setDrinks] = useState<Drink[]>([]);

  // Actual items the user liked (Drink objects). They remain displayed even if toggled off.
  const [likedDrinksData, setLikedDrinksData] = useState<Drink[]>([]);

  // We'll keep a map { drinkID -> recordID } to track existing LikedDrink records from DynamoDB
  const [recordMap, setRecordMap] = useState<Record<number, string>>({});

  // We'll keep a local set of "currently liked" IDs in the popup
  // If a user toggles a heart, we update this set (and do DB create/delete).
  const [likedIDsInPopup, setLikedIDsInPopup] = useState<Set<number>>(new Set());

  // (B) Get the signOut function from useAuthenticator
  const userSelector = (context: any) => [context.user];
  const { signOut } = useAuthenticator(userSelector);

  // --------------------------------------------------------------------
  // Fetch user data & user attributes
  // --------------------------------------------------------------------
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // 1) get user from Cognito
        const currentUser = await getCurrentUser();
        if (!currentUser) return;

        const { username } = currentUser;

        // 2) fetch user attributes from Cognito
        const attributesObject: Partial<Record<string, string>> =
          await fetchUserAttributes();
        const attributesArray: CognitoUserAttribute[] = Object.entries(
          attributesObject
        ).map(([Name, Value]) => ({ Name, Value: Value ?? '' }));

        // Helper to find attribute by name
        const findAttr = (attrName: string) =>
          attributesArray.find((attr) => attr.Name === attrName)?.Value ?? '';

        // 3) set user info in state
        const emailValue = findAttr('email');
        const firstNameValue = findAttr('given_name');
        const lastNameValue = findAttr('family_name');
        const birthdayValue = findAttr('birthdate');

        setUser({
          username: username || 'Guest',
          email: emailValue || 'No email provided',
          profilePicture: null,
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

  // --------------------------------------------------------------------
  // Fetch all drinks from S3
  // --------------------------------------------------------------------
  useEffect(() => {
    const fetchDrinksFromS3 = async () => {
      try {
        const s3res = await getUrl({ key: 'drinkMenu/drinks.json' });
        const response = await fetch(s3res.url);
        const data = await response.json();
        setDrinks(data);
      } catch (error) {
        console.error('Error fetching drinks from S3:', error);
      }
    };
    fetchDrinksFromS3();
  }, []);

  // --------------------------------------------------------------------
  // Hub listener for liked drinks updates
  // --------------------------------------------------------------------
  useEffect(() => {
    const hubListener = (data: any) => {
      const { event } = data.payload || {};
      if (event === 'likeUpdated') {
        fetchUserLikedDrinks();
      }
    };
    const unsubscribe = Hub.listen('likeChannel', hubListener);
    return () => unsubscribe();
  }, []);

  // --------------------------------------------------------------------
  // Button definitions
  // --------------------------------------------------------------------
  const buttons: ProfileButton[] = [
    {
      title: 'Edit Profile',
      icon: 'create-outline',
      content: 'Edit your profile details below.',
    },
    {
      title: 'Liked Drinks',
      icon: 'heart-outline',
      content: 'View your liked drinks.',
    },
    {
      title: 'Pour History',
      icon: 'time-outline',
      content: 'View your pour history.',
    },
    {
      title: 'Settings',
      icon: 'settings-outline',
      content: 'Adjust your app settings.',
    },
    {
      title: 'Help',
      icon: 'help-circle-outline',
      content: 'Get help and support.',
    },
    {
      title: 'Sign Out',
      icon: 'log-out-outline',
      content: 'Sign out of your account.',
    },
  ];

  // --------------------------------------------------------------------
  // Opening / closing the popup
  // --------------------------------------------------------------------
  const openPopup = (data: PopupData) => {
    setPopupData(data);
    setPopupVisible(true);
    slideAnim.setValue(SCREEN_WIDTH);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();

    // If we're opening the "Liked Drinks" popup, fetch them
    if (data.title === 'Liked Drinks') {
      fetchUserLikedDrinks();
    }
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

  // --------------------------------------------------------------------
  // Save profile changes to Cognito
  // --------------------------------------------------------------------
  const handleSaveProfile = async () => {
    try {
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

  // --------------------------------------------------------------------
  // Handle picking & uploading a profile pic
  // --------------------------------------------------------------------
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
        if (url) {
          setUser((prevUser) => ({
            ...prevUser,
            profilePicture: url.toString(),
          }));
        }
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
    }
  };

  // --------------------------------------------------------------------
  // Format birthday input
  // --------------------------------------------------------------------
  const handleBirthdayInput = (text: string) => {
    let formattedText = text.replace(/[^0-9]/g, '');
    if (formattedText.length > 2 && formattedText.length <= 4) {
      formattedText = `${formattedText.slice(0, 2)}/${formattedText.slice(2)}`;
    } else if (formattedText.length > 4) {
      formattedText = `${formattedText.slice(0, 2)}/${formattedText.slice(
        2,
        4
      )}/${formattedText.slice(4, 8)}`;
    }
    if (formattedText.length > 10) {
      formattedText = formattedText.slice(0, 10);
    }
    setBirthday(formattedText);
  };

  // --------------------------------------------------------------------
  // FETCH USER'S LIKED DRINKS
  // --------------------------------------------------------------------
  const fetchUserLikedDrinks = async () => {
    try {
      if (!user.username) return;

      const res = await client.graphql({
        query: listLikedDrinks,
        variables: {
          filter: {
            userID: { eq: user.username },
          },
        },
      });

      // items = [{ id, userID, drinkID }]
      const items: LikedDrinkRecord[] = res?.data?.listLikedDrinks?.items ?? [];

      // Gather the IDs the user has liked
      const likedIDs = items.map((r) => r.drinkID);

      // Build a { drinkID -> recordID } map
      const newRecordMap: Record<number, string> = {};
      items.forEach((rec) => {
        newRecordMap[rec.drinkID] = rec.id;
      });
      setRecordMap(newRecordMap);

      // The user’s currently liked set
      const newLikedSet = new Set(likedIDs);
      setLikedIDsInPopup(newLikedSet);

      // Filter the master "drinks" array so we have only the user's liked ones
      const userLikedDrinks = drinks.filter((d) => likedIDs.includes(d.id));
      setLikedDrinksData(userLikedDrinks);
    } catch (err) {
      console.error('Error fetching user liked drinks:', err);
    }
  };

  // --------------------------------------------------------------------
  // Remove liked drink
  // --------------------------------------------------------------------
  const removeLikedDrink = async (drinkId: number) => {
    const recordId = recordMap[drinkId];
    if (!recordId) {
      console.warn("Record not found for removal");
      return;
    }
    try {
      await client.graphql({
        query: deleteLikedDrink,
        variables: { input: { id: recordId } },
      });
      // Refresh the liked drinks list from DB
      fetchUserLikedDrinks();
      // Dispatch event so Menu page updates.
      Hub.dispatch('likeChannel', { event: 'likeUpdated', data: {} });
    } catch (err) {
      console.error("Error deleting liked drink:", err);
    }
  };

  // --------------------------------------------------------------------
  // Render the content of the popup
  // --------------------------------------------------------------------
  const renderPopupContent = () => {
    if (!popupData) return null;

    // --------------------- EDIT PROFILE -------------------
    if (popupData.title === 'Edit Profile') {
      return (
        <View style={styles.popupContent}>
          {/* First Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter first name"
              placeholderTextColor="#666"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>

          {/* Last Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter last name"
              placeholderTextColor="#666"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          {/* Birthday */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Birthday</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#666"
              value={birthday}
              onChangeText={handleBirthdayInput}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          {/* Save/Cancel Buttons */}
          <View style={styles.saveCancelRow}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={closePopup}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // --------------------- LIKED DRINKS -------------------
    if (popupData.title === 'Liked Drinks') {
      return (
        <View style={[styles.popupContent, { alignItems: 'flex-start' }]}>
          {likedDrinksData.length === 0 ? (
            <View>
              <Text style={styles.popupText}>
                You haven’t liked any drinks yet.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ marginTop: 10, width: '100%' }} contentContainerStyle={{ paddingBottom: 70 }}>
              {likedDrinksData.map((drink) => (
                <View key={drink.id} style={styles.likedDrinkItem}>
                  {/* Drink Image */}
                  <Image
                    source={{ uri: drink.image }}
                    style={styles.likedDrinkImage}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.likedDrinkName}>{drink.name}</Text>
                    <Text style={styles.likedDrinkCategory}>{drink.category}</Text>
                  </View>
                  {/* Colored Heart Icon */}
                  <Ionicons
                    name="heart"
                    size={24}
                    color="#CE975E"
                    style={{ marginRight: 10 }}
                  />
                  {/* Grey X Icon */}
                  <TouchableOpacity onPress={() => removeLikedDrink(drink.id)}>
                    <Ionicons
                      name="close"
                      size={24}
                      color="#4F4F4F"
                      style={{ marginRight: 10 }}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      );
    }

    // -------------------- EVERYTHING ELSE -------------------
    return <Text style={styles.popupText}>{popupData.content}</Text>;
  };

  // --------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Top user info */}
      <View style={styles.userInfoContainer}>
        <TouchableOpacity onPress={handleProfilePictureUpload} style={styles.profilePictureContainer}>
          <Image
            source={
              user.profilePicture
                ? { uri: user.profilePicture }
                : require('../../assets/images/default-profile.png')
            }
            style={styles.profilePicture}
            onError={() => {
              // If the URL is invalid or fails to load, fall back to default
              setUser((prev) => ({ ...prev, profilePicture: null }));
            }}
          />
          <View style={styles.editIconContainer}>
            <Ionicons name="pencil" size={18} color="#DFDCD9" />
          </View>
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
              onPress={() => {
                // If user taps Sign Out, call signOut
                if (button.title === 'Sign Out') {
                  signOut();
                  return;
                }
                // Otherwise, open the popup
                openPopup({ title: button.title, content: button.content });
              }}
            >
              <View style={styles.buttonRow}>
                <Ionicons
                  name={button.icon}
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
  profilePictureContainer: {
    position: 'relative',
  },
  profilePicture: {
    width: 125,
    height: 125,
    borderRadius: 75,
    marginBottom: 20,
    marginTop: 20,
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 20,
    right: 10,
    backgroundColor: '#1F1F1F',
    borderRadius: 50,
    padding: 5,
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
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
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
  inputContainer: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  inputLabel: {
    color: '#DFDCD9',
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    color: '#DFDCD9',
    fontSize: 16,
  },
  saveCancelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginTop: 30,
  },
  saveButton: {
    backgroundColor: '#CE975E',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  cancelButton: {
    backgroundColor: '#444',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  cancelButtonText: {
    color: '#DFDCD9',
    fontSize: 16,
    fontWeight: '600',
  },
  // Liked Drinks styling
  likedDrinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
  },
  likedDrinkImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  likedDrinkName: {
    color: '#DFDCD9',
    fontSize: 16,
    fontWeight: '600',
  },
  likedDrinkCategory: {
    color: '#CE975E',
    fontSize: 14,
  },
});
