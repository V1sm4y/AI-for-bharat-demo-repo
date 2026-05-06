import { registerRootComponent } from 'expo';
import React from 'react';
import { Text, View } from 'react-native';

import App from './App';

try {
  // registerRootComponent calls AppRegistry.registerComponent('main', () => App);
  // It also ensures that whether you load the app in Expo Go or in a native build,
  // the environment is set up appropriately
  registerRootComponent(App);
} catch (error) {
  console.error('Failed to register root component:', error);
  // Fallback for extreme cases
  const ErrorScreen = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'red' }}>App Failed to Start</Text>
      <Text style={{ marginTop: 10, textAlign: 'center' }}>{String(error)}</Text>
    </View>
  );
  registerRootComponent(ErrorScreen);
}

