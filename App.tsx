// App.tsx

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { clearAuthFormStorage, useAuthStore } from './app/store/authStore';
import { VibesProvider } from './app/context/VibesContext';
import { VoiceCallProvider } from './app/context/VoiceCallContext';
import RealtimeBridge from './app/components/RealtimeBridge';
import { isSessionExpiredError } from './app/services/api';
import { getCurrentUser } from './app/services/authApi';

import AuthNavigator from './app/navigation/AuthNavigator';
import BottomTabNavigator from './app/navigation/BottomTabNavigator';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        // Token exists, try to load user data
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          try {
            const freshUser = await getCurrentUser(token);
            const nextUser = freshUser?.user || user;
            await AsyncStorage.setItem('user', JSON.stringify(nextUser));
            setAuth(nextUser, token);
          } catch (error) {
            if (isSessionExpiredError(error)) {
              logout();
            } else {
              setAuth(user, token);
            }
          }
        }
      } else {
        await clearAuthFormStorage();
      }
    } catch (error) {
      console.log('Error checking login status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading spinner while checking token
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator
          size="large"
          color="#7c3aed"
        />
      </View>
    );
  }

  // Show Auth screens if not logged in,
  // otherwise show Home tabs.
  return (
    <VibesProvider>
      {isLoggedIn ? (
        <VoiceCallProvider>
          <NavigationContainer>
            <RealtimeBridge />
            <BottomTabNavigator />
          </NavigationContainer>
        </VoiceCallProvider>
      ) : (
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>
      )}
    </VibesProvider>
  );
}
