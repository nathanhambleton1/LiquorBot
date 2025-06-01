// -----------------------------------------------------------------------------
// File: events.tsx  (UPDATED – 1 Jun 2025)
// Guest-friendly: “Join / New Event” now trigger a polished sign-in prompt
// with icon + sub-copy encouraging users to create events.
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Platform, TextInput, ScrollView,
  Modal, Switch, Dimensions, LayoutAnimation,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons                       from '@expo/vector-icons/Ionicons';
import { generateClient }             from 'aws-amplify/api';
import { fetchAuthSession }           from '@aws-amplify/auth';
import * as Clipboard                 from 'expo-clipboard';
import { listEvents, eventsByCode, getCustomRecipe } from '../../src/graphql/queries';
import { deleteEvent, joinEvent, leaveEvent } from '../../src/graphql/mutations';
import { useLiquorBot }               from '../components/liquorbot-provider';
import { getUrl }                     from 'aws-amplify/storage';
import { Hub }                        from 'aws-amplify/utils';

/* --- layout helpers --- */
const client = generateClient();
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ---------- helpers ---------- */
const eventFilter = (user: string) => ({
  or: [
    { owner:       { eq: user } },
    { guestOwners: { contains: user } },
  ],
});

/* ---------- types ---------- */
interface Event {
  id:          string;
  name:        string;
  description?:string;
  location?:   string;
  startTime:   string;
  endTime:     string;
  liquorbotId: number;
  inviteCode:  string;
  drinkIDs:    number[];
  customRecipeIDs?: string[];
  owner?:      string;
  guestOwners?: string[];
}

export default function EventManager() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{ join?: string }>();
  const { liquorbotId, temporaryOverrideId, restorePreviousId } = useLiquorBot();

  /* ---------------- AUTH ---------------- */
  const [currentUser, setCurrentUser]       = useState<string | null>(null);
  const [isAdmin,      setIsAdmin]          = useState(false);

  useEffect(() => {
    const readUser = async () => {
      try {
        const ses = await fetchAuthSession();
        const u   = ses.tokens?.idToken?.payload['cognito:username'];
        setCurrentUser(typeof u === 'string' ? u : null);

        const groups = ses.tokens?.idToken?.payload['cognito:groups'] as string[] | undefined;
        setIsAdmin(groups?.includes('ADMIN') ?? false);
      } catch { setCurrentUser(null); }
    };

    readUser();

    const unsub = Hub.listen('auth', ({ payload }) => {
      if (['signedIn','signedOut','tokenRefresh'].includes(payload.event)) {
        readUser();
        setEvents([]);        // flush cache
      }
    });
    return () => unsub();
  }, []);

  /* ---------------- STATE ---------------- */
  const [events, setEvents]                       = useState<Event[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [filter, setFilter]                       = useState<'all'|'upcoming'|'current'|'past'>('all');
  const [searchQuery, setSearchQuery]             = useState('');
  const [alphabetical, setAlphabetical]           = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  /* join-modal & sign-in prompt */
  const [joinModalVisible,  setJoinModalVisible]  = useState(false);
  const [signPromptVisible, setSignPromptVisible] = useState(false);
  const [inviteCodeInput,   setInviteCodeInput]   = useState('');
  const [joinLoading,       setJoinLoading]       = useState(false);
  const [joinError,         setJoinError]         = useState<string|null>(null);

  const [expandedEventId, setExpandedEventId]   = useState<string | null>(null);
  const [standardDrinks,  setStandardDrinks]    = useState<Array<{ id:number; name:string }>>([]);
  const [customRecipes,   setCustomRecipes]     = useState<Array<{ id:string; name:string }>>([]);
  const [processingEvents,setProcessingEvents]  = useState<string[]>([]);
  const [copiedEventId,   setCopiedEventId]     = useState<string | null>(null);

  /* ---------------- PARAM: /events?join=true ---------------- */
  useEffect(() => {
    if (params.join === 'true') {
      currentUser ? setJoinModalVisible(true) : setSignPromptVisible(true);
      router.setParams({ join: undefined });
    }
  }, [params.join, currentUser]);

  /* ---------------- FETCH EVENTS ---------------- */
  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }

    (async () => {
      try {
        const { data } = await client.graphql({
          query: listEvents,
          variables: { filter: eventFilter(currentUser) },
          authMode:  'userPool',
        }) as { data: any };

        setEvents(data.listEvents.items.map((i: any): Event => ({
          id:i.id,name:i.name,location:i.location??undefined,description:i.description??undefined,
          startTime:i.startTime,endTime:i.endTime,liquorbotId:i.liquorbotId,inviteCode:i.inviteCode,
          drinkIDs:i.drinkIDs??[],customRecipeIDs:i.customRecipeIDs??[],owner:i.owner,
          guestOwners:i.guestOwners??[],
        })));
      } catch { Alert.alert('Error','Could not load events'); }
      finally { setLoading(false); }
    })();
  }, [currentUser, liquorbotId]);

  /* ---------------- STANDARD DRINKS JSON ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const dUrl = await getUrl({ key:'drinkMenu/drinks.json' });
        const res  = await fetch(dUrl.url);
        setStandardDrinks(await res.json());
      } catch(err){ console.error('drinks.json',err); }
    })();
  }, []);

  /* ---------------- CUSTOM RECIPES ---------------- */
  useEffect(() => {
    if (!events.length) return;
    (async () => {
      const ids = Array.from(new Set(events.flatMap(e=>e.customRecipeIDs||[])));
      const got:any[]=[];
      for(const id of ids){
        try{
          const {data}=await client.graphql({query:getCustomRecipe,variables:{id},authMode:'apiKey'});
          if(data?.getCustomRecipe) got.push(data.getCustomRecipe);
        }catch{ got.push({id,name:`Custom Drink (${id.slice(0,6)})`}); }
      }
      setCustomRecipes(got);
    })();
  }, [events]);

  /* ---------------- DEVICE OVERRIDES ---------------- */
  useEffect(() => {
    if (!events.length) return;
    const now = Date.now(); const timers:NodeJS.Timeout[]=[];
    events.forEach(ev=>{
      const s=+new Date(ev.startTime), e=+new Date(ev.endTime);
      if(s<=now && e>now) temporaryOverrideId(String(ev.liquorbotId),new Date(e));
      if(s>now) timers.push(setTimeout(()=>
        temporaryOverrideId(String(ev.liquorbotId),new Date(ev.endTime)),s-now));
    });
    return ()=>timers.forEach(clearTimeout);
  }, [events,temporaryOverrideId]);

  /* ---------------- FILTER MEMO ---------------- */
  const filteredEvents = useMemo(()=>{
    const now=new Date();
    let list=[
      ...events.filter(e=>new Date(e.startTime)<=now&&new Date(e.endTime)>=now),
      ...events.filter(e=>new Date(e.startTime)>now)
               .sort((a,b)=>+new Date(a.startTime)-+new Date(b.startTime)),
      ...events.filter(e=>new Date(e.endTime)<now)
               .sort((a,b)=>+new Date(b.endTime)-+new Date(a.endTime)),
    ];
    if(searchQuery) list=list.filter(e=>e.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if(alphabetical) list.sort((a,b)=>a.name.localeCompare(b.name));
    return list;
  },[events,searchQuery,alphabetical]);

  /* ------------------- HANDLERS ------------------- */
  const promptSignIn = () => setSignPromptVisible(true);

  const confirmDelete = (ev: Event) =>
    Alert.alert('Delete Event', `Delete “${ev.name}”?`, [
      { text: 'Cancel',  style: 'cancel' },
      { text: 'Delete',  style: 'destructive', onPress: () => doDelete(ev.id) },
    ]);

  const doDelete = async (id: string) => { /* unchanged */ /* ... */ };

  const checkForOverlappingEvents = (n: Event, ex: Event[]) => {
    const ns = new Date(n.startTime), ne = new Date(n.endTime),
          nUTC = Date.UTC(ns.getUTCFullYear(), ns.getUTCMonth(), ns.getUTCDate());
    return ex.filter(e => {
      const es = new Date(e.startTime), ee = new Date(e.endTime),
            eUTC = Date.UTC(es.getUTCFullYear(), es.getUTCMonth(), es.getUTCDate());
      if (nUTC !== eUTC) return false;
      return ns < ee && ne > es;
    });
  };

  const handleJoin = async () => { /* unchanged */ /* ... */ };

  const handleLeaveEvent = (ev: Event) =>
    Alert.alert('Leave Event', `Leave "${ev.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave',  style: 'destructive', onPress: () => doLeaveEvent(ev.id) },
    ]);

  const doLeaveEvent = async (eventId: string) => { /* unchanged */ /* ... */ };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  const copyToClipboard = (code: string, id: string) => {
    Clipboard.setStringAsync(code); setCopiedEventId(id);
    setTimeout(()=>setCopiedEventId(null),2000);
  };

  const formatRange = (s:string,e:string) => {
    const a=new Date(s), b=new Date(e), fd=(d:Date)=>d.toLocaleDateString(),
          ft=(d:Date)=>d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    return a.toDateString()===b.toDateString()
      ? `${fd(a)}  ${ft(a)} – ${ft(b)}`
      : `${fd(a)} ${ft(a)} – ${fd(b)} ${ft(b)}`;
  };

  /* ------------------- RENDER ITEM ------------------- */
  const renderItem = ({ item }: { item: Event }) => {
    const isOwner  = item.owner === currentUser;
    const isGuest  = item.guestOwners?.includes(currentUser ?? '') ?? false;
    const isPast   = new Date(item.endTime) < new Date();
    const isExpanded = expandedEventId === item.id;

    return (
      <TouchableOpacity style={styles.card} onPress={()=>toggleExpand(item.id)} activeOpacity={0.9}>
        {/* header */}
        <View style={styles.head}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.actions}>
            {isOwner ? (
              <>
                {!isPast && (
                  <TouchableOpacity onPress={()=>router.push(`/create-event?edit=${item.id}`)}>
                    <Ionicons name="create-outline" size={22} color="#CE975E"/>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={()=>confirmDelete(item)} disabled={processingEvents.includes(item.id)}>
                  {processingEvents.includes(item.id)
                    ? <ActivityIndicator size="small" color="#D9534F"/>
                    : <Ionicons name="trash-outline" size={22} color="#D9534F"/>}
                </TouchableOpacity>
              </>
            ) : isGuest && (
              <TouchableOpacity onPress={()=>handleLeaveEvent(item)} disabled={processingEvents.includes(item.id)}>
                {processingEvents.includes(item.id)
                  ? <ActivityIndicator size="small" color="#D9534F"/>
                  : <Ionicons name="exit-outline" size={22} color="#D9534F"/>}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* basic info */}
        <Text style={styles.detail}>{item.location || 'No location'}</Text>
        <Text style={styles.detail}>{formatRange(item.startTime,item.endTime)}</Text>
        {isExpanded && item.description && <Text style={styles.detail}>{item.description}</Text>}

        {/* expanded */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Drink Menu</Text>
              {item.drinkIDs.map(id=>{
                const d=standardDrinks.find(x=>x.id===id);
                return <Text key={id} style={styles.drinkName}>{d?d.name:`Drink #${id}`}</Text>;
              })}
              {item.customRecipeIDs?.map(id=>{
                const r=customRecipes.find(x=>x.id===id);
                return <Text key={id} style={styles.drinkName}>{r?r.name:`Custom Recipe #${id}`}</Text>;
              })}
            </View>
            <View style={styles.section}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={styles.sectionTitle}>Event Link</Text>
                {isExpanded && isAdmin && <Text style={styles.deviceId}>Device ID: {item.liquorbotId}</Text>}
              </View>
              <View style={styles.inviteRow}>
                <Text style={styles.inviteLink}>https://yourapp.com/join/{item.inviteCode}</Text>
                <TouchableOpacity onPress={()=>copyToClipboard(`https://yourapp.com/join/${item.inviteCode}`,item.id)}>
                  <Ionicons name="copy-outline" size={16} color="#CE975E"/>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* footer */}
        <View style={styles.foot}>
          <View style={{flexDirection:'row',alignItems:'center'}}>
            <Text style={styles.code}>Code: {item.inviteCode}</Text>
            <TouchableOpacity onPress={()=>copyToClipboard(item.inviteCode,item.id)} style={{marginLeft:8}}>
              <Ionicons name="copy-outline" size={14} color="#CE975E"/>
            </TouchableOpacity>
            {copiedEventId===item.id && <Text style={styles.copiedText}>Code Copied</Text>}
          </View>
          <Text style={styles.drinks}>{item.drinkIDs.length + (item.customRecipeIDs?.length??0)} drinks</Text>
        </View>
      </TouchableOpacity>
    );
  };

  /* ------------------- LOADING ------------------- */
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#CE975E"/>
      </View>
    );
  }

  /* ------------------- MAIN UI ------------------- */
  return (
    <View style={styles.container}>
      {/* title */}
      <Text style={styles.title}>Event Manager</Text>
      <TouchableOpacity style={styles.close} onPress={()=>router.push('/')}>
        <Ionicons name="close" size={28} color="#DFDCD9"/>
      </TouchableOpacity>

      {/* category picker */}
      <View style={styles.catWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {['All','Upcoming','Current','Past'].map(c=>{
            const k=c.toLowerCase() as typeof filter;
            return (
              <TouchableOpacity key={c} onPress={()=>setFilter(k)} style={styles.catBtn}>
                <Text style={[styles.catTxt, filter===k&&styles.catSel]}>{c}</Text>
                {filter===k&&<View style={styles.under}/>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color="#4F4F4F" style={{marginRight:10}}/>
        <TextInput
          style={styles.search}
          placeholder="Search events"
          placeholderTextColor="#4F4F4F"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity onPress={()=>setFilterModalVisible(true)}>
          <Ionicons name="funnel-outline" size={20} color={alphabetical?'#CE975E':'#4F4F4F'}/>
        </TouchableOpacity>
      </View>

      {/* list */}
      <FlatList
        data={filteredEvents}
        keyExtractor={i=>`${i.id}-${i.inviteCode}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color="#CE975E"/>
            <Text style={styles.emptyTxt}>
              {currentUser ? 'Tap “New Event” or “Join Event” to get started'
                           : 'Sign in to view or create events'}
            </Text>
          </View>
        }
      />

      {/* bottom buttons */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={currentUser?()=>setJoinModalVisible(true):promptSignIn}>
          <Ionicons name="log-in-outline" size={24} color="#141414"/>
          <Text style={styles.joinTxt}>Join Event</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={currentUser?()=>router.push('/create-event'):promptSignIn}>
          <Ionicons name="add" size={28} color="#141414"/>
        </TouchableOpacity>
      </View>

      {/* filter modal */}
      <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={()=>setFilterModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.filtCard}>
            <TouchableOpacity style={styles.filtClose} onPress={()=>setFilterModalVisible(false)}>
              <Ionicons name="close" size={24} color="#DFDCD9"/>
            </TouchableOpacity>
            <Text style={styles.filtTitle}>Filter Options</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLbl}>Sort alphabetically</Text>
              <Switch
                value={alphabetical}
                onValueChange={setAlphabetical}
                trackColor={{ false:'#4F4F4F', true:'#CE975E' }}
                thumbColor="#DFDCD9"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* join modal */}
      {currentUser && (
        <Modal visible={joinModalVisible} transparent animationType="fade" onRequestClose={()=>setJoinModalVisible(false)}>
          <View style={styles.overlay}>
            <View style={styles.joinCard}>
              <TouchableOpacity style={styles.filtClose} onPress={()=>setJoinModalVisible(false)}>
                <Ionicons name="close" size={24} color="#DFDCD9"/>
              </TouchableOpacity>
              <Text style={styles.filtTitle}>Enter Invite Code</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="ABC123"
                placeholderTextColor="#4F4F4F"
                autoCapitalize="characters"
                value={inviteCodeInput}
                onChangeText={t=>setInviteCodeInput(t.toUpperCase())}
              />
              {joinError && <Text style={styles.err}>{joinError}</Text>}
              <TouchableOpacity style={styles.joinGo} onPress={handleJoin} disabled={joinLoading}>
                {joinLoading ? <ActivityIndicator color="#141414"/> : <Text style={styles.joinGoTxt}>Join Event</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ------------ SIGN-IN PROMPT ------------- */}
      <Modal
        visible={signPromptVisible}
        transparent animationType="fade"
        onRequestClose={()=>setSignPromptVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.signCard}>
            <TouchableOpacity style={styles.filtClose} onPress={()=>setSignPromptVisible(false)}>
              <Ionicons name="close" size={24} color="#DFDCD9"/>
            </TouchableOpacity>

            <Ionicons name="person-circle-outline" size={80} color="#CE975E" style={styles.signLogo}/>
            <Text style={styles.signTitle}>Sign in to start creating</Text>
            <Text style={styles.signSub}>
              Create or join events, sync them across devices, and share your custom drink menus with friends.
            </Text>

            <TouchableOpacity
              style={[styles.joinGo,{marginTop:28}]}
              onPress={()=>{ setSignPromptVisible(false); router.push('/auth/sign-in'); }}
            >
              <Text style={styles.joinGoTxt}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#141414',paddingTop:70},
  loading:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#141414'},
  title:{color:'#DFDCD9',fontSize:24,fontWeight:'bold',textAlign:'center',marginBottom:30},
  close:{position:'absolute',top:62,left:24,padding:10,zIndex:10},

  catWrap:{alignItems:'center',marginBottom:20},
  catRow:{flexDirection:'row',alignItems:'center',paddingHorizontal:10},
  catBtn:{paddingHorizontal:15,marginHorizontal:5},
  catTxt:{color:'#4F4F4F'}, catSel:{color:'#CE975E'},
  under:{height:2,backgroundColor:'#CE975E',marginTop:2,width:'100%'},

  searchRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#1F1F1F',
             borderRadius:10,paddingHorizontal:15,marginHorizontal:20,marginBottom:20},
  search:{flex:1,color:'#DFDCD9',fontSize:16,paddingVertical:10},

  list:{paddingHorizontal:20,paddingBottom:140},
  card:{backgroundColor:'#1F1F1F',borderRadius:12,padding:16,marginBottom:12},
  head:{flexDirection:'row',justifyContent:'space-between',marginBottom:6},
  name:{color:'#DFDCD9',fontSize:18,fontWeight:'600',flexShrink:1},
  actions:{flexDirection:'row',gap:12,marginLeft:10},
  detail:{color:'#8F8F8F',fontSize:14,marginBottom:2},
  foot:{flexDirection:'row',justifyContent:'space-between',marginTop:10},
  code:{color:'#CE975E',fontSize:12}, drinks:{color:'#8F8F8F',fontSize:12},

  empty:{alignItems:'center',marginTop:150,paddingHorizontal:40},
  emptyTxt:{color:'#4F4F4F',textAlign:'center',marginTop:20,fontSize:14},

  bottom:{position:'absolute',bottom:120,left:0,right:0,flexDirection:'row',
          justifyContent:'flex-end',paddingHorizontal:20},
  joinBtn:{flexDirection:'row',alignItems:'center',backgroundColor:'#CE975E',
           borderRadius:25,paddingVertical:12,paddingHorizontal:20,marginRight:12},
  joinTxt:{color:'#141414',fontSize:16,fontWeight:'600',marginLeft:8},
  newBtn:{flexDirection:'row',alignItems:'center',backgroundColor:'#CE975E',
          borderRadius:25,paddingVertical:12,paddingHorizontal:12,
          ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:2},
          shadowOpacity:0.2,shadowRadius:4},android:{elevation:4}})},

  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'center',alignItems:'center'},
  filtCard:{width:SCREEN_WIDTH*0.8,backgroundColor:'#1F1F1F',borderRadius:10,padding:20},
  filtClose:{position:'absolute',top:15,right:15,padding:4},
  filtTitle:{color:'#DFDCD9',fontSize:20,fontWeight:'bold',alignSelf:'center',marginBottom:20},
  switchRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  switchLbl:{color:'#DFDCD9',fontSize:16},

  joinCard:{width:SCREEN_WIDTH*0.8,backgroundColor:'#1F1F1F',borderRadius:10,padding:20,alignItems:'center'},
  codeInput:{width:'100%',borderWidth:1,borderColor:'#4F4F4F',borderRadius:8,paddingVertical:10,
             paddingHorizontal:15,color:'#DFDCD9',fontSize:16,textAlign:'center',marginBottom:10},
  err:{color:'#D9534F',marginBottom:8},
  joinGo:{backgroundColor:'#CE975E',borderRadius:8,paddingVertical:12,paddingHorizontal:30,
          alignSelf:'stretch',alignItems:'center'},
  joinGoTxt:{color:'#141414',fontSize:16,fontWeight:'600'}, copiedText:{color:'#8F8F8F',fontSize:8,marginLeft:8},

  expandedContent:{marginTop:12,borderTopWidth:1,borderTopColor:'#2F2F2F',paddingTop:12},
  section:{marginBottom:16}, sectionTitle:{color:'#CE975E',fontSize:14,fontWeight:'600',marginBottom:8},
  drinkName:{color:'#8F8F8F',fontSize:14,marginBottom:4},
  inviteRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',
             backgroundColor:'#2F2F2F',borderRadius:8,padding:12},
  inviteLink:{color:'#8F8F8F',fontSize:12,flex:1,marginRight:8},
  deviceId:{color:'#4F4F4F',fontSize:10,textAlign:'right'},
  signCard:{width:SCREEN_WIDTH*0.8,backgroundColor:'#1F1F1F',borderRadius:12,
            paddingVertical:32,paddingHorizontal:24,alignItems:'center'},
  signLogo:{marginBottom:12},
  signTitle:{color:'#DFDCD9',fontSize:22,fontWeight:'700',textAlign:'center',marginBottom:10},
  signSub:{color:'#8F8F8F',fontSize:14,textAlign:'center',lineHeight:20},
});
