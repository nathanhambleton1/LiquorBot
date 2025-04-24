// -----------------------------------------------------------------------------
// File: sign-up.tsx
// Description: Registration with real-time username check, debounced requests,
//              gold spinner while checking, strict e-mail validation, and
//              smart “free-only” suggestions.
// Author: Nathan Hambleton
// Updated: Apr 25 2025
// -----------------------------------------------------------------------------
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, signIn } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import { Ionicons } from '@expo/vector-icons';

const client      = generateClient();
const dummyPwd    = 'DummyPa$$word123!';                     // meets Cognito
const emailRegex  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEBOUNCE_MS = 400;

/* ───── GraphQL (no codegen) ───── */
const LIST_USERNAMES = /* GraphQL */ `
  query Check($username: String!) {
    listUserProfiles(filter: { username: { eq: $username } }, limit: 1) {
      items { id }
    }
  }
`;

/* helper: true if username exists in table or Cognito */
const isUsernameTaken = async (name: string): Promise<boolean> => {
  const res: any = await client.graphql({
    query: LIST_USERNAMES,
    variables: { username: name },
  });
  if (res?.data?.listUserProfiles?.items?.length) return true;

  try {                               // cheap Cognito probe
    await signIn({ username: name, password: dummyPwd });
    return true;                      // (should never actually log in)
  } catch (e: any) {
    const n = e?.name;
    return n === 'NotAuthorizedException' || n === 'UserNotConfirmedException';
  }
};

export default function SignUp() {
  const router = useRouter();

  /* ───── state ───── */
  const [step, setStep] = useState<'REGISTER' | 'ROLE_SELECTION'>('REGISTER');
  const [selectedRole, setSelectedRole] =
    useState<'EventAttendee' | 'PersonalUse' | 'EventCoordinator' | ''>('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email,    setEmail]    = useState('');
  const [birthday, setBirthday] = useState('');

  const [usernameAvailable,  setUsernameAvailable]  = useState<boolean | null>(null);
  const [usernameSuggestion, setUsernameSuggestion] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const [isPasswordVisible,  setIsPasswordVisible]  = useState(false);
  const [isPasswordFocused,  setIsPasswordFocused]  = useState(false);
  const [passwordValidity,   setPasswordValidity]   = useState({
    minLength:false, upper:false, lower:false, number:false, symbol:false,
  });

  const [emailTouched, setEmailTouched] = useState(false);
  const [emailValid,   setEmailValid]   = useState<boolean | null>(null);

  const [errorMessage, setErrorMessage] = useState('');

  /* ───── debounce timer ref ───── */
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ───── birthday helpers / etc. (unchanged) ───── */
  const handleBirthdayInput = (t: string) => {
    let s = t.replace(/[^0-9]/g, '');
    if (s.length > 2 && s.length <= 4) s = `${s.slice(0,2)}/${s.slice(2)}`;
    else if (s.length > 4)             s = `${s.slice(0,2)}/${s.slice(2,4)}/${s.slice(4,8)}`;
    if (s.length > 10) s = s.slice(0,10);
    setBirthday(s);
  };
  const mdyToDash  = (mdy:string)=>(mdy.length===10?mdy.replace(/\//g,'-'):'');

  const isAtLeast21 = (d:string) => {
    if(!d) return false;
    const [m,dd,y]=d.split('-').map(Number);
    const b=new Date(y,m-1,dd), t=new Date();
    const a=t.getFullYear()-b.getFullYear();
    return a>21||(a===21&&(t.getMonth()>b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()>=b.getDate())));
  };

  const validatePassword = (p:string) =>
    p.length>=8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[!@#$%^&*(),.?":{}|<>]/.test(p);

  const handlePasswordChange = (p:string)=>{
    setPassword(p);
    setPasswordValidity({
      minLength:p.length>=8, upper:/[A-Z]/.test(p), lower:/[a-z]/.test(p),
      number:/[0-9]/.test(p), symbol:/[!@#$%^&*(),.?":{}|<>]/.test(p),
    });
  };

  const validateEmailFormat = (e:string)=>emailRegex.test(e);

  /* ───── username availability (debounced) ───── */
  const startUsernameCheck = (name: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setUsername(name);
    setUsernameAvailable(null);
    setUsernameSuggestion('');

    const trimmed = name.trim();
    if (!trimmed) { setIsCheckingUsername(false); return; }

    debounceRef.current = setTimeout(async () => {
      setIsCheckingUsername(true);
      try {
        const taken = await isUsernameTaken(trimmed);
        setUsernameAvailable(!taken);

        if (taken) {
          let suggestion = '';
          for (let i = 1; i <= 999; i++) {
            const candidate = `${trimmed}${i}`;
            if (!(await isUsernameTaken(candidate))) { suggestion = candidate; break; }
          }
          setUsernameSuggestion(suggestion);
        }
      } catch {
        setUsernameAvailable(null);
        setUsernameSuggestion('');
      } finally {
        setIsCheckingUsername(false);
      }
    }, DEBOUNCE_MS);
  };

  /* ───── first-screen validation ───── */
  const onSignUpPress = () => {
    setErrorMessage('');
    if (!username.trim())            return setErrorMessage('Username is required.');
    if (usernameAvailable===false)   return setErrorMessage('Username already taken.');
    if (!validatePassword(password)) return setErrorMessage('Password must be at least 8 characters long and include lowercase, uppercase, numerals, and symbols.');
    if (!email.trim()||!validateEmailFormat(email.trim()))
      return setErrorMessage('Please enter a valid e-mail address (e.g., name@example.com).');
    if (!isAtLeast21(mdyToDash(birthday))) return setErrorMessage('You must be at least 21.');
    setStep('ROLE_SELECTION');
  };

  /* ───── register with Cognito (unchanged) ───── */
  const onSubmitRolePress = async () => {
    try {
      setErrorMessage('');
      const { isSignUpComplete, nextStep } = await signUp({
        username, password,
        options:{ userAttributes:{ email, birthdate:mdyToDash(birthday) } },
      });
      if (isSignUpComplete){ await signIn({ username, password }); router.replace('/(tabs)'); return; }
      if (nextStep?.signUpStep==='CONFIRM_SIGN_UP'){
        router.replace({ pathname:'./confirm-code', params:{ username,password,role:selectedRole,fromSignup:'1' }});
      }
    } catch(e:any){ setErrorMessage(e?.message??'Sign-up error'); }
  };

  /* ───── UI ───── */
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      {step==='REGISTER'&&(
        <>
          {/* Username with spinner */}
          <Text style={styles.label}>Username</Text>
          <View style={{ position:'relative' }}>
            <TextInput
              value={username}
              onChangeText={startUsernameCheck}
              style={[
                styles.input,
                usernameAvailable===false && styles.inputError,
              ]}
              autoCapitalize="none"
            />
            {isCheckingUsername && (
              <ActivityIndicator
                size="small"
                color="#CE975E"
                style={{ position:'absolute', right:12, top:'50%', marginTop:-8 }}
              />
            )}
          </View>
          {username && usernameAvailable===false && (
            <Text style={styles.suggestion}>
              {usernameSuggestion
                ? `Username already taken – try “${usernameSuggestion}”.`
                : 'Username already taken'}
            </Text>
          )}
          {username && usernameAvailable===true && (
            <Text style={[styles.suggestion,{color:'green'}]}>Username available ✓</Text>
          )}

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View>
            <TextInput
              value={password}
              onChangeText={handlePasswordChange}
              style={styles.input}
              secureTextEntry={!isPasswordVisible}
              onFocus={()=>setIsPasswordFocused(true)}
              onBlur={()=>setIsPasswordFocused(false)}
            />
            <TouchableOpacity style={styles.eyeIcon} onPress={()=>setIsPasswordVisible(!isPasswordVisible)}>
              <Ionicons name={isPasswordVisible? 'eye' : 'eye-off'} size={24} color="#4F4F4F" />
            </TouchableOpacity>
          </View>
          {isPasswordFocused&&(
            <View style={{marginBottom:10}}>
              {(['minLength','upper','lower','number','symbol'] as const).map(k=>(
                <View key={k} style={{flexDirection:'row',alignItems:'center'}}>
                  <Ionicons name={passwordValidity[k]?'checkmark':'close'} size={12} color={passwordValidity[k]?'green':'red'} />
                  <Text style={{color:'#4f4f4f',marginLeft:8,fontSize:12}}>
                    {k==='minLength'?'At least 8 characters':
                     k==='upper'    ?'Contains uppercase':
                     k==='lower'    ?'Contains lowercase':
                     k==='number'   ?'Contains a number':
                                     'Contains a special symbol'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onBlur={()=>{ setEmailTouched(true); setEmailValid(validateEmailFormat(email.trim())); }}
            style={[styles.input, emailTouched&&emailValid===false&&styles.inputError]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {emailTouched&&email&&emailValid===false&&(
            <Text style={styles.error}>Invalid e-mail format. Try “name@example.com”.</Text>
          )}

          {/* Birthday */}
          <Text style={styles.label}>Birthday</Text>
          <TextInput
            value={birthday}
            onChangeText={handleBirthdayInput}
            style={[
              styles.input,
              !isAtLeast21(mdyToDash(birthday))&&birthday.length===10&&styles.inputError,
            ]}
            keyboardType="numeric"
            placeholder="MM/DD/YYYY"
            placeholderTextColor="#666"
            maxLength={10}
          />
          {!isAtLeast21(mdyToDash(birthday))&&birthday.length===10&&(
            <Text style={styles.error}>You must be at least 21 years old.</Text>
          )}

          {!!errorMessage&&<Text style={styles.error}>{errorMessage}</Text>}

          {/* Next */}
          <TouchableOpacity style={styles.button} onPress={onSignUpPress}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {step==='ROLE_SELECTION'&&(
        /*  … unchanged …  */
        <View>
          <Text style={styles.roleTitle}>Select Your Role</Text>
          <TouchableOpacity style={styles.backIcon} onPress={()=>setStep('REGISTER')}>
            <Ionicons name="arrow-back" size={24} color="#CE975E" />
          </TouchableOpacity>
          {(['EventAttendee','PersonalUse','EventCoordinator'] as const).map(role=>(
            <TouchableOpacity
              key={role}
              style={[styles.roleOption, selectedRole===role&&styles.selectedRoleOption]}
              onPress={()=>setSelectedRole(role)}
            >
              <Ionicons name={role==='EventAttendee'?'people':role==='PersonalUse'?'home':'briefcase'} size={32} color="#CE975E" />
              <View style={styles.roleTextContainer}>
                <Text style={styles.roleText}>{role.replace(/([A-Z])/g,' $1').trim()}</Text>
                <Text style={styles.roleDescription}>
                  {role==='EventAttendee'  && 'Join events and enjoy LiquorBot services.'}
                  {role==='PersonalUse'    && 'Manage your personal LiquorBot at home.'}
                  {role==='EventCoordinator'&& 'Organize events and manage services.'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {!!errorMessage&&<Text style={styles.error}>{errorMessage}</Text>}
          <TouchableOpacity style={styles.button} onPress={onSubmitRolePress} disabled={!selectedRole}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* link to sign-in */}
      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>
          Already have an account?{' '}
          <Text style={styles.signUpLink} onPress={()=>router.replace('/auth/sign-in')}>Sign In</Text>
        </Text>
      </View>
    </View>
  );
}

/* ───── styles (unchanged) ───── */
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000',justifyContent:'center',padding:24},
  title:{fontSize:48,color:'#fff',marginBottom:24,fontWeight:'bold'},
  label:{fontSize:16,color:'#fff',marginTop:10},
  input:{backgroundColor:'#141414',marginVertical:8,paddingHorizontal:16,paddingVertical:12,borderRadius:8,fontSize:16,color:'#DFDCD9'},
  inputError:{borderColor:'red',borderWidth:1},
  suggestion:{fontSize:12,color:'#4F4F4F',marginTop:-4,marginBottom:4},
  button:{backgroundColor:'#CE975E',paddingVertical:12,borderRadius:8,alignItems:'center',marginTop:20},
  buttonText:{color:'#DFDCD9',fontSize:18,fontWeight:'bold'},
  error:{color:'red',marginTop:8},
  signUpContainer:{marginTop:60,alignItems:'center'},
  signUpText:{fontSize:14,color:'#fff'},
  signUpLink:{color:'#CE975E',fontWeight:'bold'},
  roleOption:{flexDirection:'row',alignItems:'center',backgroundColor:'#141414',padding:16,borderRadius:8,marginVertical:8,borderWidth:2,borderColor:'transparent'},
  selectedRoleOption:{borderColor:'#CE975E'},
  roleTextContainer:{marginLeft:14,flex:1},
  roleText:{fontSize:18,color:'#DFDCD9'},
  roleDescription:{fontSize:14,color:'#4F4F4F',marginTop:4},
  eyeIcon:{position:'absolute',right:16,top:'50%',transform:[{translateY:-12}]},
  backIcon:{marginBottom:10,alignSelf:'flex-start'},
  roleTitle:{fontSize:36,color:'#fff',marginBottom:16,fontWeight:'bold',textAlign:'left'},
});
