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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import TopView from '../components/TopView';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileScreen() {
  const [user, setUser] = useState({
    username: 'Loading...',
    email: 'Loading...',
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
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUser({
          username: 'Guest',
          email: 'Not logged in',
        });
      }
    };
    fetchUserData();
  }, []);

  const buttons: { title: string; icon: keyof typeof Ionicons.glyphMap; content: string }[] = [
    {
      title: 'Edit Profile',
      icon: 'create-outline',
      content: 'Edit your profile details below.',
    },
  ];

  const openPopup = (data: { title: string; content: string }) => {
    setPopupData(data);
    setPopupVisible(true);
    slideAnim.setValue(SCREEN_WIDTH);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const closePopup = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 300,
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

  return (
    <View style={styles.container}>
      <TopView username={user.username} userEmail={user.email} noBorderRadius />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.buttonContainer}>
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={styles.button}
              onPress={() => openPopup({ title: button.title, content: button.content })}
            >
              <View style={styles.buttonRow}>
                <Text style={styles.buttonText}>{button.title}</Text>
                <Ionicons name={button.icon} size={20} color="#DFDCD9" />
              </View>
              <View style={styles.separator} />
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
  scrollContainer: {
    paddingHorizontal: 20,
  },
  buttonContainer: {
    marginVertical: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonText: {
    color: '#DFDCD9',
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#4F4F4F',
    marginTop: 15,
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
