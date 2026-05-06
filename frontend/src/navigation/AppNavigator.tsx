import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { ENV } from '../config/env';

import { AuthContext } from '../context/AuthContext';
import { RootStackParamList, AuthStackParamList, MainStackParamList, HomeTabParamList } from './types';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/home/ProfileScreen';
import { HistoryScreen } from '../screens/home/HistoryScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { InterviewIntroScreen } from '../screens/interview/InterviewIntroScreen';
import { InterviewScreen } from '../screens/interview/InterviewScreen';
import { ProcessingScreen } from '../screens/interview/ProcessingScreen';
import { ResultScreen } from '../screens/interview/ResultScreen';
import { EditProfileScreen } from '../screens/home/EditProfileScreen';
import { LanguageSelectionScreen } from '../screens/auth/LanguageSelectionScreen';
import { RoleSelectionScreen } from '../screens/auth/RoleSelectionScreen';
import { InterviewerNavigator } from './InterviewerNavigator';
import { JobBrowsingScreen } from '../screens/jobs/JobBrowsingScreen';
import { JobDetailScreen } from '../screens/jobs/JobDetailScreen';
import { HelpScreen } from '../screens/home/HelpScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </AuthStack.Navigator>
);

const TabNavigator = () => {
  const { t } = useContext(AuthContext);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        headerShown: false,
        tabBarStyle: {
          height: 85,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingBottom: Platform.OS === 'ios' ? 25 : 15,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 5,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('welcome') === 'Hey' ? 'Home' : t('welcome') }} />
      <Tab.Screen name="Jobs" component={JobBrowsingScreen} options={{ tabBarLabel: 'Jobs' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: t('history') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('profile') }} />
    </Tab.Navigator>
  );
};

const MainNavigator = () => (
  <MainStack.Navigator screenOptions={{ headerShown: false }}>
    <MainStack.Screen name="HomeTabs" component={TabNavigator} />
    <MainStack.Screen name="InterviewIntro" component={InterviewIntroScreen} />
    <MainStack.Screen name="Interview" component={InterviewScreen} />
    <MainStack.Screen name="Processing" component={ProcessingScreen} />
    <MainStack.Screen name="Result" component={ResultScreen} />
    <MainStack.Screen name="JobDetail" component={JobDetailScreen} />
  </MainStack.Navigator>
);

export const AppNavigator = () => {
  const { user, profile, language, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!language) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Check if Supabase is likely misconfigured
  const isSupabaseMisconfigured = !user && ENV.SUPABASE_URL.includes('your-project-ref');

  if (isSupabaseMisconfigured) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
        <Ionicons name="warning" size={64} color="#f59e0b" />
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>Configuration Required</Text>
        <Text style={{ marginTop: 8, textAlign: 'center', color: '#64748b' }}>
          It looks like your Supabase URL is still set to the placeholder.
          Please update your .env file with your actual Supabase credentials.
        </Text>
      </View>
    );
  }


  if (!user) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (!profile?.role) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {profile.role === 'employer' || profile.role === 'admin' ? (
          <Stack.Screen name="InterviewerMain" component={InterviewerNavigator} />
        ) : !profile?.onboarding_completed ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
