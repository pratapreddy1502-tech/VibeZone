import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Calendar,
  Home,
  Plus,
  Search,
  User,
} from 'lucide-react-native';

import VibesScreen from '../screens/main/VibesScreen';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import CreateVibeScreen from '../screens/main/CreateVibeScreen';
import ReelsScreen from '../screens/main/ReelsScreen';
import UploadReelScreen from '../screens/main/UploadReelScreen';
import MyZoneScreen from '../screens/main/MyZoneScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import ChatLockSettingsScreen from '../screens/main/ChatLockSettingsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import PrivacySecurityScreen from '../screens/main/PrivacySecurityScreen';
import ProfileListScreen from '../screens/main/ProfileListScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import ChatScreen from '../screens/main/ChatScreen';
import ChatThreadScreen from '../screens/main/ChatThreadScreen';
import SpotifySearchScreen from '../screens/music/SpotifySearchScreen';
import { useThemeStore } from '../store/themeStore';
import { VibeTheme } from '../theme/vibeStudio';

const Tab = createBottomTabNavigator();
const VibesStack = createNativeStackNavigator();
const DiscoverStack = createNativeStackNavigator();
const CreateStack = createNativeStackNavigator();
const ReelsStack = createNativeStackNavigator();
const MyZoneStack = createNativeStackNavigator();

function VibesStackNavigator() {
  return (
    <VibesStack.Navigator screenOptions={{ headerShown: false }}>
      <VibesStack.Screen name="VibesMain" component={VibesScreen} />
      <VibesStack.Screen name="Buzz" component={NotificationsScreen} />
      <VibesStack.Screen name="Chats" component={ChatScreen} />
      <VibesStack.Screen name="ChatThread" component={ChatThreadScreen} />
      <VibesStack.Screen name="Profile" component={MyZoneScreen} />
      <VibesStack.Screen name="Settings" component={SettingsScreen} />
      <VibesStack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <VibesStack.Screen name="ChatLockSettings" component={ChatLockSettingsScreen} />
      <VibesStack.Screen name="ProfileList" component={ProfileListScreen} />
    </VibesStack.Navigator>
  );
}

function DiscoverStackNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
      <DiscoverStack.Screen name="DiscoverMain" component={DiscoverScreen} />
      <DiscoverStack.Screen name="Profile" component={MyZoneScreen} />
      <DiscoverStack.Screen name="Settings" component={SettingsScreen} />
      <DiscoverStack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <DiscoverStack.Screen name="ChatLockSettings" component={ChatLockSettingsScreen} />
      <DiscoverStack.Screen name="ProfileList" component={ProfileListScreen} />
      <DiscoverStack.Screen name="ChatThread" component={ChatThreadScreen} />
    </DiscoverStack.Navigator>
  );
}

function CreateStackNavigator() {
  return (
    <CreateStack.Navigator screenOptions={{ headerShown: false }}>
      <CreateStack.Screen name="CreateVibeMain" component={CreateVibeScreen} />
      <CreateStack.Screen name="UploadReel" component={UploadReelScreen} />
      <CreateStack.Screen name="SpotifySearch" component={SpotifySearchScreen} />
    </CreateStack.Navigator>
  );
}

function ReelsStackNavigator() {
  return (
    <ReelsStack.Navigator screenOptions={{ headerShown: false }}>
      <ReelsStack.Screen name="ReelsMain" component={ReelsScreen} />
      <ReelsStack.Screen name="Profile" component={MyZoneScreen} />
      <ReelsStack.Screen name="Settings" component={SettingsScreen} />
      <ReelsStack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <ReelsStack.Screen name="ChatLockSettings" component={ChatLockSettingsScreen} />
      <ReelsStack.Screen name="ProfileList" component={ProfileListScreen} />
      <ReelsStack.Screen name="ChatThread" component={ChatThreadScreen} />
    </ReelsStack.Navigator>
  );
}

function MyZoneStackNavigator() {
  return (
    <MyZoneStack.Navigator screenOptions={{ headerShown: false }}>
      <MyZoneStack.Screen name="MyZoneMain" component={MyZoneScreen} />
      <MyZoneStack.Screen name="Profile" component={MyZoneScreen} />
      <MyZoneStack.Screen name="EditProfile" component={EditProfileScreen} />
      <MyZoneStack.Screen name="Settings" component={SettingsScreen} />
      <MyZoneStack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <MyZoneStack.Screen name="ChatLockSettings" component={ChatLockSettingsScreen} />
      <MyZoneStack.Screen name="ProfileList" component={ProfileListScreen} />
      <MyZoneStack.Screen name="ChatThread" component={ChatThreadScreen} />
    </MyZoneStack.Navigator>
  );
}

const icons = {
  Vibes: Home,
  Discover: Search,
  Create: Plus,
  Reels: Calendar,
  'My Zone': User,
};

export default function BottomTabNavigator() {
  const theme = useThemeStore((state) => state.theme);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.text,
        tabBarStyle: getTabBarStyle(route, theme),
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ color, focused }) => {
          const Icon = icons[route.name as keyof typeof icons] ?? Home;

          if (route.name === 'Create') {
            return (
              <LinearGradient colors={theme.buttonGradient} style={styles.createButton}>
                <Plus color="#FFFFFF" size={26} strokeWidth={2.6} />
              </LinearGradient>
            );
          }

          return (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon color={color} size={21} strokeWidth={focused ? 2.8 : 2.1} />
            </View>
          );
        },
        tabBarLabel: ({ focused, color }) => (
          <Text style={[styles.label, { color }, focused && styles.labelActive]}>
            {route.name === 'Reels' ? 'Movements' : route.name}
          </Text>
        ),
      })}
    > 
      <Tab.Screen name="Vibes" component={VibesStackNavigator} />
      <Tab.Screen name="Discover" component={DiscoverStackNavigator} />
      <Tab.Screen name="Create" component={CreateStackNavigator} />
      <Tab.Screen name="Reels" component={ReelsStackNavigator} />
      <Tab.Screen name="My Zone" component={MyZoneStackNavigator} />
    </Tab.Navigator>
  );
}

function getTabBarStyle(route: any, theme: VibeTheme) {
  const routeName = getFocusedRouteNameFromRoute(route);
  const hiddenRoutes = [
    'ChatThread',
    'EditProfile',
    'Profile',
    'ProfileList',
    'Settings',
    'PrivacySecurity',
    'ChatLockSettings',
  ];

  if (routeName && hiddenRoutes.includes(routeName)) {
    return styles.tabBarHidden;
  }

  return {
    ...styles.tabBar,
    backgroundColor: theme.surface,
    borderTopColor: theme.line,
    shadowColor: theme.shadow,
  };
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 78,
    paddingTop: 9,
    paddingBottom: 9,
    borderRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#ECECFA',
    backgroundColor: '#FFFFFF',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  tabBarHidden: {
    display: 'none',
  },
  iconWrap: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    transform: [{ translateY: -1 }],
  },
  createButton: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 9,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  labelActive: {
    fontWeight: '800',
  },
});
