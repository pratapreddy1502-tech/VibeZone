import { Platform, ToastAndroid } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { savePushToken } from './notificationApi';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
let notificationsModule: NotificationsModule | null = null;
let notificationHandlerConfigured = false;

async function getNotificationsModule() {
  if (isExpoGo) {
    return null;
  }

  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }

  if (!notificationHandlerConfigured) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
  }

  return notificationsModule;
}

export async function registerForPushNotifications(token: string) {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return null;
  }

  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('vibezone', {
      name: 'VibeZone',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (finalStatus !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;

  const pushToken = projectId
    ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
    : (await Notifications.getExpoPushTokenAsync()).data;

  await savePushToken(pushToken, token);

  return pushToken;
}

export function showLocalBuzz(message: string) {
  if (isExpoGo) {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }

    return Promise.resolve(null);
  }

  return getNotificationsModule().then((Notifications) => {
    if (!Notifications) {
      return null;
    }

    return Notifications.scheduleNotificationAsync({
      content: {
        title: 'VibeZone Buzz',
        body: message,
        sound: 'default',
      },
      trigger: null,
    });
  });
}
