import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View, StyleSheet, StatusBar, SafeAreaView } from 'react-native';

export default function TabLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#141414' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#CE975E',
          tabBarInactiveTintColor: '#4F4F4F', // Set the color of the unselected icons
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#141414', // Set a solid background color
            borderTopWidth: 0, // Remove the white line
            borderTopLeftRadius: 20, // Rounded corners
            borderTopRightRadius: 20, // Rounded corners
            overflow: 'hidden', // Ensure the background is clipped to the rounded corners
            position: 'relative', // Change from 'absolute' to 'relative'
            left: 0,
            right: 0,
            bottom: 0,
            elevation: 0, // Remove shadow on Android
            shadowOpacity: 0, // Remove shadow on iOS
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'home-sharp' : 'home-outline'}
                color={color}
                size={24}
                style={{ marginBottom: -10 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: '',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'wine-sharp' : 'wine-sharp'}
                color={color}
                size={24}
                style={{ marginBottom: -10 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'person-circle-sharp' : 'person-circle-outline'}
                color={color}
                size={24}
                style={{ marginBottom: -10 }}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
