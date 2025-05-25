// -----------------------------------------------------------------------------
// File: app/(tabs)/_layout.tsx
// Description: Defines the bottom-tab navigator for LiquorBot.
//              • Auth-guard via Amplify UI
//              • Tab-bar styling
//              • Swipe-back disabled via unstable_settings
// Author: Nathan Hambleton
// Updated: 22 May 2025
// -----------------------------------------------------------------------------

/**
 * Disable the native iOS back-swipe gesture on all tabs.
 * (expo-router will merge this into the underlying native-stack options)
 */
export const unstable_settings = {
  gesturesEnabled: false,
};

import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthenticator } from '@aws-amplify/ui-react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'react-native';
import {
  SafeAreaView as SAView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

export default function TabLayout() {
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
  const insets         = useSafeAreaInsets();

  // redirect to sign-in if not authenticated
  if (authStatus !== 'authenticated') {
    return <Redirect href="/auth/sign-in" />;
  }

  return (
    <SAView edges={['left', 'right']} style={{ flex: 1, backgroundColor: 'transparent' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor:   '#CE975E',
          tabBarInactiveTintColor: '#4F4F4F',
          tabBarStyle: {
            backgroundColor:       '#000',
            borderTopWidth:        0,
            borderTopLeftRadius:   20,
            borderTopRightRadius:  20,
            overflow:              'hidden',
            position:              'absolute',
            left:                  0,
            right:                 0,
            bottom:                0,
            elevation:             0,
            shadowOpacity:         0,
            height:                60 + insets.bottom,
            paddingBottom:         insets.bottom,
          },
        }}
      >
        {/* Home Tab */}
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

        {/* Events Tab */}
        <Tabs.Screen
          name="events"
          options={{
            title: '',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'calendar-sharp' : 'calendar-outline'}
                color={color}
                size={24}
                style={{ marginBottom: -20 }}
              />
            ),
          }}
        />

        {/* Drink Menu Tab */}
        <Tabs.Screen
          name="menu"
          options={{
            title: '',
            tabBarIcon: ({ color }) => (
              <Ionicons
                name="wine-sharp"
                color={color}
                size={24}
                style={{ marginBottom: -20 }}
              />
            ),
          }}
        />

        {/* Explore Tab */}
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

        {/* Profile Tab */}
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
    </SAView>
  );
}
