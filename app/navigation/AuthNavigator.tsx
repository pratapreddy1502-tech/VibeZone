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
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
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
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />

      <Stack.Screen
        name="ResetPassword"
        component={ForgotPasswordScreen}
      />

      <Stack.Screen
        name="Comments"
        component={CommentsScreen}
      />
    </Stack.Navigator>
  );
}
