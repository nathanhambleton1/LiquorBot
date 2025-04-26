// -----------------------------------------------------------------------------
// File: _layout.tsx
// Description: Defines the tab layout for the LiquorBot app, including routing 
//              and authentication checks. Utilizes Expo Router and AWS Amplify 
//              for navigation and authentication, respectively.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthenticator } from '@aws-amplify/ui-react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, StatusBar } from 'react-native';

export default function TabLayout() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  
  // If not authenticated, reroute to sign-in
  if (authStatus !== 'authenticated') {
    return <Redirect href="/auth/sign-in" />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#141414' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#CE975E',
          tabBarInactiveTintColor: '#4F4F4F',
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#000',
            borderTopWidth: 0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
            position: 'relative',
            left: 0,
            right: 0,
            bottom: 0,
            elevation: 0,
            shadowOpacity: 0,
            height: 60, // Increased height
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
                style={{ marginBottom: -20 }}
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
                style={{ marginBottom: -20 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: '',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'compass-sharp' : 'compass-outline'}
                color={color}
                size={24}
                style={{ marginBottom: -20 }}
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
                style={{ marginBottom: -20 }}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
