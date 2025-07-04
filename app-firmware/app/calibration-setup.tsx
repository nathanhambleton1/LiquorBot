import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LineChart } from 'react-native-chart-kit';

// Placeholder: Replace with your actual MQTT or PubSub logic
async function sendCalibrationCommand(action: string, solenoids: number) {
  // Example: publishMaintenance({ action: 'CALIBRATE_START', solenoids })
  // or pubsub.publish({ topics: [...], message: { action, solenoids } })
  // For now, just log
  console.log(`Send to ESP: ${action} for ${solenoids} solenoid(s)`);
}

const STEP_COLOR = '#CE975E'; // Gold theme for all steps
const STEPS = [
  {
    title: 'Step 1',
    description: 'Place your measuring cup under the output. Press Start, then Stop when the cup is full.',
    icon: 'water-outline' as const,
    color: STEP_COLOR,
  },
  {
    title: 'Step 2',
    description: 'Empty the cup, place it back, then press Start. Press Stop when the cup is full.',
    icon: 'water-outline' as const,
    color: STEP_COLOR,
  },
  {
    title: 'Step 3',
    description: 'Repeat one more time. Empty the cup, place it back, then press Start. Press Stop when the cup is full.',
    icon: 'water-outline' as const,
    color: STEP_COLOR,
  },
  {
    title: 'Step 4',
    description: 'Repeat again. Empty the cup, place it back, then press Start. Press Stop when the cup is full.',
    icon: 'water-outline' as const,
    color: STEP_COLOR,
  },
  {
    title: 'Step 5',
    description: 'Final step! Empty the cup, place it back, then press Start. Press Stop when the cup is full.',
    icon: 'water-outline' as const,
    color: STEP_COLOR,
  }
];

const CUP_VOLUME_LITERS = 0.236588; // 1 US cup in liters

export default function CalibrationSetup() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<number[]>([]); // ms elapsed for each step
  const [showCheck, setShowCheck] = useState(false);
  const [stepTransitioning, setStepTransitioning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  // Animate step transitions
  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
    return () => anim.setValue(0);
  }, [step]);

  // Animate checkmark on summary page mount
  React.useEffect(() => {
    if (step === STEPS.length) {
      setShowCheck(false);
      checkAnim.setValue(0);
      setTimeout(() => {
        setShowCheck(true);
        Animated.spring(checkAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }).start();
      }, 200); // slight delay for effect
    }
  }, [step]);

  const handleStart = async () => {
    setIsRunning(true);
    startTimeRef.current = Date.now();
    await sendCalibrationCommand('CALIBRATE_START', step + 1);
  };

  const handleStop = async () => {
    setIsRunning(false);
    const elapsed = Date.now() - (startTimeRef.current || Date.now());
    setResults(prev => {
      const next = [...prev];
      next[step] = elapsed;
      return next;
    });
    await sendCalibrationCommand('CALIBRATE_STOP', step + 1);
    setShowCheck(true);
    setStepTransitioning(true);
    checkAnim.setValue(0);
    Animated.spring(checkAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      setShowCheck(false);
      setStep(s => s + 1);
      setStepTransitioning(false);
    }, 900);
  };

  const handleFinish = () => {
    setShowCheck(false); // Hide checkmark immediately on finish
    checkAnim.setValue(0);
    setTimeout(() => {
      Alert.alert('Calibration Complete', 'Your calibration data has been recorded. You can now proceed to use your LiquorBot with improved accuracy.');
      router.back();
    }, 900);
  };

  // On finish page, calculate flow rates and best fit lines
  function getGraphData() {
    // x: solenoids open (1-5), y: flow rate (L/s)
    const x = [1, 2, 3, 4, 5];
    const y = results.map(t => t ? CUP_VOLUME_LITERS / (t / 1000) : 0); // L/s
    // Linear regression (least squares)
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const fitY = x.map(xi => slope * xi + intercept);
    // Logarithmic regression: y = a + b * ln(x)
    // Only valid for x > 0
    const lnX = x.map(xi => Math.log(xi));
    const sumLnX = lnX.reduce((a, b) => a + b, 0);
    const sumYLnX = lnX.reduce((a, b, i) => a + b * y[i], 0);
    const sumLnX2 = lnX.reduce((a, b) => a + b * b, 0);
    const b = (n * sumYLnX - sumLnX * sumY) / (n * sumLnX2 - sumLnX * sumLnX);
    const a = (sumY - b * sumLnX) / n;
    const logFitY = x.map(xi => a + b * Math.log(xi));
    // Calculate sum of squared errors for both fits
    const sseLinear = y.reduce((sum, yi, i) => sum + Math.pow(yi - fitY[i], 2), 0);
    const sseLog = y.reduce((sum, yi, i) => sum + Math.pow(yi - logFitY[i], 2), 0);
    // Choose best fit
    let bestFit, bestFitY, bestLabel, bestColor, bestEquation;
    if (sseLog < sseLinear) {
      bestFit = 'log';
      bestFitY = logFitY;
      bestLabel = 'Logarithmic Fit';
      bestColor = '#4a9ad4';
      bestEquation = `y = ${a.toFixed(3)} + ${b.toFixed(3)}·ln(x)`;
    } else {
      bestFit = 'linear';
      bestFitY = fitY;
      bestLabel = 'Linear Fit';
      bestColor = '#63d44a';
      bestEquation = `y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`;
    }
    return { x, y, bestFitY, bestLabel, bestColor, bestEquation };
  }

  // UI for each step
  let content;
  if (step < STEPS.length) {
    const { title, description, icon, color } = STEPS[step];
    content = (
      <Animated.View style={[styles.stepContainer, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: color }]}> 
          {/* Show checkmark animation OR icon, not both */}
          {showCheck ? (
            <Animated.View style={{
              transform: [{ scale: checkAnim }],
              opacity: checkAnim,
            }}>
              <Ionicons name="checkmark-circle" size={38} color="#63d44a" />
            </Animated.View>
          ) : (
            <Ionicons name={icon} size={38} color="#141414" />
          )}
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
        <View style={{ marginVertical: 30 }}>
          {!isRunning && !showCheck && !stepTransitioning ? (
            <TouchableOpacity style={[styles.startButton, { backgroundColor: '#63d44a' }]} onPress={handleStart}>
              <Ionicons name="play" size={22} color="#141414" />
              <Text style={styles.startButtonText}>Start</Text>
            </TouchableOpacity>
          ) : null}
          {isRunning && (
            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
              <Ionicons name="stop" size={22} color="#DFDCD9" />
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
        {results[step] && (
          <Text style={styles.resultText}>
            Last pour: {(results[step] / 1000).toFixed(2)} seconds
          </Text>
        )}
      </Animated.View>
    );
  } else {
    // Summary with graph
    const { x, y, bestFitY, bestLabel, bestColor, bestEquation } = getGraphData();
    const chartWidth = Math.min(Dimensions.get('window').width - 40, 400);
    content = (
      <Animated.View style={[styles.stepContainer, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: STEP_COLOR }]}> 
          {/* Show checkmark animation OR empty gold circle, not both */}
          {showCheck ? (
            <Animated.View style={{
              transform: [{ scale: checkAnim }],
              opacity: checkAnim,
            }}>
              <Ionicons name="checkmark-circle" size={38} color="#63d44a" />
            </Animated.View>
          ) : (
            <Ionicons name="checkmark-circle-outline" size={38} color={STEP_COLOR} />
          )}
        </View>
        <Text style={styles.stepTitle}>Calibration Complete!</Text>
        <Text style={styles.stepDescription}>
          Here are your results:
        </Text>
        <View style={{ backgroundColor: '#1F1F1F', borderRadius: 16, padding: 16, marginVertical: 8, alignSelf: 'center', width: '100%', maxWidth: 432 }}>
          <LineChart
            data={{
              labels: x.map(String),
              datasets: [
                { data: y, color: () => '#CE975E', strokeWidth: 3 }, // Data points
                { data: bestFitY, color: () => bestColor, strokeWidth: 2 }, // Best fit only
              ],
              // legend removed
            }}
            width={chartWidth - 32} // 16px padding on each side
            height={220}
            yAxisSuffix=" L/s"
            chartConfig={{
              backgroundColor: '#1F1F1F',
              backgroundGradientFrom: '#1F1F1F',
              backgroundGradientTo: '#1F1F1F',
              decimalPlaces: 3,
              color: (opacity = 1) => `rgba(206, 151, 94, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
              propsForDots: { r: '5', strokeWidth: '2', stroke: '#CE975E' },
              propsForBackgroundLines: { stroke: '#333' },
            }}
            bezier={false}
            style={{ borderRadius: 12, alignSelf: 'center' }}
          />
        </View>
        <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
          <Ionicons name="checkmark" size={22} color="#141414" />
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={28} color="#DFDCD9" />
      </TouchableOpacity>
      <Text style={styles.headerText}>Calibration Setup</Text>
      <View style={styles.content}>
      {/* Intro only on first step */}
      {step === 0 && !isRunning && (
        <Animated.View style={[styles.introBox, {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }]}
        >
          <Ionicons name="flask" size={32} color="#CE975E" style={{ marginBottom: 10 }} />
          <Text style={styles.introText}>
            Welcome to calibration!
          </Text>
          <Text style={{
            color: '#CE975E',
            fontSize: 16,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 12,
            marginTop: 2,
            backgroundColor: '#2a210f',
            borderRadius: 8,
            paddingVertical: 7,
            paddingHorizontal: 14,
            letterSpacing: 0.5,
            elevation: 2,
          }}>
            Please use a 1 cup (236.6 mL) measuring cup for calibration.
          </Text>
          <Text style={styles.instructions}>
            You will need a measuring cup. For each step, press Start, fill the cup, then press Stop. Repeat as prompted. This will help your device pour accurately.
          </Text>
        </Animated.View>
      )}
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 80, paddingHorizontal: 20 },
  backButton: { position: 'absolute', top: 40, left: 20, zIndex: 10 },
  headerText: { fontSize: 24, color: '#DFDCD9', fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  content: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  introBox: { marginBottom: 30, alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 12, padding: 18, width: '100%' },
  introText: { color: '#CE975E', fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  instructions: { color: '#DFDCD9', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  stepContainer: { alignItems: 'center', width: '100%', backgroundColor: '#1F1F1F', borderRadius: 12, padding: 18 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 18, marginTop: 5 },
  stepTitle: { color: '#CE975E', fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  stepDescription: { color: '#DFDCD9', fontSize: 16, textAlign: 'center' },
  startButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#63d44a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30, marginBottom: 10 },
  startButtonText: { color: '#141414', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  stopButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d44a4a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30, marginBottom: 10 },
  stopButtonText: { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  resultText: { color: '#CE975E', fontSize: 16, marginTop: 10, textAlign: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  finishButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#63d44a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30, marginTop: 30 },
  finishButtonText: { color: '#141414', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
});
