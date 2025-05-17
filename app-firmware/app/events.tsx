// -----------------------------------------------------------------------------
// File: events.tsx  (REPLACED – 17 May 2025)
// – Multi‑day toggle moved & widened, end‑date animates in, time‑tags added –
// -----------------------------------------------------------------------------
import React, {
  useState, useEffect, useMemo, useRef, forwardRef, Ref,
} from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  Modal, FlatList, Platform, ActivityIndicator, Dimensions, Alert,
  LayoutAnimation, UIManager, Animated,
} from 'react-native';
import Ionicons           from '@expo/vector-icons/Ionicons';
import * as Clipboard      from 'expo-clipboard';
import * as Linking        from 'expo-linking';
import { useRouter }       from 'expo-router';
import { Amplify }         from 'aws-amplify';
import { getUrl }          from 'aws-amplify/storage';
import { generateClient }  from 'aws-amplify/api';
import { createEvent }     from '../src/graphql/mutations';
import config              from '../src/amplifyconfiguration.json';
import { useLiquorBot }    from './components/liquorbot-provider';

Amplify.configure(config);
const client = generateClient();

/* ───────────────── helpers ───────────────── */
const to12=(t24:string)=>{const[h,m]=t24.split(':').map(Number);
  const p=h>=12?'PM':'AM';const h12=(h%12)||12;
  return`${h12}:${m.toString().padStart(2,'0')} ${p}`;};
const parseDT=(d:string,t:string)=>{const[mo,da,yr]=d.split('/').map(Number);
  const[h,m]=t.split(':').map(Number);return new Date(yr,mo-1,da,h,m,0,0);};
const parseIng=(d:Drink)=>d.ingredients?d.ingredients.split(',')
  .map(c=>+c.split(':')[0]):[];

/* ───────────────── types ───────────────── */
type Drink={id:number;name:string;category:string;
            image:string;ingredients?:string;isCustom?:boolean};
type Ingredient={id:number;name:string;type:string};
const categories=['All','Vodka','Rum','Tequila','Whiskey','Custom'];

/* ═════════════ Time‑wheel ═════════════ */
const ITEM_H=36;
type Anchor={x:number;y:number;width:number;height:number};

const TimeWheel=({
  visible,value24,anchor,onClose,onPick,
}:{
  visible:boolean;value24:string;anchor:Anchor|null;
  onClose:()=>void;onPick:(v24:string)=>void;
})=>{
  const base=useMemo(()=>{
    const a:string[]=[];
    for(let h=0;h<24;h++){a.push(`${String(h).padStart(2,'0')}:00`);
                          a.push(`${String(h).padStart(2,'0')}:30`);}
    return a;
  },[]);
  const data=[...base,...base,...base];
  const midIdx=base.indexOf(value24)+base.length;
  const listRef=useRef<FlatList<string>>(null);

  /* expansion animation */
  const scaleAnim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(visible){
      Animated.spring(scaleAnim,{toValue:1,useNativeDriver:true}).start();
      setTimeout(()=>listRef.current?.
        scrollToIndex({index:midIdx-2,animated:false}),40);
    }else{scaleAnim.setValue(0);}
  },[visible]);

  const clamp=(n:number,len:number)=>((n%len)+len)%len;

  /* snap after inertia */
  const alignToNearest=(y:number)=>{
    const idx=Math.round(y/ITEM_H);
    listRef.current?.scrollToOffset({offset:idx*ITEM_H,animated:true});
    onPick(base[clamp(idx,base.length)]);
  };

  const handleEnd=({nativeEvent}:{nativeEvent:any})=>
    alignToNearest(nativeEvent.contentOffset.y);

  /* quick‑tap selection */
  const handleTap=(idx:number)=>{
    const trueIdx=clamp(idx,base.length);
    onPick(base[trueIdx]);
    onClose();
  };

  if(!visible||!anchor) return null;
  /* final card geometry */
  const CARD_W=180;
  const CARD_H=ITEM_H*5;
  const centerX=anchor.x+anchor.width/2;
  const centerY=anchor.y+anchor.height/2;
  const cardLeft=centerX-CARD_W/2;
  const cardTop =centerY-CARD_H/2;

  return(
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.twBackdrop} activeOpacity={1} onPress={onClose}/>
      <Animated.View
        style={[
          styles.twCard,
          {width:CARD_W,height:CARD_H,left:cardLeft,top:cardTop,
           transform:[{scale:scaleAnim}]},
        ]}>
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(_,i)=>String(i)}
          getItemLayout={(_,i)=>({length:ITEM_H,offset:i*ITEM_H,index:i})}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          snapToAlignment="center"
          decelerationRate={0.9}
          onMomentumScrollEnd={handleEnd}
          onScrollEndDrag={e=>alignToNearest(e.nativeEvent.contentOffset.y)}
          renderItem={({item,index})=>(
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={()=>handleTap(index)}
              style={{height:ITEM_H,justifyContent:'center',alignItems:'center'}}>
              <Text style={styles.twItem}>{to12(item)}</Text>
            </TouchableOpacity>
          )}
        />
        <View pointerEvents="none" style={styles.twHighlight}/>
      </Animated.View>
    </Modal>
  );
};

/* ═════════════ component ═════════════ */
export default function EventsScreen(){
  const router=useRouter();
  const{liquorbotId}=useLiquorBot();

  /* meta */
  const today=useMemo(()=>fmt(new Date()),[]);
  const[name,setName]=useState('');
  const[location,setLocation]=useState('');
  const[description,setDesc]=useState('');
  const[startDate,setSD]=useState('');
  const[endDate,setED]=useState('');
  const[multiDay,setMD]=useState(false);
  const[startTime,setST]=useState('18:00');
  const[endTime,setET]=useState('21:00');
  const[twTarget,setTWT]=useState<'start'|'end'|null>(null);
  const[twAnchor,setTWA]=useState<null|{x:number;y:number;width:number;height:number}>(null);
  /* data */
  const[allDrinks,setAD]=useState<Drink[]>([]);
  const[ingredients,setIng]=useState<Ingredient[]>([]);
  const[loading,setLoad]=useState(true);
  /* menu */
  const[menu,setMenu]=useState<Drink[]>([]);
  const ingredientSet=useMemo(()=>{
    const s=new Set<number>();
    menu.forEach(d=>parseIng(d).forEach(i=>s.add(i)));
    return s;
  },[menu]);
  const slotsOK=ingredientSet.size<=15;
  const[showSlots,setShowSlots]=useState(false);
  const [showTimeInfo, setShowTimeInfo] = useState(false);

  /* enable animation on Android */
  useEffect(()=>{if(Platform.OS==='android'&&UIManager
    .setLayoutAnimationEnabledExperimental){UIManager
      .setLayoutAnimationEnabledExperimental(true);} },[]);

  /* fetch drinks */
  useEffect(()=>{
    (async()=>{
      try{
        const[dUrl,iUrl]=await Promise.all([
          getUrl({key:'drinkMenu/drinks.json'}),
          getUrl({key:'drinkMenu/ingredients.json'})]);
        const[dRes,iRes]=await Promise.all([fetch(dUrl.url),fetch(iUrl.url)]);
        setAD(await dRes.json());setIng(await iRes.json());
      }catch(e){console.error(e);}finally{setLoad(false);}
    })();
  },[]);

  /* filtered list */
  const[pickerVis,setPV]=useState(false);
  const[cat,setCat]=useState('All');
  const[q,setQ]=useState('');
  const filtered=allDrinks.filter(d=>
    (cat==='All'||d.category===cat)&&
    d.name.toLowerCase().includes(q.toLowerCase()));

  /* helpers */
  const fmtSlots=()=>`${ingredientSet.size}/15 unique ingredients`;
  const addDrink=(d:Drink)=>{
    const after=new Set([...ingredientSet,...parseIng(d)]);
    if(after.size>15){Alert.alert('Too many ingredients');return;}
    setMenu(m=>[...m,d]);setPV(false);setQ('');
  };
  const removeDrink=(id:number)=>setMenu(m=>m.filter(d=>d.id!==id));

  /* auto-close ingredient list */
  useEffect(() => {
    if (menu.length === 0) {
      setShowSlots(false); // Automatically close the ingredient list
    }
  }, [menu]);

  /* save */
  const save=async()=>{
    if(!name.trim()){Alert.alert('Name?');return;}
    if(menu.length===0){Alert.alert('Add a drink');return;}
    if(!slotsOK){Alert.alert('Too many ingredients');return;}
    const start=parseDT(startDate,startTime);
    const end=parseDT(multiDay?endDate:startDate,endTime);
    const code=Math.random().toString(36).slice(2,8).toUpperCase();
    try{
      await client.graphql({query:createEvent,
        variables:{input:{
          name:name.trim(),description,location,
          startTime:start.toISOString(),endTime:end.toISOString(),
          liquorbotId:Number(liquorbotId),inviteCode:code,
          drinkIDs:menu.map(d=>d.id)}},authMode:'userPool'});
      const link=Linking.createURL('/join',{queryParams:{invite:code}});
      Clipboard.setStringAsync(link);
      Alert.alert('Saved','Invite link copied!');
    }catch(e){console.error(e);Alert.alert('Error','Cannot save');}
  };
  const isDateInPast = (date: string): boolean => {
    if (!date || date.length !== 10) return true; // Invalid or incomplete date
    const [month, day, year] = date.split('/').map(Number);
    const enteredDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to the start of the day
    return enteredDate < today;
  };

  /* refs to measure TimeBoxes */
  const startRef=useRef<View>(null);
  const endRef  =useRef<View>(null);
  const showWheel=(which:'start'|'end',ref:Ref<View>)=>{
    (ref as any).current?.measureInWindow((x:number,y:number,w:number,h:number)=>{
      setTWA({x,y,width:w,height:h});setTWT(which);});
  };

  /* UI */
  return(
    <View style={styles.container}>
      {/* close */}
      <TouchableOpacity style={styles.closeBtn} onPress={()=>router.push('/')}>
        <Ionicons name="close" size={28} color="#DFDCD9"/>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Create Event</Text>
        <Field label="Event Name" value={name} onChange={setName} ph="e.g. Emma & Liam Wedding"/>
        <Field label="Location" value={location} onChange={setLocation} ph="Venue or address"/>
        <Field label="Description" value={description} onChange={setDesc}
               ph="Optional notes" multiline/>

        {/* ── MULTI‑DAY TOGGLE ── */}
        <TouchableOpacity
          style={[styles.mdToggle,multiDay&&styles.mdToggleOn]}
          onPress={()=>{LayoutAnimation.easeInEaseOut();setMD(!multiDay);}}>
          <Ionicons name={multiDay?'checkbox':'square-outline'} size={22}
                    color={multiDay?'#CE975E':'#DFDCD9'} />
          <Text style={styles.mdToggleTxt}>Multi‑day event</Text>
        </TouchableOpacity>

        {/* dates */}
        <View style={styles.timeInfoHeader}>
          <Text style={[styles.label, { marginTop: 10 }]}>Event Time</Text>
          <TouchableOpacity 
            onPress={() => setShowTimeInfo(true)}
            style={styles.infoButton}
          >
            <Ionicons name="information-circle-outline" size={18} color="#4f4f4f" />
          </TouchableOpacity>
        </View>
        <View style={styles.dateRow}>
          <InputDate val={startDate} set={setSD}/>
          {multiDay&&<InputDate val={endDate} set={setED} />}
        </View>

        {/* times */}
        <View style={styles.timeRow}>
          <TimeBox ref={startRef} tag="START"
                   label={to12(startTime)} onPress={()=>showWheel('start',startRef)}/>
          <TimeBox ref={endRef} tag="END"
                   label={to12(endTime)}   onPress={()=>showWheel('end',endRef)}/>
        </View>

        {/* drinks */}
        <View style={styles.menuHead}>
          <Text style={styles.section}>Drinks Menu</Text>
          <TouchableOpacity onPress={()=>setPV(true)}>
            <Ionicons name="add-circle" size={24} color="#CE975E"/>
          </TouchableOpacity>
        </View>
        {menu.map(d=>(
          <View key={d.id} style={styles.drinkRow}>
            <Text style={styles.drinkTxt}>{d.name}</Text>
            <TouchableOpacity onPress={()=>removeDrink(d.id)}>
              <Ionicons name="trash" size={20} color="#D9534F"/>
            </TouchableOpacity>
          </View>
        ))}

        {/* slot summary */}
        <TouchableOpacity onPress={()=>{LayoutAnimation.easeInEaseOut();
          setShowSlots(!showSlots);}}>
          <Text style={[styles.slots, !slotsOK && { color: '#D9534F' }]}>
            {fmtSlots()}
            {menu.length > 0 && (
              <Ionicons
                name={showSlots ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#DFDCD9"
                style={{ marginLeft: 0, marginTop: 0 }}
              />
            )}
          </Text>
        </TouchableOpacity>
        {showSlots&&(
          <View style={styles.slotBox}>
            {[...ingredientSet].sort((a,b)=>a-b).map((id,i)=>{
              const ing=ingredients.find(x=>x.id===id);
              return(<Text key={id} style={styles.slotLine}>
                Slot {i+1}: {ing?.name||'unknown'}</Text>);
            })}
          </View>
        )}

        {/* save */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            (!slotsOK || !name.trim() || menu.length === 0 || isDateInPast(startDate) || (multiDay && isDateInPast(endDate))) && { opacity: 0.4 },
          ]}
          disabled={!slotsOK || !name.trim() || menu.length === 0 || isDateInPast(startDate) || (multiDay && isDateInPast(endDate))}
          onPress={save}
        >
          <Text style={styles.saveTxt}>Save Event</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* drink‑picker modal */}
      <Modal visible={pickerVis} animationType="slide"
        onRequestClose={()=>setPV(false)}
        presentationStyle={Platform.OS==='ios'?'pageSheet':'fullScreen'}>
        <PickerModal {...{cat,setCat,q,setQ,filtered,loading,addDrink,close:()=>setPV(false)}}/>
      </Modal>
      
      {/* time‑info modal */}
      <Modal
        transparent
        visible={showTimeInfo}
        onRequestClose={() => setShowTimeInfo(false)}
      >
        <TouchableOpacity 
          style={styles.infoBackdrop}
          activeOpacity={1}
          onPress={() => setShowTimeInfo(false)}
        >
          <View style={styles.infoPopup}>
            <Text style={styles.infoTitle}>Event Timing Information</Text>
            <Text style={styles.infoText}>
              The start time indicates when the Liquorbot will unlock and begin serving drinks.
              {"\n\n"}
              The end time is when the device will automatically lock and stop serving.
              {"\n\n"}
              For multi-day events, the device will remain active continuously even if the event 
              spans multiple calendar days. Note that events can be longer than 24 hours.
            </Text>
            <TouchableOpacity 
              style={styles.infoClose}
              onPress={() => setShowTimeInfo(false)}
            >
              <Ionicons name="close" size={24} color="#DFDCD9" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* animated time‑picker */}
      <TimeWheel
        visible={!!twTarget} value24={twTarget==='start'?startTime:endTime}
        anchor={twAnchor}
        onClose={()=>{setTWT(null);setTWA(null);}}
        onPick={v=>twTarget==='start'?setST(v):setET(v)}
      />
    </View>
  );
}

/* ═════════ helpers components / styling ═════════ */
const Field = ({
  label,
  value,
  onChange,
  ph,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  ph: string;
  multiline?: boolean;
}) => {
  const [height, setHeight] = useState(40); // Initial height

  return (
    <View style={{ marginBottom: 15 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && { height: Math.max(40, height) }, // Adjust height dynamically
        ]}
        multiline={multiline}
        placeholder={ph}
        placeholderTextColor="#4F4F4F"
        value={value}
        onChangeText={onChange}
        onContentSizeChange={(e) => {
          if (multiline) {
            setHeight(e.nativeEvent.contentSize.height); // Update height based on content
          }
        }}
      />
    </View>
  );
};

const InputDate = ({ val, set }: { val: string; set: (v: string) => void }) => {
  const [isInvalid, setIsInvalid] = useState(false); // Track if the date is invalid

  const handleDateChange = (text: string) => {
    // Remove all non-numeric characters
    const numericText = text.replace(/[^0-9]/g, '');

    // Format the date as MM/DD/YYYY
    let formatted = numericText;
    if (numericText.length > 2) {
      formatted = `${numericText.slice(0, 2)}/${numericText.slice(2)}`;
    }
    if (numericText.length > 4) {
      formatted = `${numericText.slice(0, 2)}/${numericText.slice(2, 4)}/${numericText.slice(4, 8)}`;
    }

    // Limit the length to 10 characters (MM/DD/YYYY)
    formatted = formatted.slice(0, 10);

    // Validate the date
    if (formatted.length === 10) {
      const [month, day, year] = formatted.split('/').map(Number);
      const enteredDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set time to the start of the day

      if (enteredDate < today) {
        setIsInvalid(true); // Mark the date as invalid
      } else {
        setIsInvalid(false); // Mark the date as valid
      }
    } else {
      setIsInvalid(false); // Reset invalid state for incomplete dates
    }

    set(formatted);
  };

  return (
    <TextInput
      style={[
        styles.dateBox,
        isInvalid && { borderColor: '#D9534F', borderWidth: 1 }, // Apply red border if invalid
      ]}
      keyboardType="numeric" // Ensures only numbers are shown on the keyboard
      value={val}
      placeholder="MM/DD/YYYY"
      maxLength={10} // Limit input to 10 characters
      placeholderTextColor="#4F4F4F"
      onChangeText={handleDateChange}
    />
  );
};

const TimeBox=forwardRef(({label,onPress,tag}:{label:string;onPress:()=>void;tag:'START'|'END'},
  ref:Ref<View>)=>(
  <TouchableOpacity ref={ref} style={styles.timeBox} onPress={onPress}>
    <Text style={styles.timeTag}>{tag}</Text>
    <Text style={styles.timeTxt}>{label}</Text>
  </TouchableOpacity>
));

/* picker modal – unchanged */
const PickerModal=({cat,setCat,q,setQ,filtered,loading,addDrink,close}:any)=>(
  <View style={styles.modal}>
    <TouchableOpacity style={styles.modalClose} onPress={close}>
      <Ionicons name="chevron-down" size={30} color="#DFDCD9"/>
    </TouchableOpacity>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.catRow}>
      {categories.map(c=>(
        <TouchableOpacity key={c} onPress={()=>setCat(c)} style={styles.catBtn}>
          <Text style={[styles.catTxt,cat===c&&styles.catSel]}>{c}</Text>
          {cat===c&&<View style={styles.under}/>}</TouchableOpacity>))}
    </ScrollView>
    <View style={styles.searchRow}>
      <Ionicons name="search" size={20} color="#4F4F4F" style={{marginRight:8}}/>
      <TextInput style={styles.searchInput} placeholder="Search drinks"
        placeholderTextColor="#4F4F4F" value={q} onChangeText={setQ}/>
    </View>
    {loading?<ActivityIndicator size="large" color="#CE975E" style={{marginTop:30}}/>:
      <FlatList data={filtered} keyExtractor={i=>String(i.id)}
        renderItem={({item})=>(
          <TouchableOpacity style={styles.drinkItem} onPress={()=>addDrink(item)}>
            <Text style={styles.drinkItemText}>{item.name}</Text>
          </TouchableOpacity>)}
        contentContainerStyle={{paddingBottom:40,alignItems:'flex-start'}}/>}
  </View>);

/* date formatting */
function fmt(d:Date){return`${String(d.getMonth()+1).padStart(2,'0')}/${
  String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;}

const{width:W}=Dimensions.get('window');
const styles=StyleSheet.create({
  /* generic layout (unchanged) */
  container:{flex:1,backgroundColor:'#141414'},
  closeBtn:{position:'absolute', top:62,left:20,zIndex:10,padding:10, },
  scroll:{paddingTop:70,paddingHorizontal:20,
    paddingBottom:40},header:{fontSize:24,color:'#DFDCD9',fontWeight:'bold',
    marginBottom:20, textAlign: 'center'},label:{color:'#DFDCD9',marginBottom:5,fontSize:16},
  input:{backgroundColor:'#1F1F1F',color:'#DFDCD9',borderRadius:10,padding:12,
    fontSize:16},

  /* multi‑day toggle */
  mdToggle:{flexDirection:'row',alignItems:'center',backgroundColor:'#1F1F1F',
    borderRadius:10,padding:12,marginBottom:6},
  mdToggleOn:{borderColor:'#CE975E',borderWidth:1},
  mdToggleTxt:{color:'#DFDCD9',marginLeft:8,fontSize:15},

  dateRow:{flexDirection:'row',alignItems:'center',marginBottom:8},
  dateBox:{flex:1,backgroundColor:'#1F1F1F',color:'#DFDCD9',borderRadius:10,
           padding:12,fontSize:16,marginRight:4},

  timeRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:15},
  timeBox:{flex:1,backgroundColor:'#1F1F1F',borderRadius:10,paddingVertical:12,
           alignItems:'center',marginHorizontal:4},
  timeTag:{position:'absolute',top:4,left:8,fontSize:11,color:'#CE975E',
           letterSpacing:1},
  timeTxt:{color:'#DFDCD9',fontSize:16,marginTop:6},
  menuHead:{flexDirection:'row',justifyContent:'space-between',
            alignItems:'center',marginTop:10,marginBottom:5},
  section:{color:'#DFDCD9',fontSize:18,fontWeight:'bold'},
  drinkRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',
            backgroundColor:'#1F1F1F',paddingVertical:10,paddingHorizontal:15,
            borderRadius:10,marginBottom:8},
  drinkTxt:{color:'#DFDCD9',fontSize:16},

  slots:{color:'#DFDCD9',fontSize:12,marginBottom:10},
  slotBox:{backgroundColor:'#1F1F1F',borderRadius:10,padding:10,marginBottom:4},
  slotLine:{color:'#DFDCD9',fontSize:14,marginVertical:2},

  saveBtn:{backgroundColor:'#CE975E',borderRadius:10,paddingVertical:14,alignItems:'center',
           marginTop:10},saveTxt:{color:'#141414',fontSize:18,fontWeight:'bold'},

  /* picker modal */
  modal:{flex:1,backgroundColor:'#141414',padding:20},
  modalClose:{position:'absolute',top:30,left:20,zIndex:10},
  catRow:{flexDirection:'row',alignItems:'center',marginTop:50},
  catBtn:{paddingVertical:10,paddingHorizontal:10,marginHorizontal:6},
  catTxt:{color:'#4F4F4F',fontSize:14},catSel:{color:'#CE975E'},
  under:{height:2,backgroundColor:'#CE975E',width:'100%',marginTop:2},
  searchRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#1F1F1F',
             borderRadius:10,paddingHorizontal:15,marginVertical:15},
  searchInput:{flex:1,color:'#DFDCD9',fontSize:16,paddingVertical:10},
  drinkItem:{paddingVertical:14,width:W-40,borderBottomWidth:1,
             borderBottomColor:'#333'},drinkItemText:{color:'#DFDCD9',fontSize:16},

  /* time‑wheel */
  twBackdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'#0009'},
  twCard:{position:'absolute',backgroundColor:'#1F1F1F',
          borderRadius:16,overflow:'hidden'},
  twItem:{color:'#DFDCD9',fontSize:18},
  twHighlight:{position:'absolute',left:0,right:0,height:ITEM_H,top:'50%',
               marginTop:-ITEM_H/2,borderTopWidth:1,borderBottomWidth:1,
               borderColor:'#CE975E'},
  timeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoButton: {
    marginLeft: 8,
    padding: 4,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoPopup: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    position: 'relative',
  },
  infoTitle: {
    color: '#CE975E',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    color: '#DFDCD9',
    fontSize: 14,
    lineHeight: 20,
  },
  infoClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
});
