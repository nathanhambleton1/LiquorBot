import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLiquorBot } from './components/liquorbot-provider';

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
        <View style={styles.modeInner}>
          <Ionicons name="flash-outline" size={28} color={GOLD} style={styles.modeIcon} />
          <View style={styles.modeTextWrap}>
            <Text style={styles.modeTitle}>Quick Clean</Text>
            <Text style={styles.modeDesc}>
              Use frequently for a fast rinse. No prep needed—no ingredient removal.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#8C8C8C" />
        </View>
      </TouchableOpacity>

      {/* Custom Clean card */}
      <TouchableOpacity style={styles.modeCard} onPress={() => setFlow('custom')}>
        <View style={styles.modeInner}>
          <Ionicons name="construct-outline" size={28} color={GOLD} style={styles.modeIcon} />
          <View style={styles.modeTextWrap}>
            <Text style={styles.modeTitle}>Custom Clean</Text>
            <Text style={styles.modeDesc}>
              Target a specific line or ingredient. Clean one at a time when needed.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#8C8C8C" />
        </View>
      </TouchableOpacity>

      {/* Deep Clean card */}
      <TouchableOpacity style={styles.modeCard} onPress={() => setFlow('deep')}>
        <View style={styles.modeInner}>
          <Ionicons name="sparkles-outline" size={28} color={GOLD} style={styles.modeIcon} />
          <View style={styles.modeTextWrap}>
            <Text style={styles.modeTitle}>Deep Clean</Text>
            <Text style={styles.modeDesc}>
              Full-system clean. Remove all ingredients first, then follow steps.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#8C8C8C" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  // ───────────────── Quick Clean Flow ─────────────────
  const { isConnected, liquorbotId, pubsub } = useLiquorBot();
  const [qcCleaning, setQcCleaning] = useState(false);
  const [qcDone, setQcDone] = useState(false);
  const [qcError, setQcError] = useState<string | null>(null);

  React.useEffect(() => {
    if (flow !== 'quick' || liquorbotId === '000') return;
    const topic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
    const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
      next: (d: any) => {
        try {
          const raw = (d && d.value) ? d.value : d;
          const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!msg) return;
          // Treat several possible OK shapes
          const action = msg.action || msg.type;
          const status = msg.status;
          const mode = msg.mode || msg.context;
          const isQuick = action === 'QUICK_CLEAN' || mode === 'QUICK_CLEAN';
          const isOk = action === 'QUICK_CLEAN_OK' || action === 'QUICK_CLEAN_DONE' || status === 'OK' || msg.ok === true;
          if (qcCleaning && (isQuick || action === 'OK')) {
            if (isOk) {
              setQcCleaning(false);
              setQcDone(true);
              setQcError(null);
            }
          }
        } catch {
          /* ignore parse issues */
        }
      },
      error: () => {
        if (qcCleaning) setQcError('Lost connection during clean');
        setQcCleaning(false);
      }
    });
    return () => sub.unsubscribe();
  }, [flow, liquorbotId, pubsub, qcCleaning]);

  const startQuickClean = async () => {
    setQcError(null);
    setQcDone(false);
    setQcCleaning(true);
    const topic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
    try {
      await pubsub.publish({ topics: [topic], message: { action: 'QUICK_CLEAN' } });
    } catch (e) {
      setQcCleaning(false);
      setQcError('Failed to start clean');
    }
  };

  const QuickCleanContent = (
    <Animated.View style={[styles.stepContainer, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
    }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: GOLD }]}> 
        <Ionicons name="flash-outline" size={38} color="#141414" />
      </View>
      <Text style={styles.stepTitle}>Quick Clean</Text>
      <Text style={styles.stepDescription}>
        Runs a fast rinse through the main tubes to remove residue. Place a cup under the output spout. Ensure the trash/output container has room and the water source is filled enough to run this clean.
      </Text>

      {/* Status / Spinner */}
      <View style={{ marginTop: 16, alignItems: 'center', minHeight: 52 }}>
        {qcCleaning ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={GOLD} />
            <Text style={{ color: GOLD, marginLeft: 10, fontSize: 16 }}>Cleaning…</Text>
          </View>
        ) : qcDone ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={22} color="#63d44a" />
            <Text style={{ color: '#63d44a', marginLeft: 8, fontSize: 16 }}>Done</Text>
          </View>
        ) : qcError ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="alert-circle" size={20} color="#d44a4a" />
            <Text style={{ color: '#d44a4a', marginLeft: 8, fontSize: 16 }}>{qcError}</Text>
          </View>
        ) : null}
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.secondaryBtn, (qcCleaning) && { opacity: 0.5 }]}
          disabled={qcCleaning}
          onPress={() => setFlow('menu')}
        >
          <Ionicons name="arrow-back" size={18} color="#DFDCD9" />
          <Text style={styles.secondaryBtnText}>Back to options</Text>
        </TouchableOpacity>
        {!qcDone && (
          <TouchableOpacity
            style={[styles.primaryBtn, (!isConnected || liquorbotId === '000' || qcCleaning) && { opacity: 0.5 }]}
            disabled={!isConnected || liquorbotId === '000' || qcCleaning}
            onPress={startQuickClean}
          >
            <Ionicons name="play" size={18} color="#141414" />
            <Text style={styles.primaryBtnText}>Start clean</Text>
          </TouchableOpacity>
        )}
      </View>
      {!isConnected && (
        <Text style={{ color: '#d44a4a', marginTop: 8 }}>Connect to a device to start.</Text>
      )}
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
  content = QuickCleanContent;
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
    width: '100%', backgroundColor: '#141414', borderRadius: 12, padding: 10, marginTop: 12, borderWidth: 1,
    borderColor: '#2a2a2a'
  },
  modeInner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1C', borderRadius: 10, paddingVertical: 14,
    paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a'
  },
  modeIcon: { marginRight: 14 },
  modeTextWrap: { flex: 1 },
  modeTitle: { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modeDesc: { color: '#BDBDBD', fontSize: 14 },

  // button row for quick clean
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 18 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: '#333'
  },
  secondaryBtnText: { color: '#DFDCD9', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#63d44a', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 18
  },
  primaryBtnText: { color: '#141414', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});

