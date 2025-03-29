import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function Index() {
  const router = useRouter();
  useFonts({
    AzoMonoTest: require('@/assets/fonts/AzoSansTest-Regular.otf'), // Adjust path if needed
  });

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.text}>
          Raise your glasses—our robot bartender is here to make your special day even more 
          unforgettable! From classic cocktails to custom creations, this sleek drink-pouring 
          genius is ready to serve up smiles and keep the celebration flowing.
          {'\n\n'}
          <Text style={styles.subheading}>How It Works:</Text>
          {'\n\n'}
          <Text style={styles.listItem}>
            1. Choose Your Drink: Browse our curated wedding menu or create your signature cocktail.
          </Text>
          {'\n'}
          <Text style={styles.listItem}>
            2. Place Your Order: Tap the screen or scan your personalized QR code.
          </Text>
          {'\n'}
          <Text style={styles.listItem}>
            3. Watch the Magic: Your drink is poured to perfection, ready to toast to love!
          </Text>
          {'\n\n'}
          Let’s make your big day as smooth as our robot's pours. Cheers to love, laughter, and happily
          ever after! 🥂✨
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  text: {
    color: '#DFDCD9',
    fontSize: 16,
    marginBottom: 20,
    fontFamily: 'AzoMonoTest',
    textAlign: 'left',
  },
  subheading: {
    color: '#CE975E',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
    marginBottom: 10,
  },
  listItem: {
    color: '#DFDCD9',
    fontSize: 16,
    fontFamily: 'AzoMonoTest',
    marginBottom: 5,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4F4F4F',
    paddingVertical: 15,
    paddingHorizontal: 35,
    borderRadius: 20,
    marginVertical: 10,
    width: '80%',
  },
  buttonText: {
    color: '#DFDCD9',
    fontSize: 18,
    fontFamily: 'AzoMonoTest',
    flex: 1,
  },
  buttonIcon: {
    marginLeft: 10,
  },
});
