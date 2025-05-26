// ---------------------------------------------------------------------------
// EditProfilePopup – slide-in body for editing profile data
// ---------------------------------------------------------------------------
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { UserState } from '../../(tabs)/profile';   // <- adjust if path differs

interface Props {
  user: UserState;
  registeredUsername: string;
  email: string;
  firstName: string;
  lastName: string;
  birthday: string;
  bio: string;
  setFirstName: (t: string) => void;
  setLastName: (t: string) => void;
  setBio: (t: string) => void;
  onSave: () => void;
  onClose: () => void;
  onPickImage: () => void;
}

export default function EditProfilePopup({
  user,
  registeredUsername,
  email,
  firstName,
  lastName,
  birthday,
  bio,
  setFirstName,
  setLastName,
  setBio,
  onSave,
  onClose,
  onPickImage,
}: Props) {
  return (
    <View style={styles.body}>
      {/* picture & info */}
      <View style={styles.row}>
        <TouchableOpacity onPress={onPickImage} style={styles.avatarWrapper}>
          <Image
            source={
              user.profilePicture
                ? { uri: `${user.profilePicture}?${Date.now()}` }
                : require('../../../assets/images/default-profile.png')
            }
            style={styles.avatar}
          />
          <View style={styles.camOverlay}>
            <Ionicons name="camera" size={15} color="#DFDCD9" />
          </View>
        </TouchableOpacity>

        <View style={{ marginLeft: 30 }}>
          <Text style={styles.username}>{registeredUsername}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      </View>

      {/* first / last */}
      <Input label="First Name" value={firstName} onChangeText={setFirstName} />
      <Input label="Last Name"  value={lastName}  onChangeText={setLastName}  />

      {/* read-only birthday */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Birthday</Text>
        <Text style={styles.readonly}>
          {birthday ? birthday.replace(/-/g, '/') : 'Not provided'}
        </Text>
        <Text style={styles.support}>If this is incorrect, please contact support.</Text>
      </View>

      {/* bio (≤ 100 chars, ≤ 3 lines) + counter */}
      <View style={[styles.inputContainer, styles.bioContainer]}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          multiline
          numberOfLines={3}
          maxLength={100}
          placeholderTextColor="#666"
          value={bio}
          onChangeText={(txt: string) => {
            if (txt.length <= 100 && txt.split('\n').length <= 3) setBio(txt);
          }}
        />
        <Text style={styles.counter}>{bio.length}/100</Text>
      </View>

      {/* buttons */}
      <View style={styles.rowBtns}>
        <TouchableOpacity style={styles.saveBtn}   onPress={onSave} ><Text style={styles.btnText}>Save</Text></TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
      </View>
    </View>
  );
}

/* ───── reusable input component ───── */
const Input = ({ label, style, ...rest }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput placeholderTextColor="#666" style={[styles.input, style]} {...rest} />
  </View>
);

/* ───── styles ───── */
const styles = StyleSheet.create({
  body:           { flex: 1, padding: 20, alignItems: 'center' },
  row:            { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  avatarWrapper:  { width: 100, height: 100, borderRadius: 50, overflow: 'hidden' },
  avatar:         { width: '100%', height: '100%' },
  camOverlay:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  username:       { color: '#DFDCD9', fontSize: 20, fontWeight: 'bold' },
  email:          { color: '#4F4F4F', fontSize: 14, marginTop: 5 },
  inputContainer: { width: '100%', marginBottom: 18 },
  label:          { color: '#DFDCD9', fontSize: 16, marginBottom: 5 },
  input:          { backgroundColor: '#1F1F1F', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15, color: '#DFDCD9', fontSize: 16 },
  bioContainer:   { position: 'relative' },
  bioInput:       { height: 78, textAlignVertical: 'top' },
  counter:        { position: 'absolute', right: 10, bottom: -18, color: '#4F4F4F', fontSize: 12 },
  readonly:       { backgroundColor: '#1F1F1F', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15, color: '#4F4F4F', fontSize: 16 },
  support:        { color: '#4F4F4F', fontSize: 12, marginTop: 5 },
  rowBtns:        { flexDirection: 'row', marginTop: 30 },
  saveBtn:        { backgroundColor: '#CE975E', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, marginHorizontal: 10 },
  cancelBtn:      { backgroundColor: '#444', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10, marginHorizontal: 10 },
  btnText:        { color: '#DFDCD9', fontSize: 16, fontWeight: '600' },
});
