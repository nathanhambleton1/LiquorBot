// ----------------------------------------------------------------------------
// File: profile.tsx  (main tab screen – keeps high‑level state & routing)
// ----------------------------------------------------------------------------
import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  PanResponder,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

// Sub‑popups
import EditProfilePopup from '../components/profile/EditProfilePopup';
import LikedDrinksPopup from '../components/profile/LikedDrinksPopup';
import PourHistoryPopup   from '../components/profile/PourHistoryPopup';
import HelpPopup from '../components/profile/HelpPopup';
import SettingsPopup from '../components/profile/SettingsPopup';

// Amplify + AWS imports –‑‑‑ identical to your original ----------------------
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { getUrl, uploadData } from 'aws-amplify/storage';
import * as ImagePicker from 'expo-image-picker';
import { Amplify } from 'aws-amplify';
import config from '../../src/amplifyconfiguration.json';
import { generateClient } from 'aws-amplify/api';
import { listLikedDrinks, getUserProfile } from '../../src/graphql/queries';
import { createUserProfile, updateUserProfile } from '../../src/graphql/mutations';
import { useAuthenticator } from '@aws-amplify/ui-react-native';

Amplify.configure(config);
const client = generateClient();

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
export interface UserState {
  username: string;
  email: string;
  profilePicture: string | null;
}
export interface Drink {
  id: number;
  name: string;
  category: string;
  image: string;
  ingredients: string; // Add missing property
}
interface LikedDrinkRecord {
  id: string;
  drinkID: number;
  userID: string;
}

interface PourEvent {
  id: string;
  drinkName: string;
  timestamp: string;
  time: string; // Add missing property
  volumeOz: number; // Add missing property
}
interface PopupMeta { title: string; content?: string; }

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
export default function ProfileScreen() {
  // ───────────────────────── STATE ─────────────────────────────────────────
  const [user, setUser] = useState<UserState>({ username: 'Loading…', email: 'Loading…', profilePicture: null });
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [userProfileId, setUserProfileId] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [bio, setBio] = useState('');

  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [likedDrinks, setLikedDrinks] = useState<Drink[]>([]);
  const [pourHistory, setPourHistory]   = useState<PourEvent[]>([]);

  // Popup control
  const [popup, setPopup] = useState<PopupMeta | null>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const { signOut } = useAuthenticator((ctx: any) => [ctx.user]);
  const router = useRouter();

  // Reset popup state when navigating to the profile tab
  useFocusEffect(
    React.useCallback(() => {
      setPopup(null); // Close any open popup
    }, [])
  );

  // ─────────────────────── INITIAL LOAD ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const cognitoUser = await getCurrentUser();
        const sub = cognitoUser.username;
        setRegisteredUsername(sub);

        // display email / bday
        let email = '', bday = '';
        try {
          const attrs = await fetchUserAttributes();
          email = attrs.email ?? '';
          bday  = attrs.birthdate ?? '';
        } catch {}

        // fetch or create UserProfile row
        let res: any = await client.graphql({ query: getUserProfile, variables: { id: sub }});
        let profile = res?.data?.getUserProfile;
        if (!profile) {
          res = await client.graphql({
            query: createUserProfile,
            variables: { input: { id: sub, username: '', bio: '', role: 'USER', profilePicture: '' } }
          });
          profile = res.data.createUserProfile;
        }

        setUserProfileId(profile.id);
        setFirstName(profile.username.split(' ')[0] ?? '');
        setLastName(profile.username.split(' ').slice(1).join(' ') ?? '');
        setBio(profile.bio ?? '');

        setUser({ username: profile.username || sub, email: email || 'No email', profilePicture: profile.profilePicture || null });
        setBirthday(bday);
        setProfileLoaded(true);
      } catch (err) { console.error('init profile error', err); }
    })();
  }, []);

  // drinks JSON from S3
  useEffect(() => {
    (async () => {
      try {
        const { url } = await getUrl({ key: 'drinkMenu/drinks.json' });
        const data = await (await fetch(url)).json();
        setDrinks(data);
      } catch (err) { console.error('fetchDrinks error', err); }
    })();
  }, []);

  // ───────────────────── FETCH HELPERS ────────────────────────────────
  const fetchUserLikedDrinks = async () => {
    try {
      const res: any = await client.graphql({
        query: listLikedDrinks,
        variables: { filter: { userID: { eq: userProfileId } } },
      });
      const likedIds = (res?.data?.listLikedDrinks?.items ?? []).map((i: LikedDrinkRecord) => i.drinkID);
      setLikedDrinks(drinks.filter((d) => likedIds.includes(d.id)));
    } catch (err) { console.error('liked drinks fetch error', err); }
  };

  const fetchPourHistory = async () => {
    try {
      const { url } = await getUrl({ key: 'logs/pourHistory.json' });      // adjust path
      const data = await (await fetch(url)).json();                        // expects PourEvent[]
      setPourHistory(data.reverse());                                      // newest first
    } catch { setPourHistory([]); }
  };

  const clearPourHistory = async () => {
    setPourHistory([]);
    // Persist clearing here if using cloud storage
  };

  // ────────────────────── POPUP HANDLERS ───────────────────────────────────
  const openPopup = (p: PopupMeta) => {
    setPopup(p);
    if (p.title === 'Liked Drinks') fetchUserLikedDrinks();
    if (p.title === 'Pour History') fetchPourHistory();
    slideAnim.setValue(SCREEN_WIDTH);
    Animated.timing(slideAnim, { toValue: 0, duration: 100, useNativeDriver: false }).start();
  };
  const closePopup = () => {
    Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 100, useNativeDriver: false }).start(() => setPopup(null));
  };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => { if (g.dx > 0) slideAnim.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_WIDTH / 3) closePopup();
        else Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
      },
    })
  ).current;

  // ─────────────────── HELPERS USED BY POPUPS ──────────────────────────────
  const handleSaveProfile = async () => {
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      await client.graphql({ query: updateUserProfile, variables: { input: { id: userProfileId, username: fullName, bio } } });
      setUser((p) => ({ ...p, username: fullName }));
      closePopup();
    } catch (e) { console.log('updateUserProfile error', e); }
  };

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
      await client.graphql({ query: updateUserProfile, variables: { input: { id: userProfileId, profilePicture: url.toString() } } });
      setUser((p) => ({ ...p, profilePicture: url.toString() }));
    } catch (err) { console.error('profile pic upload error', err); }
  };

  // ─────────────────── BUTTON DEFINITIONS ──────────────────────────────────
  const buttons = [
    { title: 'Edit Profile', icon: 'create-outline' as const },
    { title: 'Liked Drinks', icon: 'heart-outline' as const },
    { title: 'My Drinks',    icon: 'wine-outline'  as const },
    { title: 'Pour History', icon: 'time-outline'  as const },
    { title: 'Settings',      icon: 'settings-outline' as const },   // placeholders
    { title: 'Help',          icon: 'help-circle-outline' as const },
    { title: 'Sign Out',      icon: 'log-out-outline' as const },
  ];

  // ───────────────────── POPUP CONTENT ROUTER ──────────────────────────────
  const renderPopupBody = () => {
    if (!popup) return null;
    switch (popup.title) {
      case 'Edit Profile':
        return (
          <EditProfilePopup
            user={user}
            registeredUsername={registeredUsername}
            email={user.email}
            firstName={firstName}
            lastName={lastName}
            birthday={birthday}
            bio={bio}
            setFirstName={setFirstName}
            setLastName={setLastName}
            setBio={setBio}
            onSave={handleSaveProfile}
            onClose={closePopup}
            onPickImage={handleProfilePictureUpload}
          />
        );
      case 'Liked Drinks':
        return <LikedDrinksPopup drinks={likedDrinks} />;
      case 'Pour History':
        return <PourHistoryPopup />;
      case 'Settings':
        return <SettingsPopup />;
      case 'Help':
        return <HelpPopup />;
      default:
        return null;
    }
  };

  if (!profileLoaded) return null;

  // ────────────────────────── RENDER ───────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* header banner */}
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

      {/* button list */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.buttonContainer}>
          {buttons.map((b) => (
            <TouchableOpacity
              key={b.title}
              style={styles.button}
              onPress={() => {
                switch (b.title) {
                  case 'Sign Out':
                    signOut();
                    break;
                  case 'My Drinks':
                    router.push('/drink-list');
                    break;
                  default:
                    openPopup({ title: b.title });
                }
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

      {/* slide‑in popup */}
      {popup && (
        <Animated.View style={[styles.popup, { transform: [{ translateX: slideAnim }] }]} {...panResponder.panHandlers}>
          <View style={styles.popupHeader}>
            <TouchableOpacity onPress={closePopup}>
              <Ionicons name="arrow-back" size={24} color="#DFDCD9" />
            </TouchableOpacity>
            <Text style={styles.popupTitle}>{popup.title}</Text>
            <View style={{ width: 24 }} />
          </View>
          {renderPopupBody()}
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────── STYLE SHEET ───────────────────────────────────────
const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#141414' },
  userInfoContainer:     { alignItems: 'center', paddingTop: 70, paddingBottom: 20 },
  profilePictureContainer:{},
  profilePicture:        { width: 125, height: 125, borderRadius: 75, marginVertical: 20 },
  usernameText:          { color: '#DFDCD9', fontSize: 24 },
  emailText:             { color: '#4F4F4F', fontSize: 16, marginTop: 5 },
  scrollContainer:       { paddingHorizontal: 20 },
  buttonContainer:       { marginVertical: 20 },
  button:                { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F',
                            borderRadius: 10, paddingVertical: 15, paddingHorizontal: 15, marginBottom: 10 },
  buttonRow:             { flexDirection: 'row', alignItems: 'center' },
  buttonIcon:            { marginRight: 15 },
  buttonText:            { color: '#DFDCD9', fontSize: 18 },
  popup:                 { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            backgroundColor: '#141414', elevation: 10, zIndex: 10 },
  popupHeader:           { flexDirection: 'row', alignItems: 'center', padding: 15, paddingTop: 70 },
  popupTitle:            { flex: 1, textAlign: 'center', color: '#DFDCD9', fontSize: 18 },
});
