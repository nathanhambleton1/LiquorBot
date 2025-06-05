// -----------------------------------------------------------------------------
// File: device-settings.tsx          (REPLACEMENT – 27 May 2025)
// Purpose:  • Maintenance & slot-configuration
//           • “Connectivity” button navigates to /connectivity-settings
//           • Advanced-settings drop-down with Danger-Zone Wi-Fi disconnect
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, ScrollView, Modal,
  TextInput, FlatList, Platform, ActivityIndicator, Alert, Animated,
} from 'react-native';
import Ionicons          from '@expo/vector-icons/Ionicons';
import { useRouter }     from 'expo-router';
import { useLiquorBot }  from './components/liquorbot-provider';
import { getUrl }        from 'aws-amplify/storage';
import { Amplify }       from 'aws-amplify';
import config            from '../src/amplifyconfiguration.json';
import { PubSub }        from '@aws-amplify/pubsub';
Amplify.configure(config);
const pubsub = new PubSub({
  region   : 'us-east-1',
  endpoint : 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface Ingredient {
  id: number;
  name: string;
  type: 'Alcohol' | 'Mixer' | 'Sour' | 'Sweet' | 'Misc';
  description: string;
}

// -----------------------------------------------------------------------------
export default function DeviceSettings() {
  const router = useRouter();

  /*────────── LiquorBot context ──────────*/
  const {
    isAdmin,            // determines access
    isConnected,        // online/offline flag
    liquorbotId,        // 3-digit ID string
    setLiquorbotId,      // function to set the LiquorBot ID
  } = useLiquorBot();

  /*────────── State ──────────*/
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<{ title: string; message: string } | null>(null);
  const [isMaintenanceCollapsed, setIsMaintenanceCollapsed] = useState(true);
  const maintenanceRot = useState(new Animated.Value(0))[0];
  const [isAdvancedCollapsed, setIsAdvancedCollapsed] = useState(true);
  const advancedRot = useState(new Animated.Value(0))[0];
  const [slots, setSlots] = useState<number[]>(Array(15).fill(0));
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);

  /*────────── Redirect non-admins after first render ──────────
  useEffect(() => {
    if (isAdmin === false) router.replace('/');
  }, [isAdmin, router]);

  // Show blank screen while redirecting / until context resolves
  if (isAdmin === false) return null;

  /*────────── Animations ──────────*/
  const toggleMaintenance = () => {
    Animated.timing(maintenanceRot, {
      toValue: isMaintenanceCollapsed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setIsMaintenanceCollapsed(!isMaintenanceCollapsed);
  };
  const maintenanceRotate = maintenanceRot.interpolate({ inputRange:[0,1], outputRange:['0deg','180deg'] });

  const toggleAdvanced = () => {
    Animated.timing(advancedRot, {
      toValue: isAdvancedCollapsed ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setIsAdvancedCollapsed(!isAdvancedCollapsed);
  };
  const advancedRotate = advancedRot.interpolate({ inputRange:[0,1], outputRange:['0deg','180deg'] });

  /*────────── MQTT maintenance helpers ──────────*/
  const maintenanceTopic = `liquorbot/liquorbot${liquorbotId}/maintenance`;
  const publishMaintenance = async (msg:any) => {
    try { await pubsub.publish({ topics:[maintenanceTopic], message:msg }); }
    catch(e){ console.error('Maintenance publish error',e); }
  };
  const bumpIfDisconnected = (fn:()=>void) => {
    if (!isConnected) { Alert.alert('Connect to a device first'); return; }
    fn();
  };
  const handleReadySystem = () => publishMaintenance({ action:'READY_SYSTEM' });
  const handleEmptySystem = () => publishMaintenance({ action:'EMPTY_SYSTEM' });
  const handleDeepClean   = () => {
    Alert.alert(
      'Deep Clean',
      'All ingredient containers must be empty.\n\n' +
        'Place warm water in a spare container and attach it to Slot 1. Proceed with deep clean?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start',  style: 'destructive', onPress:()=>publishMaintenance({action:'DEEP_CLEAN'}) },
      ],
    );
  };

  /*────────── Wi-Fi DISCONNECT helper ──────────*/
  const confirmDisconnect = () => {
    Alert.alert(
      'Disconnect LiquorBot?',
      'Kicking LiquorBot off Wi-Fi will reboot it into Bluetooth pairing mode. You’ll have to re-enter Wi-Fi credentials afterwards. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive',
          onPress:()=>{ 
            publishMaintenance({action:'DISCONNECT_WIFI'}); 
            Alert.alert('Disconnecting…','LiquorBot is rebooting into Bluetooth mode.'); 
          } 
        },
      ],
    );
  };

  /*────────── Fetch ingredients list ──────────*/
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ingUrl = await getUrl({ key:'drinkMenu/ingredients.json' });
        const resp   = await fetch(ingUrl.url);
        const data   = await resp.json();
        data.sort((a:Ingredient,b:Ingredient)=>a.name.localeCompare(b.name));
        setIngredients(data);
      } catch (err) {
        console.error('S3 ingredients fetch error:',err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /*────────── Slot-config MQTT subscribe/publish ──────────*/
  const slotTopic = `liquorbot/liquorbot${liquorbotId}/slot-config`;
  const retryIntervalRef = useRef<NodeJS.Timeout|null>(null);
  const publishSlot = async (payload:any) => {
    try { await pubsub.publish({ topics:[slotTopic], message:payload }); }
    catch(err){ console.error('Slot publish error:',err); }
  };
  useEffect(() => {
    const sub = pubsub.subscribe({ topics:[slotTopic] }).subscribe({
      next:(d)=>{
        const msg = (d as any).value ?? d;
        if (msg.action==='CURRENT_CONFIG' && Array.isArray(msg.slots)) {
          setSlots(msg.slots.map((id:any)=>Number(id)||0));
          setConfigLoading(false);
          if (retryIntervalRef.current) { clearInterval(retryIntervalRef.current); retryIntervalRef.current=null; }
        }
        if (msg.action==='SET_SLOT' && typeof msg.slot==='number') {
          setSlots(prev=>{ const next=[...prev]; next[msg.slot-1]=Number(msg.ingredientId)||0; return next; });
        }
      },
      error:(err)=>console.error('slot-config sub error:',err),
    });
    if (isConnected) {
      fetchCurrentConfig();
      retryIntervalRef.current = setInterval(()=>publishSlot({action:'GET_CONFIG'}),1500);
    }
    return ()=>{
      sub.unsubscribe();
      if (retryIntervalRef.current) { clearInterval(retryIntervalRef.current); retryIntervalRef.current=null; }
    };
  },[isConnected, liquorbotId]); // eslint-disable-line react-hooks/exhaustive-deps
  const fetchCurrentConfig = () => { if (!isConnected) return; setConfigLoading(true); publishSlot({action:'GET_CONFIG'}); };
  const handleClearAll = () => bumpIfDisconnected(()=>{ publishSlot({action:'CLEAR_CONFIG'}); setSlots(Array(15).fill(0)); });
  const handleSetSlot = (idx:number,id:number) => publishSlot({action:'SET_SLOT',slot:idx+1,ingredientId:id});

  /*────────── Ingredient helpers ──────────*/
  const categories = ['All','Alcohol','Mixer','Sour','Sweet','Misc'];
  const filteredIngredients = ingredients
    .filter(i=>i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(i=>selectedCategory==='All'||i.type===selectedCategory);
  const ingName = (id:number|string)=>ingredients.find(i=>i.id===Number(id))?.name ?? '';

  /*────────── Components ──────────*/
  const AnimatedIngredientItem = ({ item,index,onPress }:{
    item:Ingredient; index:number; onPress:()=>void;
  })=>{
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(()=>{ Animated.spring(anim,{toValue:1,delay:index*50,useNativeDriver:true}).start(); },[]);
    return(
      <Animated.View style={{opacity:anim,transform:[{translateY:anim.interpolate({inputRange:[0,1],outputRange:[50,0]})}]}}>
        <TouchableOpacity style={styles.ingredientItem} onPress={onPress}>
          <Text style={styles.ingredientText}>{item.name}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const ActionRow = ({
    label,icon,onPress,info,onInfoPress,
  }:{
    label:string; icon:any; onPress:()=>void; info:string; onInfoPress:()=>void;
  })=>{
    const anim=useRef(new Animated.Value(1)).current;
    const pressIn = ()=>Animated.timing(anim,{toValue:0.97,duration:90,useNativeDriver:true}).start();
    const pressOut= ()=>Animated.timing(anim,{toValue:1,duration:90,useNativeDriver:true}).start();
    return(
      <Animated.View style={{transform:[{scale:anim}]}}>
        <TouchableOpacity style={styles.actionRow} activeOpacity={0.8}
          onPressIn={pressIn} onPressOut={pressOut} onPress={onPress}>
          <Ionicons name={icon} size={20} color="#CE975E" style={{marginRight:15}}/>
          <Text style={styles.actionLabel}>{label}</Text>
          <View style={{flex:1}}/>
          <TouchableOpacity onPress={onInfoPress}>
            <Ionicons name="information-circle-outline" size={20} color="#4F4F4F"/>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  /*────────── Render ──────────*/
  return(
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* close */}
        <TouchableOpacity style={styles.closeButton} onPress={()=>router.push('/')}>
          <Ionicons name="close" size={30} color="#DFDCD9"/>
        </TouchableOpacity>

        <Text style={styles.headerText}>Device Settings</Text>

        {/* connection box */}
        <TouchableOpacity
          style={styles.connectionBox}
          onPress={()=>router.push('/connectivity-settings' as any)}
          activeOpacity={0.6}
        >
          <View style={styles.bluetoothIconContainer}>
            <Ionicons name="bluetooth-outline" size={24} color="#DFDCD9"/>
          </View>
          <Text style={styles.liquorBotText}>LiquorBot</Text>
          <View style={styles.connectionStatusRow}>
            <View style={[styles.statusDot,{backgroundColor:isConnected?'#63d44a':'#d44a4a'}]}/>
            <Text style={styles.connectionStatusText}>{isConnected?'Connected':'Disconnected'}</Text>
          </View>
        </TouchableOpacity>

        {/* ─────────────────── MAINTENANCE ─────────────────── */}
        <View style={styles.maintenanceContainer}>
          <TouchableOpacity style={styles.maintenanceHeader} onPress={toggleMaintenance} activeOpacity={0.8}>
            <View style={{flexDirection:'column',flex:1}}>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                <Text style={styles.sectionHeader}>Maintenance</Text>
                <Animated.View style={{transform:[{rotate:maintenanceRotate}]}}>
                  <Ionicons name="chevron-down" size={20} color="#DFDCD9"/>
                </Animated.View>
              </View>
              {isMaintenanceCollapsed&&(
                <Text style={{fontSize:12,color:'#4F4F4F',marginTop:-10}}>Click to expand</Text>
              )}
            </View>
          </TouchableOpacity>

          {!isMaintenanceCollapsed&&(
            <Animated.View>
              <ActionRow
                label="Load Ingredients" icon="server"
                onPress={()=>bumpIfDisconnected(handleReadySystem)}
                info="Primes every tube so the first pour is instant."
                onInfoPress={()=>{setSelectedInfo({title:"Load Ingredients",message:"Primes every tube so the first pour is instant."});setInfoModalVisible(true);}}
              />
              <ActionRow
                label="Empty System" icon="server-outline"
                onPress={()=>bumpIfDisconnected(handleEmptySystem)}
                info="Pumps liquid back to its bottles for safe storage."
                onInfoPress={()=>{setSelectedInfo({title:"Empty System",message:"Pumps liquid back to its bottles for safe storage."});setInfoModalVisible(true);}}
              />
              <ActionRow
                label="Deep Clean" icon="water-outline"
                onPress={()=>bumpIfDisconnected(handleDeepClean)}
                info="Runs warm water through all tubes. Bottles must be empty."
                onInfoPress={()=>{setSelectedInfo({title:"Deep Clean",message:"Runs warm water through all tubes. Bottles must be empty."});setInfoModalVisible(true);}}
              />
            </Animated.View>
          )}
        </View>

        {/* ─────────────────── CONFIGURE SLOTS ─────────────────── */}
        <View style={styles.slotsContainer}>
          <View style={styles.slotsHeaderContainer}>
            <Text style={styles.sectionHeader}>Configure Slots</Text>
            <TouchableOpacity onPress={handleClearAll} disabled={!isConnected}>
              <Text style={[styles.clearAllButtonText,!isConnected&&{opacity:0.5}]}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {!isConnected&&(
            <Text style={styles.connectDeviceMessage}>Please connect a device to start configuring.</Text>
          )}

          {slots.map((ingredientId,idx)=>(
            <View key={idx} style={styles.slotRow}>
              <Text style={styles.slotLabel}>Slot {idx+1}</Text>
              <View style={styles.pickerButtonContainer}>
                <TouchableOpacity
                  style={[styles.pickerButton,!isConnected&&styles.pickerButtonDisconnected]}
                  onPress={()=>{
                    if(!isConnected){
                      setShowConnectPrompt(true);
                      setTimeout(()=>setShowConnectPrompt(false),2000);
                      return;
                    }
                    setSelectedSlot(idx); setModalVisible(true);
                  }}
                >
                  <Text style={[styles.pickerButtonText,ingName(ingredientId)&&styles.selectedPickerButtonText]}>
                    {ingName(ingredientId)||'Select Ingredient'}
                  </Text>
                </TouchableOpacity>
                {ingName(ingredientId)&&(
                  <TouchableOpacity
                    style={[styles.clearSlotOverlay,!isConnected&&styles.clearSlotOverlayDisabled]}
                    onPress={()=>isConnected&&handleSetSlot(idx,0)} disabled={!isConnected}
                  >
                    <Text style={styles.clearSlotOverlayText}>X</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* ─────────────────── ADVANCED SETTINGS / DANGER ZONE ─────────────────── */}
        {isConnected&&(
          <View style={styles.advancedContainer}>
            <TouchableOpacity style={styles.advancedHeader} onPress={toggleAdvanced} activeOpacity={0.8}>
              <View style={{flexDirection:'column',flex:1}}>
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                  <Text style={styles.sectionHeader}>Advanced Settings</Text>
                  <Animated.View style={{transform:[{rotate:advancedRotate}]}}>
                    <Ionicons name="chevron-down" size={20} color="#DFDCD9"/>
                  </Animated.View>
                </View>
                {isAdvancedCollapsed&&(
                  <Text style={{fontSize:12,color:'#4F4F4F',marginTop:-10}}>Click to expand</Text>
                )}
              </View>
            </TouchableOpacity>

            {!isAdvancedCollapsed&&(
              <View style={styles.dangerZoneContainer}>
                <Text style={styles.dangerZoneHeader}>Danger Zone</Text>
                {/* Disconnect from Device button */}
                <TouchableOpacity style={styles.disconnectButton} onPress={() => {
                  setLiquorbotId('000');
                  Alert.alert('Disconnected', 'You have disconnected from the device.');
                }}>
                  <Text style={styles.disconnectButtonText}>Disconnect from Device</Text>
                </TouchableOpacity>
                {/* Disconnect from Wi-Fi button */}
                <TouchableOpacity style={styles.disconnectButton} onPress={()=>confirmDisconnect()}>
                  <Text style={styles.disconnectButtonText}>Disconnect from Wi-Fi</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {showConnectPrompt&&(
          <View style={styles.connectPrompt}>
            <Text style={styles.connectPromptText}>Please connect a device first</Text>
          </View>
        )}
      </ScrollView>

      {/*────────── Info Modal (maintenance row details) ──────────*/}
      <Modal visible={infoModalVisible} transparent animationType="fade" onRequestClose={()=>setInfoModalVisible(false)}>
        <View style={styles.infoModalContainer}>
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalTitle}>{selectedInfo?.title}</Text>
            <Text style={styles.infoModalText}>{selectedInfo?.message}</Text>
            <TouchableOpacity style={styles.infoModalButton} onPress={()=>setInfoModalVisible(false)}>
              <Text style={styles.infoModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/*────────── Ingredient Selection Modal ──────────*/}
      <Modal
        visible={modalVisible} animationType="slide" transparent={false}
        presentationStyle={Platform.OS==='ios'?'pageSheet':'fullScreen'}
        onRequestClose={()=>setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={()=>setModalVisible(false)}>
            <Ionicons name="chevron-down" size={30} color="#DFDCD9"/>
          </TouchableOpacity>
          <Text style={styles.modalHeaderText}>Select Ingredient</Text>

          {/* category selector */}
          <View style={styles.horizontalPickerContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalPicker}>
              {categories.map(category=>(
                <TouchableOpacity key={category} onPress={()=>setSelectedCategory(category)} style={styles.categoryButton}>
                  <View style={styles.categoryButtonContent}>
                    <Text style={[styles.categoryButtonText,selectedCategory===category&&styles.selectedCategoryText]}>{category}</Text>
                    {selectedCategory===category&&<View style={styles.underline}/>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* search */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color="#4F4F4F" style={styles.searchIcon}/>
            <TextInput
              style={styles.searchBar} placeholder="Search Ingredients" placeholderTextColor="#4F4F4F"
              value={searchQuery} onChangeText={setSearchQuery}
            />
          </View>

          {/* ingredient list */}
          {loading?(
            <Text style={{color:'#DFDCD9',textAlign:'center',margin:10}}>Loading ingredients...</Text>
          ):(
            <FlatList
              data={filteredIngredients} keyExtractor={i=>String(i.id)}
              renderItem={({item,index})=>(
                <AnimatedIngredientItem item={item} index={index} onPress={()=>{handleSetSlot(selectedSlot!,item.id); setModalVisible(false); setSearchQuery('');}}/>
              )}
            />
          )}
        </View>
      </Modal>

      {configLoading&&(
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#CE975E"/>
        </View>
      )}
    </View>
  );
}

/*────────────────── Styles ──────────────────*/
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#141414'},
  closeButton:{position:'absolute',top:70,left:25,zIndex:1001},
  headerText:{position:'absolute',top:70,alignSelf:'center',fontSize:24,color:'#FFFFFF',fontWeight:'bold'},
  scrollContainer:{paddingTop:130,paddingHorizontal:20,paddingBottom:20},

  connectionBox:{backgroundColor:'#1F1F1F',borderRadius:10,padding:20,marginBottom:20,alignItems:'center',minHeight:100},
  liquorBotText:{fontSize:24,color:'#DFDCD9',fontWeight:'bold',textAlign:'left',width:'100%'},
  connectionStatusRow:{flexDirection:'row',alignItems:'center',marginTop:5},
  statusDot:{width:6,height:6,borderRadius:3,marginRight:5,marginTop:5},
  connectionStatusText:{fontSize:14,color:'#4F4F4F',textAlign:'left',width:'100%',marginTop:5},
  bluetoothIconContainer:{position:'absolute',top:20,right:20,zIndex:999,padding:10},

  maintenanceContainer:{backgroundColor:'#1F1F1F',borderRadius:10,padding:20,marginBottom:20},
  sectionHeader:{color:'#DFDCD9',fontSize:20,fontWeight:'bold',marginBottom:15},
  maintenanceHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  actionRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#141414',borderRadius:10,paddingVertical:12,paddingHorizontal:15,marginBottom:10},
  actionLabel:{color:'#DFDCD9',fontSize:16},

  slotsContainer:{backgroundColor:'#1F1F1F',borderRadius:10,padding:20},
  slotsHeaderContainer:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},
  connectDeviceMessage:{color:'#d44a4a',fontSize:12,textAlign:'center',marginBottom:25},
  slotRow:{flexDirection:'row',alignItems:'center',marginBottom:15},
  slotLabel:{color:'#DFDCD9',fontSize:16,marginRight:10,width:80},
  pickerButtonContainer:{flex:1,position:'relative'},
  pickerButton:{flex:1,backgroundColor:'#141414',borderRadius:10,paddingVertical:10,paddingHorizontal:15,borderWidth:1,borderColor:'transparent'},
  pickerButtonDisconnected:{borderColor:'#d44a4a'},
  pickerButtonText:{color:'#4f4f4f',fontSize:16},
  selectedPickerButtonText:{color:'#dfdcd9'},
  clearSlotOverlay:{position:'absolute',top:6,right:10,padding:5},
  clearSlotOverlayDisabled:{opacity:0.5},
  clearSlotOverlayText:{color:'#808080',fontSize:14,fontWeight:'bold'},

  /* advanced settings / danger zone */
  advancedContainer:{backgroundColor:'#1F1F1F',borderRadius:10,padding:20,marginTop:20,marginBottom:20},
  advancedHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  dangerZoneContainer:{marginTop:15,padding:15,borderWidth:1,borderColor:'#d44a4a',borderRadius:10},
  dangerZoneHeader:{color:'#d44a4a',fontSize:16,fontWeight:'bold',marginBottom:10,textAlign:'center'},
  disconnectButton:{backgroundColor:'#d44a4a',borderRadius:10,paddingVertical:12,alignItems:'center'},
  disconnectButtonText:{color:'#DFDCD9',fontSize:16,fontWeight:'bold'},

  connectPrompt:{position:'absolute',bottom:20,alignSelf:'center',backgroundColor:'#1F1F1F',paddingVertical:10,paddingHorizontal:20,borderRadius:10,borderWidth:1,borderColor:'#CE975E'},
  connectPromptText:{color:'#DFDCD9',fontSize:14,textAlign:'center'},
  clearAllButtonText:{color:'#4F4F4F',fontSize:14,fontWeight:'bold'},

  /* ingredient modal */
  modalContainer:{flex:1,backgroundColor:'#141414',padding:20},
  modalCloseButton:{position:'absolute',top:30,left:20,zIndex:10},
  modalHeaderText:{fontSize:20,fontWeight:'bold',color:'#DFDCD9',textAlign:'center',marginTop:10,marginBottom:-20},
  horizontalPickerContainer:{alignItems:'center',paddingVertical:5},
  horizontalPicker:{flexDirection:'row',alignItems:'center'},
  categoryButton:{marginTop:40,paddingVertical:10,paddingHorizontal:5,marginHorizontal:15},
  categoryButtonContent:{alignItems:'center'},
  categoryButtonText:{color:'#4F4F4F',fontSize:14},
  selectedCategoryText:{color:'#CE975E'},
  underline:{height:2,backgroundColor:'#CE975E',marginTop:2,width:'100%'},
  searchBarContainer:{flexDirection:'row',alignItems:'center',backgroundColor:'#1F1F1F',borderRadius:10,paddingHorizontal:15,marginBottom:15,marginTop:10},
  searchIcon:{marginRight:10},
  searchBar:{flex:1,color:'#DFDCD9',fontSize:16,paddingVertical:10,backgroundColor:'#1F1F1F',borderRadius:10,paddingHorizontal:15},
  ingredientItem:{paddingVertical:15,borderBottomWidth:1,borderBottomColor:'#333333'},
  ingredientText:{color:'#DFDCD9',fontSize:16},

  /* info modal */
  infoModalContainer:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(0,0,0,0.5)'},
  infoModalContent:{backgroundColor:'#1F1F1F',borderRadius:15,padding:20,width:'80%'},
  infoModalTitle:{color:'#CE975E',fontSize:18,fontWeight:'bold',marginBottom:10},
  infoModalText:{color:'#DFDCD9',fontSize:14,lineHeight:20,marginBottom:20},
  infoModalButton:{backgroundColor:'#CE975E',borderRadius:8,paddingVertical:12,alignItems:'center'},
  infoModalButtonText:{color:'#141414',fontWeight:'bold'},

  loadingOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center',zIndex:1000},
});
