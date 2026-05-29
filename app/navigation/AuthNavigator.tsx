// app/navigation/BottomTabNavigator.tsx

// app/navigation/AuthNavigator.tsx
// app/navigation/AuthNavigator.tsx

// app/navigation/AuthNavigator.tsx

// app/navigation/AuthNavigator.tsx

// app/navigation/AuthNavigator.tsx

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CommentsScreen from '../screens/main/CommentsScreen';
// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Removed ForgotPasswordScreen import because the file does not exist

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Comments: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
      />

      <Stack.Screen
        name="Register"
        component={RegisterScreen}
      />

      <Stack.Screen
        name="Comments"
        component={CommentsScreen}
      />
    </Stack.Navigator>
  );
}