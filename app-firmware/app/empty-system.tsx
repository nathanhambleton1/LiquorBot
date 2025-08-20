
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, FlatList, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiquorBot } from './components/liquorbot-provider';

const SOLENOIDS = Array.from({ length: 12 }, (_, i) => `Solenoid ${i + 1}`);
const STEP_COLOR = '#CE975E';

const STEPS = [
  {
    title: 'Select Solenoid',
    description: 'Choose which solenoid you want to empty. This will open the valve and let you clean out the line.',
    icon: 'water-outline',
    color: STEP_COLOR,
  },
  {
    title: 'Prepare to Empty',
    description: 'Place a container under the output spout to collect the liquid. Make sure the area is clear.',
    icon: 'flask-outline',
    color: STEP_COLOR,
  },
  {
    title: 'Emptying',
    description: 'The system is emptying the selected solenoid. Wait until the process is complete.',
    icon: 'timer-outline',
    color: STEP_COLOR,
  },
  {
    title: 'Done!',
    description: 'The solenoid has been emptied. Dispose of the liquid safely or repeat for another slot.',
    icon: 'checkmark-circle-outline',
    color: STEP_COLOR,
  },
];

export default function EmptySystem() {
  // Track if a stop command has been sent to avoid duplicates
  const stopSentRef = useRef(false);

  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [isEmptying, setIsEmptying] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [stepTransitioning, setStepTransitioning] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  // LiquorBot context for ID and connection
  const { liquorbotId, isConnected, pubsub } = useLiquorBot();
  const maintenanceTopic = `liquorbot/liquorbot${liquorbotId}/maintenance`;

  // Listen for status responses from the microcontroller
  React.useEffect(() => {
    if (!liquorbotId || liquorbotId === '000') return;
    const sub = pubsub.subscribe({ topics: [maintenanceTopic] }).subscribe({
      next: (event: any) => {
        console.log('[EmptySystem] Full MQTT event:', event);
        // Use event directly if it has action/status
        const msg = event && typeof event === 'object' && ('action' in event || 'status' in event) ? event
          : (event?.value ? (typeof event.value === 'string' ? JSON.parse(event.value) : event.value) : null);

        if (!msg) {
          console.log('[EmptySystem] MQTT message is missing action/status:', event);
          return;
        }
        console.log('[EmptySystem] MQTT message received:', msg);
        if (msg.status === 'ok' && msg.action === 'EMPTY_INGREDIENT_START') {
          setIsEmptying(true);
          stopSentRef.current = false;
        }
        if (msg.status === 'ok' && msg.action === 'EMPTY_INGREDIENT_STOP') {
          console.log('[EmptySystem] Received EMPTY_INGREDIENT_STOP, transitioning to done page.');
          setIsEmptying(false);
          setStep(3);
          stopSentRef.current = false;
        }
      },
      error: (err: unknown) => {
        console.log('[EmptySystem] MQTT subscription error:', err);
      },
    });
    return () => sub.unsubscribe();
  }, [liquorbotId, pubsub, maintenanceTopic]);

  // Send stop command on unmount or navigation away
  React.useEffect(() => {
    return () => {
      // Only send if we were emptying and haven't already sent
      if (isEmptying && !stopSentRef.current) {
        pubsub.publish({
          topics: [maintenanceTopic],
          message: { action: 'STOP_EMPTY_INGREDIENT' },
        }).catch(() => {});
        stopSentRef.current = true;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmptying, liquorbotId, pubsub, maintenanceTopic]);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
    return () => anim.setValue(0);
  }, [step]);

  // Animate checkmark on done
  React.useEffect(() => {
    if (step === 3) {
      setShowCheck(false);
      checkAnim.setValue(0);
      setTimeout(() => {
        setShowCheck(true);
        Animated.spring(checkAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();
      }, 200);
    }
  }, [step]);

  const handleSelect = (index: number) => {
    setSelected(index);
    setStep(1);
  };



  // Start emptying a single slot
  const handleStartEmpty = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Connect to a LiquorBot device first.');
      return;
    }
    setIsEmptying(true); // Optimistically set to true for UI
    setStep(2);
    if (selected !== null) {
      try {
        await pubsub.publish({
          topics: [maintenanceTopic],
          message: { action: 'EMPTY_INGREDIENT', slot: selected + 1 },
        });
      } catch (err) {
        Alert.alert('Error', 'Failed to send empty command.');
      }
    }
  };


  // Stop emptying a single slot
  const handleStopEmpty = async () => {
    // Send stop command to microcontroller
    try {
      await pubsub.publish({
        topics: [maintenanceTopic],
        message: { action: 'STOP_EMPTY_INGREDIENT' },
      });
      stopSentRef.current = true;
    } catch (err) {
      Alert.alert('Error', 'Failed to send stop command.');
    }
  };

  const handleBack = () => {
    // Cancel emptying if needed (handled by cleanup effect)
    router.back(); // Go back to previous page in the stack
  };

  // UI for each step
  let content;
  if (step === 0) {
    content = (
      <Animated.View style={[styles.stepContainer, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: STEP_COLOR }]}> 
          <Ionicons name="water-outline" size={38} color="#141414" />
        </View>
        <Text style={styles.stepTitle}>Select an Ingredient</Text>
        <Text style={styles.stepDescription}>Choose which ingredient you want to empty.</Text>
        <FlatList
          data={SOLENOIDS}
          keyExtractor={(_, i) => i.toString()}
          numColumns={2}
          style={{ width: '100%', marginTop: 10 }}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 8 }}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 8 }}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[
                styles.solenoidItem,
                selected === index && styles.selectedSolenoid,
                { flex: 1, marginHorizontal: 4, marginVertical: 4, minWidth: 0 }
              ]}
              onPress={() => handleSelect(index)}
            >
              <Text style={styles.solenoidText}>{item.replace('Solenoid', 'Ingredient')}</Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    );
  } else if (step === 1 && selected !== null) {
    content = (
      <Animated.View style={[styles.stepContainer, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: STEP_COLOR }]}> 
          <Ionicons name="flask-outline" size={38} color="#141414" />
        </View>
        <Text style={styles.stepTitle}>Prepare to Empty</Text>
        <Text style={styles.stepDescription}>
          Place a container under the output spout to collect the liquid from <Text style={{ color: STEP_COLOR }}>{SOLENOIDS[selected].replace('Solenoid', 'Ingredient')}</Text>.
        </Text>
        <TouchableOpacity style={[styles.startButton, { backgroundColor: '#63d44a', marginTop: 24 }]} onPress={handleStartEmpty}>
          <Ionicons name="play" size={22} color="#141414" />
          <Text style={styles.startButtonText}>Start Emptying</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  } else if (step === 2 && selected !== null) {
    content = (
      <Animated.View style={[styles.stepContainer, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: STEP_COLOR }]}> 
          <Ionicons name="timer-outline" size={38} color="#141414" />
        </View>
        <Text style={styles.stepTitle}>Emptying {SOLENOIDS[selected].replace('Solenoid', 'Ingredient')}</Text>
        <Text style={styles.stepDescription}>Press Stop when the ingredient is fully emptied.</Text>
        <Animated.View style={{ marginTop: 30, alignItems: 'center', width: '100%' }}>
          <ActivityIndicator size="large" color={STEP_COLOR} style={{ marginBottom: 18 }} />
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: isEmptying ? '#d44a4a' : '#888', marginTop: 8 }]}
            onPress={handleStopEmpty}
            disabled={!isEmptying}
          >
            <Ionicons name="stop" size={22} color="#DFDCD9" />
            <Text style={[styles.startButtonText, { color: '#DFDCD9' }]}>Stop</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    );
  } else if (step === 3) {
    const handleEmptyAnother = () => {
      setSelected(null);
      setStep(0);
    };
    content = (
      <Animated.View style={[styles.stepContainer, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: STEP_COLOR }]}> 
          {showCheck ? (
            <Animated.View style={{ transform: [{ scale: checkAnim }], opacity: checkAnim }}>
              <Ionicons name="checkmark-circle" size={38} color="#63d44a" />
            </Animated.View>
          ) : (
            <Ionicons name="checkmark-circle-outline" size={38} color={STEP_COLOR} />
          )}
        </View>
        <Text style={styles.stepTitle}>Done!</Text>
        <Text style={styles.stepDescription}>The ingredient has been emptied. Dispose of the liquid safely.</Text>
        <TouchableOpacity style={[styles.startButton, { backgroundColor: STEP_COLOR, marginTop: 24 }]} onPress={handleEmptyAnother}>
          <Ionicons name="refresh" size={22} color="#141414" />
          <Text style={styles.startButtonText}>Empty Another</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with back button and centered title */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={28} color="#DFDCD9" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerText}>Empty System</Text>
        </View>
      </View>
      <View style={styles.content}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 80, paddingHorizontal: 20 },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 2,
    padding: 6,
    borderRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    justifyContent: 'center',
    position: 'relative',
    minHeight: 40,
  },
  headerTitleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 24,
    color: '#DFDCD9',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  stepContainer: { alignItems: 'center', width: '100%', backgroundColor: '#1F1F1F', borderRadius: 12, padding: 18 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 18, marginTop: 5 },
  stepTitle: { color: '#CE975E', fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  stepDescription: { color: '#DFDCD9', fontSize: 16, textAlign: 'center' },
  startButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#63d44a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30, marginBottom: 10 },
  startButtonText: { color: '#141414', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  solenoidItem: { backgroundColor: '#232323', borderRadius: 10, paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center' },
  selectedSolenoid: { borderColor: '#CE975E', borderWidth: 2 },
  solenoidText: { color: '#DFDCD9', fontSize: 18 },
});

