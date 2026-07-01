/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AQISample {
  pm25: number;
  pm10: number;
  co: number;
  no2: number;
  so2: number;
  o3: number;
  temp: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface PredictionResult {
  aqi: number;
  category: "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe";
  confidence: number;
  topFeatures: FeatureImportance[];
  riskScore: number;
  recommendation: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  impact: number; // LIME/SHAP local impact direction (-1 to +1)
}

export interface ForecastItem {
  timestamp: string;
  aqi: number;
  temp: number;
  humidity: number;
}

export interface ForecastResult {
  nextHour: ForecastItem;
  nextDay: ForecastItem[];
  nextWeek: ForecastItem[];
}

export interface Hotspot {
  id: string;
  lat: number;
  lng: number;
  aqi: number;
  intensity: number;
  clusterId: number;
  rank: number;
  label: string;
}

export interface YoloDetection {
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in percentages (0-100)
  label: "Smoke" | "Factory Emission" | "Vehicle Exhaust" | "Construction Dust" | "Wildfire" | "Industrial Plume";
  confidence: number;
}

export interface SatelliteGrid {
  pollutant: "NO2" | "CO" | "SO2" | "Aerosol";
  density: number; // overall mean
  matrix: number[][]; // 10x10 resolution matrix for heatmaps
  latitude: number;
  longitude: number;
}

export interface Alert {
  id: string;
  title: string;
  type: "AQI_WARNING" | "SMOKE_DETECTED" | "FIRE_DETECTED";
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
  resolved: boolean;
}

export interface User {
  id: string;
  username: string;
  role: "citizen" | "researcher" | "admin";
}

export interface TrainingStats {
  modelName: string;
  r2: number;
  mae: number;
  rmse: number;
  selected: boolean;
  trainingTime: number; // in ms
}
