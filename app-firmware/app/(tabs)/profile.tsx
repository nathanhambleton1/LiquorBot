// -----------------------------------------------------------------------------
// File: profile.tsx
// Description: User profile screen for the LiquorBot app. Stores & edits profile
//              data in the UserProfile @model instead of Cognito attributes.
// Author: Nathan Hambleton
// Updated:  Apr 16 2025
// -----------------------------------------------------------------------------
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

// Amplify core + Storage
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { getUrl, uploadData } from 'aws-amplify/storage';
import * as ImagePicker from 'expo-image-picker';

// GraphQL client + ops
import { Amplify } from 'aws-amplify';
import config from '../../src/amplifyconfiguration.json';
import { generateClient } from 'aws-amplify/api';
import { listLikedDrinks, getUserProfile } from '../../src/graphql/queries';
import {
  createUserProfile,
  updateUserProfile,
} from '../../src/graphql/mutations';

// Sign‑out hook
import { useAuthenticator } from '@aws-amplify/ui-react-native';

Amplify.configure(config);
const client = generateClient();

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

interface Drink {
  id: number;
  name: string;
  category: string;
  image: string;
}

interface LikedDrinkRecord {
  id: string;
  drinkID: number;
  userID: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const [user, setUser] = useState<UserState>({
    username: 'Loading…',
    email: 'Loading…',
    profilePicture: null,
  });

  const [userProfileId, setUserProfileId] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState(''); // read‑only
  const [bio, setBio] = useState('');

  // UI state
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Drinks / likes
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [likedDrinksData, setLikedDrinksData] = useState<Drink[]>([]);
  const [recordMap, setRecordMap] = useState<Record<number, string>>({});
  const [likedIDsInPopup, setLikedIDsInPopup] = useState<Set<number>>(new Set());

  // sign‑out
  const { signOut } = useAuthenticator((ctx: any) => [ctx.user]);

  // --------------------------------------------------------------------------
  // INITIALISE PROFILE (UserProfile row + basic Cognito attrs)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      try {
        const cognitoUser = await getCurrentUser();
        const sub = cognitoUser.username; // primary key for model

        // email / birthday just for display
        let email = '';
        let bday = '';
        try {
          const attrs = await fetchUserAttributes();
          email = attrs.email ?? '';
          bday = attrs.birthdate ?? '';
        } catch (_) {}

        // fetch or create UserProfile row
        let res: any = await client.graphql({
          query: getUserProfile,
          variables: { id: sub },
        });
        let profile = res?.data?.getUserProfile;

        if (!profile) {
          res = await client.graphql({
            query: createUserProfile,
            variables: {
              input: { id: sub, username: '', bio: '', role: 'USER', profilePicture: '' },
            },
          });
          profile = res.data.createUserProfile;
        }

        setUserProfileId(profile.id);
        setFirstName(profile.username.split(' ')[0] ?? '');
        setLastName(profile.username.split(' ').slice(1).join(' ') ?? '');
        setBio(profile.bio ?? '');

        // top‑banner user state
        setUser({
          username: profile.username || sub,
          email: email || 'No email',
          profilePicture: profile.profilePicture || null,
        });

        setBirthday(bday);
        setProfileLoaded(true);
      } catch (err) {
        console.error('init profile error:', err);
      }
    };

    init();
  }, []);

  // --------------------------------------------------------------------------
  // Fetch drinks list from S3 on mount
  // --------------------------------------------------------------------------
  useEffect(() => {
    const fetchDrinks = async () => {
      try {
        const { url } = await getUrl({ key: 'drinkMenu/drinks.json' });
        const data = await (await fetch(url)).json();
        setDrinks(data);
      } catch (err) {
        console.error('fetchDrinks error:', err);
      }
    };
    fetchDrinks();
  }, []);

  // --------------------------------------------------------------------------
  // Buttons
  // --------------------------------------------------------------------------
  const buttons: ProfileButton[] = [
    { title: 'Edit Profile', icon: 'create-outline', content: '' },
    { title: 'Liked Drinks', icon: 'heart-outline', content: '' },
    { title: 'Pour History', icon: 'time-outline', content: '' },
    { title: 'Settings', icon: 'settings-outline', content: '' },
    { title: 'Help', icon: 'help-circle-outline', content: '' },
    { title: 'Sign Out', icon: 'log-out-outline', content: '' },
  ];

  // --------------------------------------------------------------------------
  // Popup helpers
  // --------------------------------------------------------------------------
  const openPopup = (data: PopupData) => {
    setPopupData(data);
    setPopupVisible(true);
    slideAnim.setValue(SCREEN_WIDTH);
    Animated.timing(slideAnim, { toValue: 0, duration: 100, useNativeDriver: false }).start();

    if (data.title === 'Liked Drinks') fetchUserLikedDrinks();
  };

  const closePopup = () => {
    Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 100, useNativeDriver: false }).start(() =>
      setPopupVisible(false)
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) slideAnim.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_WIDTH / 3) closePopup();
        else Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
      },
    })
  ).current;

  // --------------------------------------------------------------------------
  // SAVE PROFILE → UserProfile model
  // --------------------------------------------------------------------------
  const handleSaveProfile = async () => {
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await client.graphql({
        query: updateUserProfile,
        variables: { input: { id: userProfileId, username: fullName, bio } },
      });
      setUser((prev) => ({ ...prev, username: fullName }));
      closePopup();
    } catch (err) {
      console.log('updateUserProfile error:', err);
    }
  };

  // --------------------------------------------------------------------------
  // Upload picture & persist URL
  // --------------------------------------------------------------------------
  const handleProfilePictureUpload = async () => {
    try {
      const picker = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (picker.canceled) return;

      const localUri = picker.assets[0].uri;
      const blob = await (await fetch(localUri)).blob();
      const s3Path = `public/profilePictures/${userProfileId}.jpg`;

      await uploadData({ path: s3Path, data: blob });
      const { url } = await getUrl({ path: s3Path });

      await client.graphql({
        query: updateUserProfile,
        variables: { input: { id: userProfileId, profilePicture: url.toString() } },
      });

      setUser((p) => ({ ...p, profilePicture: url.toString() }));
    } catch (err) {
      console.error('profile pic upload error:', err);
    }
  };

  // --------------------------------------------------------------------------
  // Birthday formatter (display only)
  // --------------------------------------------------------------------------
  const handleBirthdayInput = (t: string) => {
    let f = t.replace(/[^0-9]/g, '');
    if (f.length > 2 && f.length <= 4) f = `${f.slice(0, 2)}/${f.slice(2)}`;
    else if (f.length > 4) f = `${f.slice(0, 2)}/${f.slice(2, 4)}/${f.slice(4, 8)}`;
    if (f.length > 10) f = f.slice(0, 10);
    setBirthday(f);
  };

  // --------------------------------------------------------------------------
  // Fetch liked drinks
  // --------------------------------------------------------------------------
  const fetchUserLikedDrinks = async () => {
    try {
      const res: any = await client.graphql({
        query: listLikedDrinks,
        variables: { filter: { userID: { eq: userProfileId } } },
      });
      const items: LikedDrinkRecord[] = res?.data?.listLikedDrinks?.items ?? [];
      const likedIds = items.map((i) => i.drinkID);

      const map: Record<number, string> = {};
      items.forEach((i) => (map[i.drinkID] = i.id));
      setRecordMap(map);
      setLikedIDsInPopup(new Set(likedIds));
      setLikedDrinksData(drinks.filter((d) => likedIds.includes(d.id)));
    } catch (err) {
      console.error('liked drinks fetch error:', err);
    }
  };

  // --------------------------------------------------------------------------
  // Popup body
  // --------------------------------------------------------------------------
  const renderPopupContent = () => {
    if (!popupData) return null;

    if (popupData.title === 'Edit Profile') {
      return (
        <View style={styles.popupContent}>
          {/* picture + user info */}
          <View style={styles.popupProfilePictureContainer}>
            <TouchableOpacity onPress={handleProfilePictureUpload} style={styles.popupProfilePictureWrapper}>
              <Image
                source={
                  user.profilePicture ? { uri: user.profilePicture } : require('../../assets/images/default-profile.png')
                }
                style={styles.popupProfilePicture}
                onError={() => setUser((p) => ({ ...p, profilePicture: null }))}
              />
              <View style={styles.popupProfilePictureOverlay}>
                <Ionicons name="camera" size={15} color="#DFDCD9" />
              </View>
            </TouchableOpacity>
            <View style={styles.popupUserInfo}>
              <Text style={styles.popupUsernameText}>{user.username}</Text>
              <Text style={styles.popupEmailText}>{user.email}</Text>
            </View>
          </View>

          {/* first / last */}
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

          {/* birthday read‑only */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Birthday</Text>
            <Text style={styles.readOnlyText}>{birthday ? birthday.replace(/-/g, '/') : 'Not provided'}</Text>
            <Text style={styles.supportText}>If this is incorrect, please contact support.</Text>
          </View>

          {/* bio */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              multiline
              value={bio}
              maxLength={100}
              placeholder="Write a bio…"
              placeholderTextColor="#666"
              onChangeText={(txt) => {
                const rows = txt.split('\n');
                if (rows.length <= 3) setBio(txt);
              }}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Enter' && bio.split('\n').length >= 3) return;
              }}
            />
            <Text style={styles.charCounter}>{bio.length}/100</Text>
          </View>

          {/* save / cancel */}
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

    if (popupData.title === 'Liked Drinks') {
      return (
        <View style={[styles.popupContent, { alignItems: 'flex-start' }]}>
          {likedDrinksData.length === 0 ? (
            <Text style={styles.popupText}>You haven’t liked any drinks yet.</Text>
          ) : (
            <ScrollView style={{ marginTop: 10, width: '100%' }} contentContainerStyle={{ paddingBottom: 70 }}>
              {likedDrinksData.map((d) => (
                <View key={d.id} style={styles.likedDrinkItem}>
                  <Image source={{ uri: d.image }} style={styles.likedDrinkImage} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.likedDrinkName}>{d.name}</Text>
                    <Text style={styles.likedDrinkCategory}>{d.category}</Text>
                  </View>
                  <Ionicons name="heart" size={24} color="#CE975E" style={{ marginRight: 10 }} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      );
    }

    return <Text style={styles.popupText}>{popupData.content}</Text>;
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  if (!profileLoaded) return null; // or a spinner
  return (
    <View style={styles.container}>
      {/* banner */}
      <View style={styles.userInfoContainer}>
        <View style={styles.profilePictureContainer}>
          <Image
            source={user.profilePicture ? { uri: user.profilePicture } : require('../../assets/images/default-profile.png')}
            style={styles.profilePicture}
            onError={() => setUser((p) => ({ ...p, profilePicture: null }))}
          />
        </View>
        <Text style={styles.usernameText}>{user.username}</Text>
        <Text style={styles.emailText}>{user.email}</Text>
      </View>

      {/* buttons */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.buttonContainer}>
          {buttons.map((b, i) => (
            <TouchableOpacity
              key={i}
              style={styles.button}
              onPress={() => {
                if (b.title === 'Sign Out') signOut();
                else openPopup({ title: b.title, content: b.content });
              }}
            >
              <View style={styles.buttonRow}>
                <Ionicons name={b.icon} size={24} color="#CE975E" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>{b.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* popup */}
      {popupVisible && popupData && (
        <Animated.View style={[styles.popup, { transform: [{ translateX: slideAnim }] }]} {...panResponder.panHandlers}>
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

// --------------------------------------------------------------------------
// STYLES (unchanged except where noted)
// --------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  userInfoContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 20 },
  profilePictureContainer: { position: 'relative' },
  profilePicture: { width: 125, height: 125, borderRadius: 75, marginBottom: 20, marginTop: 20 },
  usernameText: { color: '#DFDCD9', fontSize: 24, textAlign: 'center' },
  emailText: { color: '#4F4F4F', fontSize: 16, textAlign: 'center', marginTop: 5 },
  scrollContainer: { paddingHorizontal: 20 },
  buttonContainer: { marginVertical: 20, alignItems: 'center' },
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
  buttonRow: { flexDirection: 'row', alignItems: 'center' },
  buttonIcon: { marginRight: 15 },
  buttonText: { color: '#DFDCD9', fontSize: 18 },
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
  popupHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 75, backgroundColor: '#141414' },
  popupTitle: { flex: 1, textAlign: 'center', color: '#DFDCD9', fontSize: 18 },
  popupContent: { flex: 1, padding: 20, justifyContent: 'flex-start', alignItems: 'center' },
  popupText: { color: '#DFDCD9', fontSize: 16, textAlign: 'center' },
  inputContainer: { width: '100%', marginBottom: 20, paddingHorizontal: 20 },
  inputLabel: { color: '#DFDCD9', fontSize: 16, marginBottom: 5 },
  input: { backgroundColor: '#1F1F1F', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15, color: '#DFDCD9', fontSize: 16 },
  bioInput: { height: 85, textAlignVertical: 'top', lineHeight: 20 },
  charCounter: { textAlign: 'right', color: '#888', fontSize: 12, marginTop: 5, marginRight: 5 },
  saveCancelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40, marginTop: 30 },
  saveButton: { backgroundColor: '#CE975E', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, marginHorizontal: 10 },
  cancelButton: { backgroundColor: '#444', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, marginHorizontal: 10 },
  cancelButtonText: { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
  likedDrinkItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, marginBottom: 10, padding: 10 },
  likedDrinkImage: { width: 60, height: 60, borderRadius: 8 },
  likedDrinkName: { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
  likedDrinkCategory: { color: '#CE975E', fontSize: 14 },
  readOnlyText: { backgroundColor: '#1F1F1F', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15, color: '#4f4f4f', fontSize: 16 },
  supportText: { color: '#4f4f4f', fontSize: 12, marginTop: 5, marginLeft: 5 },
  popupProfilePictureContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  popupProfilePictureWrapper: { position: 'relative', width: 100, height: 100, marginLeft: 20, borderRadius: 50, overflow: 'hidden' },
  popupProfilePicture: { width: '100%', height: '100%', borderRadius: 40 },
  popupProfilePictureOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  popupUserInfo: { marginLeft: 30 },
  popupUsernameText: { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold' },
  popupEmailText: { color: '#4f4f4f', fontSize: 14, marginTop: 5 },
});
