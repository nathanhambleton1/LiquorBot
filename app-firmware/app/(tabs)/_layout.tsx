// -----------------------------------------------------------------------------
// File: app/(tabs)/_layout.tsx
// Description: Tab navigator layout for LiquorBot.
//              ✔ Auth-gate via Amplify UI
//              ✔ Custom tab-bar styling
//              ✱ Swipe-back is disabled per-screen (export options in each page)
// Author: Nathan Hambleton
// Updated: 22 May 2025
// -----------------------------------------------------------------------------
import React from 'react';
import { Redirect, Tabs } from 'expo-router';
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

  /* ─────────────── protected-route guard ─────────────── */
  if (authStatus !== 'authenticated') {
    return <Redirect href="/auth/sign-in" />;
  }

  /* ─────────────── bottom-tab navigator ─────────────── */
  return (
    <SAView edges={['left', 'right']} style={{ flex: 1, backgroundColor: 'transparent' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor:  '#CE975E',
          tabBarInactiveTintColor:'#4F4F4F',
          tabBarStyle: {
            backgroundColor:        '#000',
            borderTopWidth:         0,
            borderTopLeftRadius:    20,
            borderTopRightRadius:   20,
            overflow:               'hidden',
            position:               'absolute',
            left:                   0,
            right:                  0,
            bottom:                 0,
            elevation:              0,
            shadowOpacity:          0,
            height:                 60 + insets.bottom,
            paddingBottom:          insets.bottom,
          },
        }}
      >
        {/* Home ─────────────────────────────────────────── */}
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

        {/* Drink Menu ───────────────────────────────────── */}
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

        {/* Explore ──────────────────────────────────────── */}
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

        {/* Profile ──────────────────────────────────────── */}
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

/* ---------------------------------------------------------------------------
   👉  Disable the iOS back-swipe per root tab screen by adding, at the top of
      each page file (e.g. app/(tabs)/index.tsx, menu/index.tsx, etc.):

      import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
      export const options: NativeStackNavigationOptions = { gestureEnabled: false };

   This keeps the layout clean and avoids TS errors, while removing the swipe.
--------------------------------------------------------------------------- */
