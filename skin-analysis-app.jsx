import { useState, useRef, useEffect } from "react";
import { CLINIC_PROFILE as DOC, PRODUCT_NAME, PROJECT_CONTACT } from "./src/config/clinic.js";

const MAROON = "#591321"; // Deep premium maroon
const GOLD = "#C2A278"; // Warm luxury bronze-gold
const PEARL = "#FAF7F5"; // Rich pearl-cream background
const MEDICAL_DISCLAIMER = "This report contains AI-generated preliminary skin observations for informational purposes only. It is not a medical diagnosis and does not replace professional medical advice. AI-generated observations may be inaccurate or incomplete. Please consult a qualified dermatologist for proper evaluation and treatment.";
const ANALYSIS_TIMEOUT_MS = 60_000;

const TIPS = [
  "Always wear sunscreen with at least SPF 30, even on cloudy days.",
  "Stay hydrated — drink at least 8 glasses of water daily for healthy skin.",
  "Remove makeup before sleeping to prevent clogged pores.",
  "A consistent skincare routine morning and night gives the best results.",
  "Vitamin C serums help brighten skin and reduce dark spots.",
  "Never pop pimples — it leads to scarring and further infection.",
];

const IND_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal","Delhi","Other",
];
const OBSERVATION_NAMES = [
  "Acne and blemishes",
  "Hyperpigmentation",
  "Dark circles",
  "Enlarged pores",
  "Fine lines",
];
const SEVERITY_LEVELS = ["Mild", "Moderate", "Severe"];

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
    isText(result.primaryConcern, 120) &&
    isText(result.summary, 1000) &&
    conditionNames.length === OBSERVATION_NAMES.length &&
    new Set(conditionNames).size === OBSERVATION_NAMES.length &&
    OBSERVATION_NAMES.every(name => conditionNames.includes(name)) &&
    result.conditions.every(condition =>
      isText(condition?.description, 500) &&
      (condition.severity == null || SEVERITY_LEVELS.includes(condition.severity))
    ) &&
    validRoutines(result.morningRoutine) &&
    validRoutines(result.eveningRoutine) &&
    isText(result.followUpAdvice, 1000)
  );
}

async function analyzeWithAI(image) {
  let response;
  try {
    response = await fetch("/api/analyze-skin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
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
    throw new Error(requestId ? `${message} Reference: ${requestId}.` : message);
  }
  if (!isValidAssessmentResult(payload.result)) {
    throw new Error("The assessment service returned an incomplete result. Please try again.");
  }

  return payload.result;
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

  for (const maxDimension of [1600, 1200, 900]) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("This image could not be prepared for analysis. Please try another image.");
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL("image/jpeg", 0.78);
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

function openPDFReport(patient, results, imageDataUrl, assessmentDate, dermatologist) {
  const date = formatDate(assessmentDate);
  const value = escapeHTML;
  const observations = results.conditions.map(condition => `
    <article class="observation">
      <div class="observation-heading"><strong>${value(condition.name)}</strong><span>${condition.severity ? `${value(condition.severity)} estimated` : "Severity not estimated"}</span></div>
      <p>${value(condition.description)}</p>
    </article>`).join("");
  const observationSummary = results.conditions.map(condition => `
    <div class="observation-short"><strong>${value(condition.name)}</strong><span>${condition.severity ? `${value(condition.severity)} estimate` : "No severity estimate"}</span></div>`).join("");
  const routine = steps => steps.map((step, index) => `
    <li><span>${index + 1}</span>${value(step)}</li>`).join("");
  const contactItems = [
    dermatologist.qualifications?.length && `<div><dt>Qualifications</dt><dd>${value(dermatologist.qualifications.join(", "))}</dd></div>`,
    dermatologist.specialization && `<div><dt>Specialization</dt><dd>${value(dermatologist.specialization)}</dd></div>`,
    dermatologist.experience && `<div><dt>Experience</dt><dd>${value(dermatologist.experience)}</dd></div>`,
    dermatologist.phone && `<div><dt>Phone</dt><dd>${value(dermatologist.countryCode)} ${value(dermatologist.phone)}</dd></div>`,
    dermatologist.whatsapp && `<div><dt>WhatsApp</dt><dd>${value(dermatologist.whatsapp)}</dd></div>`,
    dermatologist.email && `<div><dt>Email</dt><dd>${value(dermatologist.email)}</dd></div>`,
    dermatologist.address && `<div><dt>Address</dt><dd>${value(dermatologist.address)}</dd></div>`,
  ].filter(Boolean).join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${value(PRODUCT_NAME)} Assessment Report - ${value(patient.name)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f0ed;color:#342b2d;font:14px/1.6 Arial,sans-serif}
.toolbar{text-align:center;padding:18px}.print{border:0;border-radius:24px;background:#591321;color:#fff;padding:13px 24px;font-weight:700;cursor:pointer}
.page{position:relative;width:210mm;min-height:297mm;margin:20px auto;background:#fff;padding:17mm 17mm 24mm;box-shadow:0 8px 32px #59132112;page-break-after:always;break-after:page}
.page:last-of-type{page-break-after:auto;break-after:auto}.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid #eee6e0}
.brand{font-size:18px;font-weight:700;color:#591321;letter-spacing:.3px}.meta{text-align:right;color:#7a6d6c;font-size:11px}
h1{font-size:29px;line-height:1.2;color:#591321;margin:32px 0 6px}h2{font-size:17px;color:#591321;margin:26px 0 12px}
.subtitle{color:#7a6d6c;margin:0 0 22px}.card{padding:18px;border:1px solid #eee6e0;border-radius:12px;background:#fcfaf9;margin:14px 0}
.patient{display:grid;grid-template-columns:110px 1fr;gap:18px;align-items:center}.patient img{width:110px;height:130px;object-fit:cover;border-radius:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.label,dt{font-size:10px;color:#8d6b49;font-weight:700;text-transform:uppercase;letter-spacing:.7px}
.value,dd{margin:3px 0 0;color:#342b2d;font-weight:600}.summary{white-space:pre-wrap}.observation{padding:13px 0;border-bottom:1px solid #eee6e0;break-inside:avoid}
.observation:last-child{border-bottom:0}.observation-heading{display:flex;justify-content:space-between;gap:12px}.observation-heading span{color:#8d6b49;font-size:11px;text-align:right}
.observation p{margin:5px 0 0;color:#625759}.routine-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.routine h2{margin-top:18px}
.observation-short{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #eee6e0;font-size:11px}.observation-short:last-child{border-bottom:0}.observation-short span{color:#8d6b49;text-align:right}
ol{list-style:none;padding:0;margin:0}li{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f1ece8}
li span{flex:none;color:#8d6b49;font-weight:700}.contact{background:#591321;color:#fff;border-radius:12px;padding:18px}.contact h2{color:#fff;margin:0 0 10px}
.contact dl{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0}.contact dt{color:#e4cda9}.contact dd{color:#fff;overflow-wrap:anywhere}
.disclaimer{padding:14px;border:1px solid #c9ab7f;border-radius:10px;background:#fbf7f1;color:#4d3c34;font-size:12px;line-height:1.55}
.footer{position:absolute;bottom:12mm;left:17mm;right:17mm;display:flex;justify-content:space-between;border-top:1px solid #eee6e0;padding-top:9px;color:#8b7e7c;font-size:10px}
@media(max-width:800px){.page{width:100%;min-height:0;margin:0 auto 14px;padding:24px 20px 60px}.footer{left:20px;right:20px;bottom:18px}.patient{grid-template-columns:80px 1fr}.patient img{width:80px;height:100px}}
@page{size:A4;margin:0}@media print{body{background:#fff}.toolbar{display:none}.page{width:210mm;height:297mm;min-height:297mm;margin:0;padding:17mm 17mm 24mm;box-shadow:none;overflow:hidden}.footer{left:17mm;right:17mm;bottom:12mm}}
</style></head><body>
<div class="toolbar"><button class="print" onclick="window.print()">Download / print report</button><p>Choose “Save as PDF” in the print dialog.</p></div>
<main>
  <section class="page">
    <header class="header"><div class="brand">${value(PRODUCT_NAME)}</div><div class="meta">AI-Assisted Skin Assessment Report<br>${value(date)}</div></header>
    <h1>AI-Assisted Skin Assessment Report</h1><p class="subtitle">Preliminary observations for informational purposes</p>
    <h2>Patient information</h2>
    <div class="card patient">${imageDataUrl ? `<img src="${value(imageDataUrl)}" alt="Patient-provided image">` : ""}
      <div class="grid">
        <div><div class="label">Patient</div><div class="value">${value(patient.name)}</div></div>
        <div><div class="label">Age</div><div class="value">${value(patient.age)} years</div></div>
        <div><div class="label">Assessment date</div><div class="value">${value(date)}</div></div>
        <div><div class="label">Phone</div><div class="value">${value(patient.phone || "Not provided")}</div></div>
        <div><div class="label">Location</div><div class="value">${value([patient.city, patient.state].filter(Boolean).join(", ") || "Not provided")}</div></div>
      </div>
    </div>
    <h2>Skin classification</h2><div class="card"><div class="grid">
      <div><div class="label">AI-estimated skin type</div><div class="value">${value(results.skinType)}</div></div>
      <div><div class="label">Primary visible concern</div><div class="value">${value(results.primaryConcern)}</div></div>
    </div></div>
    <h2>Preliminary assessment summary</h2><div class="card summary">${value(results.summary)}</div>
    <h2>AI-Identified Skin Observations</h2><div class="card">${observationSummary}</div>
    <footer class="footer"><span>${value(PRODUCT_NAME)} · Preliminary, AI-generated observations</span><span>Page 1 of 3</span></footer>
  </section>
  <section class="page">
    <header class="header"><div class="brand">${value(PRODUCT_NAME)}</div><div class="meta">AI-Assisted Skin Assessment Report<br>${value(date)}</div></header>
    <h1>Detailed Skin Observations</h1><p class="subtitle">Visual observations are limited by image quality, lighting, and the information available.</p>
    <h2>Observed conditions</h2><div class="card">${observations}</div>
    <footer class="footer"><span>${value(PRODUCT_NAME)} · Not a medical diagnosis</span><span>Page 2 of 3</span></footer>
  </section>
  <section class="page">
    <header class="header"><div class="brand">${value(PRODUCT_NAME)}</div><div class="meta">AI-Assisted Skin Assessment Report<br>${value(date)}</div></header>
    <h1>Skincare suggestions</h1><p class="subtitle">General suggestions only; not a prescription or individualized treatment plan.</p>
    <div class="routine-grid">
      <section class="routine"><h2>Suggested Morning Skincare Routine</h2><ol>${routine(results.morningRoutine)}</ol></section>
      <section class="routine"><h2>Suggested Evening Skincare Routine</h2><ol>${routine(results.eveningRoutine)}</ol></section>
    </div>
    <h2>Dermatologist Consultation</h2><div class="card">${value(results.followUpAdvice)}</div>
    <section class="contact"><h2>${value(dermatologist.doctorName || "Dermatologist")}</h2>
      ${dermatologist.clinicName ? `<p>${value(dermatologist.clinicName)}</p>` : ""}
      ${dermatologist.profile ? `<p>${value(dermatologist.profile)}</p>` : ""}
      <dl>${contactItems}</dl>
    </section>
    <h2>Medical disclaimer</h2><div class="disclaimer">${value(MEDICAL_DISCLAIMER)}</div>
    <footer class="footer"><span>${value(PRODUCT_NAME)} · Please consult a qualified dermatologist</span><span>Page 3 of 3</span></footer>
  </section>
</main></body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Allow pop-ups to open and print the assessment report.");
  }
  win.document.write(html);
  win.document.close();
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
  const [reportError, setReportError] = useState("");
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

  const drawOval = () => {
    const draw = () => {
      const cv = overlayRef.current;
      if (!cv) return;
      const w = cv.width = cv.offsetWidth;
      const h = cv.height = cv.offsetHeight;
      const ctx = cv.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(12, 4, 6, 0.65)"; // Ultra-premium darker mask
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();

      const base = Math.min(w, h);
      const rx = base * 0.28;
      const ry = rx * 1.35;
      ctx.ellipse(w / 2, h * 0.44, rx, ry, 0, 0, Math.PI * 2);

      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(194, 162, 120, 0.85)"; // Gold overlay oval
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.44, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Subtle dashed alignment helpers
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
      ctx.moveTo(0, h * 0.44); ctx.lineTo(w, h * 0.44);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const startCamera = async () => {
    setCamError(false);
    setScreen("camera");
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
        drawOval();
      } catch { setCamError(true); }
    }, 150);
  };

  const capturePhoto = () => {
    const v = videoRef.current;
    const cv = document.createElement("canvas");
    cv.width = v.videoWidth || 640; cv.height = v.videoHeight || 480;
    cv.getContext("2d").drawImage(v, 0, 0);
    setCapturedImage(cv.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setScreen("preview");
  };

  const startCountdown = () => {
    let n = 3;
    setCountdown(n);
    const iv = setInterval(() => {
      n--;
      if (n === 0) { clearInterval(iv); setCountdown(null); capturePhoto(); }
      else setCountdown(n);
    }, 1000);
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setUploadError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (f.size > 6 * 1024 * 1024) {
      setUploadError("The selected image is larger than 6 MB. Choose a smaller image.");
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
      setScreen("preview");
    };
    r.onerror = () => setUploadError("This image could not be read. Please choose another image.");
    r.readAsDataURL(f);
  };

  const startAnalysis = async () => {
    setAnalysisError("");
    setScreen("scanning");
    setTipIdx(0);
    setAssessment(null);
    const patientSnapshot = { ...patient };
    const dermatologistSnapshot = {
      ...DOC,
      qualifications: [...(DOC.qualifications || [])],
    };
    const assessmentDate = new Date().toISOString();
    const tipIv = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 3000);

    try {
      const image = await compressImageForAnalysis(capturedImage);
      const data = await analyzeWithAI(image);
      setResults(data);
      setAssessment({
        patient: patientSnapshot,
        dermatologist: dermatologistSnapshot,
        assessmentDate,
      });
      setActiveTab("results");
      setScreen("results");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The assessment could not be completed. Please try again.");
      setScreen("form");
    } finally {
      clearInterval(tipIv);
    }
  };

  useEffect(() => () => stopCamera(), []);

  const s = { fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" };
  const sSerif = { fontFamily: "'Playfair Display', Georgia, serif" };

  // ═══ LANDING ═══
  if (screen === "landing" || screen === "choose") return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", background: PEARL, ...s }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
        @keyframes glowPulse { 0%,100%{box-shadow: 0 0 15px rgba(194, 162, 120, 0.2)} 50%{box-shadow: 0 0 25px rgba(194, 162, 120, 0.45)} }
        .opt-card { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .opt-card:hover { transform: translateY(-3px); box-shadow: 0 16px 30px rgba(89, 19, 33, 0.08); border-color: ${GOLD}!important; }
        .contact-btn { transition: all 0.3s ease; }
        .contact-btn:hover { background: #FFF!important; color: ${MAROON}!important; border-color: ${MAROON}!important; transform: translateY(-1px); }
        .start-btn { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .start-btn:hover { background: #3A0C16!important; box-shadow: 0 12px 30px rgba(89, 19, 33, 0.35)!important; transform: translateY(-1px); }
        .step-icon-glow { animation: glowPulse 2s infinite ease-in-out; }
      `}</style>

      {/* Left maroon panel */}
      <div style={{ 
        width: isMobile ? "100%" : 380, 
        background: "linear-gradient(135deg, #2D0810 0%, #4D0E1C 50%, #611827 100%)", 
        padding: isMobile ? "40px 24px" : "60px 48px", 
        display: "flex", 
        flexDirection: "column", 
        justifyContent: "space-between", 
        flexShrink: 0,
        boxSizing: "border-box",
        borderRight: isMobile ? "none" : `1px solid rgba(194, 162, 120, 0.18)`
      }}>
        <div style={{ color: "white" }}>
          <div className="step-icon-glow" style={{ 
            width: 50, 
            height: 50, 
            borderRadius: "50%", 
            background: "linear-gradient(135deg, #D4AF37 0%, #C2A278 100%)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            fontSize: 22, 
            marginBottom: isMobile ? 32 : 56,
            border: "1px solid rgba(255, 255, 255, 0.25)"
          }}>🔬</div>
          <div style={{
            display: "inline-block",
            background: "rgba(194, 162, 120, 0.12)",
            border: "1px solid rgba(194, 162, 120, 0.3)",
            color: "#E5CFB3",
            padding: "5px 14px",
            borderRadius: "30px",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "2.5px",
            marginBottom: 24
          }}>{PRODUCT_NAME.toUpperCase()} · SKIN WELLNESS PLATFORM</div>
          <div style={{ fontSize: isMobile ? 30 : 38, fontHeight: 1.2, fontWeight: 400, ...sSerif, lineHeight: 1.25, marginBottom: 20, color: "#FFF" }}>
            A clearer view<br/>of your skin
          </div>
          <div style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.8, fontWeight: 300 }}>
            AI-assisted preliminary skin observations, thoughtful skincare suggestions, and a simple path to a dermatologist consultation.
          </div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 500, letterSpacing: "1px", marginTop: isMobile ? 32 : 0 }}>
          PRELIMINARY OBSERVATIONS · PROFESSIONAL REVIEW ENCOURAGED
        </div>
      </div>

      {/* Right panel */}
      <div style={{ 
        flex: 1, 
        background: "linear-gradient(180deg, #FAF7F4 0%, #F3EEE9 100%)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: isMobile ? 16 : 40,
        boxSizing: "border-box"
      }}>
        <div style={{ 
          background: "white", 
          borderRadius: 32, 
          padding: isMobile ? "36px 20px" : "52px 48px", 
          width: "100%", 
          maxWidth: 480, 
          boxShadow: "0 30px 70px -20px rgba(76, 17, 28, 0.08)",
          border: "1px solid rgba(89, 19, 33, 0.04)",
          animation: "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          boxSizing: "border-box"
        }}>
          {/* Demonstration clinic profile */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ 
              width: 110, 
              height: 110, 
              borderRadius: "50%", 
              border: `2px solid ${GOLD}`,
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              margin: "0 auto 16px",
              boxShadow: "0 10px 25px -5px rgba(89, 19, 33, 0.2)",
              overflow: "hidden",
              background: "#FFF"
            }}>
              {DOC.image && <img src={DOC.image} alt={DOC.doctorName || "Dermatologist"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase" }}>Demonstration dermatologist profile</div>
            {DOC.doctorName && <div style={{ fontSize: 24, fontWeight: 400, color: "#1A1717", ...sSerif }}>{DOC.doctorName}</div>}
            {DOC.clinicName && <div style={{ color: GOLD, fontWeight: 700, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 6 }}>{DOC.clinicName}</div>}
            {DOC.profile && <div style={{ color: "#6E6565", fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>{DOC.profile}</div>}
            {DOC.qualifications?.length > 0 && <div style={{ color: "#6E6565", fontSize: 12, marginTop: 8, fontWeight: 500 }}>{DOC.qualifications.join(", ")}</div>}
            {DOC.specialization && <div style={{ color: "#6E6565", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{DOC.specialization}</div>}
            {DOC.experience && <div style={{ color: "#6E6565", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{DOC.experience}</div>}
            {DOC.address && <div style={{ color: "#8E8585", fontSize: 12, marginTop: 6, fontWeight: 500 }}>📍 {DOC.address}</div>}
            {DOC.email && <div style={{ color: "#8E8585", fontSize: 12, marginTop: 4, fontWeight: 500 }}>✉ {DOC.email}</div>}
          </div>

          <div style={{ borderTop: "1px solid #F0ECE7", paddingTop: 28, marginBottom: 28 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#1A1717", marginBottom: 8, letterSpacing: "-0.2px" }}>Begin Your Assessment</div>
              <div style={{ fontSize: 13, color: "#6E6565", lineHeight: 1.7, fontWeight: 300 }}>Capture or upload a photo, share a few details, and review preliminary AI observations and general skincare suggestions.</div>
            </div>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 14 : 8, justifyContent: "space-around", marginBottom: 32 }}>
              {[
                { icon: "📷", t: "1. Add a Photo", d: "Camera or image upload." },
                { icon: "🤖", t: "2. AI Analysis", d: "Extract indicators." },
                { icon: "📄", t: "3. Review Report", d: "Observations and routines." },
              ].map(x => (
                <div key={x.t} style={{ 
                  textAlign: "center", 
                  flex: 1, 
                  padding: "12px 8px", 
                  background: "linear-gradient(180deg, #FCFAF9 0%, #F7F3EE 100%)",
                  border: "1px solid rgba(194, 162, 120, 0.15)",
                  borderRadius: 16,
                  display: isMobile ? "flex" : "block", 
                  alignItems: "center", 
                  gap: 12 
                }}>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: "50%", 
                    background: "#FFF", 
                    border: `1px solid ${GOLD}`,
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    margin: isMobile ? "0" : "0 auto 10px", 
                    fontSize: 18, 
                    flexShrink: 0,
                    boxShadow: "0 4px 10px rgba(194, 162, 120, 0.05)"
                  }}>{x.icon}</div>
                  <div style={{ textAlign: isMobile ? "left" : "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: MAROON, marginBottom: 3, letterSpacing: "0.2px" }}>{x.t}</div>
                    <div style={{ fontSize: 10, color: "#8E8585", lineHeight: 1.4, fontWeight: 300 }}>{x.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="start-btn" onClick={() => setScreen("choose")} style={{ 
              width: "100%", 
              background: MAROON, 
              color: "white", 
              border: `1px solid ${GOLD}`, 
              borderRadius: 50, 
              padding: 18, 
              fontSize: 13, 
              fontWeight: 700, 
              letterSpacing: "1.5px", 
              textTransform: "uppercase",
              cursor: "pointer", 
              boxShadow: "0 10px 25px -5px rgba(89, 19, 33, 0.25)"
            }}>
              Start Skin Assessment
            </button>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#8E8585", marginBottom: 12, fontWeight: 500 }}>For bookings or direct contact:</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                DOC.phone && { label: "📞 Call Clinic", href: `tel:${DOC.countryCode}${DOC.phone}` },
                DOC.whatsapp && { label: "💬 WhatsApp", href: `https://wa.me/${DOC.whatsapp}` },
                DOC.email && { label: "✉ Email", href: `mailto:${DOC.email}` },
                DOC.address && { label: "📍 Location", href: `https://maps.google.com/?q=${encodeURIComponent(DOC.address)}` },
              ].filter(Boolean).map(b => (
                <a key={b.label} className="contact-btn" href={b.href} target="_blank" rel="noreferrer"
                  style={{ 
                    padding: "10px 18px", 
                    borderRadius: 25, 
                    border: `1px solid rgba(89, 19, 33, 0.15)`, 
                    background: "#FCFAF9", 
                    color: MAROON, 
                    fontSize: 11, 
                    fontWeight: 700, 
                    letterSpacing: "0.5px",
                    textDecoration: "none", 
                    cursor: "pointer" 
                  }}>{b.label}</a>
              ))}
            </div>
            <div aria-label="Platform contact" style={{ borderTop: "1px solid #F0ECE7", marginTop: 20, paddingTop: 16 }}>
              <div style={{ fontSize: 10, color: "#8E8585", marginBottom: 6, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Platform contact · not a clinical contact</div>
              <div style={{ fontSize: 12, color: "#4A4444", marginBottom: 8 }}>{PROJECT_CONTACT.name}</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", fontSize: 11 }}>
                  <a href={`mailto:${PROJECT_CONTACT.email}`} style={{ color: MAROON }}>{PROJECT_CONTACT.email}</a>
                  <a href={`tel:${PROJECT_CONTACT.mobile}`} style={{ color: MAROON }}>{PROJECT_CONTACT.mobile}</a>
                  <a href={`https://wa.me/${PROJECT_CONTACT.whatsappCountryCode}${PROJECT_CONTACT.whatsapp}`} target="_blank" rel="noreferrer" style={{ color: MAROON }}>Project WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Choose Analysis Modal */}
      {screen === "choose" && (
        <div style={{ 
          position: "fixed", 
          inset: 0, 
          background: "rgba(35, 12, 18, 0.45)", 
          backdropFilter: "blur(12px)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          zIndex: 200 
        }}>
          <div style={{ 
            background: "white", 
            borderRadius: 32, 
            padding: "36px 32px", 
            width: 400, 
            maxWidth: "92vw", 
            boxShadow: "0 30px 60px rgba(0, 0, 0, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.8)",
            animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" 
          }}>
            <div style={{ fontSize: 24, fontWeight: 400, color: "#1A1717", marginBottom: 6, ...sSerif }}>Choose Your Analysis</div>
            <div style={{ fontSize: 13, color: "#8E8585", marginBottom: 24, fontWeight: 300 }}>Select the examination protocol for your assessment:</div>
            {[
              { type: "quick", icon: "⚡", title: "Quick Analysis", desc: "Review preliminary AI observations from your photo." },
              { type: "detailed", icon: "📋", title: "Detailed Consultation", desc: "Add patient details and a photo before reviewing observations.", rec: true },
            ].map(o => (
              <div key={o.type} className="opt-card" onClick={() => setScreen("tips")}
                style={{ 
                  border: o.rec ? `1px solid ${GOLD}` : "1px solid rgba(89, 19, 33, 0.08)", 
                  borderRadius: 20, 
                  padding: "20px 18px", 
                  marginBottom: 14, 
                  cursor: "pointer", 
                  background: o.rec ? "linear-gradient(135deg, #4A0E1C 0%, #2D0810 100%)" : "#FCFAF9", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 16
                }}>
                <div style={{ 
                  width: 46, 
                  height: 46, 
                  borderRadius: "50%", 
                  background: o.rec ? "rgba(255, 255, 255, 0.12)" : "#FFF", 
                  border: `1px solid ${GOLD}`,
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: 20, 
                  flexShrink: 0 
                }}>{o.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, color: o.rec ? "white" : "#1A1717", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    {o.title}
                    {o.rec && (
                      <span style={{ 
                        fontSize: 9, 
                        background: `linear-gradient(90deg, #D4AF37, ${GOLD})`, 
                        padding: "3px 10px", 
                        borderRadius: 20, 
                        color: "#2D0810",
                        fontWeight: 800,
                        letterSpacing: "0.5px"
                      }}>RECOMMENDED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: o.rec ? "#D5CDCD" : "#6E6565", marginTop: 5, lineHeight: 1.5, fontWeight: 300 }}>{o.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <span onClick={() => setScreen("landing")} style={{ 
                color: "#8E8585", 
                fontSize: 13, 
                cursor: "pointer", 
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1px" 
              }}>Cancel</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══ TIPS ═══
  if (screen === "tips") return (
    <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, ...s }}>
      <div style={{ maxWidth: 480, width: "100%", animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(194, 162, 120, 0.12)",
            border: "1px solid rgba(194, 162, 120, 0.3)",
            color: MAROON,
            padding: "5px 14px",
            borderRadius: "30px",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "2px",
            marginBottom: 16
          }}>PREPARING YOUR PHOTO</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#1A1717", marginBottom: 8, ...sSerif }}>Before We Begin</div>
          <div style={{ fontSize: 13, color: "#8E8585", fontWeight: 300 }}>A clear, evenly lit photo can help the AI describe visible features:</div>
        </div>
        {[
          { e: "👓", t: "Remove spectacles, lenses, or facial accessories" },
          { e: "💡", t: "Directly face a natural or strong light source" },
          { e: "💄", t: "Ensure skin is clean and completely devoid of makeup" },
          { e: "🙍", t: "Pull hair entirely away from the cheek & forehead fields" },
          { e: "😐", t: "Use a neutral expression and keep the camera steady" },
        ].map(tip => (
          <div key={tip.t} style={{ 
            background: "white", 
            borderRadius: 16, 
            padding: "16px 24px", 
            marginBottom: 12, 
            display: "flex", 
            alignItems: "center", 
            gap: 20, 
            fontSize: 13, 
            color: "#4A4444",
            border: "1px solid rgba(89, 19, 33, 0.04)",
            boxShadow: "0 10px 20px -5px rgba(89, 19, 33, 0.02)"
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{tip.e}</span>
            <span style={{ fontWeight: 400, lineHeight: 1.5 }}>{tip.t}</span>
          </div>
        ))}
        <button onClick={() => setScreen("capture-choice")} style={{ 
          width: "100%", 
          background: MAROON, 
          color: "white", 
          border: `1px solid ${GOLD}`, 
          borderRadius: 50, 
          padding: 18, 
          fontSize: 13, 
          fontWeight: 700, 
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: "pointer", 
          marginTop: 28,
          boxShadow: "0 10px 25px -5px rgba(89, 19, 33, 0.2)"
        }}>
          I'm Ready
        </button>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span onClick={() => setScreen("choose")} style={{ 
            color: "#8E8585", 
            fontSize: 13, 
            cursor: "pointer", 
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1px",
            textDecoration: "underline" 
          }}>Back</span>
        </div>
      </div>
    </div>
  );

  // ═══ CAPTURE CHOICE ═══
  if (screen === "capture-choice") return (
    <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} .cap-opt:hover{box-shadow:0 16px 30px rgba(89, 19, 33, 0.06); transform:translateY(-2px); border-color: " + GOLD + "!important;}"}</style>
      <div style={{ maxWidth: 480, width: "100%", animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(194, 162, 120, 0.12)",
            border: "1px solid rgba(194, 162, 120, 0.3)",
            color: MAROON,
            padding: "5px 14px",
            borderRadius: "30px",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "2px",
            marginBottom: 16
          }}>PHOTO ASSESSMENT</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#1A1717", marginBottom: 8, ...sSerif }}>Add a skin photo</div>
          <div style={{ fontSize: 13, color: "#8E8585", marginBottom: 16, fontWeight: 300 }}>Take a photo with your camera or choose one from your device.</div>
          <div style={{ background: "#EBF6F3", borderRadius: 50, padding: "8px 24px", display: "inline-block", fontSize: 11, color: "#0F6E56", fontWeight: 700, border: "1px solid #D5EBE5" }}>
            Supported formats: JPEG, PNG, WebP · Maximum size: 6 MB
          </div>
        </div>
        {[
          { icon: "📷", t: "Use camera", d: "Take a photo with your device camera.", type: "camera" },
          { icon: "☁️", t: "Upload an image", d: "Choose a photo from your device.", type: "upload" },
        ].map(o => (
          <div key={o.t} className="cap-opt" onClick={o.type === "camera" ? startCamera : () => fileRef2.current?.click()}
            style={{ 
              background: "white", 
              borderRadius: 20, 
              padding: "20px 24px", 
              marginBottom: 14, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              cursor: "pointer", 
              border: "1px solid rgba(89, 19, 33, 0.05)", 
              transition: "all 0.3s ease" 
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ 
                fontSize: 24, 
                width: 44, 
                height: 44, 
                borderRadius: "50%", 
                background: "#FAF7F5", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                border: "1px solid rgba(194, 162, 120, 0.15)"
              }}>{o.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: "#1A1717", fontSize: 14 }}>{o.t}</div>
                <div style={{ fontSize: 12, color: "#8E8585", marginTop: 4, fontWeight: 300 }}>{o.d}</div>
              </div>
            </div>
            <span style={{ color: GOLD, fontSize: 24 }}>›</span>
          </div>
        ))}
        <div style={{ background: "#1C1717", borderRadius: 20, padding: "20px 24px", marginTop: 14, border: `1px solid ${GOLD}` }}>
          <div style={{ fontSize: 9, color: GOLD, letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>IMAGE AND PRIVACY</div>
          <div style={{ fontSize: 13, color: "white", fontWeight: 500, marginBottom: 6 }}>Your photo is sent to Gemini for AI observations</div>
          <div style={{ fontSize: 12, color: "#A89F9F", lineHeight: 1.6, fontWeight: 300 }}>This demonstration does not include patient accounts or a database. Only continue if you are comfortable submitting this image to the configured AI service.</div>
        </div>
        {uploadError && <div role="alert" style={{ color: "#9B1C31", background: "#FFF2F3", padding: 12, borderRadius: 12, marginTop: 12, fontSize: 13 }}>{uploadError}</div>}
        <input ref={fileRef2} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <span onClick={() => setScreen("tips")} style={{ 
            color: "#8E8585", 
            fontSize: 13, 
            cursor: "pointer", 
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1px",
            textDecoration: "underline" 
          }}>Back</span>
        </div>
      </div>
    </div>
  );

  // ═══ CAMERA ═══
  if (screen === "camera") return (
    <div style={{ position: "fixed", inset: 0, background: "#0C0406", overflow: "hidden", ...s }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      <div style={{ position: "absolute", top: 20, left: 20, right: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => { stopCamera(); setScreen("capture-choice"); }} style={{ 
          background: "rgba(12, 4, 6, 0.6)", 
          border: `1px solid ${GOLD}`, 
          color: "white", 
          width: 44, 
          height: 44, 
          borderRadius: "50%", 
          fontSize: 22, 
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(8px)"
        }}>‹</button>
        <div style={{ 
          background: "rgba(12, 4, 6, 0.6)", 
          color: GOLD, 
          padding: "8px 20px", 
          borderRadius: 20, 
          fontSize: 11, 
          fontWeight: 700, 
          letterSpacing: "1px",
          border: "1px solid rgba(194, 162, 120, 0.25)",
          backdropFilter: "blur(8px)" 
        }}>CAMERA PREVIEW</div>
      </div>

      <div style={{ 
        position: "absolute", 
        top: 84, 
        left: "50%", 
        transform: "translateX(-50%)", 
        background: "rgba(12, 4, 6, 0.75)", 
        color: "white", 
        padding: "12px 24px", 
        borderRadius: 20, 
        fontSize: 13, 
        textAlign: "center", 
        border: "1px solid rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(8px)",
        whiteSpace: "nowrap" 
      }}>
        Center your face in the frame<br />
        <span style={{ fontSize: 10, color: GOLD, fontWeight: 600, letterSpacing: "0.5px", marginTop: 4, display: "block" }}>Use even light and hold still</span>
      </div>

      {countdown && (
        <div style={{ 
          position: "absolute", 
          top: "50%", 
          left: "50%", 
          transform: "translate(-50%, -50%)", 
          fontSize: 110, 
          fontWeight: 300, 
          fontFamily: "'Playfair Display', serif",
          textShadow: "0 0 40px rgba(194, 162, 120, 0.6)",
          color: GOLD 
        }}>{countdown}</div>
      )}

      {camError && (
        <div style={{ 
          position: "absolute", 
          top: "50%", 
          left: "50%", 
          transform: "translate(-50%,-50%)", 
          background: "white", 
          padding: "32px 24px", 
          borderRadius: 24, 
          textAlign: "center", 
          maxWidth: 320,
          border: `1px solid ${GOLD}`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)" 
        }}>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8, ...sSerif, color: MAROON }}>Camera unavailable</div>
          <div style={{ fontSize: 13, color: "#8E8585", marginBottom: 20, lineHeight: 1.6, fontWeight: 300 }}>Check browser camera permissions or choose a photo from your device.</div>
          <button onClick={() => { stopCamera(); fileRef2.current?.click(); setScreen("capture-choice"); }} style={{ 
            background: MAROON, 
            color: "white", 
            border: `1px solid ${GOLD}`, 
            padding: "12px 28px", 
            borderRadius: 30, 
            cursor: "pointer", 
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "1px" 
          }}>Choose an image</button>
        </div>
      )}
      {uploadError && <div role="alert" style={{ position: "absolute", bottom: 130, left: 20, right: 20, margin: "auto", maxWidth: 420, background: "white", color: "#9B1C31", padding: 12, borderRadius: 12, textAlign: "center", fontSize: 13 }}>{uploadError}</div>}

      <div style={{ position: "absolute", bottom: 44, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 36 }}>
        <button onClick={() => { stopCamera(); fileRef.current?.click(); }} style={{ 
          background: "rgba(255,255,255,0.15)", 
          border: "1px solid rgba(255, 255, 255, 0.3)", 
          color: "white", 
          width: 52, 
          height: 52, 
          borderRadius: "50%", 
          fontSize: 22, 
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>🖼</button>
        <button onClick={startCountdown} style={{ 
          width: 80, 
          height: 80, 
          borderRadius: "50%", 
          background: "white", 
          border: `6px solid rgba(194, 162, 120, 0.5)`, 
          cursor: "pointer",
          boxShadow: "0 0 30px rgba(194, 162, 120, 0.3)",
          transition: "transform 0.2s"
        }} />
      </div>
      <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", color: GOLD, fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase" }}>Tap Trigger to Initiate 3S Countdown</div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );

  // ═══ PREVIEW ═══
  if (screen === "preview") return (
    <div style={{ minHeight: "100vh", background: PEARL, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <div style={{ maxWidth: 480, width: "100%", animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", marginBottom: 20, border: `2px solid ${GOLD}`, boxShadow: "0 20px 40px rgba(89, 19, 33, 0.08)" }}>
          <img src={capturedImage} style={{ width: "100%", display: "block" }} alt="Preview" />
        </div>
        <div style={{ background: "white", borderRadius: 20, padding: 24, marginBottom: 16, textAlign: "center", border: "1px solid rgba(89, 19, 33, 0.05)", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.02)" }}>
          <div style={{ color: "#0F6E56", fontWeight: 700, fontSize: 15, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span>✓</span> Photo ready for review
          </div>
          <div style={{ fontSize: 13, color: "#6E6565", lineHeight: 1.6, fontWeight: 300 }}>Check that the image is clear and well lit before continuing. The AI observations are preliminary and may be inaccurate.</div>
        </div>
        <button onClick={() => setScreen("form")} style={{ 
          width: "100%", 
          background: MAROON, 
          color: "white", 
          border: `1px solid ${GOLD}`, 
          borderRadius: 14, 
          padding: 18, 
          fontSize: 13, 
          fontWeight: 700, 
          letterSpacing: "1.5px", 
          textTransform: "uppercase", 
          cursor: "pointer", 
          marginBottom: 12,
          boxShadow: "0 10px 25px -5px rgba(89, 19, 33, 0.2)" 
        }}>
          Continue to Analysis →
        </button>
        <button onClick={() => { setCapturedImage(null); setScreen("capture-choice"); }} style={{ 
          width: "100%", 
          background: "white", 
          color: "#4A4444", 
          border: "1px solid rgba(89, 19, 33, 0.15)", 
          borderRadius: 14, 
          padding: 16, 
          fontSize: 13, 
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.3s"
        }}>
          Retake Photo
        </button>
      </div>
    </div>
  );

  // ═══ PATIENT FORM ═══
  if (screen === "form") return (
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} input,select{outline:none;} input:focus,select:focus{border-color:" + GOLD + "!important; box-shadow: 0 0 10px rgba(194, 162, 120, 0.15)!important;}"}</style>
      <div style={{ maxWidth: 480, width: "100%", animation: "fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(194, 162, 120, 0.12)",
            border: "1px solid rgba(194, 162, 120, 0.3)",
            color: MAROON,
            padding: "5px 14px",
            borderRadius: "30px",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "2px",
            marginBottom: 16
          }}>PATIENT INFORMATION</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#1A1717", marginBottom: 8, ...sSerif }}>A few details</div>
          <div style={{ fontSize: 13, color: "#8E8585", fontWeight: 300 }}>These details are included in your report, not sent with the image to Gemini.</div>
        </div>

        {[{ l: "Your Name", k: "name", p: "Enter patient full name", t: "text" }, { l: "Age", k: "age", p: "Enter patient age", t: "number" }].map(f => (
          <div key={f.k} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MAROON, display: "block", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>{f.l}</label>
            <input type={f.t} min={f.k === "age" ? "1" : undefined} max={f.k === "age" ? "120" : undefined} required placeholder={f.p} value={patient[f.k]} onChange={e => setPatient(p => ({ ...p, [f.k]: e.target.value }))}
              style={{ 
                width: "100%", 
                padding: "14px 18px", 
                border: "1px solid rgba(89, 19, 33, 0.08)", 
                borderRadius: 12, 
                fontSize: 14, 
                background: "#FCFAF9", 
                transition: "all 0.3s", 
                boxSizing: "border-box" 
              }} />
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: MAROON, display: "block", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>Phone Number</label>
          <div style={{ display: "flex", border: "1px solid rgba(89, 19, 33, 0.08)", borderRadius: 12, overflow: "hidden", background: "#FCFAF9" }}>
            <span style={{ padding: "14px 18px", background: "rgba(89, 19, 33, 0.03)", fontSize: 13, color: "#8E8585", fontWeight: 600, borderRight: "1px solid rgba(89, 19, 33, 0.08)" }}>{DOC.countryCode}</span>
            <input type="tel" required inputMode="tel" maxLength={20} placeholder="9876543210" value={patient.phone} onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))}
              style={{ flex: 1, padding: "14px 18px", border: "none", fontSize: 14, background: "transparent" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: MAROON, display: "block", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>City</label>
            <input type="text" required placeholder="e.g., Mumbai" value={patient.city} onChange={e => setPatient(p => ({ ...p, city: e.target.value }))}
              style={{ 
                width: "100%", 
                padding: "14px 18px", 
                border: "1px solid rgba(89, 19, 33, 0.08)", 
                borderRadius: 12, 
                fontSize: 14, 
                background: "#FCFAF9", 
                boxSizing: "border-box" 
              }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: MAROON, display: "block", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>State</label>
            <select required value={patient.state} onChange={e => setPatient(p => ({ ...p, state: e.target.value }))}
              style={{ 
                width: "100%", 
                padding: "14px 18px", 
                border: "1px solid rgba(89, 19, 33, 0.08)", 
                borderRadius: 12, 
                fontSize: 13, 
                background: "#FCFAF9", 
                boxSizing: "border-box", 
                color: "#1A1717" 
              }}>
              <option value="">Select a state</option>
              {IND_STATES.map(st => <option key={st}>{st}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: PEARL, border: `1px solid rgba(194, 162, 120, 0.3)`, borderRadius: 16, padding: 18, marginBottom: 28, display: "flex", gap: 14 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: MAROON, marginBottom: 4 }}>Image processing</div>
            <div style={{ fontSize: 12, color: "#6E6565", lineHeight: 1.6, fontWeight: 300 }}>Your image is sent to Gemini through the app’s server endpoint for analysis. Patient name, age, phone, and location are not included in that request.</div>
          </div>
        </div>

        {analysisError && <div role="alert" style={{ color: "#9B1C31", background: "#FFF2F3", padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 13 }}>{analysisError}</div>}

        <button onClick={startAnalysis} disabled={!isPatientFormValid}
          style={{ 
            width: "100%", 
            background: isPatientFormValid ? MAROON : "#E5E4E4",
            color: isPatientFormValid ? "white" : "#A29F9F",
            border: isPatientFormValid ? `1px solid ${GOLD}` : "none",
            borderRadius: 14, 
            padding: 18, 
            fontSize: 13, 
            fontWeight: 700, 
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            cursor: isPatientFormValid ? "pointer" : "not-allowed",
            boxShadow: isPatientFormValid ? "0 10px 25px -5px rgba(89, 19, 33, 0.2)" : "none",
            transition: "all 0.3s" 
          }}>
          Generate Preliminary AI Observations
        </button>
      </div>
    </div>
  );

  // ═══ SCANNING ═══
  if (screen === "scanning") return (
    <div aria-busy="true" style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes scanLine{0%{top:0%}100%{top:100%}} @keyframes glowPulse{0%,100%{box-shadow: 0 0 20px rgba(194, 162, 120, 0.25)} 50%{box-shadow: 0 0 35px rgba(194, 162, 120, 0.5)}} @keyframes loadingBar{0%{transform:translateX(-120%)}100%{transform:translateX(300%)}}"}</style>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div className="step-icon-glow" style={{ 
          position: "relative", 
          width: 230, 
          height: 270, 
          margin: "0 auto 32px", 
          borderRadius: 24, 
          overflow: "hidden", 
          border: `2px solid ${GOLD}`,
          boxShadow: "0 20px 40px rgba(89, 19, 33, 0.08)"
        }}>
          <img src={capturedImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Scanning" />
          <div style={{ 
            position: "absolute", 
            left: 0, 
            right: 0, 
            height: 4, 
            background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`, 
            animation: "scanLine 2.5s linear infinite", 
            top: "50%",
            boxShadow: `0 0 8px ${GOLD}` 
          }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(194, 162, 120, 0.06)" }} />
        </div>

        <div style={{ fontSize: 24, fontWeight: 400, color: "#1A1717", marginBottom: 6, ...sSerif }}>Preparing your observations...</div>
        <div style={{ fontSize: 13, color: "#8E8585", marginBottom: 20, fontWeight: 300 }}>The image is being reviewed by the configured Gemini AI service.</div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: "1px" }}>AI ASSESSMENT</span>
          <span style={{ fontSize: 11, color: MAROON, fontWeight: 700 }}>WAITING FOR RESPONSE</span>
        </div>
        <div role="progressbar" aria-label="Waiting for AI assessment" style={{ background: "#F5F1EC", borderRadius: 10, height: 7, marginBottom: 28, overflow: "hidden", border: "1px solid rgba(89, 19, 33, 0.03)" }}>
          <div style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${MAROON} 100%)`, height: "100%", width: "40%", animation: "loadingBar 1.4s ease-in-out infinite" }} />
        </div>

        <div style={{ 
          background: PEARL, 
          borderRadius: 20, 
          padding: "20px 24px", 
          textAlign: "left", 
          border: `1px solid rgba(194, 162, 120, 0.25)`,
          boxShadow: "0 10px 25px -10px rgba(194, 162, 120, 0.1)" 
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: MAROON, marginBottom: 8, letterSpacing: "1.5px", textTransform: "uppercase", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 15 }}>“</span> Skin Wellness Tip
          </div>
          <div style={{ fontSize: 13, color: "#4A4444", lineHeight: 1.7, fontWeight: 300, fontStyle: "italic" }}>{TIPS[tipIdx]}</div>
        </div>
      </div>
    </div>
  );

  // ═══ RESULTS ═══
  if (screen === "results" && results && assessment) {
    const primary = results.conditions[0];
    const { patient: assessedPatient, dermatologist, assessmentDate } = assessment;

    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F6", paddingBottom: isMobile ? 170 : 100, ...s }}>
        <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>

        {/* Header */}
        <div style={{ 
          background: "rgba(255, 255, 255, 0.8)", 
          backdropFilter: "blur(12px)", 
          padding: "16px 24px", 
          borderBottom: "1px solid rgba(89, 19, 33, 0.05)", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          position: "sticky", 
          top: 0, 
          zIndex: 100 
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1717", letterSpacing: "-0.2px" }}>{PRODUCT_NAME} · Preliminary observations</div>
            <div style={{ fontSize: 11, color: "#8E8585", fontWeight: 500 }}>{assessedPatient.name.toUpperCase()} • {formatDate(assessmentDate)}</div>
          </div>
          <div style={{ color: MAROON, background: PEARL, padding: "6px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>AI-GENERATED · NOT A DIAGNOSIS</div>
        </div>

        <div role="note" style={{ maxWidth: 1024, margin: "16px auto 0", padding: isMobile ? "0 16px" : "0 24px" }}>
          <div style={{ padding: 14, background: "#FBF7F1", border: "1px solid rgba(194, 162, 120, 0.45)", borderRadius: 14, color: "#4A4444", fontSize: 12, lineHeight: 1.6 }}>
            {MEDICAL_DISCLAIMER}
          </div>
        </div>

        <div style={{ 
          maxWidth: isMobile ? 480 : 1024, 
          margin: "0 auto", 
          padding: isMobile ? "20px 16px" : "40px 24px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1.3fr",
          gap: isMobile ? 0 : 32,
          alignItems: "start",
          boxSizing: "border-box"
        }}>
          {/* Left Column (Sticky on Desktop) */}
          <div style={{ position: isMobile ? "static" : "sticky", top: 100, marginBottom: isMobile ? 20 : 0 }}>
            {/* Photos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <img src={capturedImage} style={{ 
                width: "100%", 
                aspectRatio: "1", 
                objectFit: "cover", 
                borderRadius: 20, 
                display: "block",
                border: "1px solid rgba(89, 19, 33, 0.05)",
                boxShadow: "0 10px 25px rgba(89, 19, 33, 0.03)" 
              }} alt="Patient" />
              <div style={{ 
                background: "linear-gradient(135deg, #FAF7F5 0%, #F5F1EC 100%)", 
                borderRadius: 20, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                aspectRatio: "1", 
                flexDirection: "column", 
                gap: 8,
                border: `1px solid ${GOLD}`,
                boxShadow: "0 10px 25px rgba(89, 19, 33, 0.02)"
              }}>
                <span style={{ fontSize: 32 }}>🤖</span>
                <div style={{ fontSize: 10, color: MAROON, fontWeight: 700, letterSpacing: "1.5px", textAlign: "center", lineHeight: 1.4 }}>{results.skinType.toUpperCase()}<br/>ESTIMATED SKIN TYPE</div>
              </div>
            </div>

            {/* Primary Concern */}
            <div style={{ 
              background: "linear-gradient(135deg, #FFF9F9 0%, #FFF2F3 100%)", 
              border: "1px solid #F2DFD9",
              borderRadius: 24, 
              padding: 24,
              boxShadow: "0 15px 35px -10px rgba(220, 38, 38, 0.04)" 
            }}>
              <div style={{ fontSize: 9, color: "#8D6B49", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>PRIMARY VISIBLE OBSERVATION</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 400, color: "#1A1717", ...sSerif }}>{primary?.name}</div>
                {primary?.severity && <div style={{ fontSize: 11, fontWeight: 700, color: "#8D6B49", whiteSpace: "nowrap" }}>{primary.severity} estimate</div>}
              </div>
              <div style={{ fontSize: 13, color: "#5F5555", lineHeight: 1.7, fontWeight: 300 }}>{primary?.description}</div>
            </div>
          </div>

          {/* Right Column (Details) */}
          <div>
            {/* Tabs */}
            <div style={{ display: "flex", background: "#F0ECE7", borderRadius: 16, padding: 5, marginBottom: 18, border: "1px solid rgba(89, 19, 33, 0.03)" }}>
              {[
                { id: "results", label: "Diagnostic Markers" },
                { id: "routine", label: "Targeted Regimen" },
                { id: "info", label: "Specialist Review" }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ 
                    flex: 1, 
                    padding: "12px", 
                    border: "none", 
                    borderRadius: 12, 
                    cursor: "pointer", 
                    fontSize: 12, 
                    fontWeight: 700, 
                    letterSpacing: "0.5px",
                    background: activeTab === tab.id ? MAROON : "transparent", 
                    color: activeTab === tab.id ? "white" : "#6E6565", 
                    borderBottom: activeTab === tab.id ? `2px solid ${GOLD}` : "none",
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)" 
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Results Tab */}
            {activeTab === "results" && (
              <div style={{ 
                background: "white", 
                borderRadius: 24, 
                padding: "28px 24px", 
                border: "1px solid rgba(89, 19, 33, 0.04)", 
                boxShadow: "0 20px 50px rgba(89, 19, 33, 0.03)",
                animation: "fadeUp 0.3s ease" 
              }}>
                {results.conditions.map((c, i) => (
                  <div key={c.name} style={{ marginBottom: i < results.conditions.length - 1 ? 24 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1717" }}>{c.name}</span>
                      {c.severity && <span style={{ fontSize: 11, fontWeight: 700, color: "#8D6B49", whiteSpace: "nowrap" }}>{c.severity} estimate</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#6E6565", lineHeight: 1.6 }}>{c.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Routine Tab */}
            {activeTab === "routine" && (
              <div style={{ 
                background: "white", 
                borderRadius: 24, 
                padding: "28px 24px", 
                border: "1px solid rgba(89, 19, 33, 0.04)", 
                boxShadow: "0 20px 50px rgba(89, 19, 33, 0.03)",
                animation: "fadeUp 0.3s ease" 
              }}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#F97316", marginBottom: 16, letterSpacing: "1.5px", textTransform: "uppercase", borderBottom: "1px solid #F3EEE9", paddingBottom: 8 }}>☀️ Suggested Morning Skincare Routine</div>
                  {results.morningRoutine.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                      <div style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: "50%", 
                        background: "#FFF4EB", 
                        color: "#F97316", 
                        fontWeight: 700, 
                        fontSize: 11, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        flexShrink: 0,
                        border: "1px solid #FFD9BB" 
                      }}>{i + 1}</div>
                      <div style={{ fontSize: 13, color: "#4A4444", lineHeight: 1.6, paddingTop: 4, fontWeight: 300 }}>{step}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid #F3EEE9", paddingTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 16, letterSpacing: "1.5px", textTransform: "uppercase", borderBottom: "1px solid #F3EEE9", paddingBottom: 8 }}>🌙 Suggested Evening Skincare Routine</div>
                  {results.eveningRoutine.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" }}>
                      <div style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: "50%", 
                        background: "#F3EBFF", 
                        color: "#7C3AED", 
                        fontWeight: 700, 
                        fontSize: 11, 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        flexShrink: 0,
                        border: "1px solid #E8D3FF" 
                      }}>{i + 1}</div>
                      <div style={{ fontSize: 13, color: "#4A4444", lineHeight: 1.6, paddingTop: 4, fontWeight: 300 }}>{step}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Tab */}
            {activeTab === "info" && (
              <div style={{ 
                background: "white", 
                borderRadius: 24, 
                padding: "28px 24px", 
                border: "1px solid rgba(89, 19, 33, 0.04)", 
                boxShadow: "0 20px 50px rgba(89, 19, 33, 0.03)",
                animation: "fadeUp 0.3s ease" 
              }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 9, color: GOLD, letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>PRELIMINARY ASSESSMENT SUMMARY</div>
                  <div style={{ fontSize: 14, color: "#1A1717", lineHeight: 1.8, fontWeight: 300 }}>{results.summary}</div>
                </div>
                <div style={{ background: PEARL, borderRadius: 16, padding: 20, border: `1px solid rgba(194, 162, 120, 0.2)` }}>
                  <div style={{ fontSize: 9, color: GOLD, letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>DERMATOLOGIST CONSULTATION</div>
                  <div style={{ fontSize: 13, color: "#4A4444", lineHeight: 1.8, fontWeight: 300 }}>{results.followUpAdvice}</div>
                </div>
                <div style={{ 
                  marginTop: 20, 
                  padding: 16, 
                  background: "linear-gradient(135deg, #4D0E1C 0%, #2D0810 100%)", 
                  borderRadius: 16, 
                  display: "flex", 
                  gap: 16, 
                  alignItems: "center",
                  border: `1px solid ${GOLD}`,
                  boxShadow: "0 10px 25px rgba(89, 19, 33, 0.15)" 
                }}>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: "50%", 
                    background: "rgba(255, 255, 255, 0.1)", 
                    border: `1px solid ${GOLD}`,
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    fontSize: 20
                  }}>👨‍⚕️</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "white", ...sSerif }}>{dermatologist.doctorName || "Dermatologist"}</div>
                    <div style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>{[dermatologist.clinicName, dermatologist.city].filter(Boolean).join(" · ").toUpperCase()}</div>
                    {dermatologist.phone && <div style={{ fontSize: 11, color: "white", marginTop: 4 }}>{dermatologist.countryCode} {dermatologist.phone}</div>}
                    {dermatologist.email && <div style={{ fontSize: 11, color: "white", marginTop: 2 }}>{dermatologist.email}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {reportError && <div role="alert" style={{ position: "fixed", bottom: isMobile ? 150 : 94, left: 16, right: 16, zIndex: 110, maxWidth: 680, margin: "0 auto", padding: 12, borderRadius: 12, background: "#FFF2F3", color: "#9B1C31", textAlign: "center", fontSize: 13 }}>{reportError}</div>}

        {/* Bottom CTA */}
        <div style={{ 
          position: "fixed", 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: "rgba(255, 255, 255, 0.8)", 
          backdropFilter: "blur(12px)",
          padding: "14px 20px", 
          borderTop: "1px solid rgba(89, 19, 33, 0.05)", 
          display: "flex", 
          gap: 10,
          zIndex: 100 
        }}>
          <div style={{ 
            width: "100%", 
            maxWidth: isMobile ? "100%" : 768, 
            margin: "0 auto", 
            display: "flex", 
            flexDirection: isMobile ? "column" : "row",
            gap: 12
          }}>
              <button onClick={() => {
                try {
                  openPDFReport(assessedPatient, results, capturedImage, assessmentDate, dermatologist);
                  setReportError("");
                } catch (error) {
                  setReportError(error instanceof Error ? error.message : "The report could not be opened.");
                }
              }}
              style={{ 
                flex: 1, 
                background: MAROON, 
                color: "white", 
                border: `1px solid ${GOLD}`, 
                borderRadius: 14, 
                padding: 16, 
                fontSize: 12, 
                fontWeight: 700, 
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: 8,
                boxShadow: "0 10px 25px -5px rgba(89, 19, 33, 0.15)"
              }}>
              📥 Download / Print Report
            </button>
            {dermatologist.whatsapp && <button onClick={() => window.open(`https://wa.me/${dermatologist.whatsapp}?text=${encodeURIComponent(`Hello, I would like to book a dermatologist consultation through ${PRODUCT_NAME}.`)}`, "_blank", "noopener,noreferrer")}
              style={{ 
                flex: 1, 
                background: "#1C1717", 
                color: "white", 
                border: "1px solid rgba(255,255,255,0.1)", 
                borderRadius: 14, 
                padding: 16, 
                fontSize: 12, 
                fontWeight: 700, 
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: 8,
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)"
              }}>
              💬 Book a consultation on WhatsApp
            </button>}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
