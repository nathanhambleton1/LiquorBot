// -----------------------------------------------------------------------------
// File: _layout.tsx
// Description: Defines the layout for authentication screens in the LiquorBot 
//              app. Includes routing for sign-in and sign-up screens with 
//              customized screen options.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide the header
        animation: 'none', // Disable the sliding animation
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
