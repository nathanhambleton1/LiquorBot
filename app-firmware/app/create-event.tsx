// -----------------------------------------------------------------------------
// File: create-event.tsx  (REPLACED – 17 May 2025)
// - Event name, location, and description.
// - Start and end dates/times (with support for multi-day events).
// - Drinks menu with ingredient limits.
// -----------------------------------------------------------------------------
import React, {
  useState, useEffect, useMemo, useRef, forwardRef, Ref,
} from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  Modal, FlatList, Platform, ActivityIndicator, Dimensions, Alert,
  LayoutAnimation, UIManager,
  KeyboardAvoidingView, // <-- add this import
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
import { useLocalSearchParams } from 'expo-router';
import { getEvent } from '../src/graphql/queries';
import { updateEvent } from '../src/graphql/mutations';
import { fetchAuthSession } from '@aws-amplify/auth';
import type { RecipeIngredient, CustomRecipe } from '../src/API';
import { on } from '../src/event-bus';
import { useFocusEffect } from 'expo-router';
import { listEvents } from '../src/graphql/queries';
import DateTimePicker from '@react-native-community/datetimepicker';

Amplify.configure(config);
const client = generateClient();

/* ───────────────── helpers ───────────────── */
const to12=(t24:string)=>{const[h,m]=t24.split(':').map(Number);
  const p=h>=12?'PM':'AM';const h12=(h%12)||12;
  return`${h12}:${m.toString().padStart(2,'0')} ${p}`;};
const parseDT=(d:string,t:string)=>{const[mo,da,yr]=d.split('/').map(Number);
  const[h,m]=t.split(':').map(Number);return new Date(yr,mo-1,da,h,m,0,0);};
const parseIng = (d: Drink): number[] => {
  if (d.isCustom) return (d.ingArr ?? []).map(r => Number(r.ingredientID));
  return d.ingredients
    ? d.ingredients.split(',').map(c => +c.split(':')[0])
    : [];
};

const eventFilter = (user: string, liquorbotId: number) => ({
  and: [
    { liquorbotId: { eq: liquorbotId } },
    {
      or: [
        { owner:       { eq: user } },
        { guestOwners: { contains: user } },
      ],
    },
  ],
});

const checkForOverlappingEvents = (
  newStartISO: string,
  newEndISO: string,
  existing: { name: string; startTime: string; endTime: string; id: string }[],
  selfId?: string,
) => {
  const newStart = new Date(newStartISO);
  const newEnd   = new Date(newEndISO);

  return existing.filter(ev => {
    if (ev.id === selfId) return false;             // ignore the event we’re editing
    const s = new Date(ev.startTime);
    const e = new Date(ev.endTime);
    return newStart < e && newEnd > s;              // true = overlaps
  });
};

const fetchMyRecipes = async (user: string, setAD: React.Dispatch<React.SetStateAction<Drink[]>>) => {
  try {
    const result = await client.graphql({
      query: listCustomRecipesWithIngredients, // Use the updated query
      authMode: 'userPool',
    });
    const data = (result as any).data;

    const customs: Drink[] =
      (data?.listCustomRecipes?.items ?? [])
        .filter((r: any) => r && r.owner === user)
        .map((r: any) => ({
          id:   r.id,
          name: r.name,
          category: 'Custom',
          image: r.image ?? '',
          isCustom: true,
          ingArr:  r.ingredients ?? [],
        }));

    setAD(prev => {
      const seen = new Set(prev.map(d => d.id));
      return [...prev, ...customs.filter(c => !seen.has(c.id))];
    });
  } catch (err) {
    console.error('Could not load custom recipes', err);
  }
};

const listCustomRecipesWithIngredients = /* GraphQL */ `
  query ListCustomRecipes {
    listCustomRecipes {
      items {
        id
        name
        image
        ingredients {
          ingredientID
          amount
          priority
        }
        owner
      }
    }
  }
`;

/* ───────────────── types ───────────────── */
type Drink = {
  id:        string;                // “17” for stock, UUID for custom
  name:      string;
  category:  string;                // 'Vodka' |'Rum' |… |'Custom'
  image:     string;
  isCustom?: true;                  // flag for custom drinks
  ingredients?: string;             // raw string for stock items
  ingArr?:    RecipeIngredient[];   // parsed array for custom
};
type Ingredient={id:number;name:string;type:string};
const categories=['All','Vodka','Rum','Tequila','Whiskey','Custom'];

/* ═════════════ Time‑wheel ═════════════ */
const ITEM_H=36;
type Anchor={x:number;y:number;width:number;height:number};

type Props = {
  visible: boolean;
  value24: string;               // “18:30”
  anchor: { x: number; y: number; width: number; height: number } | null;
  onPick: (v24: string) => void; // ⇠ callback → “HH:MM”
  onClose: () => void;
};

export function TimePickerModal({
  visible,
  value24,
  anchor,
  onPick,
  onClose,
}: Props) {
  /* convert the incoming “18:30” → Date */
  const initial = useMemo(() => {
    const [h, m] = value24.split(':').map(Number);
    return new Date(2025, 0, 1, h, m);
  }, [value24]);

  useEffect(() => {
    if (visible) {
      setDate(initial);
    }
  }, [visible, initial]);

  const [date, setDate] = useState(initial);

  const commit = (d: Date) => {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    onPick(`${hh}:${mm}`);
  };

  /* Don’t render at all when hidden */
  if (!visible || !anchor) return null;

  /* Card geometry (same pop-up position you already calculate) */
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
  const CARD_W = 280;
  const CARD_H = Platform.OS === 'ios' ? 200 : 250;

  const rawLeft = anchor.x + anchor.width / 2 - CARD_W / 2;
  const rawTop  = anchor.y + anchor.height / 2 - CARD_H / 2;

  // keep 8 px padding all round
  const left = Math.max(8, Math.min(SCREEN_W - CARD_W - 8, rawLeft));
  const top  = Math.max(8, Math.min(SCREEN_H - CARD_H - 8, rawTop));

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => { commit(date); onClose(); }}
      />
      <View style={[styles.card, { width: CARD_W, height: CARD_H, left, top }]}>
        {/* 1️⃣ keep the picker first so it’s “under” the close-icon */}
        <DateTimePicker
          value={date}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          minuteInterval={15} // Changed from 30 to 15
          onChange={(_, d) => d && setDate(d)}
          onTouchEnd={() => { commit(date); if (Platform.OS !== 'ios') onClose(); }}
          textColor="#DFDCD9"
        />

        {/* 2️⃣ then the close button -- now it’s the top-most touchable */}
        <TouchableOpacity
          style={styles.closeIcon}
          onPress={() => { commit(date); onClose(); }}>
          <Ionicons name="close" size={22} color="#DFDCD9" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

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
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [existingEvent, setExistingEvent] = useState<Event | null>(null);
  const[allDrinks,setAD]=useState<Drink[]>([]);
  const[ingredients,setIng]=useState<Ingredient[]>([]);
  const[loading,setLoad]=useState(true);
  
  /* Event type definition */
  type Event = {
    _id: string;
    name: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    liquorbotId: number;
    inviteCode?: string;
    drinkIDs?: number[];
    customRecipeIDs?: string[]; // Added customRecipeIDs property
    owner?: string; // Added owner property
  };
  /* menu */
  const[menu,setMenu]=useState<Drink[]>([]);
  const [menuSynced, setSynced] = useState(false);
  const ingredientSet=useMemo(()=>{
    const s=new Set<number>();
    menu.forEach(d=>parseIng(d).forEach(i=>s.add(i)));
    return s;
  },[menu]);
  const slotsOK=ingredientSet.size<=15;
  const[showSlots,setShowSlots]=useState(false);
  const [showTimeInfo, setShowTimeInfo] = useState(false);

  const canAddDrink = (d: Drink) => {
    const ing = parseIng(d);
    let extra = 0;
    for (const id of ing) {
      if (!ingredientSet.has(id)) extra++;      // only count new uniques
    }
    return ingredientSet.size + extra <= 15;    // true → safe to add
  };

  useEffect(() => {
    setSynced(false)
  }, [edit])

  /* enable animation on Android */
  useEffect(()=>{if(Platform.OS==='android'&&UIManager
    .setLayoutAnimationEnabledExperimental){UIManager
      .setLayoutAnimationEnabledExperimental(true);} },[]);

  /* current user */
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const ses = await fetchAuthSession();
        const u = ses.tokens?.idToken?.payload['cognito:username'];
        setCurrentUser(typeof u === 'string' ? u : null);
      } catch {
        setCurrentUser(null);
      }
    })();
  }, []);

  /* fetch drinks */
  useEffect(() => {
    (async() => {
      try {
        // First get the storage URLs
        const [drinksUrl, ingredientsUrl] = await Promise.all([
          getUrl({ key: 'drinkMenu/drinks.json' }),
          getUrl({ key: 'drinkMenu/ingredients.json' })
        ]);

        // Then fetch the actual data
        const [dRes, iRes] = await Promise.all([
          fetch(drinksUrl.url), 
          fetch(ingredientsUrl.url)
        ]);
        
        const defaultDrinks = await dRes.json();
        setAD(defaultDrinks);
        setIng(await iRes.json());

        // Fetch custom recipes when currentUser is available
        if (currentUser) {
          await fetchMyRecipes(currentUser, setAD);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoad(false);
      }
    })();
  }, [currentUser]);

  /* auto‑set start date */
  useEffect(() => {
    if (!startTime || !endTime) return;          // times not filled yet

    const crossesMidnight = timeToMins(endTime) <= timeToMins(startTime);

    if (crossesMidnight) {
      if (!multiDay) setMD(true);                // flip the toggle visibly
      if (startDate && !endDate) setED(nextDay(startDate));  // pre-fill date if we can
    }
  }, [startTime, endTime, startDate, endDate, multiDay]);

  useEffect(() => {
  const unsub = on('recipe-created', (r: CustomRecipe) => {
      const drink: Drink = {
        id:        r.id,
        name:      r.name,
        category:  'Custom',
        image:     r.image ?? '',
        isCustom:  true,
        ingArr:    r.ingredients ?? [],
      };
      setAD(p => [...p, drink]);   // add to master list
      addDrink(drink);             // add to THIS event
    });
    return unsub;
  }, [ingredients]);

  /* filtered list */
  const[pickerVis,setPV]=useState(false);
  const[cat,setCat]=useState('All');
  const[q,setQ]=useState('');
  const filtered = allDrinks.filter(d =>
    (cat === 'All' || d.category === cat) &&                 // category match
    d.name.toLowerCase().includes(q.toLowerCase()) &&        // search match
    !menu.some(m => m.id === d.id) &&                        // skip already-added
    canAddDrink(d)                                           // skip if it overflows
  );

  /* helpers */
  const fmtSlots=()=>`${ingredientSet.size}/15 unique ingredients`;
  const addDrink=(d:Drink)=>{
    if (menu.some(drink => drink.id === d.id)) {
      Alert.alert('Already added', 'This drink is already in the menu.');
      setPV(false); setQ('');
      return;
    }
    const after=new Set([...ingredientSet,...parseIng(d)]);
    if(after.size>15){Alert.alert('Too many ingredients');return;}
    setMenu(m=>[...m,d]);setPV(false);setQ('');
  };
  function nextDay(mmddyyyy: string) {
    const [mo, da, yr] = mmddyyyy.split('/').map(Number);
    const d = new Date(yr, mo - 1, da);
    d.setDate(d.getDate() + 1);
    return fmt(d);
  }
  function timeToMins(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  const toggleMultiDay = () => {
    LayoutAnimation.easeInEaseOut();

    if (multiDay) {
      /* 🔽 turning OFF */
      setMD(false);
      setED('');                           // hide the second date box

      /* only auto-fix if end-time ≤ start-time */
      if (timeToMins(endTime) <= timeToMins(startTime)) {
        setET('23:59');
      }
    } else {
      /* 🔼 turning ON */
      if (!endDate) setED(nextDay(startDate || today));  // pre-fill “tomorrow”
      setMD(true);
    }
  };

  const removeDrink = (id:string)  => setMenu(m => m.filter(d => d.id !== id));

  /* auto-close ingredient list */
  useEffect(() => {
    if (menu.length === 0) {
      setShowSlots(false); // Automatically close the ingredient list
    }
  }, [menu]);

  // Add this useEffect to handle menu population
  useEffect(() => {
    if (existingEvent && allDrinks.length > 0) {
      const fetchCustomRecipes = async () => {
        try {
          // Get ALL recipes first
          const result = await client.graphql({
            query: /* GraphQL */ `
              query ListAllCustomRecipes {
                listCustomRecipes {
                  items {
                    id
                    name
                    image
                    ingredients {
                      ingredientID
                      amount
                      priority
                    }
                  }
                }
              }
            `,
            authMode: 'userPool'
          });
          const data = (result as any).data;

          // Then filter client-side
          const targetIds = existingEvent?.customRecipeIDs || [];
          const customRecipes = data?.listCustomRecipes?.items
            ?.filter((r: any) => targetIds.includes(r.id))
            ?.map((r: any) => ({
              id: r.id,
              name: r.name,
              category: 'Custom',
              image: r.image ?? '',
              isCustom: true,
              ingArr: r.ingredients ?? [],
            })) || [];

          // Merge custom recipes into allDrinks
          setAD(prev => {
            const newDrinks = [...prev];
            customRecipes.forEach((cr: Drink) => {
              if (!newDrinks.some(d => d.id === cr.id)) {
                newDrinks.push(cr);
              }
            });
            return newDrinks;
          });
        } catch (error) {
          console.error('Error fetching custom recipes:', error);
        }
      };

      fetchCustomRecipes();
    }
  }, [existingEvent, allDrinks]);

  // ── whenever either side changes, rebuild menu ─────────────
  useEffect(() => {
    if (!existingEvent) return;                     // nothing to load yet
    if (menuSynced)  return;                        // already populated once

    /* make sure we **have** every drink the event references
      (stock *and* custom) before the first population */
    const needIds = [
      ...(existingEvent.drinkIDs        ?? []).map(String),
      ...(existingEvent.customRecipeIDs ?? []),
    ];
    const allHaveArrived = needIds.every(id =>
      allDrinks.some(d => String(d.id) === id),
    );
    if (!allHaveArrived) return;                   // wait until they do

    const standard = (existingEvent.drinkIDs ?? [])
        .map(id => allDrinks.find(d => Number(d.id) === id))
        .filter(Boolean) as Drink[];

    const custom   = (existingEvent.customRecipeIDs ?? [])
        .map(id => allDrinks.find(d => d.id === id))
        .filter(Boolean) as Drink[];

    setMenu([...standard, ...custom]);              // first reliable load
    setSynced(true);                                // freeze further auto-writes
  }, [existingEvent, allDrinks, menuSynced]);


  /* auto‑select today */
  useEffect(() => {
    if (edit) {
      const loadExistingEvent = async () => {
        try {
          const { data } = await client.graphql({
            query: getEvent,
            variables: { id: edit },
            authMode: 'userPool'
          });
          
          if (!data?.getEvent) {
            Alert.alert('Error', 'Event not found');
            return;
          }

          const event = data.getEvent;
          setExistingEvent({
            ...event,
            _id: event.id,
            owner: event.owner,
            description: event.description ?? undefined,
            location: event.location ?? undefined,
            drinkIDs: event.drinkIDs ? event.drinkIDs.filter((id: number | null): id is number => id !== null) : undefined,
            customRecipeIDs: Array.isArray(event.customRecipeIDs)
              ? event.customRecipeIDs.filter((id: string | null): id is string => id !== null)
              : undefined,
          });

          const start = new Date(event.startTime);
          const end = new Date(event.endTime);
          
          setName(event.name);
          setLocation(event.location || '');
          setDesc(event.description || '');
          setMD(start.toDateString() !== end.toDateString());
          setSD(fmt(start));
          setED(fmt(end));
          setST(start.toTimeString().slice(0,5));
          setET(end.toTimeString().slice(0,5));
          
          const standard = (event.drinkIDs || []).map(id => 
            allDrinks.find(d => Number(d.id) === id)
          ).filter(Boolean) as Drink[];
          const custom = (event.customRecipeIDs || []).map(id => 
            allDrinks.find(d => d.id === id)
          ).filter(Boolean) as Drink[];
          setMenu([...standard, ...custom]);

        setExistingEvent({
                  ...event,
                  _id: event.id,
                  owner: event.owner,
                  description: event.description ?? undefined,
                  location: event.location ?? undefined,
                  drinkIDs: event.drinkIDs ? 
                    event.drinkIDs.filter((id: number | null): id is number => id !== null) 
                    : undefined,
                  customRecipeIDs: Array.isArray(event.customRecipeIDs)
                    ? event.customRecipeIDs.filter((id: string | null): id is string => id !== null)
                    : undefined,
                });
        } catch (error) {
          const msg = (error && typeof error === 'object' && 'message' in error)
            ? (error as any).message
            : String(error);
          Alert.alert('Error', 'Failed to load event: ' + msg);
        }
      };
      loadExistingEvent();
    }
  }, [edit]);

  useFocusEffect(
    React.useCallback(() => {
      if (currentUser) fetchMyRecipes(currentUser, setAD);
    }, [currentUser]),
  );

  /* save */
  const save = async () => {
    if (liquorbotId === undefined || liquorbotId === null) {
      Alert.alert('Error', 'Device ID not ready – try again in a second'); return;
    }
    
    const start = parseDT(startDate, startTime);
    const end = parseDT(multiDay ? endDate : startDate, endTime);
    if (!multiDay && end <= start) {
      setET('23:59');
    }

    try {
    const { data } = await client.graphql({
      query: listEvents,
      variables: { filter: eventFilter(currentUser!, Number(liquorbotId)) },
      authMode: 'userPool',
    }) as { data: any };

    const existing = (data.listEvents.items ?? []).map((i: any) => ({
      id:        i.id,
      name:      i.name,
      startTime: i.startTime,
      endTime:   i.endTime,
    }));

    const conflicts = checkForOverlappingEvents(
      start.toISOString(),
      end.toISOString(),
      existing,
      existingEvent?._id,          // so an edit can keep its own slot
    );

    if (conflicts.length) {
      const msg = conflicts
        .map(c => `• ${c.name} (${new Date(c.startTime).toLocaleString()} – ${new Date(c.endTime).toLocaleString()})`)
        .join('\n');
      Alert.alert(
        'Schedule Conflict',
        `This event overlaps with:\n\n${msg}\n\nChange the time or adjust the conflicting event first.`,
      );
      return;                       // ⬅️ stop here – don’t save
    }
  } catch (err) {
    console.error('Conflict-check failed', err);
    Alert.alert('Error', 'Could not verify schedule conflicts – try again.');
    return;
  }

    const defaultIDs = menu.filter(d => !d.isCustom).map(d => Number(d.id));
    const customRecipeIDs = menu.filter(d => d.isCustom).map(d => d.id);
    
    const input = {
      name: name.trim(),
      description,
      location,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      liquorbotId: Number(liquorbotId),
      inviteCode: existingEvent?.inviteCode || Math.random().toString(36).slice(2, 8).toUpperCase(),
      drinkIDs: defaultIDs,
      customRecipeIDs,
      owner: currentUser ?? '', // Ensure owner is always a string
    };

    try {
      if (existingEvent) {
        await client.graphql({
          query: updateEvent,
          variables: { 
            input: { 
              ...input, 
              id: existingEvent._id,
              owner: existingEvent.owner
            } 
          },
          authMode: 'userPool'
        });
        Alert.alert('Updated', 'Event updated successfully!');
      } else {
        /* 1️⃣ create the event (without extra juggling) */
        const { data } = await client.graphql({
          query: createEvent,
          variables: { input },
          authMode: 'userPool',
        }) as { data: { createEvent: { id: string } } };

        /* 2️⃣ if we actually have custom recipes, immediately patch them in.
              (harmless no-op when the field already stuck.) */
        if (customRecipeIDs.length) {
          await client.graphql({
            query: updateEvent,
            variables: {
              input: {
                id: data.createEvent.id,
                customRecipeIDs,
                drinkIDs: defaultIDs,
              },
            },
            authMode: 'userPool',
          });
        }
        const link = Linking.createURL('/join', { queryParams: { invite: input.inviteCode } });
        Clipboard.setStringAsync(link);
        Alert.alert('Saved', 'Invite link copied!');
      }
      router.push('./events');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Operation failed');
    }
  };

  /* check if date is in the past */
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#141414' }} // Set background color to match app
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 30}
    >
      {/* Ensure container also has background */}
      <View style={[styles.container, { backgroundColor: '#141414', flex: 1 }]}> 
        {/* close */}
        <TouchableOpacity 
          style={styles.closeBtn} 
          onPress={() => router.back()} // Changed from router.push('/')
        >
          <Ionicons name="close" size={28} color="#DFDCD9"/>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#CE975E" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.header}>Create Event</Text>
            <Field label="Event Name" value={name} onChange={setName} ph="e.g. Emma & Liam Wedding"/>
            <Field label="Location" value={location} onChange={setLocation} ph="Venue or address"/>
            <Field label="Description" value={description} onChange={setDesc}
                  ph="Optional notes" multiline/>

            {/* ── MULTI‑DAY TOGGLE ── */}
            <TouchableOpacity
              style={[styles.mdToggle, multiDay && styles.mdToggleOn]}
              onPress={toggleMultiDay}>
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.drinkTxt}>
                    {d.name}
                    {d.isCustom && <Text style={styles.customTag}> (custom)</Text>}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeDrink(d.id)}>
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
            <Text style={styles.deviceIdText}>
              This event will be hosted on LiquorBot: {liquorbotId}
            </Text>
          </ScrollView>
        )}

        {/* drink‑picker modal */}
        <Modal visible={pickerVis} animationType="slide"
          onRequestClose={()=>setPV(false)}
          presentationStyle={Platform.OS==='ios'?'pageSheet':'fullScreen'}>
          <PickerModal
            cat={cat}
            setCat={setCat}
            q={q}
            setQ={setQ}
            filtered={filtered}
            loading={loading}
            addDrink={addDrink}
            close={()=>setPV(false)}
            allDrinks={allDrinks}
            canAddDrink={canAddDrink}
            menu={menu}
          />
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
              • <Text style={{ fontWeight: 'bold' }}>Start time</Text> – when LiquorBot unlocks and begins serving.{'\n\n'}
              • <Text style={{ fontWeight: 'bold' }}>End time</Text> – when it locks again and stops serving.{'\n\n'}
              If you pick an end-time that is{' '}
              <Text style={{ fontStyle: 'italic' }}>earlier</Text> than the start-time
              (for example 6 PM → 1 AM), the app automatically switches the event to{' '}
              <Text style={{ fontWeight: 'bold' }}>Multi-day</Text> and pre-fills the
              second date with the following day.{'\n\n'}
              Turning <Text style={{ fontWeight: 'bold' }}>Multi-day</Text> back off
              keeps your chosen end-time <Text style={{ fontStyle: 'italic' }}>unless</Text>{' '}
              it would now be earlier than the start-time—in that case the app safely
              bumps it to <Text style={{ fontWeight: 'bold' }}>11 : 59 PM</Text>.
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
        <TimePickerModal
          visible={!!twTarget}
          value24={twTarget === 'start' ? startTime : endTime}
          anchor={twAnchor}
          onClose={() => { setTWT(null); setTWA(null); }}
          onPick={(v) => (twTarget === 'start' ? setST(v) : setET(v))}
        />
      </View>
    </KeyboardAvoidingView>
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
          multiline && { height: Math.max(40, height), textAlignVertical: 'top' },
        ]}
        multiline={multiline}
        placeholder={ph}
        placeholderTextColor="#4F4F4F"
        value={value}
        onChangeText={onChange}
        onContentSizeChange={(e) => setHeight(e.nativeEvent.contentSize.height)}
        blurOnSubmit={true}
        returnKeyType={multiline ? 'default' : 'done'}
        
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

 const PickerModal = ({ cat, setCat, q, setQ, filtered, loading, addDrink, close, allDrinks, canAddDrink, menu }: any) => {
  const router = useRouter();
  // split items: makeable vs non-makeable
  const filteredMakeable = filtered;
  // Define a predicate interface for clarity
  interface DrinkFilter {
    (drink: Drink): boolean;
  }

  const filteredNonMakeable: Drink[] = allDrinks.filter(
    (d: Drink): boolean => 
      (cat === 'All' || d.category === cat) &&
      d.name.toLowerCase().includes(q.toLowerCase()) &&
      !menu.some((m: Drink) => m.id === d.id) &&
      !canAddDrink(d)
  );
  const combined = [...filteredMakeable, ...filteredNonMakeable];

  function openCustomDrink() {
    close(); // Close the picker modal first
    router.push(`/create-drink?from=drink-list`);
  }

  return (
    <View style={styles.modal}>
      <View style={styles.modalHeader}>
        {/* Header row with all controls */}
        <View style={styles.headerRow}>
          {/* Close chevron (left-aligned) */}
          <TouchableOpacity onPress={close} style={styles.chevronButton}>
            <Ionicons name="chevron-down" size={30} color="#DFDCD9" />
          </TouchableOpacity>

          {/* Centered title */}
          <Text style={styles.modalHeaderText}>Select a Drink</Text>

          {/* Edit button (right-aligned) */}
          <TouchableOpacity 
            onPress={openCustomDrink}
            style={styles.editButton}
          >
            <Ionicons name="create-outline" size={24} color="#CE975E" />
          </TouchableOpacity>
        </View>

        {/* Rest of the header content */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {categories.map(c => (
            <TouchableOpacity key={c} onPress={() => setCat(c)} style={styles.catBtn}>
              <Text style={[styles.catTxt, cat === c && styles.catSel]}>{c}</Text>
              {cat === c && <View style={styles.under} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color="#4F4F4F" style={{ marginRight: 8 }} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search drinks"
            placeholderTextColor="#4F4F4F" 
            value={q} 
            onChangeText={setQ} 
          />
        </View>
      </View>

    {/* Drink list with tighter spacing */}
    {loading ? (
      <ActivityIndicator size="large" color="#CE975E" style={{ marginTop: 20 }} />
    ) : (
      <FlatList
        data={combined}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => {
          const disabled = !canAddDrink(item);
          return (
            <TouchableOpacity
              style={[styles.drinkItem, disabled && { opacity: 0.5 }]} 
              onPress={() => { if (!disabled) addDrink(item); }}
              disabled={disabled}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.drinkItemText, disabled && { color: '#777' }]}>{item.name}</Text>
                {item.isCustom && <Text style={styles.customTag}> (custom)</Text>}
              </View>
            </TouchableOpacity>
          );
// customTag style is defined below in the StyleSheet
        }}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListFooterComponent={() => (
          <Text style={{ color: '#4F4F4F', fontSize: 10, textAlign: 'center', marginTop: 24, marginBottom: 8, paddingHorizontal: 16 }}>
            Drinks here are filtered based on the unique ingredients your LiquorBot can hold. Drinks you cannot make are shown below and disabled.
          </Text>
        )}
      />
    )}
  </View>
  );
};

/* date formatting */
function fmt(d:Date){return`${String(d.getMonth()+1).padStart(2,'0')}/${
  String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;}

const{width:W}=Dimensions.get('window');
const styles = StyleSheet.create({
  customTag: { marginLeft: 6, color: '#888', fontSize: 12 },
  modalHeader:      { paddingTop: 20, paddingHorizontal: 20, backgroundColor: '#141414', zIndex: 1 },
  headerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 30 },
  chevronButton:    { /* Keeps the chevron on the left */ },
  modalHeaderText:  { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  editButton:       { padding: 8 },
  catRow:           { paddingBottom: 0, marginBottom: 1 },
  listContent:      { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 0 },
  itemSeparator:    { height: 1, backgroundColor: '#333', marginHorizontal: 16 },
  drinkItem:        { paddingVertical: 12 },
  modal:            { flex: 1, backgroundColor: 'transparent' },
  searchRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginBottom: 5 },
  drinkItemText:    { color: '#DFDCD9', fontSize: 16 },
  container:        { flex: 1, backgroundColor: '#141414' },
  closeBtn:         { position: 'absolute', top: 62, left: 20, zIndex: 10, padding: 10 },
  scroll:           { paddingTop: 70, paddingHorizontal: 20, paddingBottom: 40 },
  header:           { fontSize: 24, color: '#DFDCD9', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label:            { color: '#DFDCD9', marginBottom: 5, fontSize: 16 },
  input:            { backgroundColor: '#1F1F1F', color: '#DFDCD9', borderRadius: 10, padding: 12, fontSize: 16 },
  mdToggle:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, padding: 12, marginBottom: 6 },
  mdToggleOn:       { borderColor: '#CE975E', borderWidth: 1 },
  mdToggleTxt:      { color: '#DFDCD9', marginLeft: 8, fontSize: 15 },
  dateRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dateBox:          { flex: 1, backgroundColor: '#1F1F1F', color: '#DFDCD9', borderRadius: 10, padding: 12, fontSize: 16, marginRight: 4 },
  timeRow:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  timeBox:          { flex: 1, backgroundColor: '#1F1F1F', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginHorizontal: 4 },
  timeTag:          { position: 'absolute', top: 4, left: 8, fontSize: 11, color: '#CE975E', letterSpacing: 1 },
  timeTxt:          { color: '#DFDCD9', fontSize: 16, marginTop: 6 },
  menuHead:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 5 },
  section:          { color: '#DFDCD9', fontSize: 18, fontWeight: 'bold' },
  drinkRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1F1F1F', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10, marginBottom: 8 },
  drinkTxt:         { color: '#DFDCD9', fontSize: 16 },
  slots:            { color: '#DFDCD9', fontSize: 12, marginBottom: 10 },
  slotBox:          { backgroundColor: '#1F1F1F', borderRadius: 10, padding: 10, marginBottom: 4 },
  slotLine:         { color: '#DFDCD9', fontSize: 14, marginVertical: 2 },
  saveBtn:          { backgroundColor: '#CE975E', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveTxt:          { color: '#141414', fontSize: 18, fontWeight: 'bold' },
  modalClose:       { position: 'absolute', top: 45, left: 30, zIndex: 10 },
  catBtn:           { paddingVertical: 10, paddingHorizontal: 10, marginHorizontal: 6 },
  catTxt:           { color: '#4F4F4F', fontSize: 14 },
  catSel:           { color: '#CE975E' },
  under:            { height: 2, backgroundColor: '#CE975E', width: '100%', marginTop: 2 },
  searchInput:      { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  twBackdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: '#0009' },
  twCard:           { position: 'absolute', backgroundColor: '#1F1F1F', borderRadius: 16, overflow: 'hidden' },
  twItem:           { color: '#DFDCD9', fontSize: 18 },
  twHighlight:      { position: 'absolute', left: 0, right: 0, height: 36, top: '50%', marginTop: -18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#CE975E' },
  timeInfoHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoButton:       { marginLeft: 8, padding: 4 },
  infoBackdrop:     { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', alignItems: 'center' },
  infoPopup:        { backgroundColor: '#1F1F1F', borderRadius: 16, padding: 20, width: '80%', position: 'relative' },
  infoTitle:        { color: '#CE975E', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  infoText:         { color: '#DFDCD9', fontSize: 14, lineHeight: 20 },
  infoClose:        { position: 'absolute', top: 12, right: 12, padding: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#141414' },
  deviceIdText:     { color: '#4F4F4F', fontSize: 12, textAlign: 'center', marginTop: 16 },
  backdrop:         { ...StyleSheet.absoluteFillObject, backgroundColor: '#0009' },
  card:             { position: 'absolute', backgroundColor: '#1F1F1F', borderRadius: 16, overflow: 'hidden', justifyContent: 'center' },
  closeIcon:        { position: 'absolute', top: 6, right: 6, padding: 6, zIndex: 10, elevation: 10 },
});