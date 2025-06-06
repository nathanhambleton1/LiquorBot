// -----------------------------------------------------------------------------
// File: create-drink.tsx
// Description: Create **or** edit a custom recipe.  When navigated to with
//              `?edit=1&recipeId=…&name=…&desc=…&ingredients=…&imageKey=…`
//              the form auto-populates and Save performs an update instead of a
//              create.  Image logic keeps the original drink image unless the
//              builder is used to generate a new one.
// Author: Nathan Hambleton
// Updated: Apr 26 2025 – edit-mode support
// -----------------------------------------------------------------------------

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useUnits, ozToMl, mlToOz } from './components/UnitsContext';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  Modal, FlatList, Platform, KeyboardAvoidingView, Image, Dimensions, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';

import { Amplify } from 'aws-amplify';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/api';
import { createCustomRecipe, updateCustomRecipe } from '../src/graphql/mutations';
import config from '../src/amplifyconfiguration.json';
import { emit } from '../src/event-bus';

// ---- Skia --------------------------------------------------
import {
  Canvas, useImage, Image as SkiaImage,
} from '@shopify/react-native-skia';
import { Skia } from '@shopify/react-native-skia';

Amplify.configure(config);
const client = generateClient();

/* ═════════════  STATIC ASSETS  ═════════════ */
const GLASS_COLOUR_ASSETS: any[][] = [
  [ // rocks
    require('../assets/images/glasses/rocks_white.png'),  // white
    require('../assets/images/glasses/rocks_amber.png'),  // amber
    require('../assets/images/glasses/rocks_red.png'),    // red
    require('../assets/images/glasses/rocks_green.png'),  // green
    require('../assets/images/glasses/rocks_blue.png'),   // blue
  ],
  [ // highball
    require('../assets/images/glasses/highball_white.png'),
    require('../assets/images/glasses/highball_amber.png'),
    require('../assets/images/glasses/highball_red.png'),
    require('../assets/images/glasses/highball_green.png'),
    require('../assets/images/glasses/highball_blue.png'),
  ],
  [ // martini
    require('../assets/images/glasses/martini_white.png'),
    require('../assets/images/glasses/martini_amber.png'),
    require('../assets/images/glasses/martini_red.png'),
    require('../assets/images/glasses/martini_green.png'),
    require('../assets/images/glasses/martini_blue.png'),
  ],
  [ // coupe
    require('../assets/images/glasses/coupe_white.png'),
    require('../assets/images/glasses/coupe_amber.png'),
    require('../assets/images/glasses/coupe_red.png'),
    require('../assets/images/glasses/coupe_green.png'),
    require('../assets/images/glasses/coupe_blue.png'),
  ],
  [ // margarita
    require('../assets/images/glasses/margarita_white.png'),
    require('../assets/images/glasses/margarita_amber.png'),
    require('../assets/images/glasses/margarita_red.png'),
    require('../assets/images/glasses/margarita_green.png'),
    require('../assets/images/glasses/margarita_blue.png'),
  ],
];

const GLASS_PLACEHOLDERS = [
  require('../assets/images/glasses/rocks.png'),
  require('../assets/images/glasses/highball.png'),
  require('../assets/images/glasses/martini.png'),
  require('../assets/images/glasses/coupe.png'),
  require('../assets/images/glasses/margarita.png'),
];

const PLACEHOLDER_IMAGE = require('../assets/images/glasses/rocks.png');
// Update drink color names and values
const DRINK_COLOURS = [
  '#FFFFFF', // white
  '#FFD580', // amber
  '#d72638', // red
  '#57c84d', // green
  '#1e90ff', // blue
];

/* ═════════════  TYPES  ═════════════ */
interface Ingredient {
  id: number; name: string; type: 'Alcohol'|'Mixer'|'Sour'|'Sweet'|'Misc'; description: string;
}
interface RecipeRow { id: number; volume: number; priority: number; volStr?: string;}
interface DrinkMeta  { id: number; name: string; }

const CANVAS_W = 300, CANVAS_H = 300, THUMB = 70;

/* ═════════════  COMPONENT  ═════════════ */
export default function CreateDrinkScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    edit?: string; recipeId?: string; name?: string;
    desc?: string; ingredients?: string; imageKey?: string;
    // Add this new param to track where we came from
    from?: 'event' | 'drink-list';
  }>();

  const isEditing = params.edit === '1';
  const recipeId  = params.recipeId ?? '';

  /* ----------- state: meta ----------- */
  const [drinkName, setDrinkName]         = useState<string>(isEditing ? String(params.name ?? '') : '');
  const [allDrinks, setAllDrinks]         = useState<DrinkMeta[]>([]);
  const [loadingDrinks, setLoadingDrinks] = useState(true);

  /* ----------- state: ingredients & rows ----------- */
  const [ingredients, setIngredients]     = useState<Ingredient[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  const [rows, setRows] = useState<RecipeRow[]>(() => {
    if (!isEditing || !params.ingredients) return [{ id: 0, volume: 1.5, priority: 1 }];
    return [
      ...String(params.ingredients)
        .split(',')
        .filter(Boolean)
        .map((c) => {
          const [id, vol, pri] = c.split(':');
          return { id: Number(id), volume: Number(vol), priority: Number(pri ?? 1), volStr: String(Number(vol)) };
        }),
      { id: 0, volume: 1.5, priority: 1, volStr: '1.5' },
      ];
  });

  /* ----------- state: search & picker ----------- */
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingIndex, setEditingIndex]   = useState<number|null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All'|'Alcohol'|'Mixer'|'Sour'|'Sweet'|'Misc'>('All');
  const categories = ['All','Alcohol','Mixer','Sour','Sweet','Misc'] as const;

  /* ----------- state: priority bubble ----------- */
  const [showPriorityInfoIndex, setShowPriorityInfoIndex] = useState<number|null>(null);
  const [saving, setSaving] = useState(false);

  /* ----------- state: image builder ----------- */
  const [builderVisible, setBuilderVisible] = useState(false);
  const [glassIdx,   setGlassIdx]   = useState(0);
  const [colourIdx,  setColourIdx]  = useState(0);
  const [imageConfigured, setImageConfigured] = useState(false);
  const [exporting, setExporting]   = useState(false);

  /* ----------- edit-mode existing image ----------- */
  const [existingImageKey] = useState<string|null>(
    isEditing && params.imageKey ? String(params.imageKey) : null
  );
  const [existingImageUrl, setExistingImageUrl] = useState<string|null>(null);

  /* ----------- Skia images ----------- */
  const baseImage   = useImage(GLASS_COLOUR_ASSETS[glassIdx][colourIdx]);

  const roundToQuarter = (value: number): number => {
    return Math.round(value * 4) / 4;
  };

  /* ═════════════  VALIDATION  ═════════════ */
  const isValidNumberInput = (text: string): boolean => {
  // Allow empty string temporarily
  if (text === '') return true;
  
  // Allow numbers and single decimal point
  if (/^\d*\.?\d*$/.test(text)) {
    // Only allow one decimal point
    const decimalCount = (text.match(/\./g) || []).length;
    return decimalCount <= 1;
  }
  return false;
};

  /* ═════════════  DATA LOAD  ═════════════ */
  useEffect(() => {
    (async () => {                      // ingredient list
      setLoadingIngredients(true);
      try {
        const { url } = await getUrl({ key: 'drinkMenu/ingredients.json' });
        const list: Ingredient[] = await (await fetch(url)).json();
        list.sort((a,b)=>a.name.localeCompare(b.name));
        setIngredients(list);
      } finally { setLoadingIngredients(false); }
    })();

    (async () => {                      // drink names (dup-check)
      setLoadingDrinks(true);
      try {
        const { url } = await getUrl({ key: 'drinkMenu/drinks.json' });
        setAllDrinks(await (await fetch(url)).json());
      } finally { setLoadingDrinks(false); }
    })();
  }, []);

  /* -------- existing image URL (edit mode) -------- */
  useEffect(() => {
    if (!existingImageKey) return;
    (async () => {
      try {
        const { url } = await getUrl({ key: existingImageKey });
        setExistingImageUrl(url.toString());
      } catch { /* ignore */ }
    })();
  }, [existingImageKey]);

  /* ═════════════  HELPERS  ═════════════ */
  const ingName = (id:number) => id ? ingredients.find(i=>i.id===id)?.name ?? '' : '';

  const filteredIngredients = ingredients
    .filter(i=>i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(i=>selectedCategory==='All' || i.type===selectedCategory);

  const matchingDrink = useMemo(() => {
    if (drinkName.trim()==='') return null;
    const lc = drinkName.trim().toLowerCase();
    return allDrinks.find(d=>d.name.toLowerCase()===lc) ?? null;
  }, [drinkName, allDrinks]);

  /* ═════════════  ROW ACTIONS  ═════════════ */
  const openPicker = (idx:number) => { setEditingIndex(idx); setPickerVisible(true); };

  const assignIngredient = (ingredientId:number) => {
    if (editingIndex===null) return;
    const next=[...rows]; next[editingIndex].id = ingredientId;
    if (editingIndex===rows.length-1) next.push({ id:0, volume:1.5, priority:1 });
    setRows(next); setPickerVisible(false); setSearchQuery('');
  };

  const removeRow   = (idx:number) => {
    const next = rows.filter((_,i)=>i!==idx);
    setRows(next.length ? next : [{ id:0, volume:1.5, priority:1 }]);
  };

  const adjustVol = (idx: number, d: number) => setRows(prev =>
    prev.map((r, i) => {
      if (i !== idx) return r;
      const newVol = Math.max(0, +(r.volume + d).toFixed(2));
      return { ...r, volume: newVol, volStr: String(newVol) };  // ← keep volStr matched
    })
  );

  const adjustPriority = (idx:number, d:number) => setRows(p=>
    p.map((r,i)=>i===idx?{...r,priority:Math.min(9,Math.max(1,r.priority+d))}:r));

  /* ═════════════  IMAGE EXPORT  ═════════════ */
  const exportAndUploadImage = useCallback(async ():Promise<string|null>=>{
    if (!baseImage) return null;
    try{
      setExporting(true);
      const surface=Skia.Surface.MakeOffscreen(CANVAS_W,CANVAS_H);
      if(!surface)throw new Error('Surface fail');
      const ctx=surface.getCanvas(), paint=Skia.Paint();

      ctx.drawImageRect(baseImage,{x:0,y:0,width:baseImage.width(),height:baseImage.height()},
        {x:0,y:0,width:CANVAS_W,height:CANVAS_H},paint);

      const pngBytes=surface.makeImageSnapshot().encodeToBytes();
      const key=`drinkImages/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      await uploadData({key,data:new Uint8Array(pngBytes),options:{contentType:'image/png'}}).result;
      return key;
    }catch(e){console.error(e); return null;}
    finally{setExporting(false);}
  },[baseImage]);

  /* ═════════════  SAVE  ═════════════ */
  const handleSave = async () => {
    if (saving) return;
    setSaving(true); 
    const ingredientsInput = rows.filter(r=>r.id!==0)
      .map(({id,volume,priority})=>({
        ingredientID:String(id), amount:volume, priority,
      }));
    if(!ingredientsInput.length){ alert('Add at least one ingredient.'); return; }

    /* decide image */
    let imageKey:string|null=null;
    if(imageConfigured){
      imageKey = await exportAndUploadImage();
    }else if(existingImageKey){               // keep original
      imageKey = existingImageKey;
    }else{                                    // upload placeholder
      const { uri } = Image.resolveAssetSource(PLACEHOLDER_IMAGE);
      const buf = await (await fetch(uri)).arrayBuffer();
      const key=`drinkImages/${Date.now()}-placeholder.png`;
      await uploadData({ key, data:new Uint8Array(buf), options:{ contentType:'image/png'} }).result;
      imageKey = key;
    }
    if(!imageKey){ alert('Could not save image'); return; }

    try{
      if(isEditing){
        await client.graphql({
          query:updateCustomRecipe,
          variables:{ input:{
            id:recipeId,
            name:drinkName.trim(),
            image:imageKey,
            ingredients:ingredientsInput,
          }},
          authMode:'userPool',
        });
      } else {
        const { data } = await client.graphql({
          query: createCustomRecipe,
          variables: { input: { name: drinkName.trim(), image: imageKey, ingredients: ingredientsInput } },
          authMode: 'userPool',
        }) as { data: { createCustomRecipe: any } };

        emit('recipe-created', data.createCustomRecipe);   // ← tell whoever opened us
      }
      setSaving(false);
      navigation.goBack();
    }catch(e){ 
      console.error('Save failed',e); 
      alert('Save failed – see console.'); 
      setSaving(false);
    }
  };

  // Update the close button handlers
  const handleClose = () => {
    navigation.goBack();
  };

  /* ═════════════  VOLUME BLUR  ═════════════ */
  const handleVolumeBlur = (idx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i === idx) {
        let newValue = r.volume;
        
        // Ensure value is within range
        newValue = Math.max(0.25, Math.min(99.75, newValue));
        
        // Round to nearest 0.25
        newValue = roundToQuarter(newValue);
        
        return { ...r, volume: newValue };
      }
      return r;
    }));
  };

  /* ═════════════  PREVIEW THUMB  ═════════════ */
  const previewCanvas = imageConfigured ? (
    <Canvas style={styles.previewCanvasSmall}>
      {baseImage   && <SkiaImage image={baseImage} x={0} y={0} width={THUMB} height={THUMB}/>}
    </Canvas>
  ) : existingImageUrl ? (
    <Image source={{uri:existingImageUrl}} style={styles.previewCanvasSmall} resizeMode="contain"/>
  ):(
    <Image source={PLACEHOLDER_IMAGE} style={styles.previewCanvasSmall} resizeMode="contain"/>
  );

  const { units } = useUnits();
  /* ═════════════  UI  ═════════════ */
  return (
    <KeyboardAvoidingView style={styles.container}
      behavior={Platform.OS==='ios'?'padding':undefined}>
      {/* close */}
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={30} color="#DFDCD9" />
      </TouchableOpacity>

      <Text style={styles.headerText}>{isEditing ? 'Edit Drink' : 'Custom Drink'}</Text>

      <ScrollView contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* image builder entry */}
        <View style={styles.imageBuilderEntry}>
          {previewCanvas}
          <TouchableOpacity style={styles.buildBtn} onPress={()=>setBuilderVisible(true)}>
            <Text style={styles.buildBtnText}>{imageConfigured?'Edit Image':'Build Image'}</Text>
          </TouchableOpacity>
        </View>

        {/* name */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Drink Name</Text>
          <TextInput
            style={[styles.input,styles.drinkNameInput]}
            placeholder="e.g. Vodka Cranberry" placeholderTextColor="#4F4F4F"
            value={drinkName} onChangeText={setDrinkName}/>
          {matchingDrink && !isEditing && (
            <Text style={styles.nameHint}>Heads up — “{matchingDrink.name}” already exists.</Text>
          )}
        </View>

        {/* ingredient rows */}
        <View style={styles.ingredientsSection}>
          <Text style={styles.label}>Ingredients</Text>

          {rows.map((row,idx)=>(
            <View key={idx} style={styles.rowContainer}>
              {/* select box */}
              <View style={styles.ingredientRow}>
                <TouchableOpacity style={styles.ingredientBox} onPress={()=>openPicker(idx)}>
                  <Text style={[
                      styles.ingredientBoxText,
                      row.id!==0 && styles.ingredientBoxTextSelected,
                    ]}>
                    {ingName(row.id)||'Select Ingredient'}
                  </Text>
                  <Ionicons name={row.id===0?'add':'pencil'} size={16} color="#808080" style={{marginLeft:8}}/>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>removeRow(idx)} style={styles.deleteBtn}>
                  <Ionicons name="close" size={22} color="#d44a4a"/>
                </TouchableOpacity>
              </View>

              {/* vol + priority */}
              <View style={styles.volumeRow}>
                {/* volume */}
                <View style={styles.volumeGroup}>
                  <View style={{flexDirection:'row',alignItems:'center'}}>
                    <TouchableOpacity onPress={()=>adjustVol(idx,-0.25)} style={styles.volBtn}>
                      <Ionicons name="remove" size={18} color="#DFDCD9"/>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.volumeInput}
                      keyboardType="decimal-pad"
                      // display in selected units
                      value={(() => {
                        const v = row.volume;
                        return units === 'oz'
                          ? (row.volStr ?? String(v))
                          : ozToMl(v).toFixed(1);
                      })()}
                      onChangeText={txt => {
                        if (!isValidNumberInput(txt)) return;
                        // convert input back to oz for storage
                        const val = parseFloat(txt);
                        const oz = units === 'oz' ? val : mlToOz(val);
                        setRows(prev => prev.map((r, i) =>
                          i === idx
                            ? { ...r, volStr: String(txt), volume: Math.round(oz * 4) / 4 }
                            : r
                        ));
                      }}
                      onBlur={() => {
                        setRows(prev => prev.map((r, i) => {
                          if (i !== idx) return r;
                          const raw = r.volStr ?? '';
                          const num = parseFloat(raw);
                          if (isNaN(num)) {
                            return { ...r, volStr: String(r.volume) };
                          }
                          // clamp & round
                          const valRaw = units === 'oz' ? num : mlToOz(num);
                          const clamped = Math.max(0.25, Math.min(99.75, valRaw));
                          const rounded = Math.round(clamped * 4) / 4;
                          return { ...r, volume: rounded, volStr: String(rounded) };
                        }));
                      }}
                      maxLength={7}
                    />
                    <TouchableOpacity onPress={()=>adjustVol(idx,0.25)} style={styles.volBtn}>
                      <Ionicons name="add" size={18} color="#DFDCD9"/>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.counterLabel}>
                    Volume ({units.toUpperCase()})
                  </Text>
                </View>
                {/* priority */}
                <View style={styles.priorityGroup}>
                  <View style={styles.priorityContainer}>
                    <TouchableOpacity onPress={()=>adjustPriority(idx,-1)} style={styles.priBtn}>
                      <Ionicons name="chevron-down" size={18} color="#DFDCD9"/>
                    </TouchableOpacity>
                    <Text style={styles.priorityValue}>{row.priority}</Text>
                    <TouchableOpacity onPress={()=>adjustPriority(idx,1)} style={styles.priBtn}>
                      <Ionicons name="chevron-up" size={18} color="#DFDCD9"/>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.counterLabel}>Priority</Text>
                </View>

                <TouchableOpacity onPress={()=>setShowPriorityInfoIndex(idx)} style={styles.infoBtn}>
                  <Ionicons name="information-circle-outline" size={24} color="#4F4F4F"
                    style={{marginLeft:10,marginBottom:18}}/>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity onPress={()=>setRows(p=>[...p,{id:0,volume:1.5,priority:1}])}>
            <Text style={styles.addIngredientText}>+ Add another ingredient</Text>
          </TouchableOpacity>
        </View>

        {/* save */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, // 👈 NEW
            (drinkName.trim() === '' || saving || exporting) && { opacity: 0.4 }
          ]}
          disabled={drinkName.trim() === '' || saving || exporting}
          onPress={handleSave}
        >
          {(saving || exporting) && (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.saveButtonText}>
            {saving || exporting ? 'Saving…' : isEditing ? 'Update Drink' : 'Save Drink'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---------- IMAGE BUILDER MODAL ---------- */}
      <Modal
          visible={builderVisible}
          animationType="slide"
          // Add this for iOS modal stacking
          presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'}
          onRequestClose={() => setBuilderVisible(false)}
        >
        <View style={styles.builderModal}>
          {/* Header */}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setBuilderVisible(false)}
          >
            <Ionicons name="chevron-down" size={30} color="#DFDCD9" />
          </TouchableOpacity>
          <Text style={styles.modalHeaderText}>Build Image</Text>

          {/* Preview */}
          <Canvas style={styles.previewCanvas}>
            {baseImage && (
              <SkiaImage
                image={baseImage}
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
              />
            )}
          </Canvas>

          {/* Combined Selection Boxes */}
          <View style={styles.selectionContainer}>
            {/* Glass picker */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectorRow}
            >
              {GLASS_COLOUR_ASSETS.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setGlassIdx(idx)}
                  style={[
                    styles.selectorThumb,
                    glassIdx === idx && styles.selectedThumb,
                  ]}
                >
                  <Image
                    source={GLASS_PLACEHOLDERS[idx]}   // ← always the empty glass
                    style={styles.thumbImage}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Colour picker */}
            <View style={styles.selectorRow}>
              {DRINK_COLOURS.map((c, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setColourIdx(idx)}
                  style={[
                    styles.colourSwatchContainer,
                    colourIdx === idx && styles.selectedColourSwatchContainer,
                  ]}
                >
                  <View
                    style={[
                      styles.colourSwatch,
                      { backgroundColor: c },
                      colourIdx === idx && styles.selectedColourSwatch,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Done */}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => {
              setImageConfigured(true);
              setBuilderVisible(false);
            }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* INGREDIENT PICKER MODAL */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent={false}
        // Add this for iOS modal stacking
        presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'fullScreen'}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setPickerVisible(false)}
          >
            <Ionicons name="chevron-down" size={30} color="#DFDCD9" />
          </TouchableOpacity>

          <Text style={styles.modalHeaderText}>Select Ingredient</Text>

          {/* Categories */}
          <View style={styles.horizontalPickerContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalPicker}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={styles.categoryButton}
                >
                  <View style={styles.categoryButtonContent}>
                    <Text
                      style={[
                        styles.categoryButtonText,
                        selectedCategory === cat && styles.selectedCategoryText,
                      ]}
                    >
                      {cat}
                    </Text>
                    {selectedCategory === cat && (
                      <View style={styles.underline} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Search */}
          <View style={styles.searchBarContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#4F4F4F"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchBar}
              placeholder="Search Ingredients"
              placeholderTextColor="#4F4F4F"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Ingredient list */}
          {loadingIngredients ? (
            <Text style={styles.loadingText}>Loading ingredients…</Text>
          ) : (
            <FlatList
              data={filteredIngredients}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.ingredientItem}
                  onPress={() => assignIngredient(item.id)}
                >
                  <Text style={styles.ingredientText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* PRIORITY INFO POPUP */}
      <Modal
        visible={showPriorityInfoIndex !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPriorityInfoIndex(null)}
      >
        <TouchableOpacity
          style={styles.popupOverlay}
          activeOpacity={1}
          onPressOut={() => setShowPriorityInfoIndex(null)}
        >
          <View style={styles.popupContainer}>
            {/* Volume Section */}
            <Text style={[styles.popupText, styles.goldText]}>Volume:</Text>
            <Text style={styles.popupText}>
              The volume represents the amount of each ingredient in increments of 0.25 oz. All measurements are in ounces (oz).
            </Text>

            {/* Empty line */}
            <Text style={styles.popupText}>{'\n'}</Text>

            {/* Priority Section */}
            <Text style={[styles.popupText, styles.goldText]}>Priority:</Text>
            <Text style={styles.popupText}>
              Priority determines the pour order. Higher priority (1) pours first, while lower priority pours later.
            </Text>

            {/* Two empty lines */}
            <Text style={styles.popupText}>{'\n'}</Text>

            {/* Example Section */}
            <Text style={[styles.popupText, styles.grayText]}>
              For example, in a Tequila Sunrise, grenadine is given a higher priority so it’s poured first, creating a lovely gradient as orange juice is added on top.
            </Text>

            <TouchableOpacity
              style={styles.popupCloseBtn}
              onPress={() => setShowPriorityInfoIndex(null)}
            >
              <Ionicons name="close" size={24} color="#DFDCD9" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ────────────────────────────  STYLES  ──────────────────────────── */
const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 60, paddingHorizontal: 20 },
  closeButton: { position: 'absolute', top: 75, left: 20, zIndex: 10, padding: 10 },
  headerText: { fontSize: 28, color: '#DFDCD9', fontWeight: 'bold', textAlign: 'center', marginBottom: 10, marginTop: 20 },
  contentContainer: { paddingVertical: 20 },
  imageBuilderEntry: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  previewCanvasSmall: { width: THUMB, height: THUMB, backgroundColor: 'transparent', borderRadius: 8 },
  buildBtn: { marginLeft: 15, backgroundColor: '#1F1F1F', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  buildBtnText: { color: '#DFDCD9', fontSize: 16 },
  builderModal: { flex: 1, backgroundColor: '#141414', padding: 20 },
  modalCloseButton: { position: 'absolute', top: 80, left: 20, zIndex: 10 },
  modalHeaderText: { fontSize: 20, fontWeight: 'bold', color: '#DFDCD9', textAlign: 'center', marginTop: 60, marginBottom: 10 },
  previewCanvas: { width: CANVAS_W, height: CANVAS_H, alignSelf: 'center', borderRadius: 10, backgroundColor: 'transparent', marginTop: 30 },
  selectorRow: { flexDirection: 'row', marginTop: 30 },
  selectorThumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#1F1F1F', marginRight: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  selectedThumb: { borderWidth: 2, borderColor: '#CE975E' },
  thumbImage: { width: 40, height: 40, resizeMode: 'contain' },
  colourSwatchContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  selectedColourSwatchContainer: { borderWidth: 2, borderColor: '#CE975E' },
  colourSwatch: { width: 32, height: 32, borderRadius: 16 },
  selectedColourSwatch: { width: 24, height: 24, borderRadius: 12 },
  doneBtn: { marginTop: 50, backgroundColor: '#CE975E', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#141414', fontSize: 16, fontWeight: 'bold' },
  drinkNameInput: { borderWidth: 2, borderColor: '#CE975E' },
  nameHint: { color: '#4F4F4F', fontSize: 12, marginTop: 5 },
  selectionContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ingredientsSection: { marginBottom: 30 },
  rowContainer: { marginBottom: 20 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center' },
  ingredientBox: { backgroundColor: '#1F1F1F', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', flex: 1 },
  ingredientBoxText: { color: '#4F4F4F', fontSize: 16, flex: 1 },
  ingredientBoxTextSelected: { color: '#DFDCD9' },
  deleteBtn: { marginLeft: 10, padding: 6 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  volumeGroup: { alignItems: 'flex-start' },
  priorityGroup: { alignItems: 'flex-start', marginLeft: 15 },
  counterLabel: { color: '#808080', fontSize: 12, marginTop: 4 },
  volBtn: { backgroundColor: '#1F1F1F', padding: 8, borderRadius: 8, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  volumeInput: { backgroundColor: '#1F1F1F', marginHorizontal: 10, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, color: '#DFDCD9', fontSize: 16, minWidth: 60, textAlign: 'center' },
  priorityContainer: { flexDirection: 'row', alignItems: 'center' },
  priBtn: { backgroundColor: '#1F1F1F', padding: 8, borderRadius: 8, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  priorityValue: { color: '#DFDCD9', fontSize: 16, marginHorizontal: 8, minWidth: 16, textAlign: 'center' },
  addIngredientText: { color: '#4F4F4F', fontSize: 14, marginTop: 5 },
  saveButton: { backgroundColor: '#CE975E', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#141414', padding: 20 },
  horizontalPickerContainer: { alignItems: 'center', paddingVertical: 5 },
  horizontalPicker: { flexDirection: 'row', alignItems: 'center' },
  categoryButton: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 5, marginHorizontal: 15 },
  categoryButtonContent: { alignItems: 'center' },
  categoryButtonText: { color: '#4F4F4F', fontSize: 14 },
  selectedCategoryText: { color: '#CE975E' },
  underline: { height: 2, backgroundColor: '#CE975E', marginTop: 2, width: '100%' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F1F1F', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, marginTop: 10 },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  loadingText: { color: '#DFDCD9', textAlign: 'center', margin: 10 },
  ingredientItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333333' },
  ingredientText: { color: '#DFDCD9', fontSize: 16 },
  infoBtn: { marginLeft: 10, justifyContent: 'center' },
  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  popupContainer: { backgroundColor: '#1F1F1F', padding: 20, borderRadius: 10, marginHorizontal: 30, position: 'relative' },
  popupText: { color: '#DFDCD9', fontSize: 14, lineHeight: 20 },
  popupCloseBtn: { position: 'absolute', top: 10, right: 10, padding: 5 },
  goldText: { color: '#CE975E', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  grayText: { color: '#4f4f4f', fontSize: 12, lineHeight: 20, fontStyle: 'italic' },
  formGroup: { marginBottom: 20 },
  label: { color: '#DFDCD9', marginBottom: 5, fontSize: 16 },
  input: { backgroundColor: '#1F1F1F', color: '#DFDCD9', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 },
});