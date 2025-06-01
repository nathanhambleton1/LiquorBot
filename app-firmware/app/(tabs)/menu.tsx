// -----------------------------------------------------------------------------
// File: menu.tsx   (UPDATED – 1 Jun 2025)
// Adds polished sign-in prompt when a guest taps the heart icon.
// -----------------------------------------------------------------------------
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Text, View, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, LayoutAnimation, Platform, UIManager, Animated,
  TextInput, Modal, Switch, ActivityIndicator, Alert,
} from 'react-native';
import Ionicons      from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage  from '@react-native-async-storage/async-storage';

// Amplify & PubSub
import { Amplify }   from 'aws-amplify';
import { PubSub }    from '@aws-amplify/pubsub';
import config        from '../../src/amplifyconfiguration.json';

// GraphQL & Auth
import { generateClient } from 'aws-amplify/api';
import { createLikedDrink, deleteLikedDrink, createPouredDrink } from '../../src/graphql/mutations';
import { listLikedDrinks } from '../../src/graphql/queries';
import { getCurrentUser }  from 'aws-amplify/auth';
import { getUrl }          from 'aws-amplify/storage';

// LiquorBot context
import { useLiquorBot } from '../components/liquorbot-provider';

Amplify.configure(config);
const client = generateClient();

const pubsub = new PubSub({
  region  : 'us-east-1',
  endpoint: 'wss://a2d1p97nzglf1y-ats.iot.us-east-1.amazonaws.com/mqtt',
});

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/* -------------------------------------------------------------------------- */
/*                               GraphQL helper                               */
/* -------------------------------------------------------------------------- */
const LIST_CUSTOM_RECIPES_WITH_ING = /* GraphQL */ `
  query ListCustomRecipes {
    listCustomRecipes {
      items {
        id
        name
        description
        image
        ingredients { ingredientID amount priority }
        createdAt
      }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */
type Drink = {
  id: number;
  name: string;
  category: string;
  description?: string;
  image: string;
  ingredients?: string;
  isCustom?: boolean;
  recipeId?: string;
  imageKey?: string | null;
};
type BaseIngredient = { id: number; name: string; type: string };
type ParsedIngredient = { id: number; name: string; amount: number; priority: number };

/* -------------------------------------------------------------------------- */
/*                             DRINK-ITEM COMPONENT                           */
/* -------------------------------------------------------------------------- */
interface DrinkItemProps {
  drink: Drink;
  isExpanded: boolean;
  isLiked: boolean;
  isMakeable: boolean;
  isGuest: boolean;
  toggleFavorite: (id: number) => Promise<void>;
  onExpand: (id: number) => void;
  onCollapse: () => void;
  allIngredients: BaseIngredient[];
  onExpandedLayout?: (layout: { y: number }) => void;
  onGuestPrompt: () => void;             // NEW
}

function parseIngredientString(
  ingredientString: string,
  allIngredients: BaseIngredient[],
): ParsedIngredient[] {
  if (!ingredientString) return [];
  return ingredientString.split(',').map(chunk => {
    const [idStr, amountStr, priorityStr] = chunk.split(':');
    const id       = parseInt(idStr, 10);
    const amount   = parseFloat(amountStr);
    const priority = parseInt(priorityStr, 10);
    const ingObj   = allIngredients.find(ing => ing.id === id);
    const name     = ingObj ? ingObj.name : `Ingredient #${id}`;
    return { id, name, amount, priority };
  });
}

function buildSlotCommand(ingredientString: string, slots: number[], qty: number): string {
  if (!ingredientString) return '';
  return ingredientString
    .split(',')
    .map(chunk => {
      const [idStr, amtStr, prioStr] = chunk.split(':');
      const ingId  = Number(idStr);
      const amount = Number(amtStr) * qty;
      const prio   = Number(prioStr);
      const slotIdx = slots.findIndex(id => id === ingId);
      if (slotIdx === -1) return null;
      const slotNum = slotIdx + 1;
      return `${slotNum}:${amount}:${prio}`;
    })
    .filter(Boolean)
    .join(',');
}

function DrinkItem({
  drink,
  isExpanded,
  isLiked,
  isMakeable,
  isGuest,
  toggleFavorite,
  onExpand,
  onCollapse,
  allIngredients,
  onExpandedLayout,
  onGuestPrompt,                     // NEW
}: DrinkItemProps) {
  const [animValue] = useState(new Animated.Value(isExpanded ? 1 : 0));
  const [quantity,  setQuantity] = useState(1);
  const { isConnected, slots, liquorbotId } = useLiquorBot();
  const [logging, setLogging] = useState(false);
  const [statusAnim] = useState(new Animated.Value(0));
  const [statusType, setStatusType] = useState<'success'|'error'|null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const router = useRouter();

  const parsedIngredients = parseIngredientString(
    drink.ingredients ?? '', allIngredients,
  );

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  /* ---------------- POUR LOGIC (signed-in only) ---------------- */
  async function publishDrinkCommand() {
    const cmd = buildSlotCommand(drink.ingredients ?? '', slots, quantity);
    if (!cmd) throw new Error('No valid ingredients to pour');
    await pubsub.publish({
      topics: [`liquorbot/liquorbot${liquorbotId}/publish`],
      message: cmd,
    });
  }

  async function handlePourDrink() {
    if (logging || !isMakeable) return;
    if (!isConnected) {
      triggerStatus('error','LiquorBot is not connected.');
      return;
    }
    setLogging(true);
    try {
      await publishDrinkCommand();
    } catch (e) {
      triggerStatus('error','Pour failed – please try again.');
      setLogging(false);
    }
  }

  const triggerStatus = (type:'success'|'error', msg:string) => {
    setStatusType(type);
    setStatusMessage(msg);
    statusAnim.setValue(1);
    Animated.timing(statusAnim,{ toValue:0,duration:5000,useNativeDriver:false })
      .start(()=>setStatusType(null));
  };

  /* ---------------------- RENDER (EXPANDED) --------------------- */
  if (isExpanded) {
    return (
      <Animated.View
        onLayout={e => onExpandedLayout?.(e.nativeEvent.layout)}
        style={[
          styles.box, styles.expandedBox,
          { transform:[{ scale:animValue.interpolate({ inputRange:[0,1], outputRange:[0.95,1] }) }]},
        ]}
      >
        {/* top-buttons */}
        <TouchableOpacity onPress={onCollapse} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#DFDCD9" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => isGuest ? onGuestPrompt() : toggleFavorite(drink.id)}
          style={styles.expandedFavoriteButton}
        >
          <Ionicons
            name={isLiked ? 'heart':'heart-outline'}
            size={24} color={isLiked ? '#CE975E' : '#4F4F4F'}
          />
        </TouchableOpacity>

        {/* content */}
        <View style={styles.expandedContent}>
          <View style={styles.expandedTitleContainer}>
            <Text style={styles.expandedboxText}>{drink.name}</Text>
            <Text style={styles.expandedcategoryText}>{drink.category}</Text>
          </View>
          <Image source={{ uri: drink.image }} style={styles.expandedImage}/>
        </View>
        <View style={styles.expandeddetailContainer}>
          {parsedIngredients.length
            ? <Text style={styles.expandeddescriptionText}>
                Contains {parsedIngredients
                  .map((it,i)=> i===parsedIngredients.length-1 && i!==0 ? `and ${it.name}` : it.name)
                  .join(', ')}.
              </Text>
            : <Text style={styles.expandeddescriptionText}>No ingredients found.</Text>}
        </View>

        {/* quantity */}
        <View style={styles.quantityContainer}>
          <TouchableOpacity onPress={()=>setQuantity(q=>Math.max(1,q-1))} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity onPress={()=>setQuantity(q=>Math.min(3,q+1))} style={styles.quantityButton}>
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* button area */}
        <View style={styles.buttonArea}>
          {isGuest ? (
            <TouchableOpacity style={styles.button} onPress={()=>router.push('../auth/sign-in')}>
              <Text style={styles.buttonText}>Sign in to pour</Text>
            </TouchableOpacity>
          ) : (
            <>
              <AnimatedTouchable
                style={[
                  styles.button,
                  statusType && {
                    backgroundColor: statusAnim.interpolate({
                      inputRange:[0,1],
                      outputRange:['#CE975E', statusType==='error' ? '#D9534F' : '#63d44a'],
                    }),
                  },
                  (!isMakeable || logging || !isConnected) && styles.disabledButton,
                ]}
                onPress={handlePourDrink}
                disabled={logging || !isMakeable || !isConnected}
              >
                <View style={styles.buttonContent}>
                  <Text style={[
                    styles.buttonText,
                    (!isMakeable || logging || !isConnected) && styles.disabledButtonText,
                  ]}>
                    {!isConnected ? 'No Pouring Device Connected'
                      : !isMakeable ? 'Missing Ingredients'
                      : logging ? 'Pouring…'
                      : 'Pour Drink'}
                  </Text>
                  {logging && <ActivityIndicator size="small" color="#FFF" style={styles.spinner}/>}
                </View>
              </AnimatedTouchable>
              {statusType && (
                <Text style={[
                  styles.statusMessageOverlay,
                  statusType==='error' ? styles.errorText : styles.successText,
                ]}>
                  {statusMessage}
                </Text>
              )}
            </>
          )}
        </View>
      </Animated.View>
    );
  }

  /* ---------------------- RENDER (COLLAPSED) -------------------- */
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={()=>{
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onExpand(drink.id);
      }}
      style={styles.box}
    >
      <TouchableOpacity
        onPress={()=> isGuest ? onGuestPrompt() : toggleFavorite(drink.id)}
        style={styles.favoriteButton}
      >
        <Ionicons
          name={isLiked ? 'heart':'heart-outline'}
          size={24} color={isLiked ? '#CE975E' : '#4F4F4F'}
        />
      </TouchableOpacity>
      <Image source={{ uri: drink.image }} style={styles.image}/>
      <Text style={styles.boxText}>{drink.name}</Text>
      <Text style={styles.categoryText}>{drink.category}</Text>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------------------------- */
/*                                MAIN SCREEN                                 */
/* -------------------------------------------------------------------------- */
export default function MenuScreen() {
  const router                 = useRouter();
  const scrollViewRef          = useRef<ScrollView>(null);
  const { isConnected, slots, liquorbotId, isAdmin } = useLiquorBot();
  const isFocused              = useIsFocused();

  /* ------------------------ STATE ------------------------ */
  const [drinks,setDrinks]                 = useState<Drink[]>([]);
  const [allIngredients,setAllIngredients] = useState<BaseIngredient[]>([]);
  const [loading,setLoading]               = useState(true);

  const categories = ['All','Vodka','Rum','Tequila','Whiskey'];
  const [selectedCategory,setSelectedCategory] = useState('All');
  const [searchQuery,setSearchQuery] = useState('');

  const [filterModalVisible,setFilterModalVisible] = useState(false);
  const [onlyMakeable,setOnlyMakeable] = useState(false);
  const [alphabetical,setAlphabetical] = useState(false);
  const [onlyCustom,setOnlyCustom]     = useState(false);

  const [expandedDrink,setExpandedDrink] = useState<number|null>(null);
  const [userID,setUserID]               = useState<string|null>(null);
  const [likedDrinks,setLikedDrinks]     = useState<number[]>([]);
  const [customFetched,setCustomFetched] = useState(false);

  /* sign-prompt modal */
  const [signPromptVisible,setSignPromptVisible] = useState(false);

  /* helper passed into DrinkItem */
  const showSignPrompt = () => setSignPromptVisible(true); 

  /* ------------------- slot-config request ------------------ */
  const GET_CONFIG = { action:'GET_CONFIG' };
  const requestSlotConfig = useCallback(async()=>{
    if (!liquorbotId || !isConnected) return;
    try {
      await pubsub.publish({
        topics:[`liquorbot/liquorbot${liquorbotId}/slot-config`],
        message:GET_CONFIG,
      });
    } catch {}
  },[liquorbotId,isConnected]);

  useEffect(()=>{
    if (!isFocused) return;
    requestSlotConfig();
    const t = setTimeout(()=>{
      const anyLoaded = slots.some(id=>id>0);
      if (!anyLoaded) requestSlotConfig();
    },2000);
    return ()=>clearTimeout(t);
  },[isFocused,slots,requestSlotConfig]);

  /* ------------------- JSON FETCH (public fallback) ------------------ */
  const PUBLIC_BASE = 'https://liquorbot-storage-8cb6bcd8a9244-dev.s3.amazonaws.com/public/';
  async function fetchJsonWithFallback(key:string):Promise<string>{
    try {
      const { url } = await getUrl({ key });
      return await fetch(url).then(r=>r.text());
    } catch {
      const publicUrl = `${PUBLIC_BASE}${key}`;
      return await fetch(publicUrl).then(r=>r.text());
    }
  }

  useEffect(()=>{
    (async()=>{
      try {
        const [cachedD,cachedI] = await AsyncStorage.multiGet(['drinksJson','ingredientsJson']);
        const dStr = cachedD?.[1] ?? null;
        const iStr = cachedI?.[1] ?? null;
        if (dStr && iStr) {
          setDrinks(JSON.parse(dStr));
          setAllIngredients(JSON.parse(iStr));
          setLoading(false);
        }
      } catch {}
    })();
  },[]);

  useEffect(()=>{
    if (drinks.length && allIngredients.length) return;
    (async()=>{
      try {
        const [dText,iText] = await Promise.all([
          fetchJsonWithFallback('drinkMenu/drinks.json'),
          fetchJsonWithFallback('drinkMenu/ingredients.json'),
        ]);
        await AsyncStorage.multiSet([
          ['drinksJson',dText],
          ['ingredientsJson',iText],
        ]);
        setDrinks(JSON.parse(dText));
        setAllIngredients(JSON.parse(iText));
      } catch(e){ console.error(e); }
      finally { setLoading(false); }
    })();
  },[drinks.length,allIngredients.length]);

  /* ------------------- auth & likes ------------------ */
  useEffect(()=>{
    (async()=>{
      try {
        const user = await getCurrentUser();
        setUserID(user?.username ?? null);
      } catch { setUserID(null); }
    })();
  },[]);

  useEffect(()=>{
    if (!userID) return;
    (async()=>{
      try {
        const res:any = await client.graphql({
          query:listLikedDrinks,
          variables:{ filter:{ userID:{ eq:userID } } },
          authMode:'userPool',
        });
        setLikedDrinks(res.data?.listLikedDrinks?.items.map((i:any)=>i.drinkID) || []);
      } catch(e){ console.error(e); }
    })();
  },[userID]);

  /* ------------------- custom recipes ------------------ */
  useEffect(()=>{
    if (!userID || customFetched) return;
    (async()=>{
      try {
        const res:any = await client.graphql({
          query:LIST_CUSTOM_RECIPES_WITH_ING,
          authMode:'userPool',
        });
        const items = res.data?.listCustomRecipes?.items ?? [];
        const placeholder = 'https://d3jj0su0y4d6lr.cloudfront.net/placeholder_drink.png';
        const custom:Drink[] = await Promise.all(
          items.map(async(item:any,idx:number):Promise<Drink>=>{
            const numericId = 1_000_000 + idx;
            const ingredientsString = (item.ingredients??[])
              .map((ri:any)=>`${ri.ingredientID}:${ri.amount}:${ri.priority??1}`).join(',');
            let imageUrl = placeholder;
            if (item.image){
              try { const {url} = await getUrl({key:item.image}); imageUrl=url.toString(); } catch{}
            }
            return {
              id:numericId,
              name:item.name ?? `Custom #${idx+1}`,
              category:'Custom',
              description:item.description ?? '',
              image:imageUrl, ingredients:ingredientsString,
              isCustom:true, recipeId:item.id, imageKey:item.image ?? null,
            };
          }),
        );
        setDrinks(prev=>{
          const builtIn = prev.filter(d=>d.category!=='Custom');
          return [...builtIn,...custom];
        });
        setCustomFetched(true);
      } catch(e){ console.error(e); }
    })();
  },[userID,customFetched]);

  /* --------------- favourite toggle --------------- */
  async function toggleFavorite(drinkId:number){
    if (!userID){
      setSignPromptVisible(true);       // NEW
      return;
    }
    if (likedDrinks.includes(drinkId)){
      try {
        const res:any = await client.graphql({
          query:listLikedDrinks,
          variables:{ filter:{ userID:{eq:userID}, drinkID:{eq:drinkId} } },
          authMode:'userPool',
        });
        const existing = res.data?.listLikedDrinks?.items?.[0];
        if (existing){
          await client.graphql({
            query:deleteLikedDrink,
            variables:{ input:{ id:existing.id } },
            authMode:'userPool',
          });
        }
        setLikedDrinks(p=>p.filter(id=>id!==drinkId));
      } catch(e){ console.error(e); }
    } else {
      try {
        await client.graphql({
          query:createLikedDrink,
          variables:{ input:{ userID, drinkID:drinkId } },
          authMode:'userPool',
        });
        setLikedDrinks(p=>[...p,drinkId]);
      } catch(e){ console.error(e); }
    }
  }

  /* -------------------- filter logic ------------------- */
  const isDrinkMakeable = (drink:Drink)=>{
    if (!drink.ingredients) return false;
    const needed = drink.ingredients.split(',').map(c=>parseInt(c.split(':')[0],10));
    return needed.every(id=>slots.includes(id));
  };
  const canMake = (d:Drink)=> onlyMakeable ? isDrinkMakeable(d) : true;

  let filteredDrinks = drinks.filter(d=>
    (!onlyCustom||d.category==='Custom') &&
    (selectedCategory==='All' || d.category===selectedCategory) &&
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    canMake(d),
  );
  if (alphabetical) filteredDrinks.sort((a,b)=>a.name.localeCompare(b.name));

  const renderedDrinks = [...filteredDrinks];
  if (expandedDrink!=null){
    const i = renderedDrinks.findIndex(d=>d.id===expandedDrink);
    if (i!==-1 && i%2===1){
      renderedDrinks.splice(i-1,0,renderedDrinks.splice(i,1)[0]);
    }
  }

  const handleExpandedLayout = (layout:{y:number}) =>
    scrollViewRef.current?.scrollTo({ y:layout.y, animated:true });

  /* -------------------- loader -------------------- */
  if (loading){
    return(
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>Loading drinks…</Text>
      </View>
    );
  }

  /* ----------------------- UI ---------------------- */
  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Drinks</Text>
        <View style={styles.connectionRow}>
          <Animated.View style={[
            styles.greenDot,
            { backgroundColor:isConnected?'#63d44a':'#B81A1A', shadowColor:isConnected?'#00FF00':'#B81A1A' },
          ]}/>
          <Text style={styles.subHeaderText}>
            {isConnected?'LiquorBot Connected':'LiquorBot Disconnected'}
          </Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.editIconContainer}
            onPress={()=>router.push('/create-drink')}
          >
            <Ionicons name="create-outline" size={30} color="#CE975E"/>
          </TouchableOpacity>
        )}
      </View>

      {/* categories */}
      <View style={styles.horizontalPickerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalPicker}>
          {categories.map(cat=>(
            <TouchableOpacity key={cat} onPress={()=>setSelectedCategory(cat)}
              style={styles.categoryButton}>
              <View style={styles.categoryButtonContent}>
                <Text style={[
                  styles.categoryButtonText,
                  selectedCategory===cat && styles.selectedCategoryText
                ]}>{cat}</Text>
                {selectedCategory===cat && <View style={styles.underline}/>}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* search / filter */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color="#4F4F4F" style={styles.searchIcon}/>
        <TextInput
          style={styles.searchBar}
          placeholder="Search"
          placeholderTextColor="#4F4F4F"
          value={searchQuery} onChangeText={setSearchQuery}
        />
        {isAdmin && (
          <TouchableOpacity onPress={()=>setFilterModalVisible(true)} style={styles.filterIcon}>
            <Ionicons name="funnel-outline" size={20} color={onlyMakeable?'#CE975E':'#4F4F4F'}/>
          </TouchableOpacity>
        )}
      </View>

      {/* grid */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContainer,{ paddingBottom:expandedDrink?100:80 }]}
      >
        {renderedDrinks.length===0 ? (
          <View style={styles.noDrinksContainer}>
            <Text style={styles.noDrinksText}>
              Oops, no drinks here! Check your filters or internet connection.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {renderedDrinks.map(drink=>(
              <DrinkItem
                key={drink.id}
                drink={drink}
                isExpanded={expandedDrink===drink.id}
                isLiked={likedDrinks.includes(drink.id)}
                isMakeable={isDrinkMakeable(drink)}
                isGuest={!userID}
                toggleFavorite={toggleFavorite}
                onExpand={id=>setExpandedDrink(id)}
                onCollapse={()=>setExpandedDrink(null)}
                allIngredients={allIngredients}
                onExpandedLayout={handleExpandedLayout}
                onGuestPrompt={showSignPrompt}      // NEW
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* filter popup */}
      {isAdmin && (
        <Modal
          visible={filterModalVisible}
          transparent animationType="fade"
          onRequestClose={()=>setFilterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.filterModal}>
              <TouchableOpacity style={styles.modalCloseButton}
                onPress={()=>setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#DFDCD9"/>
              </TouchableOpacity>
              <Text style={styles.filterModalTitle}>Filter Options</Text>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Show only makeable drinks</Text>
                <Switch value={onlyMakeable} onValueChange={setOnlyMakeable}
                  trackColor={{false:'#4F4F4F',true:'#CE975E'}} thumbColor="#DFDCD9"/>
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Sort drinks alphabetically</Text>
                <Switch value={alphabetical} onValueChange={setAlphabetical}
                  trackColor={{false:'#4F4F4F',true:'#CE975E'}} thumbColor="#DFDCD9"/>
              </View>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Show only my custom drinks</Text>
                <Switch value={onlyCustom} onValueChange={setOnlyCustom}
                  trackColor={{false:'#4F4F4F',true:'#CE975E'}} thumbColor="#DFDCD9"/>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ----------- SIGN-IN PROMPT ------------- */}
      <Modal
        visible={signPromptVisible}
        transparent animationType="fade"
        onRequestClose={()=>setSignPromptVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.signCard}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={()=>setSignPromptVisible(false)}>
              <Ionicons name="close" size={24} color="#DFDCD9"/>
            </TouchableOpacity>

            <Ionicons name="person-circle-outline" size={80} color="#CE975E" style={{marginBottom:12}}/>
            <Text style={styles.signTitle}>Sign in to save favourites</Text>
            <Text style={styles.signSub}>
              Like drinks, see them on any device, and get personalised
              recommendations.
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
// -------------------------------- STYLES --------------------------------
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  headerContainer: { paddingTop: 80, paddingHorizontal: 20, marginBottom: 10 },
  headerText: { color: '#DFDCD9', fontWeight: 'bold', fontSize: 36, textAlign: 'left' },
  subHeaderText: { color: '#4F4F4F', fontSize: 18, textAlign: 'left', marginTop: 0 },
  connectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  greenDot: { width: 8, height: 8, borderRadius: 5, marginRight: 8, shadowOffset: { width: 0, height: 0 }, shadowRadius: 5, shadowOpacity: 0.6, elevation: 5 },
  horizontalPickerContainer: { alignItems: 'center', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingVertical: 5, marginBottom: -10 },
  horizontalPicker: { flexDirection: 'row', alignItems: 'center' },
  categoryButton: { paddingVertical: 10, paddingHorizontal: 15, marginHorizontal: 5 },
  categoryButtonContent: { alignItems: 'center' },
  selectedCategoryText: { color: '#CE975E' },
  underline: { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },
  categoryButtonText: { color: '#4F4F4F' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginHorizontal: 20, marginVertical: 10, marginBottom: 10 },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  scrollContainer: { flexGrow: 1, padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  box: { width: '45%', marginBottom: 25, alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, overflow: 'visible', position: 'relative', paddingVertical: 10 },
  expandedBox: { width: '100%', height: 500, padding: 20, marginBottom: 25, overflow: 'visible' },
  favoriteButton: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  expandedFavoriteButton: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
  closeButton: { position: 'absolute', top: 10, left: 10, zIndex: 2 },
  image: { top: -5, left: -15, width: '90%', height: 160, marginBottom: 10 },
  expandedboxText: { color: '#DFDCD9', fontSize: 24, marginBottom: 10, textAlign: 'left', alignSelf: 'flex-start' },
  expandedImage: { marginTop: 0, width: 200, height: 200, borderRadius: 10, marginLeft: -30 },
  expandedcategoryText: { color: '#CE975E', fontSize: 14, textAlign: 'left', alignSelf: 'flex-start' },
  expandeddescriptionText: { color: '#4F4F4F', fontSize: 14, textAlign: 'left', alignSelf: 'flex-start', marginBottom: 5 },
  expandedContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expandedTitleContainer: { flex: 1, marginTop: 50, marginRight: 10, alignSelf: 'flex-start' },
  expandeddetailContainer: { flex: 1, marginTop: 40, marginRight: 10 },
  boxText: { color: '#DFDCD9', fontSize: 18, paddingLeft: 10, marginBottom: 0, textAlign: 'left', alignSelf: 'flex-start' },
  categoryText: { color: '#CE975E', fontSize: 14, marginBottom: 10, paddingLeft: 10, textAlign: 'left', alignSelf: 'flex-start' },
  quantityContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 20 },
  quantityButton: { backgroundColor: '#4f4f4f', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5, alignItems: 'center' },
  quantityButtonText: { color: '#FFFFFF', fontSize: 20 },
  quantityText: { color: '#FFFFFF', fontSize: 20, marginHorizontal: 20 },
  button: { backgroundColor: '#CE975E', paddingVertical: 20, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', marginTop: 20, marginBottom: 20, width: '100%', alignSelf: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 20 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  spinner: { marginLeft: 10 },
  editIconContainer: { position: 'absolute', top: 85, right: 30 },
  loadingScreen: { flex: 1, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#DFDCD9', fontSize: 18 },
  filterIcon: { marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  filterModal: { width: SCREEN_WIDTH * 0.8, backgroundColor: '#1F1F1F', borderRadius: 10, padding: 20 },
  filterModalTitle: { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold', marginBottom: 20, alignSelf: 'center' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filterLabel: { color: '#DFDCD9', fontSize: 16, flex: 1, flexWrap: 'wrap' },
  modalCloseButton: { position: 'absolute', top: 15, right: 15 },
  disabledButton: { backgroundColor: '#4F4F4F' },
  disabledButtonText: { color: '#9E9E9E' },
  statusMessage: { textAlign: 'center', fontSize: 10 },
  errorText: { color: '#D9534F' },
  successText: { color: '#63d44a' },
  buttonArea: { width: '100%', alignItems: 'center', position: 'relative' },
  statusMessageOverlay: { position: 'absolute', top: '100%', marginTop: -12, fontSize: 10, textAlign: 'center' },
  editButton: { position: 'absolute', top: 10, left: 45, zIndex: 2 },
  signInButton: {
    marginTop: 15,
    backgroundColor: '#CE975E',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  signInButtonText: { color: '#FFFFFF', fontSize: 16 },
  noDrinksContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  noDrinksText: { color: '#4f4f4f', fontSize: 12, textAlign: 'center' },
  signCard:{width:SCREEN_WIDTH*0.8,backgroundColor:'#1F1F1F',borderRadius:12,
           paddingVertical:32,paddingHorizontal:24,alignItems:'center'},
  signTitle:{color:'#DFDCD9',fontSize:22,fontWeight:'700',textAlign:'center',marginBottom:10},
  signSub:{color:'#8F8F8F',fontSize:14,textAlign:'center',lineHeight:20},
  joinGo:{backgroundColor:'#CE975E',borderRadius:8,paddingVertical:12,paddingHorizontal:40,
          alignSelf:'stretch',alignItems:'center'},
  joinGoTxt:{color:'#141414',fontSize:16,fontWeight:'600'},
});