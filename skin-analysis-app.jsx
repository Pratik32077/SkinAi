import { useState, useRef, useEffect } from "react";
import {
  BRAND_LOGO_PATH,
  CLINIC_PROFILE as DEMO_DOCTOR,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  PROJECT_CONTACT,
  PROJECT_TEAM,
} from "./src/config/clinic.js";

const MAROON = "#591321";
const MAROON_DARK = "#3A0C16";
const GOLD = "#C2A278";
const PEARL = "#FAF7F5";
const BLUSH = "#FDF2F4";
const TEXT_HEADING = "#1A1717";
const TEXT_BODY = "#4A4444";
const TEXT_MUTED = "#6E6565";

const MEDICAL_DISCLAIMER =
  "DermaLens AI provides AI-assisted preliminary visual observations for informational and educational purposes only. The estimated visual indicators are not medically validated diagnostic scores and should not be interpreted as a confirmed diagnosis, disease severity measurement, or medical prescription. Image quality, lighting, facial visibility, and other factors may affect the observations. For an accurate diagnosis and personalized treatment, please consult a qualified dermatologist.";

const CONSULTATION_RECOMMENDATION_TITLE = "Need an Accurate Skin Diagnosis?";
const CONSULTATION_RECOMMENDATION_BODY =
  "AI-generated observations are preliminary and cannot replace a professional medical examination. For a reliable diagnosis and personalized treatment recommendations, consult a qualified dermatologist.";

const EYEWEAR_INSTRUCTION =
  "For better skin analysis, please remove your glasses and capture a clear, front-facing photograph of your face.";

const ANALYSIS_TIMEOUT_MS = 80_000;

const TIPS = [
  "Always wear broad-spectrum sunscreen with at least SPF 30, even on cloudy days.",
  "Stay hydrated — consistent hydration supports skin barrier comfort.",
  "Remove makeup and sunscreen gently before sleeping to help keep pores clear.",
  "A consistent, gentle morning and evening routine is easier to maintain than harsh active layering.",
  "Avoid picking or squeezing blemishes, which can worsen irritation and post-blemish marks.",
  "Any changing, persistent, or painful skin concern should always be evaluated by a dermatologist.",
];

const IND_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Other",
];

const OBSERVATION_NAMES = [
  "Acne and blemishes",
  "Hyperpigmentation",
  "Dark circles",
  "Enlarged pores",
  "Fine lines",
];

const SEVERITY_LEVELS = ["Mild", "Moderate", "Severe"];

const PHOTOGRAPHY_GUIDELINES = [
  { title: "Remove spectacles or sunglasses", detail: EYEWEAR_INSTRUCTION },
  { title: "Face the camera directly", detail: "Keep your face centered with a neutral expression." },
  { title: "Use natural or sufficient lighting", detail: "Avoid strong backlighting, harsh glare, and deep shadows." },
  { title: "Maintain a suitable distance", detail: "Ensure your forehead, cheeks, nose, chin, and under-eye areas are clearly visible." },
  { title: "Keep skin clean and natural", detail: "Avoid beauty filters, heavy makeup, or hair covering facial regions." },
];

const ANALYSIS_STAGES = [
  { key: "processing", label: "Image Processing", detail: "Validating format and optimizing facial photograph..." },
  { key: "validation", label: "Image Validation", detail: "Verifying human face, lighting, clarity, and eyewear..." },
  { key: "assessment", label: "AI Assessment", detail: "Reviewing visible facial skin characteristics with Gemini AI..." },
  { key: "report", label: "Report Preparation", detail: "Preparing preliminary observations and visual report..." },
];

let cachedLogoDataUrl = null;

async function getEmbeddedLogoSrc() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const absoluteUrl = new URL(BRAND_LOGO_PATH, window.location.href).href;
  try {
    const response = await fetch(absoluteUrl);
    if (!response.ok) return absoluteUrl;
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : absoluteUrl);
      reader.onerror = () => reject(new Error("Logo read failed"));
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    return absoluteUrl;
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function isValidAssessmentResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return false;
  const isText = (value, limit) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= limit;
  const validRoutines = routine =>
    Array.isArray(routine) &&
    routine.length > 0 &&
    routine.length <= 6 &&
    routine.every(step => isText(step, 300));
  const conditionNames = Array.isArray(result.conditions)
    ? result.conditions.map(condition => condition?.name)
    : [];

  return (
    ["Oily", "Dry", "Combination", "Normal", "Unable to assess"].includes(result.skinType) &&
    isText(result.primaryConcern, 140) &&
    isText(result.summary, 1000) &&
    conditionNames.length === OBSERVATION_NAMES.length &&
    new Set(conditionNames).size === OBSERVATION_NAMES.length &&
    OBSERVATION_NAMES.every(name => conditionNames.includes(name)) &&
    result.conditions.every(
      condition =>
        isText(condition?.description, 500) &&
        (condition.severity == null || SEVERITY_LEVELS.includes(condition.severity)) &&
        (condition.visualScore == null ||
          (Number.isInteger(condition.visualScore) &&
            condition.visualScore >= 0 &&
            condition.visualScore <= 100)),
    ) &&
    validRoutines(result.morningRoutine) &&
    validRoutines(result.eveningRoutine) &&
    isText(result.followUpAdvice, 1000)
  );
}

async function postSkinEndpoint(payloadBody) {
  let response;
  try {
    response = await fetch("/api/analyze-skin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
      signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("The assessment request timed out. Please try again.", { cause: error });
    }
    throw new Error("Unable to reach the assessment service. Please try again.", { cause: error });
  }

  let responseBody;
  let payload;
  try {
    responseBody = await response.text();
    payload = JSON.parse(responseBody);
  } catch {
    const requestId = response.headers.get("x-request-id");
    const reference = requestId ? ` Reference: ${requestId}.` : "";
    throw new Error(`The assessment service returned an unreadable response (HTTP ${response.status}).${reference}`);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    payload = {};
  }

  if (!response.ok) {
    const message = payload.error || `The assessment could not be completed (HTTP ${response.status}).`;
    const requestId = payload.requestId || response.headers.get("x-request-id");
    const err = new Error(requestId ? `${message} Reference: ${requestId}.` : message);
    err.code = payload.code;
    throw err;
  }

  return {
    ...payload,
    requestId: payload.requestId || response.headers.get("x-request-id") || "",
  };
}

async function validateFaceWithAI(image) {
  const payload = await postSkinEndpoint({ action: "validate", image });
  if (!payload.validation || typeof payload.validation !== "object") {
    throw new Error("Image validation returned an incomplete response. Please try again.");
  }
  return payload.validation;
}

async function analyzeWithAI(image, validationContext) {
  const payload = await postSkinEndpoint({ action: "analyze", image, validationContext });
  if (!isValidAssessmentResult(payload.result)) {
    throw new Error("The assessment service returned an incomplete result. Please try again.");
  }
  return { result: payload.result, requestId: payload.requestId };
}

async function compressImageForAnalysis(imageDataUrl) {
  const image = new Image();
  image.src = imageDataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("This image could not be opened. Please choose another image."));
  });
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("This image has invalid dimensions. Please choose another image.");
  }

  for (const maxDimension of [1024, 800, 640]) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This image could not be prepared for analysis. Please try another image.");
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", 0.8);
    const base64Length = compressed.split(",")[1].length;
    if (Math.ceil(base64Length * 0.75) <= 2.5 * 1024 * 1024) {
      return compressed;
    }
  }

  throw new Error("This image is too large to analyze. Please choose a smaller image.");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function buildReportHTML(patient, results, imageDataUrl, assessmentDate, referenceId, validationSummary, logoSrc) {
  const date = formatDate(assessmentDate);
  const v = escapeHTML;
  const quality = results.imageQuality || {};
  const limitations = Array.isArray(quality.limitations) ? quality.limitations : [];
  const eyewearStatusText =
    results.eyewearDetected === "glasses"
      ? "Eyeglasses detected (limitation recorded)"
      : results.eyewearDetected === "sunglasses"
        ? "Dark eyewear detected"
        : results.eyewearDetected === "uncertain"
          ? "Uncertain (image-quality warning noted)"
          : "No eyewear detected";

  const observationRows = results.conditions
    .map(condition => {
      const hasScore = condition.assessable !== false && typeof condition.visualScore === "number";
      const scoreLabel = hasScore ? `Approx. ${condition.visualScore}%` : "Unable to assess";
      const barWidth = hasScore ? condition.visualScore : 0;
      return `
        <tr>
          <td><strong>${v(condition.name)}</strong></td>
          <td class="score-cell">
            <div class="score-line"><span>${v(scoreLabel)}</span>${condition.severity ? `<span class="severity-tag">${v(condition.severity)} visual indicator</span>` : ""}</div>
            ${hasScore ? `<div class="bar-track"><div class="bar-fill" style="width:${barWidth}%"></div></div>` : ""}
          </td>
        </tr>`;
    })
    .join("");

  const detailedMarkers = results.conditions
    .map(condition => {
      const hasScore = condition.assessable !== false && typeof condition.visualScore === "number";
      const scoreHeading = hasScore
        ? `Approx. ${condition.visualScore}% Visual Indicator${condition.severity ? ` · ${condition.severity}` : ""}`
        : "Unable to assess";
      return `
        <article class="observation">
          <div class="observation-heading">
            <strong>${v(condition.name)}</strong>
            <span>${v(scoreHeading)}</span>
          </div>
          ${hasScore ? `<div class="bar-track bar-wide"><div class="bar-fill" style="width:${condition.visualScore}%"></div></div>` : ""}
          <p>${v(condition.description)}</p>
        </article>`;
    })
    .join("");

  const routineList = steps =>
    steps.map((step, index) => `<li><span>${index + 1}</span><div>${v(step)}</div></li>`).join("");

  const limitationsList = [
    ...limitations,
    ...(validationSummary?.qualityWarning ? [validationSummary.qualityWarning] : []),
  ];

  const reportFooter = `
    <footer class="footer">
      <div><strong>Generated by ${v(PRODUCT_NAME)}</strong></div>
      <div class="footer-contact">Platform Contact: ${v(PROJECT_CONTACT.name)} · Phone: ${v(PROJECT_CONTACT.phoneDisplay)} · Email: ${v(PROJECT_CONTACT.email)}</div>
    </footer>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${v(PRODUCT_NAME)} — Preliminary Skin Assessment Report (${v(patient.name)})</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #F5F0EC; color: #342B2D; font: 13.5px/1.55 "Plus Jakarta Sans", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { position: sticky; top: 0; z-index: 20; background: #FFFFFF; border-bottom: 1px solid #E8DDD5; padding: 14px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; }
    .btn-print { border: 1px solid #C2A278; border-radius: 999px; background: #591321; color: #FFF; padding: 11px 22px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .btn-save { border: 1px solid #591321; border-radius: 999px; background: #FAF7F5; color: #591321; padding: 11px 20px; font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; }
    .toolbar-note { color: #6E6565; font-size: 12px; margin: 0; }
    .page { position: relative; width: 210mm; min-height: 297mm; margin: 18px auto; background: #FFF; padding: 15mm 16mm 28mm; box-shadow: 0 10px 30px rgba(89, 19, 33, 0.08); page-break-after: always; break-after: page; }
    .page:last-of-type { page-break-after: auto; break-after: auto; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #EFE5DD; }
    .brand-lockup { display: flex; align-items: center; gap: 12px; }
    .brand-logo { height: 46px; width: auto; object-fit: contain; display: block; }
    .brand-title { font-size: 17px; font-weight: 700; color: #591321; }
    .brand-sub { font-size: 11px; color: #8D6B49; font-weight: 600; }
    .meta { text-align: right; color: #5E5353; font-size: 11px; line-height: 1.5; font-variant-numeric: tabular-nums; }
    h1 { font-size: 24px; line-height: 1.2; color: #591321; margin: 20px 0 4px; font-family: Georgia, serif; font-weight: 600; }
    h2 { font-size: 14px; color: #591321; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.7px; }
    .subtitle { color: #6E6565; margin: 0 0 14px; font-size: 12.5px; }
    .card { padding: 14px 16px; border: 1px solid #ECE2DA; border-radius: 10px; background: #FCFAF8; margin: 10px 0; break-inside: avoid; }
    .patient { display: grid; grid-template-columns: 104px 1fr; gap: 16px; align-items: center; }
    .patient img { width: 104px; height: 124px; object-fit: cover; border-radius: 8px; border: 1px solid #DFCFC3; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .label { font-size: 10px; color: #8D6B49; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    .value { margin-top: 2px; color: #1A1717; font-weight: 600; font-size: 13px; overflow-wrap: anywhere; }
    .notice-eyewear { padding: 12px 14px; border: 1px solid #D9B477; background: #FFF8EB; border-radius: 10px; color: #5C4018; font-size: 12px; margin: 10px 0; break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-variant-numeric: tabular-nums; break-inside: avoid; }
    th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #ECE2DA; vertical-align: middle; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #8D6B49; background: #FAF7F5; }
    th:last-child, td:last-child { text-align: right; width: 48%; }
    tr { break-inside: avoid; }
    .score-line { display: flex; justify-content: flex-end; align-items: baseline; gap: 8px; font-weight: 700; color: #591321; font-size: 12.5px; }
    .severity-tag { font-weight: 500; color: #7A6D6C; font-size: 11px; }
    .bar-track { height: 6px; width: 100%; background: #EFE7E1; border-radius: 999px; overflow: hidden; margin-top: 5px; }
    .bar-wide { margin: 6px 0; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #C2A278, #591321); border-radius: 999px; }
    .observation { padding: 11px 0; border-bottom: 1px solid #ECE2DA; break-inside: avoid; }
    .observation:last-child { border-bottom: 0; padding-bottom: 0; }
    .observation-heading { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .observation-heading strong { color: #1A1717; font-size: 13.5px; }
    .observation-heading span { color: #591321; font-weight: 700; font-size: 12px; font-variant-numeric: tabular-nums; }
    .observation p { margin: 5px 0 0; color: #4A4444; font-size: 12.5px; }
    .routine-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; break-inside: avoid; }
    ol { list-style: none; padding: 0; margin: 0; }
    li { display: flex; gap: 9px; align-items: flex-start; padding: 7px 0; border-bottom: 1px solid #F1EAE4; font-size: 12.5px; break-inside: avoid; }
    li:last-child { border-bottom: 0; }
    li span { width: 20px; height: 20px; border-radius: 50%; background: #FAF7F5; border: 1px solid #C2A278; color: #591321; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; margin-top: 1px; }
    .consult-box { background: #591321; color: #FFF; border-radius: 10px; padding: 15px 16px; border: 1px solid #C2A278; break-inside: avoid; }
    .consult-box h3 { margin: 0 0 6px; font-size: 15px; color: #FFF; font-family: Georgia, serif; }
    .consult-box p { margin: 0 0 8px; font-size: 12px; color: #F5ECE6; line-height: 1.55; }
    .demo-doctor { display: flex; align-items: center; gap: 10px; padding-top: 8px; border-top: 1px solid rgba(194, 162, 120, 0.35); font-size: 12px; color: #E5CFB3; }
    .disclaimer { padding: 12px 14px; border: 1px solid #C9AB7F; border-radius: 10px; background: #FBF7F1; color: #4D3C34; font-size: 11.5px; line-height: 1.55; break-inside: avoid; }
    .lim-list { margin: 4px 0 0; padding-left: 18px; color: #4A4444; font-size: 12px; }
    .footer { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; border-top: 1px solid #E6DAD1; padding-top: 8px; color: #6E6565; font-size: 10.5px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; }
    .footer strong { color: #591321; }
    @media (max-width: 820px) {
      .page { width: auto; min-height: 0; margin: 12px; padding: 18px 16px 64px; }
      .header { flex-direction: column; align-items: flex-start; }
      .meta { text-align: left; }
      .patient, .grid, .grid-3, .routine-grid { grid-template-columns: 1fr; }
      .footer { left: 16px; right: 16px; bottom: 14px; position: static; margin-top: 20px; }
      .page { padding-bottom: 20px; }
    }
    @page { size: A4; margin: 0; }
    @media print {
      body { background: #FFF; }
      .toolbar { display: none; }
      .page { width: 210mm; min-height: 297mm; margin: 0; padding: 14mm 16mm 26mm; box-shadow: none; }
      .footer { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
    <p class="toolbar-note">Select “Save as PDF” in the print dialog to download a PDF copy.</p>
  </div>
  <main>
    <section class="page">
      <header class="header">
        <div class="brand-lockup">
          <img class="brand-logo" src="${v(logoSrc)}" alt="${v(PRODUCT_NAME)} Logo">
          <div>
            <div class="brand-title">${v(PRODUCT_NAME)}</div>
            <div class="brand-sub">AI-Powered Preliminary Skin Assessment</div>
          </div>
        </div>
        <div class="meta">
          <div><strong>Patient:</strong> ${v(patient.name)}</div>
          <div><strong>Date:</strong> ${v(date)}</div>
          ${referenceId ? `<div><strong>Reference ID:</strong> ${v(referenceId)}</div>` : ""}
        </div>
      </header>

      <h1>Preliminary Skin Assessment Report</h1>
      <p class="subtitle">AI-assisted visual screening summary for informational and educational support.</p>

      <h2>1. Patient Information &amp; Uploaded Facial Image</h2>
      <div class="card patient">
        ${imageDataUrl ? `<img src="${v(imageDataUrl)}" alt="Uploaded facial photograph">` : ""}
        <div class="grid">
          <div><div class="label">Patient Name</div><div class="value">${v(patient.name)}</div></div>
          <div><div class="label">Age</div><div class="value">${v(patient.age)} years</div></div>
          <div><div class="label">Phone</div><div class="value">${v(patient.phone || "Not provided")}</div></div>
          <div><div class="label">Location</div><div class="value">${v([patient.city, patient.state].filter(Boolean).join(", ") || "Not provided")}</div></div>
          <div><div class="label">Assessment Date</div><div class="value">${v(date)}</div></div>
          <div><div class="label">Report Reference ID</div><div class="value">${v(referenceId || "Session Report")}</div></div>
        </div>
      </div>

      <h2>2. Face Detection, Image Quality &amp; Eyewear Status</h2>
      <div class="card grid-3">
        <div><div class="label">Face Detection Status</div><div class="value">Human face verified</div></div>
        <div><div class="label">Eyewear Detection Status</div><div class="value">${v(eyewearStatusText)}</div></div>
        <div><div class="label">AI-Estimated Skin Type</div><div class="value">${v(results.skinType)}</div></div>
        <div><div class="label">Lighting Assessment</div><div class="value">${v(quality.lighting || "Assessed")}</div></div>
        <div><div class="label">Image Clarity</div><div class="value">${v(quality.clarity || "Assessed")}</div></div>
        <div><div class="label">Facial Framing</div><div class="value">${v(quality.framing || "Assessed")}</div></div>
      </div>
      ${results.eyewearNote ? `<div class="notice-eyewear">${v(results.eyewearNote)}</div>` : ""}

      <h2>3. Preliminary Skin Observations &amp; Estimated Visual Indicators</h2>
      <div class="card">
        <div class="label" style="margin-bottom:6px">Approximate visual indicators only — not medically validated diagnostic scores</div>
        <table>
          <thead><tr><th>Skin Observation</th><th>Estimated Visual Score</th></tr></thead>
          <tbody>${observationRows}</tbody>
        </table>
      </div>
      ${reportFooter}
    </section>

    <section class="page">
      <header class="header">
        <div class="brand-lockup">
          <img class="brand-logo" src="${v(logoSrc)}" alt="${v(PRODUCT_NAME)} Logo">
          <div>
            <div class="brand-title">${v(PRODUCT_NAME)}</div>
            <div class="brand-sub">AI-Powered Preliminary Skin Assessment</div>
          </div>
        </div>
        <div class="meta">
          <div><strong>Patient:</strong> ${v(patient.name)}</div>
          <div><strong>Date:</strong> ${v(date)}</div>
          ${referenceId ? `<div><strong>Reference ID:</strong> ${v(referenceId)}</div>` : ""}
        </div>
      </header>

      <h1>Diagnostic Markers &amp; Skincare Suggestions</h1>
      <p class="subtitle">Detailed visual notes, routine suggestions, and image limitations.</p>

      <h2>4. Detailed Diagnostic Markers</h2>
      <div class="card">
        <div style="margin-bottom:10px">
          <div class="label">Primary Visible Observation</div>
          <div class="value">${v(results.primaryConcern)}</div>
        </div>
        <div style="margin-bottom:10px">
          <div class="label">Preliminary Summary</div>
          <div style="font-size:12.5px;color:#4A4444;margin-top:3px">${v(results.summary)}</div>
        </div>
        ${detailedMarkers}
      </div>

      <h2>5. General Skincare Routine Suggestions</h2>
      <div class="routine-grid">
        <div class="card">
          <div class="label" style="margin-bottom:8px">Suggested Morning Skincare Routine</div>
          <ol>${routineList(results.morningRoutine)}</ol>
        </div>
        <div class="card">
          <div class="label" style="margin-bottom:8px">Suggested Evening Skincare Routine</div>
          <ol>${routineList(results.eveningRoutine)}</ol>
        </div>
      </div>

      <h2>6. Image Limitations</h2>
      <div class="card">
        ${
          limitationsList.length > 0
            ? `<ul class="lim-list">${limitationsList.map(item => `<li>${v(item)}</li>`).join("")}</ul>`
            : `<div style="font-size:12.5px;color:#4A4444">Visual observations remain limited by single-image lighting, camera resolution, and the absence of an in-person clinical examination.</div>`
        }
      </div>

      <h2>7. Specialist Consultation Recommendation</h2>
      <div class="consult-box">
        <h3>${v(CONSULTATION_RECOMMENDATION_TITLE)}</h3>
        <p>${v(CONSULTATION_RECOMMENDATION_BODY)}</p>
        <p style="margin-bottom:10px">${v(results.followUpAdvice)}</p>
        <div class="demo-doctor">
          <strong>${v(DEMO_DOCTOR.doctorName)}</strong> · ${v(DEMO_DOCTOR.professionalIdentity)}
        </div>
      </div>

      <h2>8. ${v(PRODUCT_NAME)} Medical Disclaimer</h2>
      <div class="disclaimer">${v(MEDICAL_DISCLAIMER)}</div>
      ${reportFooter}
    </section>
  </main>
</body>
</html>`;
}

async function openOrDownloadPDFReport(patient, results, imageDataUrl, assessmentDate, referenceId, validationSummary) {
  const logoSrc = await getEmbeddedLogoSrc();
  const html = buildReportHTML(
    patient,
    results,
    imageDataUrl,
    assessmentDate,
    referenceId,
    validationSummary,
    logoSrc,
  );

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    return "opened";
  }

  // Fallback for iframe / popup-blocked browsers: download self-contained printable HTML report
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (patient.name || "patient").trim().replace(/[^a-z0-9-_]+/gi, "-");
  link.href = url;
  link.download = `DermaLens-AI-Report-${safeName}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

function BrandLogo({ onDark = false, height = 42 }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: onDark ? "rgba(255, 255, 255, 0.96)" : "transparent",
        padding: onDark ? "8px 14px" : 0,
        borderRadius: onDark ? 14 : 0,
        border: onDark ? `1px solid rgba(194, 162, 120, 0.55)` : "none",
        boxShadow: onDark ? "0 8px 20px rgba(0, 0, 0, 0.16)" : "none",
      }}
    >
      <img
        src={BRAND_LOGO_PATH}
        alt={`${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`}
        style={{ height, width: "auto", maxWidth: "100%", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}

function TopNavBar({ onBack, backLabel = "Back", onHome }) {
  return (
    <header
      style={{
        width: "100%",
        background: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(89, 19, 33, 0.08)",
        position: "sticky",
        top: 0,
        zIndex: 80,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={onHome}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Return to DermaLens AI home"
        >
          <BrandLogo height={38} />
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              background: PEARL,
              color: MAROON,
              border: "1px solid rgba(89, 19, 33, 0.16)",
              borderRadius: 999,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {backLabel}
          </button>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [capturedImage, setCapturedImage] = useState(null);
  const [patient, setPatient] = useState({ name: "", age: "", phone: "", city: "", state: "" });
  const [results, setResults] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [tipIdx, setTipIdx] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [activeTab, setActiveTab] = useState("results");
  const [camError, setCamError] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [reportError, setReportError] = useState("");
  const [validationResult, setValidationResult] = useState(null);
  const [preparedImage, setPreparedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressState, setProgressState] = useState({
    stageIndex: 0,
    detail: ANALYSIS_STAGES[0].detail,
    completed: false,
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const isPatientFormValid =
    patient.name.trim().length > 0 &&
    /^\d{1,3}$/.test(patient.age) &&
    Number(patient.age) >= 1 &&
    Number(patient.age) <= 120 &&
    /^[0-9][0-9 ()-]{6,14}$/.test(patient.phone.trim()) &&
    patient.city.trim().length > 0 &&
    patient.state.length > 0;

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const fileRef = useRef(null);
  const fileRef2 = useRef(null);
  const analysisInFlightRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };

  useEffect(() => () => stopCamera(), []);

  const drawOval = () => {
    const draw = () => {
      const cv = overlayRef.current;
      if (!cv) return;
      const w = (cv.width = cv.offsetWidth);
      const h = (cv.height = cv.offsetHeight);
      const ctx = cv.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(12, 4, 6, 0.62)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();

      const base = Math.min(w, h);
      const rx = base * 0.28;
      const ry = rx * 1.35;
      ctx.ellipse(w / 2, h * 0.45, rx, ry, 0, 0, Math.PI * 2);

      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(194, 162, 120, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.45, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h * 0.45);
      ctx.lineTo(w, h * 0.45);
      ctx.stroke();
      ctx.setLineDash([]);

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const startCamera = async () => {
    setCamError(false);
    setUploadError("");
    setScreen("camera");
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        drawOval();
      } catch {
        setCamError(true);
      }
    }, 150);
  };

  const capturePhoto = () => {
    const v = videoRef.current;
    const cv = document.createElement("canvas");
    cv.width = v.videoWidth || 640;
    cv.height = v.videoHeight || 480;
    cv.getContext("2d").drawImage(v, 0, 0);
    setCapturedImage(cv.toDataURL("image/jpeg", 0.85));
    setValidationResult(null);
    setPreparedImage(null);
    stopCamera();
    setScreen("preview");
  };

  const startCountdown = () => {
    let n = 3;
    setCountdown(n);
    const iv = setInterval(() => {
      n--;
      if (n === 0) {
        clearInterval(iv);
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(n);
      }
    }, 1000);
  };

  const handleFile = e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setUploadError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (f.size > 6 * 1024 * 1024) {
      setUploadError("The selected image is larger than 6 MB. Please choose a smaller image.");
      return;
    }
    setUploadError("");
    const r = new FileReader();
    r.onload = ev => {
      if (typeof ev.target.result !== "string") {
        setUploadError("This image could not be read. Please choose another image.");
        return;
      }
      setCapturedImage(ev.target.result);
      setValidationResult(null);
      setPreparedImage(null);
      setScreen("preview");
    };
    r.onerror = () => setUploadError("This image could not be read. Please choose another image.");
    r.readAsDataURL(f);
  };

  const resetToHome = () => {
    stopCamera();
    setCapturedImage(null);
    setPreparedImage(null);
    setValidationResult(null);
    setResults(null);
    setAssessment(null);
    setAnalysisError("");
    setUploadError("");
    setReportError("");
    setReportNotice("");
    setScreen("landing");
  };

  const runSkinAnalysisStage = async (imageToAnalyze, validationInfo, options = {}) => {
    if (!options.fromStartAnalysis) {
      if (analysisInFlightRef.current) return;
      analysisInFlightRef.current = true;
      setIsAnalyzing(true);
    }

    setAnalysisError("");
    setScreen("scanning");
    setTipIdx(0);
    setAssessment(null);
    const patientSnapshot = { ...patient };
    const assessmentDate = new Date().toISOString();
    const tipIv = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 3200);

    try {
      setProgressState({
        stageIndex: 2,
        detail: ANALYSIS_STAGES[2].detail,
        completed: false,
      });

      const { result: data, requestId } = await analyzeWithAI(imageToAnalyze, {
        eyewearDetected: validationInfo?.eyewearDetected,
        lighting: validationInfo?.lighting,
        clarity: validationInfo?.clarity,
        framing: validationInfo?.framing,
      });

      setProgressState({
        stageIndex: 3,
        detail: ANALYSIS_STAGES[3].detail,
        completed: false,
      });

      setResults(data);
      setAssessment({
        patient: patientSnapshot,
        dermatologist: DEMO_DOCTOR,
        assessmentDate,
        referenceId: requestId,
        validationSummary: validationInfo,
      });

      setProgressState({
        stageIndex: 3,
        detail: "Your preliminary skin assessment and report are ready.",
        completed: true,
      });
      await new Promise(resolve => setTimeout(resolve, 350));
      setActiveTab("results");
      setReportNotice("");
      setReportError("");
      setScreen("results");
    } catch (error) {
      if (error?.code === "NO_FACE") {
        setValidationResult({
          approved: false,
          code: "NO_FACE",
          title: "No human face detected.",
          message:
            "DermaLens AI can analyze facial skin images only. Please upload a clear face photograph.",
        });
        setScreen("validation-issue");
        return;
      }
      setAnalysisError(
        error instanceof Error ? error.message : "The assessment could not be completed. Please try again.",
      );
      setScreen("form");
    } finally {
      clearInterval(tipIv);
      if (!options.fromStartAnalysis) {
        analysisInFlightRef.current = false;
        setIsAnalyzing(false);
      }
    }
  };

  const startAnalysis = async () => {
    if (analysisInFlightRef.current || !isPatientFormValid) return;
    analysisInFlightRef.current = true;
    setIsAnalyzing(true);
    setAnalysisError("");
    setScreen("scanning");
    setTipIdx(0);
    setAssessment(null);
    const tipIv = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 3200);

    try {
      setProgressState({
        stageIndex: 0,
        detail: ANALYSIS_STAGES[0].detail,
        completed: false,
      });

      const compressed = preparedImage || (await compressImageForAnalysis(capturedImage));
      setPreparedImage(compressed);

      setProgressState({
        stageIndex: 1,
        detail: ANALYSIS_STAGES[1].detail,
        completed: false,
      });

      const validation = await validateFaceWithAI(compressed);
      setValidationResult(validation);

      if (!validation.approved) {
        clearInterval(tipIv);
        setScreen("validation-issue");
        return;
      }

      if (validation.eyewearDetected === "glasses") {
        clearInterval(tipIv);
        setScreen("eyewear-warning");
        return;
      }

      clearInterval(tipIv);
      await runSkinAnalysisStage(compressed, validation, { fromStartAnalysis: true });
    } catch (error) {
      clearInterval(tipIv);
      setAnalysisError(
        error instanceof Error ? error.message : "The assessment could not be completed. Please try again.",
      );
      setScreen("form");
    } finally {
      analysisInFlightRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const s = { fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" };
  const sSerif = { fontFamily: "'Playfair Display', Georgia, serif" };

  // ═══ LANDING ═══
  if (screen === "landing" || screen === "choose")
    return (
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          minHeight: "100vh",
          background: PEARL,
          ...s,
        }}
      >
        <style>{`
          @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
          .opt-card { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease; }
          .opt-card:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(89, 19, 33, 0.08); border-color: ${GOLD} !important; }
          .contact-btn { transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease; }
          .contact-btn:hover { background: ${MAROON} !important; color: #FFFFFF !important; border-color: ${MAROON} !important; }
          .team-card { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
          .team-card:hover { transform: translateY(-1px); box-shadow: 0 10px 22px -12px rgba(89, 19, 33, 0.2) !important; border-color: ${GOLD} !important; }
          .team-link { transition: color 0.15s ease; }
          .team-link:hover { color: ${MAROON} !important; text-decoration: underline !important; }
          .start-btn { transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease; }
          .start-btn:hover { background: ${MAROON_DARK} !important; box-shadow: 0 12px 26px rgba(89, 19, 33, 0.28) !important; transform: translateY(-1px); }
        `}</style>

        {/* Left Burgundy Brand Panel */}
        <aside
          style={{
            width: isMobile ? "100%" : 400,
            background: "linear-gradient(155deg, #2D0810 0%, #4D0E1C 55%, #591321 100%)",
            padding: isMobile ? "32px 24px" : "48px 40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flexShrink: 0,
            borderRight: isMobile ? "none" : "1px solid rgba(194, 162, 120, 0.22)",
          }}
        >
          <div>
            <div style={{ marginBottom: isMobile ? 24 : 44 }}>
              <BrandLogo onDark height={52} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#E5CFB3",
                fontWeight: 600,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              AI Skin Wellness Platform
            </div>
            <h1
              style={{
                fontSize: isMobile ? 30 : 38,
                fontWeight: 500,
                ...sSerif,
                lineHeight: 1.22,
                margin: "0 0 18px",
                color: "#FFFFFF",
                textWrap: "balance",
              }}
            >
              A clearer view of your skin
            </h1>
            <p
              style={{
                fontSize: 14.5,
                color: "rgba(255, 255, 255, 0.86)",
                lineHeight: 1.75,
                margin: "0 0 28px",
                fontWeight: 400,
              }}
            >
              AI-assisted preliminary facial skin observations, structured visual indicators, and non-prescription skincare guidance to help prepare for a dermatologist consultation.
            </p>
            <div
              style={{
                borderTop: "1px solid rgba(194, 162, 120, 0.25)",
                paddingTop: 18,
                display: "grid",
                gap: 10,
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.85)",
              }}
            >
              <div>• Automated human face &amp; image quality check</div>
              <div>• Five visual observation markers with score indicators</div>
              <div>• Printable &amp; downloadable PDF screening report</div>
            </div>
          </div>

          <div
            style={{
              marginTop: isMobile ? 28 : 32,
              paddingTop: 16,
              borderTop: "1px solid rgba(255, 255, 255, 0.12)",
              color: "rgba(255, 255, 255, 0.72)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Preliminary visual screening only · Not a medical diagnosis
          </div>
        </aside>

        {/* Right Main Card */}
        <main
          style={{
            flex: 1,
            background: "linear-gradient(180deg, #FAF7F5 0%, #F3ECE7 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 32px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 28,
              padding: isMobile ? "28px 20px" : "44px 44px",
              width: "100%",
              maxWidth: 540,
              boxShadow: "0 24px 60px -20px rgba(89, 19, 33, 0.1)",
              border: "1px solid rgba(89, 19, 33, 0.06)",
              animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Demo Doctor Profile */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  border: `2px solid ${GOLD}`,
                  background: BLUSH,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                  padding: 12,
                  boxShadow: "0 10px 24px -8px rgba(89, 19, 33, 0.18)",
                }}
              >
                <img
                  src={BRAND_LOGO_PATH}
                  alt="DermaLens AI Demo Doctor Avatar"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              <div
                style={{
                  color: "#8D6B49",
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                }}
              >
                {DEMO_DOCTOR.professionalIdentity}
              </div>
              <h2
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  color: TEXT_HEADING,
                  ...sSerif,
                  margin: "4px 0 6px",
                }}
              >
                {DEMO_DOCTOR.doctorName}
              </h2>
              <p
                style={{
                  color: TEXT_MUTED,
                  fontSize: 13,
                  margin: "0 auto",
                  maxWidth: 420,
                  lineHeight: 1.6,
                }}
              >
                {DEMO_DOCTOR.profile}
              </p>
            </div>

            {/* Begin Assessment */}
            <div style={{ borderTop: "1px solid #EFE7E1", paddingTop: 26, marginBottom: 26 }}>
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: TEXT_HEADING, marginBottom: 6 }}>
                  Begin Your Skin Assessment
                </div>
                <p style={{ fontSize: 13.5, color: TEXT_MUTED, lineHeight: 1.6, margin: 0 }}>
                  Capture or upload a clear facial photo, enter basic report details, and review AI-assisted visual observations.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                  gap: 12,
                  marginBottom: 26,
                }}
              >
                {[
                  { step: "01", title: "Add Face Photo", desc: "Camera capture or image upload." },
                  { step: "02", title: "Face & Quality Check", desc: "Verifies face visibility & lighting." },
                  { step: "03", title: "Review Report", desc: "Visual indicators & PDF export." },
                ].map(item => (
                  <div
                    key={item.step}
                    style={{
                      padding: "14px 12px",
                      background: PEARL,
                      border: "1px solid rgba(194, 162, 120, 0.25)",
                      borderRadius: 16,
                      textAlign: isMobile ? "left" : "center",
                    }}
                  >
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#8D6B49",
                        marginBottom: 4,
                      }}
                    >
                      Step {item.step}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: MAROON, marginBottom: 4 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.45 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="start-btn"
                onClick={() => setScreen("choose")}
                style={{
                  width: "100%",
                  background: MAROON,
                  color: "#FFFFFF",
                  border: `1px solid ${GOLD}`,
                  borderRadius: 999,
                  padding: "16px 24px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  boxShadow: "0 10px 24px -6px rgba(89, 19, 33, 0.28)",
                }}
              >
                Start Skin Assessment
              </button>
            </div>

            {/* Project Team */}
            <footer
              aria-label="Project Team"
              style={{
                borderTop: "1px solid #EFE7E1",
                paddingTop: 24,
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ width: 18, height: 1, background: GOLD }} />
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "#8D6B49",
                      fontWeight: 700,
                      letterSpacing: "1.4px",
                      textTransform: "uppercase",
                    }}
                  >
                    {PRODUCT_NAME}
                  </span>
                  <span style={{ width: 18, height: 1, background: GOLD }} />
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 600,
                    color: MAROON,
                    letterSpacing: "1.2px",
                    ...sSerif,
                  }}
                >
                  PROJECT TEAM
                </h3>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {PROJECT_TEAM.map(member => (
                  <div
                    key={member.id}
                    className="team-card"
                    style={{
                      background: "linear-gradient(135deg, #FFFFFF 0%, #FAF7F5 100%)",
                      border: "1px solid rgba(194, 162, 120, 0.34)",
                      borderLeft: `3px solid ${MAROON}`,
                      borderRadius: 14,
                      padding: isMobile ? "13px 14px" : "13px 16px",
                      boxShadow: "0 4px 14px -10px rgba(89, 19, 33, 0.16)",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span
                          className="tabular-nums"
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 7,
                            background: BLUSH,
                            border: "1px solid rgba(89, 19, 33, 0.16)",
                            color: MAROON,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {member.number}
                        </span>
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: TEXT_HEADING,
                            lineHeight: 1.35,
                          }}
                        >
                          {member.name}
                        </span>
                      </div>

                      <span
                        className="tabular-nums"
                        style={{
                          padding: "3px 9px",
                          borderRadius: 8,
                          background: BLUSH,
                          border: "1px solid rgba(194, 162, 120, 0.45)",
                          color: MAROON,
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Roll No.: {member.rollNo}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        alignItems: isMobile ? "flex-start" : "center",
                        flexWrap: "wrap",
                        gap: isMobile ? 6 : "6px 14px",
                      }}
                    >
                      <a
                        className="team-link"
                        href={`mailto:${member.email}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          color: TEXT_BODY,
                          textDecoration: "none",
                          overflowWrap: "anywhere",
                          lineHeight: 1.4,
                        }}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={MAROON}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          style={{ flexShrink: 0 }}
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        <span>{member.email}</span>
                      </a>

                      {member.phoneDisplay && (
                        <a
                          className="team-link tabular-nums"
                          href={`tel:${member.mobile}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: MAROON,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            lineHeight: 1.4,
                          }}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={MAROON}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          <span>{member.phoneDisplay}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </footer>
          </div>
        </main>

        {/* Choose Analysis Modal */}
        {screen === "choose" && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose Your Analysis"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(35, 12, 18, 0.5)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 200,
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 28,
                padding: "32px 28px",
                width: 440,
                maxWidth: "100%",
                boxShadow: "0 30px 60px rgba(0, 0, 0, 0.22)",
                border: `1px solid rgba(194, 162, 120, 0.35)`,
                animation: "fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div style={{ marginBottom: 18 }}>
                <BrandLogo height={36} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 500, color: TEXT_HEADING, margin: "0 0 6px", ...sSerif }}>
                Choose Your Assessment
              </h2>
              <p style={{ fontSize: 13.5, color: TEXT_MUTED, margin: "0 0 22px" }}>
                Select how you would like to prepare your preliminary skin wellness report:
              </p>
              {[
                {
                  type: "quick",
                  title: "Quick Facial Screening",
                  desc: "Check facial skin observations and estimated visual indicators.",
                  rec: false,
                },
                {
                  type: "detailed",
                  title: "Detailed Screening Report",
                  desc: "Include patient details, face validation, and a printable PDF report.",
                  rec: true,
                },
              ].map(o => (
                <button
                  type="button"
                  key={o.type}
                  className="opt-card"
                  onClick={() => setScreen("tips")}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: o.rec ? `1px solid ${GOLD}` : "1px solid rgba(89, 19, 33, 0.12)",
                    borderRadius: 18,
                    padding: "18px 18px",
                    marginBottom: 12,
                    cursor: "pointer",
                    background: o.rec ? "linear-gradient(135deg, #4A0E1C 0%, #2D0810 100%)" : PEARL,
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: o.rec ? "#FFFFFF" : TEXT_HEADING,
                      fontSize: 14.5,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{o.title}</span>
                    {o.rec && (
                      <span style={{ fontSize: 11, color: "#E5CFB3", fontWeight: 700, letterSpacing: "0.6px" }}>
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: o.rec ? "rgba(255, 255, 255, 0.82)" : TEXT_MUTED,
                      marginTop: 5,
                      lineHeight: 1.5,
                    }}
                  >
                    {o.desc}
                  </div>
                </button>
              ))}
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setScreen("landing")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: TEXT_MUTED,
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: 600,
                    padding: "8px 16px",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

  // ═══ PHOTOGRAPHY INSTRUCTIONS (TIPS) ═══
  if (screen === "tips")
    return (
      <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", ...s }}>
        <TopNavBar onHome={resetToHome} onBack={() => setScreen("choose")} />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 24px",
          }}
        >
          <div style={{ maxWidth: 560, width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  color: "#8D6B49",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Photography Instructions
              </div>
              <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 500, color: TEXT_HEADING, margin: "0 0 10px", ...sSerif }}>
                Prepare for Your Facial Scan
              </h1>
              <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
                DermaLens AI requires a clear, front-facing human face photograph for reliable visual screening.
              </p>
            </div>

            {/* Highlighted Eyewear Instruction */}
            <div
              style={{
                background: BLUSH,
                border: `1px solid ${GOLD}`,
                borderRadius: 18,
                padding: "16px 20px",
                marginBottom: 18,
                color: MAROON,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.55,
                textAlign: "center",
              }}
            >
              {EYEWEAR_INSTRUCTION}
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 22,
                padding: "8px 22px",
                border: "1px solid rgba(89, 19, 33, 0.08)",
                boxShadow: "0 14px 30px -12px rgba(89, 19, 33, 0.08)",
              }}
            >
              {PHOTOGRAPHY_GUIDELINES.map((item, idx) => (
                <div
                  key={item.title}
                  style={{
                    padding: "14px 0",
                    borderBottom: idx < PHOTOGRAPHY_GUIDELINES.length - 1 ? "1px solid #F1EAE4" : "none",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    className="tabular-nums"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: PEARL,
                      border: `1px solid ${GOLD}`,
                      color: MAROON,
                      fontWeight: 700,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_HEADING, marginBottom: 2 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.5 }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setScreen("capture-choice")}
              style={{
                width: "100%",
                background: MAROON,
                color: "#FFFFFF",
                border: `1px solid ${GOLD}`,
                borderRadius: 999,
                padding: "16px 24px",
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
                cursor: "pointer",
                marginTop: 24,
                boxShadow: "0 10px 24px -6px rgba(89, 19, 33, 0.25)",
              }}
            >
              I&apos;m Ready — Continue
            </button>
          </div>
        </main>
      </div>
    );

  // ═══ CAPTURE CHOICE ═══
  if (screen === "capture-choice")
    return (
      <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", ...s }}>
        <TopNavBar onHome={resetToHome} onBack={() => setScreen("tips")} />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 24px",
          }}
        >
          <div style={{ maxWidth: 500, width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  color: "#8D6B49",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Facial Photo Capture
              </div>
              <h1 style={{ fontSize: isMobile ? 26 : 30, fontWeight: 500, color: TEXT_HEADING, margin: "0 0 8px", ...sSerif }}>
                Add a Facial Photograph
              </h1>
              <p style={{ fontSize: 13.5, color: TEXT_MUTED, margin: "0 0 10px", lineHeight: 1.6 }}>
                Supported formats: JPEG, PNG, WebP · Maximum size: 6 MB
              </p>
              <p style={{ fontSize: 12.5, color: MAROON, fontWeight: 600, margin: 0 }}>
                {EYEWEAR_INSTRUCTION}
              </p>
            </div>

            {[
              {
                type: "camera",
                title: "Use Device Camera",
                desc: "Align your face inside the guide with even lighting.",
              },
              {
                type: "upload",
                title: "Upload an Image",
                desc: "Select a clear front-facing photo from your device.",
              },
            ].map(opt => (
              <button
                type="button"
                key={opt.title}
                onClick={() => (opt.type === "camera" ? startCamera() : fileRef2.current?.click())}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "#FFFFFF",
                  borderRadius: 18,
                  padding: "20px 22px",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  cursor: "pointer",
                  border: "1px solid rgba(89, 19, 33, 0.1)",
                  boxShadow: "0 10px 24px -12px rgba(89, 19, 33, 0.1)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: TEXT_HEADING, fontSize: 15 }}>{opt.title}</div>
                  <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>{opt.desc}</div>
                </div>
                <span style={{ color: MAROON, fontSize: 22, fontWeight: 600 }}>→</span>
              </button>
            ))}

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 18,
                padding: "18px 20px",
                marginTop: 14,
                border: `1px solid rgba(194, 162, 120, 0.45)`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#8D6B49",
                  letterSpacing: "1px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Face Validation &amp; Privacy
              </div>
              <div style={{ fontSize: 13, color: TEXT_BODY, lineHeight: 1.6 }}>
                Your photo is checked for a human face, lighting clarity, and eyewear before skin observation analysis. This demonstration stores session data in memory only and does not create patient accounts or a database.
              </div>
            </div>

            {uploadError && (
              <div
                role="alert"
                style={{
                  color: "#9B1C31",
                  background: "#FFF2F3",
                  border: "1px solid #F3C2C9",
                  padding: 14,
                  borderRadius: 12,
                  marginTop: 14,
                  fontSize: 13,
                }}
              >
                {uploadError}
              </div>
            )}

            <input
              ref={fileRef2}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={handleFile}
            />
          </div>
        </main>
      </div>
    );

  // ═══ CAMERA ═══
  if (screen === "camera")
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0C0406", overflow: "hidden", ...s }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setScreen("capture-choice");
            }}
            style={{
              background: "rgba(12, 4, 6, 0.72)",
              border: `1px solid ${GOLD}`,
              color: "#FFFFFF",
              padding: "9px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <BrandLogo onDark height={34} />
        </div>

        <div
          style={{
            position: "absolute",
            top: 78,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(12, 4, 6, 0.8)",
            color: "#FFFFFF",
            padding: "10px 20px",
            borderRadius: 16,
            fontSize: 13,
            textAlign: "center",
            border: "1px solid rgba(194, 162, 120, 0.35)",
            maxWidth: "90vw",
          }}
        >
          Center your face inside the guide without glasses
        </div>

        {countdown && (
          <div
            className="tabular-nums"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 100,
              fontWeight: 400,
              ...sSerif,
              color: GOLD,
              textShadow: "0 0 32px rgba(0,0,0,0.65)",
            }}
          >
            {countdown}
          </div>
        )}

        {camError && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              background: "#FFFFFF",
              padding: "28px 24px",
              borderRadius: 22,
              textAlign: "center",
              maxWidth: 340,
              width: "90vw",
              border: `1px solid ${GOLD}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, ...sSerif, color: MAROON }}>
              Camera unavailable
            </div>
            <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 18, lineHeight: 1.6 }}>
              Check browser camera permissions or upload a clear facial photograph from your device.
            </div>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setScreen("capture-choice");
                setTimeout(() => fileRef2.current?.click(), 100);
              }}
              style={{
                background: MAROON,
                color: "#FFFFFF",
                border: `1px solid ${GOLD}`,
                padding: "12px 24px",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Upload an Image
            </button>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 42,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
          }}
        >
          <button
            type="button"
            onClick={() => {
              stopCamera();
              fileRef.current?.click();
            }}
            style={{
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              color: "#FFFFFF",
              padding: "12px 18px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Upload Photo
          </button>
          <button
            type="button"
            aria-label="Capture photo with 3 second timer"
            onClick={startCountdown}
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              background: "#FFFFFF",
              border: `6px solid rgba(194, 162, 120, 0.7)`,
              cursor: "pointer",
              boxShadow: "0 0 28px rgba(194, 162, 120, 0.35)",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 0,
            right: 0,
            textAlign: "center",
            color: GOLD,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          Tap Shutter for 3-Second Countdown
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
    );

  // ═══ PREVIEW ═══
  if (screen === "preview")
    return (
      <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", ...s }}>
        <TopNavBar
          onHome={resetToHome}
          onBack={() => {
            setCapturedImage(null);
            setScreen("capture-choice");
          }}
          backLabel="Choose Another"
        />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 24px",
          }}
        >
          <div style={{ maxWidth: 480, width: "100%" }}>
            <div
              style={{
                borderRadius: 22,
                overflow: "hidden",
                marginBottom: 18,
                border: `2px solid ${GOLD}`,
                boxShadow: "0 20px 40px rgba(89, 19, 33, 0.1)",
                background: "#FFFFFF",
              }}
            >
              <img
                src={capturedImage}
                style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block" }}
                alt="Preview of facial photo"
              />
            </div>

            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 18,
                padding: 20,
                marginBottom: 16,
                textAlign: "center",
                border: "1px solid rgba(89, 19, 33, 0.08)",
              }}
            >
              <div style={{ color: MAROON, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                Review Your Photograph
              </div>
              <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6 }}>
                Ensure your face is clearly visible, evenly lit, and free of glasses or filters before proceeding to face validation.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setScreen("form")}
              style={{
                width: "100%",
                background: MAROON,
                color: "#FFFFFF",
                border: `1px solid ${GOLD}`,
                borderRadius: 999,
                padding: "16px 24px",
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
                cursor: "pointer",
                marginBottom: 12,
                boxShadow: "0 10px 24px -6px rgba(89, 19, 33, 0.25)",
              }}
            >
              Continue to Patient Details →
            </button>
            <button
              type="button"
              onClick={() => {
                setCapturedImage(null);
                setScreen("capture-choice");
              }}
              style={{
                width: "100%",
                background: "#FFFFFF",
                color: TEXT_BODY,
                border: "1px solid rgba(89, 19, 33, 0.16)",
                borderRadius: 999,
                padding: "14px 24px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retake / Upload Different Photo
            </button>
          </div>
        </main>
      </div>
    );

  // ═══ PATIENT FORM ═══
  if (screen === "form")
    return (
      <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", ...s }}>
        <TopNavBar onHome={resetToHome} onBack={() => setScreen("preview")} />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 500,
              width: "100%",
              background: "#FFFFFF",
              borderRadius: 24,
              padding: isMobile ? "28px 20px" : "36px 36px",
              border: "1px solid rgba(89, 19, 33, 0.08)",
              boxShadow: "0 20px 50px -20px rgba(89, 19, 33, 0.12)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  color: "#8D6B49",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Patient Information
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 500, color: TEXT_HEADING, margin: "0 0 8px", ...sSerif }}>
                Report Details
              </h1>
              <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0 }}>
                Used to label your DermaLens AI report locally; not sent with your photo to Gemini.
              </p>
            </div>

            {[
              { l: "Patient Full Name", k: "name", p: "Enter patient full name", t: "text" },
              { l: "Age (Years)", k: "age", p: "Enter age (1–120)", t: "number" },
            ].map(f => (
              <div key={f.k} style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: MAROON,
                    display: "block",
                    marginBottom: 6,
                    letterSpacing: "0.7px",
                    textTransform: "uppercase",
                  }}
                >
                  {f.l}
                </label>
                <input
                  type={f.t}
                  min={f.k === "age" ? "1" : undefined}
                  max={f.k === "age" ? "120" : undefined}
                  required
                  placeholder={f.p}
                  value={patient[f.k]}
                  onChange={e => setPatient(p => ({ ...p, [f.k]: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    border: "1px solid rgba(89, 19, 33, 0.14)",
                    borderRadius: 12,
                    fontSize: 14,
                    background: PEARL,
                    color: TEXT_HEADING,
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: MAROON,
                  display: "block",
                  marginBottom: 6,
                  letterSpacing: "0.7px",
                  textTransform: "uppercase",
                }}
              >
                Phone Number
              </label>
              <div
                style={{
                  display: "flex",
                  border: "1px solid rgba(89, 19, 33, 0.14)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: PEARL,
                }}
              >
                <span
                  style={{
                    padding: "13px 14px",
                    background: "rgba(89, 19, 33, 0.04)",
                    fontSize: 13.5,
                    color: TEXT_MUTED,
                    fontWeight: 600,
                    borderRight: "1px solid rgba(89, 19, 33, 0.12)",
                  }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  maxLength={20}
                  placeholder="9876543210"
                  value={patient.phone}
                  onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))}
                  style={{
                    flex: 1,
                    padding: "13px 16px",
                    border: "none",
                    fontSize: 14,
                    background: "transparent",
                    color: TEXT_HEADING,
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: MAROON,
                    display: "block",
                    marginBottom: 6,
                    letterSpacing: "0.7px",
                    textTransform: "uppercase",
                  }}
                >
                  City
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Mumbai"
                  value={patient.city}
                  onChange={e => setPatient(p => ({ ...p, city: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    border: "1px solid rgba(89, 19, 33, 0.14)",
                    borderRadius: 12,
                    fontSize: 14,
                    background: PEARL,
                    color: TEXT_HEADING,
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: MAROON,
                    display: "block",
                    marginBottom: 6,
                    letterSpacing: "0.7px",
                    textTransform: "uppercase",
                  }}
                >
                  State
                </label>
                <select
                  required
                  value={patient.state}
                  onChange={e => setPatient(p => ({ ...p, state: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    border: "1px solid rgba(89, 19, 33, 0.14)",
                    borderRadius: 12,
                    fontSize: 13.5,
                    background: PEARL,
                    color: TEXT_HEADING,
                  }}
                >
                  <option value="">Select a state</option>
                  {IND_STATES.map(st => (
                    <option key={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                background: PEARL,
                border: "1px solid rgba(194, 162, 120, 0.4)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 22,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: MAROON, marginBottom: 4 }}>
                Privacy &amp; Two-Step AI Processing
              </div>
              <div style={{ fontSize: 12.5, color: TEXT_MUTED, lineHeight: 1.55 }}>
                Your facial image is sent to the secure server endpoint for face validation and skin observation analysis. Name, age, phone, and location remain in your browser session for report formatting only.
              </div>
            </div>

            {analysisError && (
              <div
                role="alert"
                style={{
                  color: "#9B1C31",
                  background: "#FFF2F3",
                  border: "1px solid #F3C2C9",
                  padding: 14,
                  borderRadius: 12,
                  marginBottom: 16,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Unable to Complete Analysis</div>
                <div>{analysisError}</div>
                <div style={{ fontSize: 12, color: TEXT_BODY, marginTop: 6 }}>
                  Your uploaded photo and entered details are preserved—tap Retry below when ready.
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={startAnalysis}
              disabled={!isPatientFormValid || isAnalyzing}
              style={{
                width: "100%",
                background: isPatientFormValid && !isAnalyzing ? MAROON : "#E5E2DF",
                color: isPatientFormValid && !isAnalyzing ? "#FFFFFF" : "#8F8A88",
                border: isPatientFormValid && !isAnalyzing ? `1px solid ${GOLD}` : "1px solid transparent",
                borderRadius: 999,
                padding: "16px 24px",
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                cursor: isPatientFormValid && !isAnalyzing ? "pointer" : "not-allowed",
                boxShadow: isPatientFormValid && !isAnalyzing ? "0 10px 24px -6px rgba(89, 19, 33, 0.25)" : "none",
              }}
            >
              {isAnalyzing
                ? "Analyzing..."
                : analysisError
                  ? "Retry Face Validation & Analysis"
                  : "Validate Face & Analyze Skin"}
            </button>
          </div>
        </main>
      </div>
    );

  // ═══ VALIDATION ISSUE (NO FACE / UNSUITABLE IMAGE) ═══
  if (screen === "validation-issue" && validationResult)
    return (
      <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", ...s }}>
        <TopNavBar onHome={resetToHome} onBack={() => setScreen("capture-choice")} backLabel="Change Photo" />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 24px",
          }}
        >
          <div
            role="alert"
            style={{
              maxWidth: 500,
              width: "100%",
              background: "#FFFFFF",
              borderRadius: 24,
              padding: isMobile ? "28px 20px" : "36px 34px",
              border: "1px solid #EBC0C7",
              boxShadow: "0 20px 50px -20px rgba(89, 19, 33, 0.14)",
              textAlign: "center",
            }}
          >
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Submitted image requiring retake"
                style={{
                  width: 112,
                  height: 112,
                  objectFit: "cover",
                  borderRadius: 16,
                  border: "2px solid #EBC0C7",
                  marginBottom: 18,
                }}
              />
            )}
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#9B1C31",
                marginBottom: 8,
              }}
            >
              Image Validation Failed
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: TEXT_HEADING, margin: "0 0 10px", ...sSerif }}>
              {validationResult.title || "No human face detected."}
            </h1>
            <p style={{ fontSize: 14, color: TEXT_BODY, lineHeight: 1.65, margin: "0 0 18px" }}>
              {validationResult.message}
            </p>

            {validationResult.detectedSubject && validationResult.code === "NO_FACE" && (
              <div
                style={{
                  background: PEARL,
                  border: "1px solid rgba(89, 19, 33, 0.1)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  color: TEXT_MUTED,
                  marginBottom: 14,
                }}
              >
                Detected subject: <strong style={{ color: TEXT_HEADING }}>{validationResult.detectedSubject}</strong>
              </div>
            )}

            <div
              style={{
                background: "#FAF7F5",
                border: "1px solid rgba(194, 162, 120, 0.35)",
                borderRadius: 14,
                padding: "12px 14px",
                textAlign: "left",
                fontSize: 12.5,
                color: TEXT_BODY,
                lineHeight: 1.55,
                marginBottom: 20,
              }}
            >
              <strong style={{ color: MAROON, display: "block", marginBottom: 4 }}>Tips for a clear photo:</strong>
              Remove glasses, face the camera directly, use even natural lighting, and avoid harsh shadows.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                onClick={startCamera}
                style={{
                  width: "100%",
                  background: MAROON,
                  color: "#FFFFFF",
                  border: `1px solid ${GOLD}`,
                  borderRadius: 999,
                  padding: "15px 22px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Capture New Facial Photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setPreparedImage(null);
                  setValidationResult(null);
                  setScreen("capture-choice");
                }}
                style={{
                  width: "100%",
                  background: PEARL,
                  color: MAROON,
                  border: "1px solid rgba(89, 19, 33, 0.16)",
                  borderRadius: 999,
                  padding: "14px 22px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Upload Another Image
              </button>
            </div>
          </div>
        </main>
      </div>
    );

  // ═══ EYEWEAR WARNING BEFORE PROCEEDING ═══
  if (screen === "eyewear-warning" && validationResult)
    return (
      <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", ...s }}>
        <TopNavBar onHome={resetToHome} onBack={() => setScreen("capture-choice")} backLabel="Change Photo" />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 520,
              width: "100%",
              background: "#FFFFFF",
              borderRadius: 24,
              padding: isMobile ? "28px 20px" : "36px 34px",
              border: `1px solid ${GOLD}`,
              boxShadow: "0 20px 50px -20px rgba(89, 19, 33, 0.14)",
              textAlign: "center",
            }}
          >
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Facial photo with glasses detected"
                style={{
                  width: 112,
                  height: 112,
                  objectFit: "cover",
                  borderRadius: 16,
                  border: `2px solid ${GOLD}`,
                  marginBottom: 18,
                }}
              />
            )}
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#8D6B49",
                marginBottom: 8,
              }}
            >
              Eyewear Warning
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: TEXT_HEADING, margin: "0 0 10px", ...sSerif }}>
              Glasses Detected in Photo
            </h1>
            <p style={{ fontSize: 14, color: TEXT_BODY, lineHeight: 1.65, margin: "0 0 16px" }}>
              {EYEWEAR_INSTRUCTION}
            </p>
            <div
              style={{
                background: "#FFF8EB",
                border: "1px solid #E5C285",
                borderRadius: 14,
                padding: 14,
                fontSize: 13,
                color: "#5C4018",
                lineHeight: 1.55,
                textAlign: "left",
                marginBottom: 22,
              }}
            >
              Glasses may obstruct parts of the eye and under-eye areas, making observations in those regions less reliable. You may remove your glasses and retake the photo, or continue with this limitation recorded in your report.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setPreparedImage(null);
                  setValidationResult(null);
                  setScreen("capture-choice");
                }}
                style={{
                  width: "100%",
                  background: MAROON,
                  color: "#FFFFFF",
                  border: `1px solid ${GOLD}`,
                  borderRadius: 999,
                  padding: "15px 22px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Remove Glasses &amp; Retake Photo
              </button>
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => runSkinAnalysisStage(preparedImage, validationResult)}
                style={{
                  width: "100%",
                  background: PEARL,
                  color: MAROON,
                  border: "1px solid rgba(89, 19, 33, 0.16)",
                  borderRadius: 999,
                  padding: "14px 22px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isAnalyzing ? "not-allowed" : "pointer",
                  opacity: isAnalyzing ? 0.65 : 1,
                }}
              >
                {isAnalyzing ? "Analyzing..." : "Proceed With Recorded Limitation"}
              </button>
            </div>
          </div>
        </main>
      </div>
    );

  // ═══ SCANNING / PROGRESS SCREEN ═══
  if (screen === "scanning") {
    const activeStage = ANALYSIS_STAGES[progressState.stageIndex] || ANALYSIS_STAGES[0];
    return (
      <div
        aria-busy={!progressState.completed}
        style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", ...s }}
      >
        <TopNavBar onHome={resetToHome} />
        <style>{`
          @keyframes scanLine { 0% { top: 0%; } 100% { top: 100%; } }
          @keyframes smoothSlide {
            0% { transform: translateX(-65%); }
            50% { transform: translateX(45%); }
            100% { transform: translateX(165%); }
          }
          @keyframes stagePulse { 0%, 100% { opacity: 0.45; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.1); } }
        `}</style>
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "24px 16px" : "40px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: "100%",
              background: "#FFFFFF",
              borderRadius: 24,
              padding: isMobile ? "28px 20px" : "36px 34px",
              border: "1px solid rgba(89, 19, 33, 0.08)",
              boxShadow: "0 20px 50px -20px rgba(89, 19, 33, 0.12)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 210,
                height: 245,
                margin: "0 auto 24px",
                borderRadius: 22,
                overflow: "hidden",
                border: `2px solid ${GOLD}`,
                boxShadow: "0 18px 36px rgba(89, 19, 33, 0.1)",
              }}
            >
              <img src={capturedImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Scanning face" />
              {!progressState.completed && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`,
                    animation: "scanLine 2.4s linear infinite",
                    boxShadow: `0 0 10px ${GOLD}`,
                  }}
                />
              )}
            </div>

            <div
              className="tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                color: "#8D6B49",
                marginBottom: 6,
              }}
            >
              {progressState.completed
                ? "Assessment Complete · 100%"
                : `Stage ${progressState.stageIndex + 1} of ${ANALYSIS_STAGES.length} · ${activeStage.label}`}
            </div>

            <h1
              className="tabular-nums"
              style={{ fontSize: 24, fontWeight: 500, color: TEXT_HEADING, margin: "0 0 6px", ...sSerif }}
            >
              {progressState.completed ? "Report Ready – 100%" : "Analyzing Your Skin"}
            </h1>
            <p style={{ fontSize: 13.5, color: MAROON, fontWeight: 600, margin: "0 0 18px", minHeight: 20 }}>
              {progressState.detail}
            </p>

            <div
              role="progressbar"
              aria-label="Skin analysis status"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressState.completed ? 100 : undefined}
              style={{
                position: "relative",
                background: "#F1EAE4",
                borderRadius: 999,
                height: 10,
                marginBottom: 18,
                overflow: "hidden",
                border: "1px solid rgba(89, 19, 33, 0.06)",
              }}
            >
              {progressState.completed ? (
                <div
                  style={{
                    background: `linear-gradient(90deg, ${GOLD} 0%, ${MAROON} 100%)`,
                    height: "100%",
                    width: "100%",
                    transition: "width 0.35s ease",
                  }}
                />
              ) : (
                <div
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${GOLD} 30%, ${MAROON} 70%, transparent 100%)`,
                    height: "100%",
                    width: "45%",
                    borderRadius: 999,
                    animation: "smoothSlide 1.8s ease-in-out infinite",
                  }}
                />
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
                gap: 8,
                marginBottom: 22,
                textAlign: "left",
              }}
            >
              {ANALYSIS_STAGES.map((stage, idx) => {
                const isDone = progressState.completed || idx < progressState.stageIndex;
                const isActive = !progressState.completed && idx === progressState.stageIndex;
                return (
                  <div
                    key={stage.key}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      background: isDone ? "#FAF7F5" : isActive ? BLUSH : "#FAFAFA",
                      border: isActive
                        ? `1px solid ${GOLD}`
                        : isDone
                          ? "1px solid rgba(89, 19, 33, 0.14)"
                          : "1px solid rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9.5,
                          fontWeight: 700,
                          background: isDone ? MAROON : isActive ? GOLD : "#E5E2DF",
                          color: "#FFFFFF",
                          animation: isActive ? "stagePulse 1.3s ease-in-out infinite" : "none",
                          flexShrink: 0,
                        }}
                      >
                        {isDone ? "✓" : idx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: isActive || isDone ? 700 : 500,
                          color: isActive || isDone ? MAROON : TEXT_MUTED,
                          lineHeight: 1.25,
                        }}
                      >
                        {stage.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                background: PEARL,
                borderRadius: 16,
                padding: "16px 20px",
                textAlign: "left",
                border: "1px solid rgba(194, 162, 120, 0.3)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: MAROON,
                  marginBottom: 6,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                Skin Wellness Tip
              </div>
              <div style={{ fontSize: 13, color: TEXT_BODY, lineHeight: 1.6 }}>{TIPS[tipIdx]}</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═══ RESULTS ═══
  if (screen === "results" && results && assessment) {
    const { patient: assessedPatient, dermatologist, assessmentDate, referenceId, validationSummary } = assessment;
    const quality = results.imageQuality || {};
    const limitations = [
      ...(Array.isArray(quality.limitations) ? quality.limitations : []),
      ...(validationSummary?.qualityWarning ? [validationSummary.qualityWarning] : []),
    ];

    const whatsappSummary = encodeURIComponent(
      `Hello, I am reaching out regarding a ${PRODUCT_NAME} preliminary skin assessment (${referenceId || "Session"}) for ${assessedPatient.name}.`,
    );

    return (
      <div style={{ minHeight: "100vh", background: PEARL, paddingBottom: isMobile ? 120 : 96, ...s }}>
        {/* Header */}
        <header
          style={{
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(89, 19, 33, 0.08)",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: 1080,
              margin: "0 auto",
              padding: "12px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <BrandLogo height={38} />
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: TEXT_HEADING }}>
                  Preliminary Skin Assessment
                </div>
                <div className="tabular-nums" style={{ fontSize: 12, color: TEXT_MUTED }}>
                  {assessedPatient.name} · {formatDate(assessmentDate)}
                  {referenceId ? ` · Ref: ${referenceId.slice(0, 8)}` : ""}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetToHome}
              style={{
                background: PEARL,
                color: MAROON,
                border: "1px solid rgba(89, 19, 33, 0.16)",
                borderRadius: 999,
                padding: "9px 16px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              New Assessment
            </button>
          </div>
        </header>

        <div style={{ maxWidth: 1080, margin: "18px auto 0", padding: isMobile ? "0 16px" : "0 20px" }}>
          {/* Medical Disclaimer */}
          <div
            role="note"
            style={{
              padding: "14px 18px",
              background: "#FBF7F1",
              border: "1px solid rgba(194, 162, 120, 0.55)",
              borderRadius: 16,
              color: TEXT_BODY,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: MAROON }}>Important Notice: </strong>
            {MEDICAL_DISCLAIMER}
          </div>

          {/* Eyewear Limitation Notice */}
          {results.eyewearNote && (
            <div
              role="note"
              style={{
                marginTop: 12,
                padding: "14px 18px",
                background: "#FFF8EB",
                border: "1px solid #E5C285",
                borderRadius: 16,
                color: "#5C4018",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {results.eyewearNote}
            </div>
          )}
        </div>

        <main
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: isMobile ? "20px 16px" : "28px 20px",
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "360px 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Left Summary Column */}
          <div style={{ position: isMobile ? "static" : "sticky", top: 88, display: "grid", gap: 16 }}>
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 20,
                padding: 16,
                border: "1px solid rgba(89, 19, 33, 0.08)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <img
                  src={capturedImage}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid rgba(89, 19, 33, 0.08)",
                  }}
                  alt="Assessed facial photograph"
                />
                <div
                  style={{
                    background: PEARL,
                    borderRadius: 14,
                    border: `1px solid ${GOLD}`,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 10.5, color: "#8D6B49", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    Estimated Skin Type
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: MAROON, marginTop: 6, ...sSerif }}>
                    {results.skinType}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>Face Verified</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #F1EAE4", paddingTop: 12 }}>
                <div style={{ fontSize: 10.5, color: "#8D6B49", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Primary Visible Observation
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: TEXT_HEADING, marginTop: 4, ...sSerif }}>
                  {results.primaryConcern}
                </div>
              </div>
            </div>

            {/* Image Quality Assessment Card */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 20,
                padding: 18,
                border: "1px solid rgba(89, 19, 33, 0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#8D6B49",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.9px",
                  marginBottom: 12,
                }}
              >
                Image Quality &amp; Visibility
              </div>
              <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Lighting: </span>
                  <strong style={{ color: TEXT_HEADING }}>{quality.lighting || "Assessed"}</strong>
                </div>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Clarity: </span>
                  <strong style={{ color: TEXT_HEADING }}>{quality.clarity || "Assessed"}</strong>
                </div>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Framing: </span>
                  <strong style={{ color: TEXT_HEADING }}>{quality.framing || "Assessed"}</strong>
                </div>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Eyewear Status: </span>
                  <strong style={{ color: TEXT_HEADING }}>
                    {results.eyewearDetected === "glasses"
                      ? "Glasses detected"
                      : results.eyewearDetected === "uncertain"
                        ? "Uncertain visibility"
                        : "None detected"}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Tabbed Workspace */}
          <div>
            <div
              role="tablist"
              aria-label="Assessment sections"
              style={{
                display: "flex",
                background: "#EFE8E2",
                borderRadius: 14,
                padding: 4,
                marginBottom: 18,
                gap: 4,
              }}
            >
              {[
                { id: "results", label: "Diagnostic Markers" },
                { id: "routine", label: "Targeted Regimen" },
                { id: "info", label: "Specialist Review" },
              ].map(tab => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: "11px 10px",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 700,
                    background: activeTab === tab.id ? MAROON : "transparent",
                    color: activeTab === tab.id ? "#FFFFFF" : TEXT_BODY,
                    whiteSpace: "nowrap",
                    transition: "background-color 0.2s ease, color 0.2s ease",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Diagnostic Markers */}
            {activeTab === "results" && (
              <div style={{ display: "grid", gap: 16 }}>
                {/* Summary Score Table */}
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 20,
                    padding: isMobile ? 18 : 24,
                    border: "1px solid rgba(89, 19, 33, 0.08)",
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: TEXT_HEADING, margin: "0 0 4px", ...sSerif }}>
                      Preliminary Skin Observations
                    </h2>
                    <p style={{ fontSize: 12.5, color: TEXT_MUTED, margin: 0 }}>
                      Approximate visual indicators grounded in visible image features only — not medically validated disease severity scores.
                    </p>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }} className="tabular-nums">
                      <thead>
                        <tr style={{ borderBottom: "1px solid #EAE0D8" }}>
                          <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11.5, color: "#8D6B49", textTransform: "uppercase" }}>
                            Skin Observation
                          </th>
                          <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11.5, color: "#8D6B49", textTransform: "uppercase" }}>
                            Estimated Visual Score
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.conditions.map(c => {
                          const hasScore = c.assessable !== false && typeof c.visualScore === "number";
                          return (
                            <tr key={c.name} style={{ borderBottom: "1px solid #F3ECE7" }}>
                              <td style={{ padding: "12px 8px", fontSize: 13.5, fontWeight: 600, color: TEXT_HEADING }}>
                                {c.name}
                              </td>
                              <td style={{ padding: "12px 8px", textAlign: "right", fontSize: 13.5, fontWeight: 700, color: hasScore ? MAROON : TEXT_MUTED }}>
                                {hasScore ? `${c.visualScore}%` : "Unable to assess"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detailed Observation Cards */}
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 20,
                    padding: isMobile ? 18 : 24,
                    border: "1px solid rgba(89, 19, 33, 0.08)",
                  }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: TEXT_HEADING, margin: "0 0 16px" }}>
                    Detailed Visual Indicators
                  </h3>
                  {results.conditions.map((c, idx) => {
                    const hasScore = c.assessable !== false && typeof c.visualScore === "number";
                    return (
                      <div
                        key={c.name}
                        style={{
                          paddingBottom: idx < results.conditions.length - 1 ? 18 : 0,
                          marginBottom: idx < results.conditions.length - 1 ? 18 : 0,
                          borderBottom: idx < results.conditions.length - 1 ? "1px solid #F1EAE4" : "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_HEADING }}>
                            {c.name} – {hasScore ? `Approx. ${c.visualScore}% Visual Indicator` : "Unable to assess"}
                          </span>
                          {c.severity && (
                            <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: "#8D6B49" }}>
                              {c.severity} indicator
                            </span>
                          )}
                        </div>

                        {hasScore && (
                          <div
                            style={{
                              height: 7,
                              background: "#F1EAE4",
                              borderRadius: 999,
                              overflow: "hidden",
                              marginBottom: 10,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${c.visualScore}%`,
                                background: `linear-gradient(90deg, ${GOLD} 0%, ${MAROON} 100%)`,
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        )}

                        <p style={{ margin: 0, fontSize: 13.5, color: TEXT_BODY, lineHeight: 1.65 }}>
                          {c.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Image Quality Limitations */}
                {limitations.length > 0 && (
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: 20,
                      padding: 20,
                      border: "1px solid rgba(194, 162, 120, 0.45)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#8D6B49", textTransform: "uppercase", marginBottom: 8 }}>
                      Image Quality Limitations Noted
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: TEXT_BODY, lineHeight: 1.6 }}>
                      {limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Targeted Regimen */}
            {activeTab === "routine" && (
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 20,
                  padding: isMobile ? 20 : 26,
                  border: "1px solid rgba(89, 19, 33, 0.08)",
                }}
              >
                <p style={{ fontSize: 12.5, color: TEXT_MUTED, margin: "0 0 20px", lineHeight: 1.6 }}>
                  General non-prescription skincare suggestions for informational support — not an individualized medical prescription.
                </p>

                <div style={{ marginBottom: 26 }}>
                  <h2
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: MAROON,
                      margin: "0 0 14px",
                      letterSpacing: "0.7px",
                      textTransform: "uppercase",
                      borderBottom: "1px solid #F1EAE4",
                      paddingBottom: 8,
                    }}
                  >
                    Suggested Morning Skincare Routine
                  </h2>
                  {results.morningRoutine.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "flex-start" }}>
                      <div
                        className="tabular-nums"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "#FFF4EB",
                          color: "#C25E12",
                          fontWeight: 700,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          border: "1px solid #F6D5B8",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 13.5, color: TEXT_BODY, lineHeight: 1.6, paddingTop: 3 }}>{step}</div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid #F1EAE4", paddingTop: 22 }}>
                  <h2
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: MAROON,
                      margin: "0 0 14px",
                      letterSpacing: "0.7px",
                      textTransform: "uppercase",
                      borderBottom: "1px solid #F1EAE4",
                      paddingBottom: 8,
                    }}
                  >
                    Suggested Evening Skincare Routine
                  </h2>
                  {results.eveningRoutine.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "flex-start" }}>
                      <div
                        className="tabular-nums"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: BLUSH,
                          color: MAROON,
                          fontWeight: 700,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          border: `1px solid rgba(194, 162, 120, 0.55)`,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 13.5, color: TEXT_BODY, lineHeight: 1.6, paddingTop: 3 }}>{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Specialist Review */}
            {activeTab === "info" && (
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 20,
                  padding: isMobile ? 20 : 26,
                  border: "1px solid rgba(89, 19, 33, 0.08)",
                  display: "grid",
                  gap: 18,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "#8D6B49", letterSpacing: "1px", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                    Preliminary Assessment Summary
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: TEXT_BODY, lineHeight: 1.7 }}>{results.summary}</p>
                </div>

                <div
                  style={{
                    background: PEARL,
                    borderRadius: 16,
                    padding: 18,
                    border: "1px solid rgba(194, 162, 120, 0.35)",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600, color: MAROON, marginBottom: 6, ...sSerif }}>
                    {CONSULTATION_RECOMMENDATION_TITLE}
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 13.5, color: TEXT_BODY, lineHeight: 1.6 }}>
                    {CONSULTATION_RECOMMENDATION_BODY}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6 }}>
                    {results.followUpAdvice}
                  </p>
                </div>

                {/* Demo Doctor Card */}
                <div
                  style={{
                    padding: 18,
                    background: "linear-gradient(135deg, #4D0E1C 0%, #2D0810 100%)",
                    borderRadius: 16,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    border: `1px solid ${GOLD}`,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "#FFFFFF",
                      border: `2px solid ${GOLD}`,
                      padding: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={BRAND_LOGO_PATH}
                      alt="DermaLens AI Demo Doctor"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "#FFFFFF", ...sSerif }}>
                      {dermatologist.doctorName}
                    </div>
                    <div style={{ fontSize: 12, color: "#E5CFB3", fontWeight: 600, marginTop: 2 }}>
                      {dermatologist.professionalIdentity}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.8)", marginTop: 6, lineHeight: 1.5 }}>
                      Demonstration profile only. For clinical diagnosis or treatment, consult a licensed dermatologist in your area.
                    </div>
                  </div>
                </div>

                {/* Platform Contact Footer in Specialist Tab */}
                <div
                  style={{
                    borderTop: "1px solid #F1EAE4",
                    paddingTop: 14,
                    fontSize: 12.5,
                    color: TEXT_MUTED,
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: MAROON }}>Generated by {PRODUCT_NAME}</strong> · Platform Contact:{" "}
                  {PROJECT_CONTACT.name} · {PROJECT_CONTACT.phoneDisplay} · {PROJECT_CONTACT.email}
                </div>
              </div>
            )}
          </div>
        </main>

        {(reportError || reportNotice) && (
          <div
            role={reportError ? "alert" : "status"}
            style={{
              position: "fixed",
              bottom: isMobile ? 116 : 82,
              left: 16,
              right: 16,
              zIndex: 110,
              maxWidth: 680,
              margin: "0 auto",
              padding: "12px 16px",
              borderRadius: 12,
              background: reportError ? "#FFF2F3" : "#F3FAF7",
              color: reportError ? "#9B1C31" : "#0F6E56",
              border: `1px solid ${reportError ? "#F3C2C9" : "#BCE3D6"}`,
              textAlign: "center",
              fontSize: 13,
            }}
          >
            {reportError || reportNotice}
          </div>
        )}

        {/* Bottom CTA Bar */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(10px)",
            padding: "12px 16px",
            borderTop: "1px solid rgba(89, 19, 33, 0.08)",
            zIndex: 100,
          }}
        >
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={async () => {
                try {
                  const mode = await openOrDownloadPDFReport(
                    assessedPatient,
                    results,
                    capturedImage,
                    assessmentDate,
                    referenceId,
                    validationSummary,
                  );
                  setReportError("");
                  setReportNotice(
                    mode === "downloaded"
                      ? "Pop-ups were blocked, so your printable HTML report was downloaded directly."
                      : "Report opened in a new tab — use Print / Save as PDF.",
                  );
                } catch (error) {
                  setReportNotice("");
                  setReportError(error instanceof Error ? error.message : "The report could not be opened.");
                }
              }}
              style={{
                flex: 1,
                background: MAROON,
                color: "#FFFFFF",
                border: `1px solid ${GOLD}`,
                borderRadius: 999,
                padding: "13px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Download / Print PDF Report
            </button>
            <a
              href={`https://wa.me/${PROJECT_CONTACT.whatsappCountryCode}${PROJECT_CONTACT.whatsapp}?text=${whatsappSummary}`}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                background: "#1A1717",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 999,
                padding: "13px 20px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Consultation Inquiry (WhatsApp)
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
