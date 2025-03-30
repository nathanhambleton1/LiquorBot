import { Text, View, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Index() {
  const router = useRouter();
  useFonts({
    AzoMonoTest: require('@/assets/fonts/AzoSansTest-Regular.otf'), // Adjust path if needed
  });

  return (
    <ImageBackground
      source={require('@/assets/images/home-background.jpg')} // Add a background image
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.container}>
        {/* Welcome Section */}
        <Text style={styles.welcomeTitle}>Welcome to LiquorBot</Text>

        {/* Hero Section */}
        <Text style={styles.title}>Raise Your Glasses</Text>
        <Text style={styles.tagline}>
          Your personal robot bartender is here to make every moment unforgettable.
        </Text>

        {/* How It Works Section */}
        <View style={styles.howItWorksContainer}>
          <Text style={styles.subheading}>How It Works</Text>
          <View style={styles.step}>
            <Ionicons name="wine-outline" size={24} color="#CE975E" style={styles.stepIcon} />
            <Text style={styles.stepText}>Choose Your Drink: Browse our curated menu or create your signature cocktail.</Text>
          </View>
          <View style={styles.step}>
            <Ionicons name="qr-code-outline" size={24} color="#CE975E" style={styles.stepIcon} />
            <Text style={styles.stepText}>Place Your Order: Tap the screen or scan your personalized QR code.</Text>
          </View>
          <View style={styles.step}>
            <Ionicons name="sparkles-outline" size={24} color="#CE975E" style={styles.stepIcon} />
            <Text style={styles.stepText}>Watch the Magic: Your drink is poured to perfection, ready to toast to love!</Text>
          </View>
        </View>

        {/* Call-to-Action Button */}
        <TouchableOpacity style={styles.button} onPress={() => router.push('/menu')}>
          <Text style={styles.buttonText}>Explore Drinks</Text>
          <Ionicons
            name="chevron-forward-circle"
            size={36}
            color="#CE975E"
            style={styles.buttonIcon}
          />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 20, 20, 0.7)', // Dark overlay for better text visibility
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    color: '#DFDCD9',
    fontSize: 28,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#CE975E',
    fontSize: 32,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
    marginBottom: 10,
  },
  tagline: {
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
    marginBottom: 30,
  },
  howItWorksContainer: {
    width: '100%',
    marginBottom: 40,
  },
  subheading: {
    color: '#CE975E',
    fontSize: 22,
    fontFamily: 'AzoMonoTest',
    textAlign: 'center',
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  stepIcon: {
    marginRight: 10,
    marginTop: 3,
  },
  stepText: {
    color: '#DFDCD9',
    fontSize: 16,
    fontFamily: 'AzoMonoTest',
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f4f4f',
    paddingVertical: 15,
    paddingHorizontal: 35,
    borderRadius: 30,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
    marginRight: 10,
  },
  buttonIcon: {
    marginLeft: 10,
  },
});
