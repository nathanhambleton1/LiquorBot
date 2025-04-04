import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const Help = () => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.description}>
        Welcome to the Help page! Here you can find answers to common questions and learn how to use the app effectively.
      </Text>
      <Text style={styles.subtitle}>Frequently Asked Questions</Text>
      <View style={styles.faqItem}>
        <Text style={styles.question}>Q: How do I reset my password?</Text>
        <Text style={styles.answer}>A: Go to the Profile tab, select "Settings," and click on "Reset Password."</Text>
      </View>
      <View style={styles.faqItem}>
        <Text style={styles.question}>Q: How can I contact support?</Text>
        <Text style={styles.answer}>A: You can reach out to us via the "Contact Us" option in the Settings menu.</Text>
      </View>
      <View style={styles.faqItem}>
        <Text style={styles.question}>Q: Where can I find the user manual?</Text>
        <Text style={styles.answer}>A: The user manual is available under the "Resources" section in the app.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  faqItem: {
    marginBottom: 16,
  },
  question: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  answer: {
    fontSize: 16,
    marginTop: 4,
  },
});

export default Help;
