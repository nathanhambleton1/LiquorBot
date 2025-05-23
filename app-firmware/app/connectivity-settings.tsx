// -----------------------------------------------------------------------------
// File: connectivity-settings.tsx     (NEW – 23 May 2025)
// Purpose:  • Scan & connect to LiquorBot BLE peripherals
//           • Prompt for Wi-Fi SSID / password and transmit over BLE
//           • Shows live connection status
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, FlatList, Modal,
  PermissionsAndroid, Platform, ActivityIndicator, TextInput, Alert, Animated,
} from 'react-native';
import Ionicons        from '@expo/vector-icons/Ionicons';
import { BleManager }  from 'react-native-ble-plx';
import { Buffer }      from 'buffer';
import { useRouter }   from 'expo-router';
import { useLiquorBot }from './components/liquorbot-provider';

// BLE Service & Char UUIDs ----------------------------------------------------
const SERVICE_UUID   ='e0be0301-718e-4700-8f55-a24d6160db08';
const SSID_CHAR_UUID ='e0be0302-718e-4700-8f55-a24d6160db08';
const PASS_CHAR_UUID ='e0be0303-718e-4700-8f55-a24d6160db08';
(global as any).Buffer = (global as any).Buffer || Buffer;

// -----------------------------------------------------------------------------
interface BluetoothDevice{ id:string; name:string }

// -----------------------------------------------------------------------------
export default function ConnectivitySettings() {
  const router = useRouter();
  const { isConnected, liquorbotId } = useLiquorBot();

  /*────────── BLE State ──────────*/
  const [discoveredDevices,setDiscoveredDevices]=useState<BluetoothDevice[]>([]);
  const [isScanning,setIsScanning]               =useState(false);
  const [isConnecting,setIsConnecting]           =useState(false);
  const [connectedDevice,setConnectedDevice]     =useState<any|null>(null);

  /*────────── Wi-Fi modal ──────────*/
  const [wifiModalVisible,setWifiModalVisible] = useState(false);
  const [ssid,setSsid]       = useState('');
  const [password,setPassword]= useState('');

  const managerRef = useRef<BleManager|null>(null);
  const getManager = ()=>{ if(!managerRef.current) managerRef.current=new BleManager(); return managerRef.current; };

  /*────────── Permissions + scan ──────────*/
  const requestBluetoothPermissions=async()=>{
    if(Platform.OS!=='android') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(granted).every(v=>v===PermissionsAndroid.RESULTS.GRANTED);
  };
  const scanForDevices=async()=>{
    const manager=getManager();
    if(Platform.OS==='android'&&!(await requestBluetoothPermissions())){Alert.alert('Bluetooth permissions needed');return;}
    if((await manager.state())!=='PoweredOn'){Alert.alert('Enable Bluetooth first');return;}
    setDiscoveredDevices([]); setIsScanning(true);
    manager.startDeviceScan([SERVICE_UUID],{allowDuplicates:false},(err,device)=>{
      if(err){console.error(err);manager.stopDeviceScan();setIsScanning(false);return;}
      if(device?.name?.startsWith('LiquorBot')){
        setDiscoveredDevices(prev=>prev.some(d=>d.id===device.id)?prev:[...prev,{id:device.id,name:device.name!}].sort((a,b)=>a.name.localeCompare(b.name)));
      }
    });
    setTimeout(()=>{manager.stopDeviceScan();setIsScanning(false);},15000);
  };

  /*────────── Connect & Wi-Fi send ──────────*/
  const handleConnectDevice=async(devId:string)=>{
    try{
      setIsConnecting(true);
      const manager=getManager();
      const dev=await manager.connectToDevice(devId,{requestMTU:256});
      await dev.discoverAllServicesAndCharacteristics();
      setConnectedDevice(dev);
      setWifiModalVisible(true);
    }catch(e:any){
      console.error('BLE connect',e); Alert.alert('Connection failed',e?.message??'Unknown error');
    }finally{setIsConnecting(false);}
  };
  const sendWifiCredentials=async()=>{
    if(!connectedDevice) return;
    try{
      const ssidB64 = Buffer.from(ssid,'utf8').toString('base64');
      const passB64= Buffer.from(password,'utf8').toString('base64');
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID,SSID_CHAR_UUID,ssidB64);
      await connectedDevice.writeCharacteristicWithResponseForService(SERVICE_UUID,PASS_CHAR_UUID,passB64);
      Alert.alert('Sent','Credentials transmitted – the device will reboot and join Wi-Fi.');
      setWifiModalVisible(false);
    }catch(e:any){
      console.error('Write creds',e); Alert.alert('Error',e?.message??'Failed to send credentials');
    }
  };

  /*────────── Scan on mount ──────────*/
  useEffect(() => {
    scanForDevices();
    return () => { getManager().stopDeviceScan(); };
  }, []);

  /*────────── UI helpers ──────────*/
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(()=>{ Animated.timing(fadeAnim,{toValue:1,duration:350,useNativeDriver:true}).start(); },[]);

  /*────────── Render ──────────*/
  return(
    <View style={styles.container}>
      {/* close */}
      <TouchableOpacity style={styles.closeButton} onPress={()=>router.back()}>
        <Ionicons name="chevron-back" size={30} color="#DFDCD9"/>
      </TouchableOpacity>
      <Text style={styles.headerText}>Connectivity</Text>

      {/* status */}
      <View style={styles.statusBox}>
        <Text style={styles.statusTitle}>Cloud Status</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot,{backgroundColor:isConnected?'#63d44a':'#d44a4a'}]}/>
          <Text style={styles.statusText}>{isConnected?'Online':'Offline'} – Bot #{liquorbotId||'--'}</Text>
        </View>
      </View>

      {/* device list */}
      <Animated.View style={{flex:1,opacity:fadeAnim}}>
        {isScanning?(
          <View style={styles.scanningRow}>
            <ActivityIndicator size="small" color="#CE975E"/>
            <Text style={styles.scanningText}>Scanning…</Text>
          </View>
        ):(
          <Text style={styles.scanningText}>
            {discoveredDevices.length?'Tap a device to connect':'No devices found – pull to rescan'}
          </Text>
        )}
        <FlatList
          data={discoveredDevices} keyExtractor={i=>i.id}
          onRefresh={scanForDevices} refreshing={isScanning}
          renderItem={({item})=>(
            <TouchableOpacity style={styles.deviceRow} disabled={isConnecting} onPress={()=>handleConnectDevice(item.id)}>
              <Text style={styles.deviceName}>{item.name}{' '}
                <Text style={{color:'#4F4F4F',fontSize:12}}>({item.id.slice(-5)})</Text>
              </Text>
              <Ionicons name="bluetooth" size={18} color="#DFDCD9"/>
            </TouchableOpacity>
          )}
          contentContainerStyle={{paddingBottom:40}}
        />
      </Animated.View>

      {/* Wi-Fi modal */}
      <Modal visible={wifiModalVisible} transparent animationType="fade" onRequestClose={()=>setWifiModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Configure Wi-Fi</Text>
            <TextInput
              placeholder="SSID" placeholderTextColor="#4F4F4F"
              value={ssid} onChangeText={setSsid}
              style={styles.input}
            />
            <TextInput
              placeholder="Password" placeholderTextColor="#4F4F4F"
              secureTextEntry value={password} onChangeText={setPassword}
              style={styles.input}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={sendWifiCredentials}>
              <Text style={styles.modalBtnText}>Send Credentials</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/*────────────────── Styles ──────────────────*/
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#141414',paddingTop:100,paddingHorizontal:20},
  closeButton:{position:'absolute',top:70,left:20},
  headerText:{position:'absolute',top:70,alignSelf:'center',fontSize:24,color:'#FFFFFF',fontWeight:'bold'},

  statusBox:{backgroundColor:'#1F1F1F',borderRadius:10,padding:20,marginBottom:20},
  statusTitle:{color:'#DFDCD9',fontSize:16,fontWeight:'bold',marginBottom:8},
  statusRow:{flexDirection:'row',alignItems:'center'},
  statusDot:{width:6,height:6,borderRadius:3,marginRight:6},
  statusText:{color:'#4F4F4F',fontSize:14},

  scanningRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',marginBottom:20},
  scanningText:{color:'#4F4F4F',textAlign:'center',marginLeft:10,marginBottom:10},
  deviceRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:14,paddingHorizontal:10,backgroundColor:'#1F1F1F',borderRadius:10,marginBottom:12},
  deviceName:{color:'#DFDCD9',fontSize:16},

  modalBackdrop:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'rgba(0,0,0,0.5)'},
  modalBox:{backgroundColor:'#1F1F1F',borderRadius:15,padding:20,width:'80%'},
  modalTitle:{color:'#CE975E',fontSize:18,fontWeight:'bold',marginBottom:15},
  input:{backgroundColor:'#141414',borderRadius:10,paddingVertical:10,paddingHorizontal:15,color:'#DFDCD9',marginBottom:12},
  modalBtn:{backgroundColor:'#CE975E',borderRadius:8,paddingVertical:12,alignItems:'center',marginTop:4},
  modalBtnText:{color:'#141414',fontWeight:'bold'},
});
