/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import {
  generateSyntheticAQISamples,
  cleanAndEngineerFeatures,
  runModelSelectionArena,
  calculateLocalXAI,
  LocalRNNForecaster,
  runKMeans,
  runDBSCAN
} from "./src/lib/ml";
import { AQISample, Alert, User, YoloDetection } from "./src/types";

// Setup Local DB
const DB_FILE = path.join(process.cwd(), "db.json");

interface LocalDB {
  users: Record<string, { id: string; username: string; role: string; passwordHash: string }>;
  samples: AQISample[];
  alerts: Alert[];
}

function initDB(): LocalDB {
  // Ensure directory exists
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      if (data.users && data.samples && data.alerts) {
        return data;
      }
    } catch (e) {
      console.error("Failed to read DB file, re-initializing", e);
    }
  }

  // Preseed DB
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

  const initial: LocalDB = {
    users: {
      admin: { id: "user-admin", username: "admin", role: "admin", passwordHash: "admin123" },
      researcher: { id: "user-res", username: "researcher", role: "researcher", passwordHash: "res123" },
      citizen: { id: "user-cit", username: "citizen", role: "citizen", passwordHash: "cit123" }
    },
    samples: defaultSamples,
    alerts: defaultAlerts
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

const dbData = initDB();

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

// AI Engine Training - Auto select model on startup
console.log("Training local machine learning models on seeded datasets...");
const arenaResult = runModelSelectionArena(dbData.samples);
const championModel = arenaResult.champion;
console.log(`Model selection complete. Champion Model selected: ${arenaResult.championName} with R² = ${arenaResult.stats[0].r2}`);

// Train Forecaster
console.log("Training sequential deep learning forecaster (RNN)...");
const forecaster = new LocalRNNForecaster();
const aqiSequence = dbData.samples.map(s => s.pm25 * 2.5); // approximate baseline historicals
forecaster.train(aqiSequence, 40);
console.log("RNN Forecaster model fit complete.");

// Initialize Express
const app = express();
app.use(express.json({ limit: "50mb" }));

// Auth Middlewares
app.post("/api/auth/register", (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (dbData.users[username]) {
    return res.status(400).json({ error: "Username already exists" });
  }

  const newUser = {
    id: `user-${Date.now()}`,
    username,
    role: role || "citizen",
    passwordHash: password
  };

  dbData.users[username] = newUser;
  saveDB();

  res.json({ id: newUser.id, username: newUser.username, role: newUser.role, token: `mock-jwt-token-${newUser.id}` });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = dbData.users[username];
  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  res.json({ id: user.id, username: user.username, role: user.role, token: `mock-jwt-token-${user.id}` });
});

// MODULE 1: Real-time AQI collection
app.post("/api/samples", (req, res) => {
  const sample: AQISample = req.body;
  dbData.samples.push(sample);

  // Check alerts threshold
  const computedFeatures = cleanAndEngineerFeatures([sample])[0];
  const aqi = Math.round(computedFeatures.aqi);

  if (aqi > 250) {
    dbData.alerts.unshift({
      id: `alert-${Date.now()}`,
      title: "Severe Air Quality Registered",
      type: "AQI_WARNING",
      message: `Critical AQI reading of ${aqi} logged at latitude ${sample.lat}, longitude ${sample.lng}.`,
      severity: "critical",
      timestamp: new Date().toISOString(),
      resolved: false
    });
  } else if (aqi > 150) {
    dbData.alerts.unshift({
      id: `alert-${Date.now()}`,
      title: "High Pollution Alert",
      type: "AQI_WARNING",
      message: `Unhealthy AQI reading of ${aqi} logged at latitude ${sample.lat}, longitude ${sample.lng}.`,
      severity: "warning",
      timestamp: new Date().toISOString(),
      resolved: false
    });
  }

  // Keep last 500 samples
  if (dbData.samples.length > 500) {
    dbData.samples.shift();
  }

  saveDB();
  res.json({ status: "success", computedAqi: aqi });
});

app.get("/api/samples", (req, res) => {
  res.json(dbData.samples);
});

// MODULE 8: Prediction API
app.post("/api/predict", (req, res) => {
  const rawSample: AQISample = req.body;
  const cleanedList = cleanAndEngineerFeatures([rawSample]);
  if (cleanedList.length === 0) {
    return res.status(400).json({ error: "Could not process input features" });
  }

  const row = cleanedList[0];
  const predictedAqi = Math.round(championModel.predict(row));

  // Category
  let category: "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe" = "Good";
  if (predictedAqi <= 50) category = "Good";
  else if (predictedAqi <= 100) category = "Satisfactory";
  else if (predictedAqi <= 200) category = "Moderate";
  else if (predictedAqi <= 300) category = "Poor";
  else if (predictedAqi <= 400) category = "Very Poor";
  else category = "Severe";

  // Confidence Score (based on feature bounds)
  const isOutlier = rawSample.pm25 > 450 || rawSample.pm10 > 600;
  const confidence = isOutlier ? 0.72 : 0.94;

  // LIME / SHAP Explanation
  const topFeatures = calculateLocalXAI(row, championModel as any);

  // Risk & Recommendation
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

  res.json({
    aqi: predictedAqi,
    category,
    confidence,
    topFeatures,
    riskScore,
    recommendation
  });
});

// MODULE 9: Forecast API
app.get("/api/forecast", (req, res) => {
  // Take last 7 sample values
  const lastSamples = dbData.samples.slice(-14);
  const historicAqis = lastSamples.map(s => {
    const f = cleanAndEngineerFeatures([s]);
    return f.length > 0 ? f[0].aqi : 120;
  });

  while (historicAqis.length < 7) {
    historicAqis.unshift(100 + Math.random() * 50);
  }

  const nextHourRaw = forecaster.forecast(historicAqis, 1)[0];
  const next24hRaw = forecaster.forecast(historicAqis, 24);
  const next7dRaw = forecaster.forecast(historicAqis, 7);

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

  res.json({
    nextHour: formatForecast([nextHourRaw], 1)[0],
    nextDay: formatForecast(next24hRaw, 1),
    nextWeek: formatForecast(next7dRaw, 24)
  });
});

// MODULE 10: Pollution Hotspot Detection
app.get("/api/hotspots", (req, res) => {
  const method = req.query.method === "dbscan" ? "dbscan" : "kmeans";
  const points = dbData.samples.map(s => {
    const computed = cleanAndEngineerFeatures([s])[0];
    return {
      lat: s.lat,
      lng: s.lng,
      aqi: computed ? computed.aqi : 120
    };
  });

  if (method === "dbscan") {
    const results = runDBSCAN(points, 0.05, 2);
    res.json(results);
  } else {
    const results = runKMeans(points, 3);
    res.json(results);
  }
});

// MODULE 5: Computer Vision using Gemini API
app.post("/api/cv/analyze", async (req, res) => {
  const { imageBase64, imageName } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: "Missing base64 image content" });
  }

  // Gracefully check if API key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not configured or left default. Returning simulated high-precision YOLOv11 bounding boxes.");
    
    // Simulate smart bounding boxes depending on image name hint or random
    const simulations: YoloDetection[] = [
      { box: [15, 20, 65, 55], label: "Factory Emission", confidence: 0.94 },
      { box: [40, 60, 85, 95], label: "Smoke", confidence: 0.88 },
      { box: [75, 10, 95, 45], label: "Vehicle Exhaust", confidence: 0.82 }
    ];

    // Trigger an alert
    dbData.alerts.unshift({
      id: `alert-${Date.now()}`,
      title: "Vision AI Pollution Incident Detected",
      type: "SMOKE_DETECTED",
      message: "YOLOv11 model detected Factory Emission (94% confidence) and Heavy Smoke (88%) from vision analytics feed.",
      severity: "warning",
      timestamp: new Date().toISOString(),
      resolved: false
    });
    saveDB();

    return res.json({
      detections: simulations,
      summary: "Simulation mode active. Identified major Industrial plume emission spanning coordinates [15%, 20%] to [65%, 55%] with a secondary ground fire/smoke concentration at [40%, 60%]. Recommendation: Industrial emission filter override alert dispatched to environmental inspectors.",
      apiGrounding: false
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg"
          }
        },
        {
          text: `You are an integrated YOLOv11 and computer vision model deployed on an ISRO environmental monitoring workstation. 
Analyze the image to detect: Smoke, Factory Emission, Vehicle Exhaust, Construction Dust, Wildfire, or Industrial Plume.
Find all matching pollution hazards. For each hazard, specify the bounding box where coordinates are [ymin, xmin, ymax, xmax] as integers from 0 to 100 representing percentages of image dimensions.
Also provide a confidence score between 0.0 and 1.0.

Return a JSON payload matching the following structure:
{
  "detections": [
    {
      "box": [ymin, xmin, ymax, xmax],
      "label": "Smoke" | "Factory Emission" | "Vehicle Exhaust" | "Construction Dust" | "Wildfire" | "Industrial Plume",
      "confidence": 0.95
    }
  ],
  "summary": "Brief summary of observations and risk impact..."
}`
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  box: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER }
                  },
                  label: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                },
                required: ["box", "label", "confidence"]
              }
            },
            summary: { type: Type.STRING }
          },
          required: ["detections", "summary"]
        }
      }
    });

    const textResult = response.text || "{}";
    const parsed = JSON.parse(textResult);

    // Trigger alerts if heavy hazards are detected
    const hasSmokeOrFire = parsed.detections.some(
      (d: any) => d.label === "Smoke" || d.label === "Wildfire" || d.label === "Factory Emission"
    );

    if (hasSmokeOrFire) {
      dbData.alerts.unshift({
        id: `alert-${Date.now()}`,
        title: "Vision AI Hazard Dispatched",
        type: "SMOKE_DETECTED",
        message: `Real-time YOLO computer vision flagged a severe ${parsed.detections[0]?.label ?? "plume"} hazard on satellite/station stream.`,
        severity: "critical",
        timestamp: new Date().toISOString(),
        resolved: false
      });
      saveDB();
    }

    res.json({
      detections: parsed.detections,
      summary: parsed.summary,
      apiGrounding: true
    });
  } catch (error: any) {
    console.error("Gemini CV API failed:", error);
    res.status(500).json({ error: "Computer vision processing failed", details: error.message });
  }
});

// MODULE 6: Satellite Image Processing API (NO2, CO, SO2, Aerosol layers)
app.post("/api/satellite/process", (req, res) => {
  const { latitude, longitude, pollutant } = req.body;
  const lat = parseFloat(latitude) || 23.0225;
  const lng = parseFloat(longitude) || 72.5714;
  const poll = pollutant || "NO2";

  // Simulate spectral density matrix for Sentinel-5P grid mapping (10x10)
  const matrix: number[][] = [];
  let meanSum = 0;

  for (let r = 0; r < 10; r++) {
    const row: number[] = [];
    for (let c = 0; c < 10; c++) {
      // Create geographic wave variations (high concentrations near center)
      const distToCenter = Math.hypot(r - 5, c - 5);
      const noise = Math.sin(r * 0.8) * Math.cos(c * 0.8) * 12;
      let base = 0;

      if (poll === "NO2") base = 35 + (200 / (distToCenter + 1.2)) + noise;
      else if (poll === "CO") base = 0.2 + (1.5 / (distToCenter + 1.2)) + (noise * 0.02);
      else if (poll === "SO2") base = 8 + (45 / (distToCenter + 1.2)) + noise * 0.5;
      else base = 0.1 + (0.8 / (distToCenter + 1.2)) + (noise * 0.01); // Aerosol

      const finalVal = Math.max(0.01, parseFloat(base.toFixed(3)));
      row.push(finalVal);
      meanSum += finalVal;
    }
    matrix.push(row);
  }

  res.json({
    pollutant: poll,
    density: parseFloat((meanSum / 100).toFixed(3)),
    matrix,
    latitude: lat,
    longitude: lng
  });
});

// Alerts Retrieval
app.get("/api/alerts", (req, res) => {
  res.json(dbData.alerts);
});

app.post("/api/alerts/resolve", (req, res) => {
  const { id } = req.body;
  const alert = dbData.alerts.find(a => a.id === id);
  if (alert) {
    alert.resolved = true;
    saveDB();
    res.json({ status: "success", alert });
  } else {
    res.status(404).json({ error: "Alert not found" });
  }
});

// Model stats
app.get("/api/models/stats", (req, res) => {
  res.json(arenaResult.stats);
});

// MODULE 12: ISRO Dashboard global stats
app.get("/api/dashboard/summary", (req, res) => {
  const samples = dbData.samples;
  const current = samples[samples.length - 1];
  const previous = samples[samples.length - 2] || current;

  const currentFeatures = cleanAndEngineerFeatures([current])[0];
  const prevFeatures = cleanAndEngineerFeatures([previous])[0];

  const currentAqi = Math.round(currentFeatures.aqi);
  const prevAqi = Math.round(prevFeatures.aqi);

  res.json({
    currentAqi,
    previousAqi: prevAqi,
    aqiDelta: currentAqi - prevAqi,
    stationCount: 5,
    activeAlerts: dbData.alerts.filter(a => !a.resolved).length,
    criticalAlerts: dbData.alerts.filter(a => !a.resolved && a.severity === "critical").length,
    pm25: current.pm25,
    pm10: current.pm10,
    temp: current.temp,
    humidity: current.humidity,
    windSpeed: current.windSpeed,
    gasSum: parseFloat(currentFeatures.gasSum.toFixed(2)),
    championModel: arenaResult.championName
  });
});

// Setup dev server or static file serving
async function startServer() {
  const PORT = 3000;

  // Serve static files in production or hook Vite development server middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AQI Vision AI Server listening on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
