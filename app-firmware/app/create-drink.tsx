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
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  Modal, FlatList, Platform, KeyboardAvoidingView, Image, Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
    require('../assets/images/glasses/rocks_red.png'),
    require('../assets/images/glasses/rocks_yellow.png'),
    require('../assets/images/glasses/rocks_orange.png'),
    require('../assets/images/glasses/rocks_green.png'),
    require('../assets/images/glasses/rocks_blue.png'),
  ],
  [ // highball
    require('../assets/images/glasses/highball_red.png'),
    require('../assets/images/glasses/highball_yellow.png'),
    require('../assets/images/glasses/highball_orange.png'),
    require('../assets/images/glasses/highball_green.png'),
    require('../assets/images/glasses/highball_blue.png'),
  ],
  [ // martini
    require('../assets/images/glasses/martini_red.png'),
    require('../assets/images/glasses/martini_yellow.png'),
    require('../assets/images/glasses/martini_orange.png'),
    require('../assets/images/glasses/martini_green.png'),
    require('../assets/images/glasses/martini_blue.png'),
  ],
  [ // coupe
    require('../assets/images/glasses/coupe_red.png'),
    require('../assets/images/glasses/coupe_yellow.png'),
    require('../assets/images/glasses/coupe_orange.png'),
    require('../assets/images/glasses/coupe_green.png'),
    require('../assets/images/glasses/coupe_blue.png'),
  ],
  [ // margarita
    require('../assets/images/glasses/margarita_red.png'),
    require('../assets/images/glasses/margarita_yellow.png'),
    require('../assets/images/glasses/margarita_orange.png'),
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

const GARNISH_ASSETS = [
  require('../assets/images/garnishes/lime.png'),
  require('../assets/images/garnishes/cherry.png'),
  require('../assets/images/garnishes/orange.png'),
  require('../assets/images/garnishes/umbrella.png'),
];

const PLACEHOLDER_IMAGE = require('../assets/images/glasses/rocks.png');
const DRINK_COLOURS = ['#d72638', '#f5be41', '#e97451', '#57c84d', '#1e90ff'];
const GARNISH_PLACEMENTS = [
  { x: 180, y: 50, width: 50, height: 50 }, // rocks
  { x: 180, y: 40, width: 50, height: 50 }, // highball
  { x: 140, y: 10, width: 40, height: 40 }, // martini
  { x: 160, y: 20, width: 45, height: 45 }, // coupe
  { x: 140, y:  0, width: 45, height: 45 }, // margarita
];

/* ═════════════  TYPES  ═════════════ */
interface Ingredient {
  id: number; name: string; type: 'Alcohol'|'Mixer'|'Sour'|'Sweet'|'Misc'; description: string;
}
interface RecipeRow { id: number; volume: number; priority: number; }
interface DrinkMeta  { id: number; name: string; }

const CANVAS_W = 300, CANVAS_H = 300, THUMB = 70;

/* ═════════════  COMPONENT  ═════════════ */
export default function CreateDrinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    edit?: string; recipeId?: string; name?: string;
    desc?: string; ingredients?: string; imageKey?: string;
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
          return { id: Number(id), volume: Number(vol), priority: Number(pri ?? 1) };
        }),
      { id: 0, volume: 1.5, priority: 1 },
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

  /* ----------- state: image builder ----------- */
  const [builderVisible, setBuilderVisible] = useState(false);
  const [glassIdx,   setGlassIdx]   = useState(0);
  const [colourIdx,  setColourIdx]  = useState(0);
  const [garnishIdx, setGarnishIdx] = useState<number|null>(null);
  const [imageConfigured, setImageConfigured] = useState(false);
  const [exporting, setExporting]   = useState(false);

  /* ----------- edit-mode existing image ----------- */
  const [existingImageKey] = useState<string|null>(
    isEditing && params.imageKey ? String(params.imageKey) : null
  );
  const [existingImageUrl, setExistingImageUrl] = useState<string|null>(null);

  /* ----------- Skia images ----------- */
  const baseImage   = useImage(GLASS_COLOUR_ASSETS[glassIdx][colourIdx]);
  const garnishImage= useImage(garnishIdx!==null ? GARNISH_ASSETS[garnishIdx] : undefined);

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

  const adjustVol   = (idx:number, d:number) => setRows(p=>
    p.map((r,i)=>i===idx ? {...r, volume:Math.max(0, +(r.volume+d).toFixed(2))}:r));

  const setVolDirect= (idx:number, txt:string) => {
    const num=parseFloat(txt); if (!isNaN(num))
      setRows(p=>p.map((r,i)=>i===idx?{...r, volume:num}:r));
  };

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

      if(garnishImage){
        const gp=GARNISH_PLACEMENTS[glassIdx];
        ctx.drawImageRect(garnishImage,{x:0,y:0,width:garnishImage.width(),height:garnishImage.height()},gp,paint);
      }
      const pngBytes=surface.makeImageSnapshot().encodeToBytes();
      const key=`drinkImages/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      await uploadData({key,data:new Uint8Array(pngBytes),options:{contentType:'image/png'}}).result;
      return key;
    }catch(e){console.error(e); return null;}
    finally{setExporting(false);}
  },[baseImage,garnishImage,glassIdx]);

  /* ═════════════  SAVE  ═════════════ */
  const handleSave = async () => {
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
      router.back();
    }catch(e){ console.error('Save failed',e); alert('Save failed – see console.'); }
  };

  /* ═════════════  PREVIEW THUMB  ═════════════ */
  const previewCanvas = imageConfigured ? (
    <Canvas style={styles.previewCanvasSmall}>
      {baseImage   && <SkiaImage image={baseImage} x={0} y={0} width={THUMB} height={THUMB}/>}
      {garnishImage&& <SkiaImage image={garnishImage} x={THUMB*0.6} y={THUMB*0.1} width={THUMB*0.4} height={THUMB*0.4}/>}
    </Canvas>
  ) : existingImageUrl ? (
    <Image source={{uri:existingImageUrl}} style={styles.previewCanvasSmall} resizeMode="contain"/>
  ):(
    <Image source={PLACEHOLDER_IMAGE} style={styles.previewCanvasSmall} resizeMode="contain"/>
  );

  /* ═════════════  UI  ═════════════ */
  return (
    <KeyboardAvoidingView style={styles.container}
      behavior={Platform.OS==='ios'?'padding':undefined}>
      {/* close */}
      <TouchableOpacity style={styles.closeButton} onPress={()=>router.push('/menu')}>
        <Ionicons name="close" size={30} color="#DFDCD9"/>
      </TouchableOpacity>

      {/* list button */}
      <TouchableOpacity style={styles.listButton} onPress={() => router.push('/drink-list')}>
        <Ionicons name="list" size={30} color="#DFDCD9" />
      </TouchableOpacity>

      <Text style={styles.headerText}>{isEditing?'Edit Drink':'Custom Drink'}</Text>

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
                      style={styles.volumeInput} keyboardType="decimal-pad"
                      value={row.volume.toFixed(2)} onChangeText={txt=>setVolDirect(idx,txt)}
                      maxLength={5}/>
                    <TouchableOpacity onPress={()=>adjustVol(idx,0.25)} style={styles.volBtn}>
                      <Ionicons name="add" size={18} color="#DFDCD9"/>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.counterLabel}>Volume in oz</Text>
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
          style={[styles.saveButton,(drinkName.trim()===''||exporting)&&{opacity:0.4}]}
          disabled={drinkName.trim()===''||exporting}
          onPress={handleSave}>
          <Text style={styles.saveButtonText}>{exporting?'Saving…': (isEditing?'Update Drink':'Save Drink')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---------- IMAGE BUILDER MODAL ---------- */}
      <Modal
        visible={builderVisible}
        animationType="slide"
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
            {garnishImage && (
              <SkiaImage
                image={garnishImage}
                {...GARNISH_PLACEMENTS[glassIdx]}
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

            {/* Garnish picker */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.selectorRow}
            >
              {GARNISH_ASSETS.map((src, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setGarnishIdx(idx)}
                  style={[
                    styles.selectorThumb,
                    garnishIdx === idx && styles.selectedThumb,
                  ]}
                >
                  <Image source={src} style={styles.garnishThumb} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setGarnishIdx(null)}
                style={[
                  styles.selectorThumb,
                  garnishIdx === null && styles.selectedThumb,
                ]}
              >
                <Ionicons name="ban" size={28} color="#4F4F4F" />
              </TouchableOpacity>
            </ScrollView>
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
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
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
  container: {
    flex: 1,
    backgroundColor: '#141414',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 75,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  listButton: {
    position: 'absolute',
    top: 75,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  headerText: {
    fontSize: 28,
    color: '#DFDCD9',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  contentContainer: { paddingVertical: 20 },

  /* ---------- image-builder entry ---------- */
  imageBuilderEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  previewCanvasSmall: {
    width: THUMB,
    height: THUMB,
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  buildBtn: {
    marginLeft: 15,
    backgroundColor: '#1F1F1F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buildBtnText: { color: '#DFDCD9', fontSize: 16 },

  /* ---------- builder modal ---------- */
  builderModal: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 20,
  },
  modalCloseButton: { position: 'absolute', top: 70, left: 20, zIndex: 10 },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DFDCD9',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 10,
  },
  previewCanvas: {
    width: CANVAS_W,
    height: CANVAS_H,
    alignSelf: 'center',
    borderRadius: 10,
    backgroundColor: 'transparent',
    marginTop: 30,
  },
  selectorRow: {
    flexDirection: 'row',
    marginTop: 30,
  },
  selectorThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#1F1F1F',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectedThumb: {
    borderWidth: 2,
    borderColor: '#CE975E',
  },
  thumbImage: { width: 40, height: 40, resizeMode: 'contain' },
  garnishThumb: { width: 40, height: 40, resizeMode: 'contain' },
  colourSwatchContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  selectedColourSwatchContainer: {
    borderWidth: 2,
    borderColor: '#CE975E', // Gold border
  },
  colourSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  selectedColourSwatch: {
    width: 24, // Smaller size for selected color
    height: 24,
    borderRadius: 12,
  },
  doneBtn: {
    marginTop: 50,
    backgroundColor: '#CE975E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#141414', fontSize: 16, fontWeight: 'bold' },
  drinkNameInput: {
    borderWidth: 2,
    borderColor: '#CE975E', // Gold border
  },
  nameHint: { color: '#4F4F4F', fontSize: 12, marginTop: 5 },
  selectionContainer: {
    alignItems: 'center', // Center align items horizontally
    justifyContent: 'center', // Center align items vertically
    marginTop: 20, // Optional: Add spacing above the container
  },
  // rows
  ingredientsSection: { marginBottom: 30 },
  rowContainer: { marginBottom: 20 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center' },
  ingredientBox: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ingredientBoxText: { color: '#4F4F4F', fontSize: 16, flex: 1 },
  ingredientBoxTextSelected: { color: '#DFDCD9' },
  deleteBtn: { marginLeft: 10, padding: 6 },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8, // Removed justifyContent to keep groups together on the left
  },
  volumeGroup: {
    alignItems: 'flex-start',
  },
  priorityGroup: {
    alignItems: 'flex-start',
    marginLeft: 15, // Adds spacing between volume and priority groups
  },
  counterLabel: {
    color: '#808080',
    fontSize: 12,
    marginTop: 4,
  },
  volBtn: {
    backgroundColor: '#1F1F1F',
    padding: 8,
    borderRadius: 8,
    minWidth: 36, // Ensure consistent size
    alignItems: 'center', // Center icon
    justifyContent: 'center', // Center icon
  },
  volumeInput: {
    backgroundColor: '#1F1F1F',
    marginHorizontal: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: '#DFDCD9',
    fontSize: 16,
    minWidth: 60,
    textAlign: 'center',
  },
  // priority controls
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // Removed marginLeft to keep the priority box aligned to the left
  },
  priBtn: {
    backgroundColor: '#1F1F1F',
    padding: 8,
    borderRadius: 8,
    minWidth: 36, // Ensure consistent size
    alignItems: 'center', // Center icon
    justifyContent: 'center', // Center icon
  },
  priorityValue: {
    color: '#DFDCD9',
    fontSize: 16,
    marginHorizontal: 8,
    minWidth: 16,
    textAlign: 'center',
  },
  addIngredientText: { color: '#4F4F4F', fontSize: 14, marginTop: 5 },
  saveButton: {
    backgroundColor: '#CE975E',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  // modal
  modalContainer: { flex: 1, backgroundColor: '#141414', padding: 20 },
  horizontalPickerContainer: { alignItems: 'center', paddingVertical: 5 },
  horizontalPicker: { flexDirection: 'row', alignItems: 'center' },
  categoryButton: {
    marginTop: 40,
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginHorizontal: 15,
  },
  categoryButtonContent: { alignItems: 'center' },
  categoryButtonText: { color: '#4F4F4F', fontSize: 14 },
  selectedCategoryText: { color: '#CE975E' },
  underline: {
    height: 2,
    backgroundColor: '#CE975E',
    marginTop: 2,
    width: '100%',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    marginTop: 10,
  },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, color: '#DFDCD9', fontSize: 16, paddingVertical: 10 },
  loadingText: { color: '#DFDCD9', textAlign: 'center', margin: 10 },
  ingredientItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  ingredientText: { color: '#DFDCD9', fontSize: 16 },
  infoBtn: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    backgroundColor: '#1F1F1F',
    padding: 20,
    borderRadius: 10,
    marginHorizontal: 30,
    position: 'relative',
  },
  popupText: {
    color: '#DFDCD9',
    fontSize: 14,
    lineHeight: 20,
  },
  popupCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
  },
  goldText: {
    color: '#CE975E',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  grayText: {
    color: '#4f4f4f',
    fontSize: 12,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  formGroup: {                     // <<  NEW
    marginBottom: 20,
  },
  label: {                         // <<  NEW
    color: '#DFDCD9',
    marginBottom: 5,
    fontSize: 16,
  },
  input: {                         // <<  NEW
    backgroundColor: '#1F1F1F',
    color: '#DFDCD9',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
});
