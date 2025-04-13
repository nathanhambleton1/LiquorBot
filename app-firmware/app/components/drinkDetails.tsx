// -----------------------------------------------------------------------------
// File: sign-up.tsx
// Description: Handles the user registration process for the LiquorBot app. 
//              Includes functionality for account creation, role selection, 
//              and confirmation. Integrates with AWS Amplify for authentication.
// Author: Nathan Hambleton
// Created:  March 1, 2025
// -----------------------------------------------------------------------------
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import TopView from './TopView'; 
// ^ Adjust the import path if you put TopView in a different folder

type DrinkParam = {
  id: number;
  name: string;
  category: string;
  description: string;
  image: any; // or ImageSourcePropType
};

export default function DrinkDetails() {
  const router = useRouter();
  // For example, we might use "drink" in the URL: /drinkDetails?drink={...}
  const { drink: drinkParam } = useLocalSearchParams();

  // If passed as JSON string, parse it
  let drink: DrinkParam | undefined;
  if (typeof drinkParam === 'string') {
    try {
      drink = JSON.parse(drinkParam);
    } catch {
      // If parsing fails, drink stays undefined
    }
  }

  if (!drink) {
    return (
      <View style={styles.container}>
        <TopView title="Drink Details" />
        <Text style={styles.errorText}>Drink not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopView title={drink.name} />
      <View style={styles.contentContainer}>
        <Image source={drink.image} style={styles.image} />
        <Text style={styles.categoryText}>{drink.category}</Text>
        <Text style={styles.descriptionText}>{drink.description}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  image: {
    width: '80%',
    height: 200,
    marginBottom: 20,
    resizeMode: 'contain', // optional
  },
  categoryText: {
    color: '#CE975E',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
    marginBottom: 10,
  },
  descriptionText: {
    color: '#DFDCD9',
    fontSize: 16,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#141414',
    paddingVertical: 15,
    paddingHorizontal: 35,
    borderRadius: 20,
    marginVertical: 10,
  },
  buttonText: {
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
  },
  errorText: {
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
    marginTop: 20,
  },
});
