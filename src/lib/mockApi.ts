/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  generateSyntheticAQISamples,
  cleanAndEngineerFeatures,
  runModelSelectionArena,
  calculateLocalXAI,
  LocalRNNForecaster,
  runKMeans,
  runDBSCAN
} from "./ml";
import { AQISample, Alert, User, YoloDetection } from "../types";

// Setup Local Storage Mock DB
const MOCK_DB_KEY = "aqi_vision_mock_db";

interface MockDB {
  users: Record<string, { id: string; username: string; role: string; passwordHash: string }>;
  samples: AQISample[];
  alerts: Alert[];
}

function initMockDB(): MockDB {
  const saved = localStorage.getItem(MOCK_DB_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.users && data.samples && data.alerts) {
        return data;
      }
    } catch (e) {
      console.error("Failed to parse mock DB", e);
    }
  }

  // Preseed Mock DB
  const defaultSamples = generateSyntheticAQISamples(120);
  const defaultAlerts: Alert[] = [
    {
      id: "alert-1",
      title: "Severe Air Quality in Kalupur Junction",
      type: "AQI_WARNING",
      message: "AQI levels have exceeded 250 in the Kalupur rail junction region. Citizens are advised to wear mask.",
      severity: "critical",
      timestamp: new Date().toISOString(),
      resolved: false
    },
    {
      id: "alert-2",
      title: "Industrial Smoke Alert",
      type: "SMOKE_DETECTED",
      message: "Plume detection algorithm flagged excessive factory smoke in the Naroda GIDC region.",
      severity: "warning",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      resolved: false
    }
  ];

  const initial: MockDB = {
    users: {
      admin: { id: "user-admin", username: "admin", role: "admin", passwordHash: "admin123" },
      researcher: { id: "user-res", username: "researcher", role: "researcher", passwordHash: "res123" },
      citizen: { id: "user-cit", username: "citizen", role: "citizen", passwordHash: "cit123" }
    },
    samples: defaultSamples,
    alerts: defaultAlerts
  };

  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(initial));
  return initial;
}

const db = initMockDB();

function saveMockDB() {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
}

// Client-side ML fit cache
let cachedArenaResult: any = null;
let cachedForecaster: LocalRNNForecaster | null = null;

function getMLModel() {
  if (!cachedArenaResult) {
    cachedArenaResult = runModelSelectionArena(db.samples);
  }
  return cachedArenaResult;
}

function getForecaster() {
  if (!cachedForecaster) {
    cachedForecaster = new LocalRNNForecaster();
    const aqiSequence = db.samples.map(s => s.pm25 * 2.5);
    cachedForecaster.train(aqiSequence, 30); // Train with 30 epochs client-side for speed
  }
  return cachedForecaster;
}

function mockResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleMockRequest(url: string, init?: RequestInit): Promise<Response> {
  const path = url.split("?")[0];
  const query = new URLSearchParams(url.split("?")[1] || "");
  const method = init?.method || "GET";
  const body = init?.body ? JSON.parse(init.body as string) : {};

  console.log(`[Mock API] Intercepting ${method} ${path}`, body);

  // Authentication Endpoints
  if (path === "/api/auth/login" && method === "POST") {
    const { username, password } = body;
    const user = db.users[username];
    if (!user || user.passwordHash !== password) {
      return mockResponse({ error: "Invalid username or password" }, 401);
    }
    return mockResponse({ id: user.id, username: user.username, role: user.role, token: `mock-jwt-${user.id}` });
  }

  if (path === "/api/auth/register" && method === "POST") {
    const { username, password, role } = body;
    if (db.users[username]) {
      return mockResponse({ error: "Username already exists" }, 400);
    }
    const newUser = {
      id: `user-${Date.now()}`,
      username,
      role: role || "citizen",
      passwordHash: password
    };
    db.users[username] = newUser;
    saveMockDB();
    return mockResponse({ id: newUser.id, username: newUser.username, role: newUser.role, token: `mock-jwt-${newUser.id}` });
  }

  // Samples Endpoints
  if (path === "/api/samples") {
    if (method === "GET") {
      return mockResponse(db.samples);
    }
    if (method === "POST") {
      const sample: AQISample = body;
      db.samples.push(sample);

      // Check alerts threshold
      const computedFeatures = cleanAndEngineerFeatures([sample])[0];
      const aqi = Math.round(computedFeatures.aqi);

      if (aqi > 250) {
        db.alerts.unshift({
          id: `alert-${Date.now()}`,
          title: "Severe Air Quality Registered",
          type: "AQI_WARNING",
          message: `Critical AQI reading of ${aqi} logged at latitude ${sample.lat}, longitude ${sample.lng}.`,
          severity: "critical",
          timestamp: new Date().toISOString(),
          resolved: false
        });
      } else if (aqi > 150) {
        db.alerts.unshift({
          id: `alert-${Date.now()}`,
          title: "High Pollution Alert",
          type: "AQI_WARNING",
          message: `Unhealthy AQI reading of ${aqi} logged at latitude ${sample.lat}, longitude ${sample.lng}.`,
          severity: "warning",
          timestamp: new Date().toISOString(),
          resolved: false
        });
      }

      if (db.samples.length > 500) {
        db.samples.shift();
      }

      saveMockDB();
      // Clear cache to trigger re-training with new samples
      cachedArenaResult = null;
      cachedForecaster = null;

      return mockResponse({ status: "success", computedAqi: aqi });
    }
  }

  // Alerts Endpoints
  if (path === "/api/alerts") {
    return mockResponse(db.alerts);
  }

  if (path === "/api/alerts/resolve" && method === "POST") {
    const { id } = body;
    const alert = db.alerts.find(a => a.id === id);
    if (alert) {
      alert.resolved = true;
      saveMockDB();
      return mockResponse({ status: "success", alert });
    }
    return mockResponse({ error: "Alert not found" }, 404);
  }

  // Model Stats
  if (path === "/api/models/stats") {
    const arena = getMLModel();
    return mockResponse(arena.stats);
  }

  // Predict Endpoint
  if (path === "/api/predict" && method === "POST") {
    const rawSample: AQISample = body;
    const cleanedList = cleanAndEngineerFeatures([rawSample]);
    if (cleanedList.length === 0) {
      return mockResponse({ error: "Could not process input features" }, 400);
    }

    const arena = getMLModel();
    const championModel = arena.champion;
    const row = cleanedList[0];
    const predictedAqi = Math.round(championModel.predict(row));

    let category: "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe" = "Good";
    if (predictedAqi <= 50) category = "Good";
    else if (predictedAqi <= 100) category = "Satisfactory";
    else if (predictedAqi <= 200) category = "Moderate";
    else if (predictedAqi <= 300) category = "Poor";
    else if (predictedAqi <= 400) category = "Very Poor";
    else category = "Severe";

    const isOutlier = rawSample.pm25 > 450 || rawSample.pm10 > 600;
    const confidence = isOutlier ? 0.72 : 0.94;
    const topFeatures = calculateLocalXAI(row, championModel as any);
    const riskScore = Math.min(100, Math.round((predictedAqi / 350) * 100));

    let recommendation = "Air quality is ideal. Feel free to engage in standard outdoor sports and keep windows open.";
    if (predictedAqi > 50 && predictedAqi <= 100) {
      recommendation = "Sensitive citizens should consider reducing prolonged heavy outdoor activity.";
    } else if (predictedAqi > 100 && predictedAqi <= 200) {
      recommendation = "Wear a N95 respirator mask in heavy traffic corridors. Sensitive groups should stay indoors.";
    } else if (predictedAqi > 200 && predictedAqi <= 300) {
      recommendation = "Active restriction suggested. Reduce vehicle driving. School recess should be held indoors.";
    } else if (predictedAqi > 300) {
      recommendation = "Health warning. Wear high-grade masks. Mandatory reduction of factory emission limits. Advisory to stay indoors.";
    }

    return mockResponse({
      aqi: predictedAqi,
      category,
      confidence,
      topFeatures,
      riskScore,
      recommendation
    });
  }

  // Forecast Endpoint
  if (path === "/api/forecast") {
    const lastSamples = db.samples.slice(-14);
    const historicAqis = lastSamples.map(s => {
      const f = cleanAndEngineerFeatures([s]);
      return f.length > 0 ? f[0].aqi : 120;
    });

    while (historicAqis.length < 7) {
      historicAqis.unshift(100 + Math.random() * 50);
    }

    const forecastEngine = getForecaster();
    const nextHourRaw = forecastEngine.forecast(historicAqis, 1)[0];
    const next24hRaw = forecastEngine.forecast(historicAqis, 24);
    const next7dRaw = forecastEngine.forecast(historicAqis, 7);

    const formatForecast = (values: number[], frequencyHours: number): any[] => {
      const start = Date.now();
      return values.map((val, idx) => {
        const date = new Date(start + idx * frequencyHours * 3600 * 1000);
        return {
          timestamp: date.toISOString(),
          aqi: Math.round(val),
          temp: Math.round(25 + Math.sin(idx * 0.4) * 4),
          humidity: Math.round(55 + Math.cos(idx * 0.4) * 15)
        };
      });
    };

    return mockResponse({
      nextHour: formatForecast([nextHourRaw], 1)[0],
      nextDay: formatForecast(next24hRaw, 1),
      nextWeek: formatForecast(next7dRaw, 24)
    });
  }

  // Hotspots Endpoint
  if (path === "/api/hotspots") {
    const mParam = query.get("method") === "dbscan" ? "dbscan" : "kmeans";
    const points = db.samples.map(s => {
      const computed = cleanAndEngineerFeatures([s])[0];
      return {
        lat: s.lat,
        lng: s.lng,
        aqi: computed ? computed.aqi : 120
      };
    });

    if (mParam === "dbscan") {
      const results = runDBSCAN(points, 0.05, 2);
      return mockResponse(results);
    } else {
      const results = runKMeans(points, 3);
      return mockResponse(results);
    }
  }

  // Satellite process Endpoint
  if (path === "/api/satellite/process" && method === "POST") {
    const { latitude, longitude, pollutant } = body;
    const latVal = parseFloat(latitude) || 23.0225;
    const lngVal = parseFloat(longitude) || 72.5714;
    const poll = pollutant || "NO2";

    const matrix: number[][] = [];
    let meanSum = 0;

    for (let r = 0; r < 10; r++) {
      const row: number[] = [];
      for (let c = 0; c < 10; c++) {
        const distToCenter = Math.hypot(r - 5, c - 5);
        const noise = Math.sin(r * 0.8) * Math.cos(c * 0.8) * 12;
        let base = 0;

        if (poll === "NO2") base = 35 + (200 / (distToCenter + 1.2)) + noise;
        else if (poll === "CO") base = 0.2 + (1.5 / (distToCenter + 1.2)) + (noise * 0.02);
        else if (poll === "SO2") base = 8 + (45 / (distToCenter + 1.2)) + noise * 0.5;
        else base = 0.1 + (0.8 / (distToCenter + 1.2)) + (noise * 0.01);

        const finalVal = Math.max(0.01, parseFloat(base.toFixed(3)));
        row.push(finalVal);
        meanSum += finalVal;
      }
      matrix.push(row);
    }

    return mockResponse({
      pollutant: poll,
      density: parseFloat((meanSum / 100).toFixed(3)),
      matrix,
      latitude: latVal,
      longitude: lngVal
    });
  }

  // Computer Vision Endpoint
  if (path === "/api/cv/analyze" && method === "POST") {
    const simulations: YoloDetection[] = [
      { box: [15, 20, 65, 55], label: "Factory Emission", confidence: 0.94 },
      { box: [40, 60, 85, 95], label: "Smoke", confidence: 0.88 },
      { box: [75, 10, 95, 45], label: "Vehicle Exhaust", confidence: 0.82 }
    ];

    db.alerts.unshift({
      id: `alert-${Date.now()}`,
      title: "Vision AI Pollution Incident Detected",
      type: "SMOKE_DETECTED",
      message: "YOLOv11 model detected Factory Emission (94% confidence) and Heavy Smoke (88%) from vision analytics feed.",
      severity: "warning",
      timestamp: new Date().toISOString(),
      resolved: false
    });
    saveMockDB();

    return mockResponse({
      detections: simulations,
      summary: "Simulation mode active. Identified major Industrial plume emission spanning coordinates [15%, 20%] to [65%, 55%] with a secondary ground fire/smoke concentration at [40%, 60%]. Recommendation: Industrial emission filter override alert dispatched to environmental inspectors.",
      apiGrounding: false
    });
  }

  // Dashboard summary Endpoint
  if (path === "/api/dashboard/summary") {
    const samples = db.samples;
    const current = samples[samples.length - 1];
    const previous = samples[samples.length - 2] || current;

    const currentFeatures = cleanAndEngineerFeatures([current])[0];
    const prevFeatures = cleanAndEngineerFeatures([previous])[0];

    const currentAqi = Math.round(currentFeatures.aqi);
    const prevAqi = Math.round(prevFeatures.aqi);

    const arena = getMLModel();

    return mockResponse({
      currentAqi,
      previousAqi: prevAqi,
      aqiDelta: currentAqi - prevAqi,
      stationCount: 5,
      activeAlerts: db.alerts.filter(a => !a.resolved).length,
      criticalAlerts: db.alerts.filter(a => !a.resolved && a.severity === "critical").length,
      pm25: current.pm25,
      pm10: current.pm10,
      temp: current.temp,
      humidity: current.humidity,
      windSpeed: current.windSpeed,
      gasSum: parseFloat(currentFeatures.gasSum.toFixed(2)),
      championModel: arena.championName
    });
  }

  return mockResponse({ error: "Endpoint not matched" }, 404);
}

// Global Interceptor Setup
const originalFetch = window.fetch;

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input as Request).url;

  if (url.startsWith("/api/")) {
    try {
      const response = await originalFetch(input, init);
      // If server returns 404 (non-existent endpoint on static host), fall back to mock
      if (response.status === 404) {
        return handleMockRequest(url, init);
      }
      return response;
    } catch (error) {
      // If network fails (no backend running/unreachable), fall back to mock
      return handleMockRequest(url, init);
    }
  }

  return originalFetch(input, init);
};
