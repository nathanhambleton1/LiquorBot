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
  const { isConnected, liquorbotId, pubsub, slotCount } = useLiquorBot();
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
        {qcDone ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="checkmark" size={18} color="#141414" />
            <Text style={styles.primaryBtnText}>Finish</Text>
          </TouchableOpacity>
        ) : (
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

  // ───────────────── Custom Clean Flow (TOP-LEVEL HOOKS) ─────────────────
  const [customSelSlot, setCustomSelSlot] = useState<number | null>(null); // 1-based
  // Simplified to single step; retain phase for backend compatibility but keep at 1
  const [customPhase, setCustomPhase] = useState<1 | 2>(1);
  const [customRunning, setCustomRunning] = useState(false);
  const [customAwaitingOk, setCustomAwaitingOk] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customHasStarted, setCustomHasStarted] = useState(false); // determines Start vs Resume label

  React.useEffect(() => {
    if (flow !== 'custom' || liquorbotId === '000') return;
    const topic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
    const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
      next: (d: any) => {
        try {
          const raw = d?.value ?? d;
          const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!msg) return;
          const action = msg.action || msg.type;
          const status = msg.status;
          const slot = Number(msg.slot ?? msg.line ?? msg.channel ?? -1);
          const isForUs = customSelSlot !== null ? slot === customSelSlot || slot === -1 : true;
          const isCustom = action?.includes('CUSTOM_CLEAN') || msg.mode === 'CUSTOM_CLEAN' || msg.context === 'CUSTOM_CLEAN';
          const isOk = action === 'CUSTOM_CLEAN_OK' || action === 'OK' || status === 'OK' || msg.ok === true;
          if (isForUs && isCustom && isOk) {
            if (customAwaitingOk) setCustomAwaitingOk(false);
          }
        } catch {}
      },
      error: () => {
        if (customRunning || customAwaitingOk) setCustomError('Connection lost during clean');
        setCustomRunning(false);
        setCustomAwaitingOk(false);
      }
    });
    return () => sub.unsubscribe();
  }, [flow, liquorbotId, pubsub, customSelSlot, customRunning, customAwaitingOk]);

  const publishCustom = async (op: 'START' | 'STOP' | 'RESUME') => {
    if (customSelSlot == null) return;
    setCustomError(null);
    const topic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
    try {
      await pubsub.publish({ topics: [topic], message: { action: 'CUSTOM_CLEAN', slot: customSelSlot, op, phase: customPhase } });
    } catch {
      setCustomError('Failed to send command');
    }
  };

  const onCustomStart = async () => {
    setCustomRunning(true);
    setCustomHasStarted(true);
    await publishCustom('START');
  };
  const onCustomStop = async () => {
    setCustomAwaitingOk(true);
    await publishCustom('STOP');
    setCustomRunning(false);
  };
  const onCustomResume = async () => {
    // Deprecated in UI; kept for compatibility if referenced elsewhere
    setCustomRunning(true);
    await publishCustom('RESUME');
  };
  const onCustomRedo = async () => {
    // Redo/Restart the custom clean from the beginning (same as START)
    setCustomRunning(true);
    await publishCustom('START');
  };
  const onCustomFinish = () => {
    setCustomSelSlot(null);
    setCustomPhase(1);
    setCustomRunning(false);
    setCustomAwaitingOk(false);
    setCustomError(null);
  setCustomHasStarted(false);
  // Navigate back to device settings (same as header back)
  router.back();
  };

  // ───────────────── Deep Clean Flow (TOP-LEVEL HOOKS) ─────────────────
  const [deepActive, setDeepActive] = useState(false);
  const [deepStep, setDeepStep] = useState(1); // 1..slotCount then final
  const [deepRunning, setDeepRunning] = useState(false);
  const [deepAwaiting, setDeepAwaiting] = useState<null | 'start' | 'stop' | 'final'>(null);
  const [deepCanContinue, setDeepCanContinue] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  React.useEffect(() => {
    if (flow !== 'deep' || liquorbotId === '000') return;
    const topic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
    const sub = pubsub.subscribe({ topics: [topic] }).subscribe({
      next: (d: any) => {
        try {
          const raw = d?.value ?? d;
          const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!msg) return;
          const action = msg.action || msg.type || '';
          const status = msg.status;
          const mode = msg.mode || msg.context || '';
          const isDeep = action.includes('DEEP_CLEAN') || mode === 'DEEP_CLEAN' || mode === 'DEEP_CLEAN_FINAL' || action.includes('FINAL');
          const isOk = action === 'DEEP_CLEAN_OK' || action === 'DEEP_CLEAN_DONE' || action === 'OK' || status === 'OK' || msg.ok === true;
          if (!isDeep || !isOk) return;
          if (deepAwaiting === 'start') {
            setDeepAwaiting(null);
            setDeepRunning(true);
            setDeepError(null);
          } else if (deepAwaiting === 'stop') {
            setDeepAwaiting(null);
            setDeepRunning(false);
            setDeepCanContinue(true);
            setDeepError(null);
          } else if (deepAwaiting === 'final') {
            setDeepAwaiting(null);
            setDeepError(null);
            setDeepCanContinue(true);
          }
        } catch {/* ignore */}
      },
      error: () => {
        if (deepAwaiting || deepRunning) setDeepError('Connection lost during clean');
        setDeepRunning(false);
        setDeepAwaiting(null);
      }
    });
    return () => sub.unsubscribe();
  }, [flow, liquorbotId, pubsub, deepAwaiting, deepRunning]);

  const publishDeep = async (message: any) => {
    setDeepError(null);
    const topic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
    try { await pubsub.publish({ topics: [topic], message }); }
    catch { setDeepError('Failed to send command'); }
  };

  const startDeepStep = async () => {
    setDeepAwaiting('start');
    setDeepCanContinue(false);
    await publishDeep({ action: 'DEEP_CLEAN', slot: deepStep, op: 'START' });
  };
  const stopDeepStep = async () => {
    setDeepAwaiting('stop');
    await publishDeep({ action: 'DEEP_CLEAN', slot: deepStep, op: 'STOP' });
  };
  const redoDeepStep = async () => {
    setDeepAwaiting('start');
    setDeepCanContinue(false);
    await publishDeep({ action: 'DEEP_CLEAN', slot: deepStep, op: 'START' });
  };
  const continueDeepStep = (totalSlots: number) => {
    if (deepStep < totalSlots) {
      setDeepStep(deepStep + 1);
      setDeepRunning(false);
      setDeepAwaiting(null);
      setDeepCanContinue(false);
      setDeepError(null);
    } else {
      setDeepStep(totalSlots + 1); // go to final page
      setDeepRunning(false);
      setDeepAwaiting(null);
      setDeepCanContinue(false);
      setDeepError(null);
    }
  };
  const startFinalDeep = async () => {
    setDeepAwaiting('final');
    await publishDeep({ action: 'DEEP_CLEAN_FINAL', op: 'START' });
  };

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
  // Combined single-step instructions

    content = (
      <Animated.View style={[styles.stepContainer, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
      }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: GOLD }]}> 
          <Ionicons name="construct-outline" size={38} color="#141414" />
        </View>
        <Text style={styles.stepTitle}>Custom Clean</Text>

        {/* Slot picker */}
        {customSelSlot == null ? (
          <>
            <Text style={[styles.stepDescription, { marginBottom: 10 }]}>Choose which ingredient to clean.</Text>
            <View style={styles.slotGrid}>
              {Array.from({ length: Math.max(1, slotCount || 12) }).map((_, i) => {
                const n = i + 1;
                return (
                  <TouchableOpacity key={n} style={styles.slotChip} onPress={() => setCustomSelSlot(n)}>
                    <Text style={styles.slotChipText}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setFlow('menu')}
              >
                <Ionicons name="arrow-back" size={18} color="#DFDCD9" />
                <Text style={styles.secondaryBtnText}>Back to options</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.stepDescription, { marginBottom: 6 }]}>Selected line: {customSelSlot}</Text>
            <Text style={styles.stepDescription}>
              Empty the bottle for this line. Fill with warm soapy water or a food-safe cleaner and place a container at the spout to catch all fluid. Tap Start to flush. When you Stop, you can refill with clean water and tap Redo to rinse any residue.
            </Text>

            {/* Status */}
            <View style={{ marginTop: 14, alignItems: 'center', minHeight: 24 }}>
              {customAwaitingOk ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={GOLD} />
                  <Text style={{ color: GOLD, marginLeft: 8 }}>Finishing up…</Text>
                </View>
              ) : customError ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="alert-circle" size={18} color="#d44a4a" />
                  <Text style={{ color: '#d44a4a', marginLeft: 8 }}>{customError}</Text>
                </View>
              ) : null}
            </View>

            {/* Controls */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, (customRunning || customAwaitingOk) && { opacity: 0.5 }]}
                disabled={customRunning || customAwaitingOk}
                onPress={() => { setCustomSelSlot(null); setCustomHasStarted(false); }}
              >
                <Ionicons name="arrow-back" size={18} color="#DFDCD9" />
                <Text style={styles.secondaryBtnText}>Change line</Text>
              </TouchableOpacity>
        {!customRunning ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, (!isConnected || liquorbotId === '000' || customAwaitingOk) && { opacity: 0.5 }]}
                  disabled={!isConnected || liquorbotId === '000' || customAwaitingOk}
                  onPress={!customHasStarted && !customAwaitingOk ? onCustomStart : onCustomRedo}
                >
                  <Ionicons name={customHasStarted ? 'refresh' : 'play'} size={18} color="#141414" />
                  <Text style={styles.primaryBtnText}>{customAwaitingOk ? 'Please wait' : (customHasStarted ? 'Redo' : 'Start clean')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtnDanger]}
                  onPress={onCustomStop}
                >
                  <Ionicons name="pause" size={18} color="#141414" />
                  <Text style={styles.primaryBtnText}>Stop</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Finish action */}
            {customHasStarted && !customRunning && !customAwaitingOk && (
              <View style={{ width: '100%', marginTop: 12 }}>
                <TouchableOpacity style={styles.advanceBtn} onPress={onCustomFinish}>
                  <Ionicons name="checkmark" size={18} color={GOLD} />
                  <Text style={styles.advanceBtnText}>Finish</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isConnected && (
              <Text style={{ color: '#d44a4a', marginTop: 8 }}>Connect to a device to start.</Text>
            )}
          </>
        )}
      </Animated.View>
    );
  } else if (flow === 'deep') {
  const total = Math.max(1, slotCount || 12);

    // Intro before starting
    if (!deepActive) {
      content = (
        <Animated.View style={[styles.stepContainer, {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: GOLD }]}> 
            <Ionicons name="sparkles-outline" size={38} color="#141414" />
          </View>
          <Text style={styles.stepTitle}>Deep Clean</Text>
          <Text style={styles.stepDescription}>
            You’ll clean each line one-by-one. Remove all ingredients. For each line, fill the bottle with warm soapy water or food-safe cleaner and place a large container at the spout. After stopping, it’s recommended to redo with clean water to rinse.
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, (!isConnected || liquorbotId === '000') && { opacity: 0.5 }]}
              disabled={!isConnected || liquorbotId === '000'}
              onPress={() => setFlow('menu')}
            >
              <Ionicons name="arrow-back" size={18} color="#DFDCD9" />
              <Text style={styles.secondaryBtnText}>Back to options</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, (!isConnected || liquorbotId === '000') && { opacity: 0.5 }]}
              disabled={!isConnected || liquorbotId === '000'}
              onPress={() => { setDeepActive(true); setDeepStep(1); }}
            >
              <Ionicons name="play" size={18} color="#141414" />
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
          {!isConnected && (
            <Text style={{ color: '#d44a4a', marginTop: 8 }}>Connect to a device to start.</Text>
          )}
        </Animated.View>
      );
    } else if (deepStep <= total) {
      // Step page
      content = (
        <Animated.View style={[styles.stepContainer, {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: GOLD }]}> 
            <Ionicons name="sparkles-outline" size={38} color="#141414" />
          </View>
          <Text style={styles.stepTitle}>Deep Clean — Ingredient {deepStep} / {total}</Text>
          <Text style={[styles.stepDescription, { marginTop: 6 }]}>
            Empty bottle {deepStep}. Fill with warm soapy water or food-safe cleaner. Place a container at the spout to catch all fluid. Start to flush, Stop when done. It’s recommended to redo with clean water to rinse before continuing.
          </Text>

          {/* Status */}
          <View style={{ marginTop: 14, alignItems: 'center', minHeight: 24 }}>
            {deepAwaiting === 'start' && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={GOLD} />
                <Text style={{ color: GOLD, marginLeft: 8 }}>Starting…</Text>
              </View>
            )}
            {deepAwaiting === 'stop' && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={GOLD} />
                <Text style={{ color: GOLD, marginLeft: 8 }}>Stopping…</Text>
              </View>
            )}
            {deepError && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="alert-circle" size={18} color="#d44a4a" />
                <Text style={{ color: '#d44a4a', marginLeft: 8 }}>{deepError}</Text>
              </View>
            )}
          </View>

          {/* Controls */}
          <View style={styles.buttonRow}>
            {/* Back to options is hidden during the sequence */}
            {!deepRunning && !deepCanContinue && (
              <TouchableOpacity
                style={[styles.primaryBtn, (!isConnected || liquorbotId === '000' || deepAwaiting !== null) && { opacity: 0.5 }]}
                disabled={!isConnected || liquorbotId === '000' || deepAwaiting !== null}
                onPress={startDeepStep}
              >
                <Ionicons name="play" size={18} color="#141414" />
                <Text style={styles.primaryBtnText}>Start</Text>
              </TouchableOpacity>
            )}
            {deepRunning && (
              <TouchableOpacity style={styles.primaryBtnDanger} onPress={stopDeepStep}>
                <Ionicons name="stop" size={18} color="#141414" />
                <Text style={styles.primaryBtnText}>Stop</Text>
              </TouchableOpacity>
            )}
            {!deepRunning && deepCanContinue && (
              <>
                <TouchableOpacity style={styles.secondaryBtn} onPress={redoDeepStep}>
                  <Ionicons name="refresh" size={18} color="#DFDCD9" />
                  <Text style={styles.secondaryBtnText}>Redo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => continueDeepStep(total)}>
                  <Ionicons name="arrow-forward" size={18} color="#141414" />
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      );
    } else {
      // Final clean page
      content = (
        <Animated.View style={[styles.stepContainer, {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: GOLD }]}> 
            <Ionicons name="sparkles-outline" size={38} color="#141414" />
          </View>
          <Text style={styles.stepTitle}>Final Clean</Text>
          <Text style={styles.stepDescription}>
            Run a final system flush. Ensure the water source is filled and there’s room at the output container. This runs automatically to finish the deep clean.
          </Text>
          <View style={{ marginTop: 14, alignItems: 'center', minHeight: 24 }}>
            {deepAwaiting === 'final' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={GOLD} />
                <Text style={{ color: GOLD, marginLeft: 8 }}>Final cleaning… finishing up</Text>
              </View>
            ) : deepCanContinue ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="checkmark-circle" size={20} color="#63d44a" />
                <Text style={{ color: '#63d44a', marginLeft: 8 }}>Done</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.buttonRow}>
      {!deepAwaiting && !deepCanContinue && (
              <TouchableOpacity
                style={[styles.primaryBtn, (!isConnected || liquorbotId === '000') && { opacity: 0.5 }]}
                disabled={!isConnected || liquorbotId === '000'}
        onPress={startFinalDeep}
              >
                <Ionicons name="play" size={18} color="#141414" />
                <Text style={styles.primaryBtnText}>Start final clean</Text>
              </TouchableOpacity>
            )}
            {deepCanContinue && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.back()}
              >
                <Ionicons name="checkmark" size={18} color="#141414" />
                <Text style={styles.primaryBtnText}>Finish</Text>
              </TouchableOpacity>
            )}
          </View>
          {!isConnected && (
            <Text style={{ color: '#d44a4a', marginTop: 8 }}>Connect to a device to start.</Text>
          )}
        </Animated.View>
      );
    }
  }

  return (
    <View style={styles.container}>
      {/* Header with back button and centered title (mirrors calibration) */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={async () => {
            // If a Custom Clean is actively running, stop it before leaving
            if (flow === 'custom' && customRunning) {
              await onCustomStop();
            }
            router.back();
          }}
        >
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
  primaryBtnDanger: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#d44a4a', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 18
  },

  // custom clean slot picker
  slotGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  slotChip: {
    width: 56, height: 40, borderRadius: 10, backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center'
  },
  slotChipText: { color: '#DFDCD9', fontSize: 16, fontWeight: 'bold' },

  // advance actions
  advanceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: GOLD, paddingVertical: 10 },
  advanceBtnText: { color: GOLD, fontSize: 16, fontWeight: 'bold', marginLeft: 8, textAlign: 'center' },
});

