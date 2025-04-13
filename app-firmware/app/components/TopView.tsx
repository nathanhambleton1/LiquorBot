// -----------------------------------------------------------------------------
// File: TopView.tsx
// Description: A reusable top view component for the LiquorBot app. Displays 
//              user information, a title, and a sign-out button. Integrates 
//              with AWS Amplify for authentication.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useAuthenticator } from '@aws-amplify/ui-react-native';

// Define the props interface
export interface TopViewProps {
  title?: string;
  noBorderRadius?: boolean; // hides bottom radius if needed
  username?: string;
  userEmail?: string;
  // If you want more optional props, add them here
}

export default function TopView({
  title,
  noBorderRadius,
  username,
  userEmail,
}: TopViewProps) {
  // Retrieve user only if needed:
  const userSelector = (context: any) => [context.user];
  const { user, signOut } = useAuthenticator(userSelector);

  // Renders a sign out button
  const SignOutButton = () => {
    return (
      <Pressable onPress={signOut} style={styles.signOutButton}>
        <Text style={styles.signOutButtonText}>Sign out</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.topView, noBorderRadius && styles.noBorderRadius]}>
      {title ? (
        <Text style={styles.topViewText}>{title}</Text>
      ) : (
        <View style={styles.userInfo}>
          <View>
            {username && <Text style={styles.username}>{username}</Text>}
            {userEmail && <Text style={styles.userEmail}>{userEmail}</Text>}
          </View>
          <View>
            <SignOutButton />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topView: {
    width: '100%',
    height: 120, 
    paddingTop: 50, 
    paddingLeft: 30,
    backgroundColor: '#000',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    justifyContent: 'center',
  },
  noBorderRadius: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  topViewText: {
    color: '#DFDCD9',
    fontSize: 25,
    fontFamily: 'AzoMonoTest',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingRight: 30,
  },
  username: {
    color: '#DFDCD9',
    fontSize: 20,
    fontFamily: 'AzoMonoTest',
  },
  userEmail: {
    color: '#DFDCD9',
    fontSize: 15,
    fontFamily: 'AzoMonoTest',
  },
  signOutButton: {
    backgroundColor: '#CE975E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
  },
  signOutButtonText: {
    color: '#141414',
    fontSize: 16,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
  },
});
