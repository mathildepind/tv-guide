import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import SearchScreen from '../screens/SearchScreen';
import MyListsScreen from '../screens/MyListsScreen';
import DetailScreen from '../screens/DetailScreen';

import type {
  SearchStackParamList,
  MyListsStackParamList,
} from '../types';

// ─── Theme constants ──────────────────────────────────────────────────────────

const COLORS = {
  background: '#0f0f0f',
  surface: '#1a1a1a',
  accent: '#E50914',
  text: '#ffffff',
  textMuted: '#9ca3af',
  border: '#2a2a2a',
};

// ─── Stack navigators ─────────────────────────────────────────────────────────

const SearchStack = createNativeStackNavigator<SearchStackParamList>();

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <SearchStack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Discover' }}
      />
      <SearchStack.Screen
        name="Detail"
        component={DetailScreen}
        options={{ title: '', headerTransparent: true }}
      />
    </SearchStack.Navigator>
  );
}

const MyListsStack = createNativeStackNavigator<MyListsStackParamList>();

function MyListsStackNavigator() {
  return (
    <MyListsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <MyListsStack.Screen
        name="MyLists"
        component={MyListsScreen}
        options={{ title: 'My Lists' }}
      />
      <MyListsStack.Screen
        name="Detail"
        component={DetailScreen}
        options={{ title: '', headerTransparent: true }}
      />
    </MyListsStack.Navigator>
  );
}

// ─── Bottom tab navigator ─────────────────────────────────────────────────────

type TabParamList = {
  SearchTab: undefined;
  MyListsTab: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: ({ color, size, focused }) => {
            let iconName: React.ComponentProps<typeof Ionicons>['name'];
            if (route.name === 'SearchTab') {
              iconName = focused ? 'search' : 'search-outline';
            } else {
              iconName = focused ? 'list' : 'list-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="SearchTab"
          component={SearchStackNavigator}
          options={{ title: 'Discover' }}
        />
        <Tab.Screen
          name="MyListsTab"
          component={MyListsStackNavigator}
          options={{ title: 'My Lists' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
