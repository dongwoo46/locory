'use client';

import { useReducer } from 'react';
import type { SetStateAction } from 'react';
import type { City } from '@/types/database';
import type { RecommendSettings } from '../map.types';

type RecommendStep = 'neighborhoods' | 'settings' | 'generating' | 'result';

interface RecommendBuildState {
  showCourseTypePicker: boolean;
  recommendStep: RecommendStep;
  recommendDistricts: string[];
  recommendCities: City[];
  recommendCityTab: City;
  recommendPlaceCount: number | null;
  showFewPlacesWarning: boolean;
  showRecommendCalendar: boolean;
  recommendSettings: RecommendSettings;
}

type Action =
  | { type: 'setShowCourseTypePicker'; payload: boolean }
  | { type: 'setRecommendStep'; payload: RecommendStep }
  | { type: 'setRecommendDistricts'; payload: string[] }
  | { type: 'setRecommendCities'; payload: City[] }
  | { type: 'setRecommendCityTab'; payload: City }
  | { type: 'setRecommendPlaceCount'; payload: number | null }
  | { type: 'setShowFewPlacesWarning'; payload: boolean }
  | { type: 'setShowRecommendCalendar'; payload: boolean }
  | { type: 'setRecommendSettings'; payload: RecommendSettings }
  | { type: 'resetRecommendSelection' };

const initialState: RecommendBuildState = {
  showCourseTypePicker: false,
  recommendStep: 'neighborhoods',
  recommendDistricts: [],
  recommendCities: [],
  recommendCityTab: 'seoul',
  recommendPlaceCount: null,
  showFewPlacesWarning: false,
  showRecommendCalendar: false,
  recommendSettings: {
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    timeRange: [8, 32],
    styles: [],
    companion: 'friends',
    extraConditions: '',
  },
};

function reducer(state: RecommendBuildState, action: Action): RecommendBuildState {
  switch (action.type) {
    case 'setShowCourseTypePicker':
      return { ...state, showCourseTypePicker: action.payload };
    case 'setRecommendStep':
      return { ...state, recommendStep: action.payload };
    case 'setRecommendDistricts':
      return { ...state, recommendDistricts: action.payload };
    case 'setRecommendCities':
      return { ...state, recommendCities: action.payload };
    case 'setRecommendCityTab':
      return { ...state, recommendCityTab: action.payload };
    case 'setRecommendPlaceCount':
      return { ...state, recommendPlaceCount: action.payload };
    case 'setShowFewPlacesWarning':
      return { ...state, showFewPlacesWarning: action.payload };
    case 'setShowRecommendCalendar':
      return { ...state, showRecommendCalendar: action.payload };
    case 'setRecommendSettings':
      return { ...state, recommendSettings: action.payload };
    case 'resetRecommendSelection':
      return {
        ...state,
        recommendStep: 'neighborhoods',
        recommendDistricts: [],
        recommendCities: [],
        recommendPlaceCount: null,
        showFewPlacesWarning: false,
      };
    default:
      return state;
  }
}

export function useRecommendBuildState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  function resetRecommendSelection() {
    dispatch({ type: 'resetRecommendSelection' });
  }

  function resolveStateAction<T>(action: SetStateAction<T>, prev: T): T {
    return typeof action === 'function'
      ? (action as (prevState: T) => T)(prev)
      : action;
  }

  return {
    showCourseTypePicker: state.showCourseTypePicker,
    setShowCourseTypePicker: (payload: boolean) =>
      dispatch({ type: 'setShowCourseTypePicker', payload }),
    recommendStep: state.recommendStep,
    setRecommendStep: (payload: RecommendStep) =>
      dispatch({ type: 'setRecommendStep', payload }),
    recommendDistricts: state.recommendDistricts,
    setRecommendDistricts: (payload: SetStateAction<string[]>) =>
      dispatch({
        type: 'setRecommendDistricts',
        payload: resolveStateAction(payload, state.recommendDistricts),
      }),
    recommendCities: state.recommendCities,
    setRecommendCities: (payload: City[]) =>
      dispatch({ type: 'setRecommendCities', payload }),
    recommendCityTab: state.recommendCityTab,
    setRecommendCityTab: (payload: City) =>
      dispatch({ type: 'setRecommendCityTab', payload }),
    recommendPlaceCount: state.recommendPlaceCount,
    setRecommendPlaceCount: (payload: number | null) =>
      dispatch({ type: 'setRecommendPlaceCount', payload }),
    showFewPlacesWarning: state.showFewPlacesWarning,
    setShowFewPlacesWarning: (payload: boolean) =>
      dispatch({ type: 'setShowFewPlacesWarning', payload }),
    showRecommendCalendar: state.showRecommendCalendar,
    setShowRecommendCalendar: (payload: boolean) =>
      dispatch({ type: 'setShowRecommendCalendar', payload }),
    recommendSettings: state.recommendSettings,
    setRecommendSettings: (payload: SetStateAction<RecommendSettings>) =>
      dispatch({
        type: 'setRecommendSettings',
        payload: resolveStateAction(payload, state.recommendSettings),
      }),
    resetRecommendSelection,
  };
}
