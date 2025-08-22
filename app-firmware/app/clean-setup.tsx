import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

// We mirror the calibration setup styling/structure to keep UX identical
// Infrastructure only: present three cleaning flows and placeholder pages

type Flow = 'menu' | 'quick' | 'custom' | 'deep' | 'summary';

const GOLD = '#CE975E';

export default function CleanSetup() {
  const router = useRouter();

  // flow: menu -> quick/custom/deep -> (later steps) -> summary
  const [flow, setFlow] = useState<Flow>('menu');
  const anim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [flow]);

  const Menu = (
    <Animated.View style={[styles.introBox, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }]}
    >
      <Ionicons name="water-outline" size={32} color={GOLD} style={{ marginBottom: 10 }} />
      <Text style={styles.introText}>Choose a cleaning mode</Text>
      <Text style={styles.instructions}>
        Pick the option that fits what you need right now. You can come back any time.
      </Text>

      {/* Quick Clean card */}
      <TouchableOpacity style={styles.modeCard} onPress={() => setFlow('quick')}>
        <View style={[styles.iconCircle, { backgroundColor: GOLD }]}>
          <Ionicons name="flash-outline" size={28} color="#141414" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.modeTitle}>Quick Clean</Text>
          <Text style={styles.modeDesc}>
            Use frequently for a fast rinse. No prep needed—no ingredient removal.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#DFDCD9" />
      </TouchableOpacity>

      {/* Custom Clean card */}
      <TouchableOpacity style={styles.modeCard} onPress={() => setFlow('custom')}>
        <View style={[styles.iconCircle, { backgroundColor: GOLD }]}>
          <Ionicons name="construct-outline" size={28} color="#141414" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.modeTitle}>Custom Clean</Text>
          <Text style={styles.modeDesc}>
            Target a specific line or ingredient. Clean one at a time when needed.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#DFDCD9" />
      </TouchableOpacity>

      {/* Deep Clean card */}
      <TouchableOpacity style={styles.modeCard} onPress={() => setFlow('deep')}>
        <View style={[styles.iconCircle, { backgroundColor: GOLD }]}>
          <Ionicons name="sparkles-outline" size={28} color="#141414" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.modeTitle}>Deep Clean</Text>
          <Text style={styles.modeDesc}>
            Full-system clean. Remove all ingredients first, then follow steps.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#DFDCD9" />
      </TouchableOpacity>
    </Animated.View>
  );

  const PlaceholderFlow = ({
    title,
    description,
    icon,
  }: { title: string; description: string; icon: any }) => (
    <Animated.View style={[styles.stepContainer, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
    }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: GOLD }]}> 
        <Ionicons name={icon} size={38} color="#141414" />
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>

      {/* Reserved space for future step controls, matching calibration layout */}
      <View style={{ marginVertical: 24, alignItems: 'center', width: '100%', minHeight: 120, justifyContent: 'center' }}>
        <Text style={{ color: GOLD, fontSize: 16, textAlign: 'center' }}>
          Step-by-step actions coming next.
        </Text>
      </View>

      <TouchableOpacity style={styles.finishButton} onPress={() => setFlow('menu')}>
        <Ionicons name="arrow-back" size={22} color="#141414" />
        <Text style={styles.finishButtonText}>Back to options</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  let content: React.ReactNode;
  if (flow === 'menu') {
    content = Menu;
  } else if (flow === 'quick') {
    content = (
      <PlaceholderFlow
        title="Quick Clean"
        description="A fast, one-and-done rinse that you can run often. No ingredient removal or extra setup required."
        icon="flash-outline"
      />
    );
  } else if (flow === 'custom') {
    content = (
      <PlaceholderFlow
        title="Custom Clean"
        description="Clean a specific line. Next steps will let you pick which slot/ingredient to rinse."
        icon="construct-outline"
      />
    );
  } else if (flow === 'deep') {
    content = (
      <PlaceholderFlow
        title="Deep Clean"
        description="Thoroughly clean every line. Make sure all bottles are removed before you begin."
        icon="sparkles-outline"
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with back button and centered title (mirrors calibration) */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#DFDCD9" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerText}>Clean Setup</Text>
        </View>
      </View>

      <View style={styles.content}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 80, paddingHorizontal: 20 },
  backButton: { position: 'absolute', left: 0, zIndex: 2, padding: 6, borderRadius: 20 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 30, justifyContent: 'center', position: 'relative', minHeight: 40,
  },
  headerTitleWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerText: { fontSize: 24, color: '#DFDCD9', fontWeight: 'bold', textAlign: 'center' },
  content: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },

  // mirrored from calibration styles
  introBox: { marginBottom: 30, alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 12, padding: 18, width: '100%' },
  introText: { color: GOLD, fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  instructions: { color: '#DFDCD9', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  stepContainer: { alignItems: 'center', width: '100%', backgroundColor: '#1F1F1F', borderRadius: 12, padding: 18 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 18, marginTop: 5 },
  stepTitle: { color: GOLD, fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  stepDescription: { color: '#DFDCD9', fontSize: 16, textAlign: 'center' },
  startButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#63d44a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30, marginBottom: 10 },
  startButtonText: { color: '#141414', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  stopButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d44a4a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30, marginBottom: 10 },
  stopButtonText: { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  resultText: { color: GOLD, fontSize: 16, marginTop: 10, textAlign: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  finishButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#63d44a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 30, marginTop: 30 },
  finishButtonText: { color: '#141414', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },

  // cards on menu
  modeCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14, marginTop: 10, borderWidth: 1, borderColor: '#2a2a2a'
  },
  modeTitle: { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modeDesc: { color: '#BDBDBD', fontSize: 14 },
});

