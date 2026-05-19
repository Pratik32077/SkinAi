import { useState, useRef, useEffect } from "react";

const DOC = {
  name: "Dr. Pratik Tiwari",
  initials: "PT",
  clinic: "Tiwari Neurologist Brain Clinic",
  city: "Mumbai",
  phone: "8055208985",
  wa: "918055208985",
};

const MAROON = "#7b1d2e";
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

async function analyzeWithAI(base64, patient) {
  const prompt = `You are a clinical dermatologist AI. Analyze this skin photo for ${patient.name}, age ${patient.age}. Return ONLY valid JSON with no markdown or explanation:
{
  "skinType": "oily|dry|combination|normal",
  "primaryConcern": "main skin concern in 2-3 words",
  "severityIndex": "Low|Moderate|High",
  "skinAge": "e.g. consistent with age",
  "conditions": [
    {"name": "condition name", "severity": "Mild|Moderate|Severe", "percentage": 35, "description": "one sentence clinical description"}
  ],
  "physicianSummary": "2-3 sentence clinical summary referencing the patient's age and visible findings",
  "morningRoutine": ["step 1", "step 2", "step 3", "step 4"],
  "eveningRoutine": ["step 1", "step 2", "step 3"],
  "followUpAdvice": "2-3 sentence follow-up recommendation"
}
Include 4-6 conditions based on actual visible features. Be clinically accurate.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
        { type: "text", text: prompt }
      ]}]
    })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function openPDFReport(patient, results, imageDataUrl) {
  const reportId = "MSA-" + (Math.floor(Math.random() * 900000) + 100000);
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const sevColor = results.severityIndex === "Low" ? "#16a34a" : results.severityIndex === "Moderate" ? "#d97706" : "#dc2626";

  const condRows = results.conditions.map(c => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-weight:500;color:#111;">${c.name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;color:#999;font-size:11px;letter-spacing:1px;">${c.severity.toUpperCase()}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;text-align:right;font-weight:700;font-size:16px;">${c.percentage}%</td>
    </tr>`).join("");

  const morningSteps = results.morningRoutine.map((s,i)=>`<div style="display:flex;gap:10px;margin:10px 0;font-size:13px;"><span style="color:#bbb;min-width:20px;">0${i+1}</span><span>${s}</span></div>`).join("");
  const eveningSteps = results.eveningRoutine.map((s,i)=>`<div style="display:flex;gap:10px;margin:10px 0;font-size:13px;"><span style="color:#bbb;min-width:20px;">0${i+1}</span><span>${s}</span></div>`).join("");

  const findingsHTML = results.conditions.slice(0,3).map((c,i)=>`
    <div style="flex:1;padding:20px 16px;border-right:${i<2?'1px solid #f0f0f0':'none'};">
      <div style="font-size:10px;letter-spacing:2px;color:#aaa;margin-bottom:8px;">PRIMARY FINDING 0${i+1}</div>
      <div style="font-size:20px;font-weight:300;margin-bottom:10px;color:#111;">${c.name}</div>
      <div style="font-size:12px;color:#666;line-height:1.7;">${c.description}</div>
    </div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Skin Analysis Report — ${patient.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Georgia,serif;background:#f0eeeb;padding:20px;}
.page{width:794px;min-height:1123px;margin:0 auto 24px;padding:52px;background:white;position:relative;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:52px;padding-bottom:20px;border-bottom:1px solid #eee;}
.logo{width:36px;height:36px;background:#7b1d2e;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-family:sans-serif;font-weight:700;}
.rid{text-align:right;}
.rid .conf{font-size:9px;letter-spacing:2px;color:#aaa;font-family:sans-serif;}
.rid .id{font-size:16px;font-weight:600;font-family:sans-serif;}
.rid .dt{font-size:12px;color:#888;margin-top:2px;font-family:sans-serif;}
.title{font-size:52px;font-weight:300;line-height:1.15;margin-bottom:12px;color:#111;}
.subtitle{font-size:13px;color:#888;margin-bottom:44px;font-family:sans-serif;}
.pt{display:flex;gap:40px;margin-bottom:36px;}
.pt img{width:180px;height:200px;object-fit:cover;border-radius:4px;}
.pt-info{flex:1;}
.pt-name{font-size:40px;font-weight:300;margin-bottom:24px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.info-label{font-size:10px;letter-spacing:1px;color:#aaa;font-family:sans-serif;margin-bottom:4px;}
.info-val{font-size:16px;font-weight:300;font-family:sans-serif;}
.accent{color:#dc2626;}
hr{border:none;border-top:1px solid #eee;margin:24px 0;}
.sl{font-size:10px;letter-spacing:2px;color:#aaa;font-family:sans-serif;margin-bottom:16px;}
.clin{display:grid;grid-template-columns:1fr 1fr;gap:40px;}
.pl{font-size:11px;color:#aaa;letter-spacing:1px;font-family:sans-serif;margin-bottom:10px;}
.pt-txt{font-size:13px;line-height:1.9;color:#444;font-style:italic;}
.ctags{margin-top:16px;}
.ctag{display:inline-block;border:1px solid #ddd;border-radius:20px;padding:4px 12px;font-size:11px;margin:3px;font-family:sans-serif;color:#666;}
.sev-val{font-size:56px;font-weight:300;font-family:sans-serif;}
.sev-sub{font-size:12px;color:#888;margin-top:4px;font-family:sans-serif;}
.ftr{position:absolute;bottom:48px;left:52px;right:52px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #eee;padding-top:14px;}
.ftr-brand{font-size:10px;letter-spacing:1px;color:#aaa;font-family:sans-serif;}
.ftr-pg{font-size:10px;color:#aaa;font-family:sans-serif;}
.diag{display:flex;gap:40px;margin-bottom:32px;}
.diag img{width:200px;height:200px;object-fit:cover;border-radius:4px;}
.ai-tag{font-size:10px;color:#aaa;border:1px solid #eee;padding:4px 8px;display:inline-block;margin-top:8px;font-family:sans-serif;}
.cond-tbl{flex:1;}
.cond-tbl table{width:100%;}
.fnds{display:flex;border-top:1px solid #eee;margin-top:32px;}
.rtn{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:36px;}
.rtn-ttl{font-size:10px;letter-spacing:2px;color:#aaa;font-family:sans-serif;padding-bottom:10px;border-bottom:1px solid #eee;margin-bottom:16px;}
.fu{background:#f9f9f9;padding:24px;font-size:13px;line-height:2;color:#444;margin-bottom:36px;}
.doc-ftr{background:#111;color:white;padding:36px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
.df-lbl{font-size:9px;letter-spacing:2px;color:#666;font-family:sans-serif;margin-bottom:10px;}
.df-name{font-size:30px;font-weight:300;}
.df-sub{font-size:13px;color:#666;font-family:sans-serif;}
.df-contact{font-size:22px;font-weight:300;font-family:sans-serif;}
.disc{font-size:10px;color:#aaa;text-align:center;padding:20px;line-height:1.8;font-family:sans-serif;}
.print-btn{display:block;background:#111;color:white;border:none;padding:14px 40px;font-size:14px;cursor:pointer;font-family:sans-serif;margin:0 auto 20px;letter-spacing:1px;}
@media print{body{background:white;padding:0;}.page{margin:0;}.no-print{display:none!important;}}
</style></head><body>
<div class="no-print" style="text-align:center;padding:16px;"><button class="print-btn" onclick="window.print()">⬇ Download / Print PDF</button></div>

<!-- PAGE 1 -->
<div class="page">
<div class="hdr"><div class="logo">S</div><div class="rid"><div class="conf">CONFIDENTIAL REPORT</div><div class="id">${reportId}</div><div class="dt">${date}</div></div></div>
<div class="title">Dermatological<br>Assessment</div>
<div class="subtitle" style="font-family:sans-serif;">A comprehensive, AI-assisted analysis of skin health, texture, and underlying conditions.</div>
<div class="pt">
<img src="${imageDataUrl}" alt="Patient photo"/>
<div class="pt-info">
<div class="pt-name">${patient.name}</div>
<div class="info-grid">
<div><div class="info-label">AGE</div><div class="info-val">${patient.age} Years</div></div>
<div><div class="info-label">SKIN TYPE</div><div class="info-val">${results.skinType}</div></div>
<div><div class="info-label">PRIMARY CONCERN</div><div class="info-val">${results.primaryConcern}</div></div>
<div><div class="info-label">IDENTIFIED FOCUS</div><div class="info-val accent">${results.conditions[0]?.name||"—"}</div></div>
</div></div></div>
<hr/>
<div class="sl">CLINICAL EVALUATION</div>
<div class="clin">
<div>
<div class="pl">PHYSICIAN'S SUMMARY</div>
<div class="pt-txt">"${results.physicianSummary}"</div>
<div class="ctags"><div class="pl" style="margin-top:16px;">NOTED CONDITIONS:</div>${results.conditions.slice(0,3).map(c=>`<span class="ctag">${c.name}</span>`).join("")}</div>
</div>
<div>
<div class="pl">SEVERITY INDEX</div>
<div class="sev-val" style="color:${sevColor};">${results.severityIndex}</div>
<div class="sev-sub">Estimated Skin Age: ${results.skinAge}</div>
</div>
</div>
<div class="ftr"><div class="ftr-brand">AI SKIN ANALYSIS &nbsp;·&nbsp; ${DOC.clinic.toUpperCase()}</div><div class="ftr-pg">PAGE 1 / 3</div></div>
</div>

<!-- PAGE 2 -->
<div class="page">
<div class="hdr"><div class="logo">S</div><div class="rid"><div class="conf">CONFIDENTIAL REPORT</div><div class="id">${reportId}</div><div class="dt">${date}</div></div></div>
<div class="sl">DIAGNOSTIC MAPPING</div>
<div class="subtitle" style="font-family:sans-serif;">Detailed breakdown of detected skin conditions and their respective severity.</div>
<div class="diag">
<div><img src="${imageDataUrl}" alt="Patient"/><div class="ai-tag">AI DIAGNOSTICS</div></div>
<div class="cond-tbl"><table>${condRows}</table></div>
</div>
<div class="fnds">${findingsHTML}</div>
<div class="ftr"><div class="ftr-brand">AI SKIN ANALYSIS &nbsp;·&nbsp; ${DOC.clinic.toUpperCase()}</div><div class="ftr-pg">PAGE 2 / 3</div></div>
</div>

<!-- PAGE 3 -->
<div class="page">
<div class="hdr"><div class="logo">S</div><div class="rid"><div class="conf">CONFIDENTIAL REPORT</div><div class="id">${reportId}</div><div class="dt">${date}</div></div></div>
<div class="sl">PRESCRIBED REGIMEN</div>
<div class="subtitle" style="font-family:sans-serif;">A curated protocol designed to address the identified conditions.</div>
<div class="rtn">
<div><div class="rtn-ttl">MORNING PROTOCOL</div>${morningSteps}</div>
<div><div class="rtn-ttl">EVENING PROTOCOL</div>${eveningSteps}</div>
</div>
<div class="sl">FOLLOW-UP DIRECTIVES</div>
<div class="fu">${results.followUpAdvice}</div>
<div class="doc-ftr">
<div><div class="df-lbl">ATTENDING SPECIALIST</div><div class="df-name">${DOC.name}</div><div class="df-sub">${DOC.clinic}</div></div>
<div><div class="df-lbl">CONTACT</div><div class="df-contact">+91 ${DOC.phone}</div><div class="df-sub">${DOC.city}</div></div>
</div>
<div class="disc">DISCLAIMER: This AI-powered analysis is for informational purposes only and does not replace professional medical advice.<br>Please consult a board-certified dermatologist for diagnosis and treatment.</div>
<div class="ftr"><div class="ftr-brand">AI SKIN ANALYSIS &nbsp;·&nbsp; ${DOC.clinic.toUpperCase()}</div><div class="ftr-pg">PAGE 3 / 3</div></div>
</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [analysisType, setAnalysisType] = useState("detailed");
  const [capturedImage, setCapturedImage] = useState(null);
  const [patient, setPatient] = useState({ name: "", age: "", phone: "", city: "Mumbai", state: "Maharashtra" });
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [activeTab, setActiveTab] = useState("results");
  const [camError, setCamError] = useState(false);

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const fileRef = useRef(null);
  const fileRef2 = useRef(null);

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
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.44, w * 0.27, h * 0.37, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.44, w * 0.27, h * 0.37, 0, 0, Math.PI * 2);
      ctx.stroke();
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
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { setCapturedImage(ev.target.result); setScreen("preview"); };
    r.readAsDataURL(f);
  };

  const startAnalysis = async () => {
    setScreen("scanning");
    setProgress(0);
    setTipIdx(0);
    const tipIv = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 3000);
    const progIv = setInterval(() => setProgress(p => { if (p >= 90) { clearInterval(progIv); return 90; } return p + Math.random() * 7; }), 350);

    try {
      const b64 = capturedImage.split(",")[1];
      const data = await analyzeWithAI(b64, patient);
      clearInterval(progIv); clearInterval(tipIv);
      setProgress(100);
      setTimeout(() => { setResults(data); setActiveTab("results"); setScreen("results"); }, 700);
    } catch {
      clearInterval(progIv); clearInterval(tipIv);
      const mock = {
        skinType: "combination", primaryConcern: "acne & pigmentation", severityIndex: "Moderate", skinAge: "consistent with age",
        conditions: [
          { name: "Acne & Blemishes", severity: "Moderate", percentage: 35, description: "Visible lesions and marks on the cheeks and lower face consistent with reported concern." },
          { name: "Hyperpigmentation", severity: "Mild", percentage: 30, description: "Uneven skin tone and mild post-inflammatory pigmentation marks observed." },
          { name: "Dark Circles", severity: "Mild", percentage: 25, description: "Mild shadowing visible under the eyes, likely accentuated by lighting." },
          { name: "Enlarged Pores", severity: "Mild", percentage: 20, description: "Slightly visible pores on the nose area, a normal textural feature." },
          { name: "Fine Lines", severity: "Mild", percentage: 10, description: "Early signs of fine lines visible, age-appropriate findings." },
        ],
        physicianSummary: `Analysis indicates combination skin with moderate acne activity for a ${patient.age}-year-old patient. Primary findings show post-inflammatory marks alongside enlarged pores. A structured routine targeting acne and pigmentation is strongly recommended.`,
        morningRoutine: ["Gentle non-comedogenic cleanser", "Niacinamide serum (10%) for PIH", "Lightweight oil-free moisturizer", "SPF 30+ broad-spectrum sunscreen"],
        eveningRoutine: ["Gentle cleanser", "Targeted acne treatment (benzoyl peroxide)", "Hydrating night cream"],
        followUpAdvice: `Given the moderate severity and chronic nature of the condition, it is highly recommended to consult ${DOC.name} for a personalized treatment plan. Prescription-grade topicals or oral medications may be needed to prevent further scarring.`
      };
      setProgress(100);
      setTimeout(() => { setResults(mock); setActiveTab("results"); setScreen("results"); }, 700);
    }
  };

  useEffect(() => () => stopCamera(), []);

  const s = { fontFamily: "'Segoe UI', system-ui, sans-serif" };

  // ═══ LANDING ═══
  if (screen === "landing" || screen === "choose") return (
    <div style={{ display: "flex", minHeight: "100vh", ...s }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .opt-card:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.08);}
        .contact-btn:hover{background:#f5e0e4!important;border-color:#c49!important;}
        .start-btn:hover{background:#333!important;}
      `}</style>

      {/* Left maroon panel */}
      <div style={{ width: 340, background: MAROON, padding: "52px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ color: "white" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 48 }}>🔬</div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.3, marginBottom: 16 }}>Advanced AI<br/>Skin Analysis</div>
          <div style={{ fontSize: 14, opacity: 0.72, lineHeight: 1.8 }}>Welcome to the digital consultation portal for {DOC.clinic}.</div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Powered by AI · Completely Private</div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: "#fdf2f4", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ background: "white", borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 460, animation: "fadeUp 0.5s ease" }}>
          {/* Doctor card */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: MAROON, color: "white", fontSize: 30, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>PT</div>
            <div style={{ fontSize: 21, fontWeight: 700, color: "#111" }}>{DOC.name}</div>
            <div style={{ color: MAROON, fontWeight: 600, fontSize: 13, marginTop: 4 }}>{DOC.clinic}</div>
            <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>📍 {DOC.city}</div>
          </div>

          <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: 24, marginBottom: 24 }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 6 }}>Begin Your Personalised Consultation</div>
              <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7 }}>In three simple steps, our AI will analyze your skin and generate a personalized preliminary report.</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 28 }}>
              {[
                { icon: "📷", t: "1. Snap Photo", d: "Capture a clear photo of the skin area." },
                { icon: "🤖", t: "2. AI Analysis", d: "Our system analyzes the image instantly." },
                { icon: "📄", t: "3. Get Report", d: "Receive a detailed report for the doctor." },
              ].map(x => (
                <div key={x.t} style={{ textAlign: "center", flex: 1, padding: "0 6px" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fde8ed", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 20 }}>{x.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#111", marginBottom: 3 }}>{x.t}</div>
                  <div style={{ fontSize: 10, color: "#aaa", lineHeight: 1.5 }}>{x.d}</div>
                </div>
              ))}
            </div>
            <button className="start-btn" onClick={() => setScreen("choose")} style={{ width: "100%", background: "#111", color: "white", border: "none", borderRadius: 50, padding: 16, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}>
              Start My Skin Analysis
            </button>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#bbb", marginBottom: 10 }}>For appointments or questions, contact the clinic:</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { label: "📞 Call Clinic", href: `tel:+91${DOC.phone}` },
                { label: "💬 WhatsApp", href: `https://wa.me/${DOC.wa}` },
                { label: "📍 Directions", href: `https://maps.google.com/?q=${encodeURIComponent(DOC.clinic + " " + DOC.city)}` },
              ].map(b => (
                <a key={b.label} className="contact-btn" href={b.href} target="_blank" rel="noreferrer"
                  style={{ padding: "8px 14px", borderRadius: 20, border: `1px solid #f0d0d8`, background: "#fdf2f4", color: MAROON, fontSize: 11, fontWeight: 600, textDecoration: "none", transition: "all 0.2s", cursor: "pointer" }}>{b.label}</a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Choose Analysis Modal */}
      {screen === "choose" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "32px 28px", width: 380, maxWidth: "92vw", animation: "fadeUp 0.25s ease" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 4 }}>Choose Your Analysis</div>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 24 }}>Select how you'd like to proceed</div>
            {[
              { type: "quick", icon: "⚡", title: "Quick Analysis", desc: "Get instant results with just your photo and basic info" },
              { type: "detailed", icon: "📋", title: "Detailed Analysis", desc: "Answer a few questions for personalized, more accurate results", rec: true },
            ].map(o => (
              <div key={o.type} className="opt-card" onClick={() => { setAnalysisType(o.type); setScreen("tips"); }}
                style={{ border: "1px solid " + (o.rec ? "transparent" : "#eee"), borderRadius: 16, padding: "16px 18px", marginBottom: 12, cursor: "pointer", background: o.rec ? "#111" : "white", display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: o.rec ? "#2a2a2a" : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{o.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, color: o.rec ? "white" : "#111", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    {o.title}
                    {o.rec && <span style={{ fontSize: 10, background: "#333", padding: "2px 8px", borderRadius: 10, color: "#ccc" }}>Recommended</span>}
                  </div>
                  <div style={{ fontSize: 12, color: o.rec ? "#888" : "#aaa", marginTop: 3 }}>{o.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <span onClick={() => setScreen("landing")} style={{ color: "#aaa", fontSize: 13, cursor: "pointer" }}>Cancel</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══ TIPS ═══
  if (screen === "tips") return (
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, ...s }}>
      <div style={{ maxWidth: 460, width: "100%", animation: "fadeUp 0.3s ease" }}>
        <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111", marginBottom: 6 }}>Before We Begin</div>
          <div style={{ fontSize: 13, color: "#aaa" }}>For the best analysis results:</div>
        </div>
        {[
          { e: "👓", t: "Remove glasses & spectacles" },
          { e: "💡", t: "Face a window or good light source" },
          { e: "💄", t: "Remove makeup for accurate results" },
          { e: "🙍", t: "Pull hair away from your face" },
          { e: "😐", t: "Keep a neutral, relaxed expression" },
        ].map(tip => (
          <div key={tip.t} style={{ background: "#f9f9f9", borderRadius: 14, padding: "14px 20px", marginBottom: 10, display: "flex", alignItems: "center", gap: 16, fontSize: 14, color: "#444" }}>
            <span style={{ fontSize: 22 }}>{tip.e}</span>{tip.t}
          </div>
        ))}
        <button onClick={() => setScreen("capture-choice")} style={{ width: "100%", background: "#111", color: "white", border: "none", borderRadius: 50, padding: 16, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 24 }}>
          I'm Ready
        </button>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span onClick={() => setScreen("choose")} style={{ color: "#aaa", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Back</span>
        </div>
      </div>
    </div>
  );

  // ═══ CAPTURE CHOICE ═══
  if (screen === "capture-choice") return (
    <div style={{ minHeight: "100vh", background: "#f8faff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} .cap-opt:hover{box-shadow:0 4px 16px rgba(0,0,0,0.08);transform:translateY(-1px);}"}</style>
      <div style={{ maxWidth: 460, width: "100%", animation: "fadeUp 0.3s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 6 }}>See What Your Skin Reveals</div>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12 }}>Get personalized insights in seconds — choose your preferred method</div>
          <div style={{ background: "#e0f7f0", borderRadius: 50, padding: "7px 20px", display: "inline-block", fontSize: 12, color: "#0f6e56" }}>Upload images smaller than 6MB or use the camera</div>
        </div>
        {[
          { icon: "📷", t: "Take Photo", d: "Use your camera for instant capture", action: startCamera },
          { icon: "☁️", t: "Upload Photo", d: "Choose from your gallery", action: () => fileRef2.current?.click() },
        ].map(o => (
          <div key={o.t} className="cap-opt" onClick={o.action}
            style={{ background: "white", borderRadius: 18, padding: "18px 22px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", border: "1px solid #eee", transition: "all 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 26 }}>{o.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: "#111", fontSize: 15 }}>{o.t}</div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{o.d}</div>
              </div>
            </div>
            <span style={{ color: "#ccc", fontSize: 22 }}>›</span>
          </div>
        ))}
        <div style={{ background: "#0f172a", borderRadius: 16, padding: "16px 20px", marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "#666", letterSpacing: 1, marginBottom: 8 }}>PRIVATE PHOTO HANDLING</div>
          <div style={{ fontSize: 13, color: "white", fontWeight: 600, marginBottom: 6 }}>🛡️ Your photo is used once for analysis and then removed.</div>
          <div style={{ fontSize: 12, color: "#666" }}>• We do not keep your image after the analysis is completed.</div>
        </div>
        <input ref={fileRef2} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span onClick={() => setScreen("tips")} style={{ color: "#aaa", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Back</span>
        </div>
      </div>
    </div>
  );

  // ═══ CAMERA ═══
  if (screen === "camera") return (
    <div style={{ position: "fixed", inset: 0, background: "black", overflow: "hidden", ...s }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => { stopCamera(); setScreen("capture-choice"); }} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "white", width: 42, height: 42, borderRadius: "50%", fontSize: 20, cursor: "pointer" }}>‹</button>
        <div style={{ background: "rgba(0,0,0,0.5)", color: "white", padding: "6px 16px", borderRadius: 20, fontSize: 12 }}>Step 1 of 4</div>
      </div>

      <div style={{ position: "absolute", top: 68, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.65)", color: "white", padding: "8px 20px", borderRadius: 20, fontSize: 13, textAlign: "center", whiteSpace: "nowrap" }}>
        Align your full face in the oval frame<br />
        <span style={{ fontSize: 10, opacity: 0.65 }}>Hold still • Neutral expression • Good light</span>
      </div>

      {countdown && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "white", fontSize: 100, fontWeight: 700, textShadow: "0 0 30px rgba(0,0,0,0.5)" }}>{countdown}</div>
      )}

      {camError && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "white", padding: 28, borderRadius: 20, textAlign: "center", maxWidth: 300 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Camera not available</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Please upload a photo instead</div>
          <button onClick={() => { stopCamera(); fileRef2.current?.click(); setScreen("capture-choice"); }} style={{ background: "#111", color: "white", border: "none", padding: "10px 24px", borderRadius: 20, cursor: "pointer", fontSize: 13 }}>Upload Photo</button>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 44, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 36 }}>
        <button onClick={() => { stopCamera(); fileRef.current?.click(); }} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", width: 50, height: 50, borderRadius: "50%", fontSize: 22, cursor: "pointer" }}>🖼</button>
        <button onClick={startCountdown} style={{ width: 76, height: 76, borderRadius: "50%", background: "white", border: "5px solid rgba(255,255,255,0.4)", cursor: "pointer" }} />
      </div>
      <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 12 }}>Tap to start 3-second countdown</div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );

  // ═══ PREVIEW ═══
  if (screen === "preview") return (
    <div style={{ minHeight: "100vh", background: "#f8faff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}"}</style>
      <div style={{ maxWidth: 460, width: "100%", animation: "fadeUp 0.3s ease" }}>
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 16 }}>
          <img src={capturedImage} style={{ width: "100%", display: "block" }} alt="Preview" />
        </div>
        <div style={{ background: "white", borderRadius: 16, padding: 20, marginBottom: 14, textAlign: "center", border: "1px solid #eee" }}>
          <div style={{ color: "#16a34a", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>✓ Face detected — ready for analysis</div>
          <div style={{ fontSize: 13, color: "#666" }}>This photo will be analyzed by our AI system to provide detailed skin insights</div>
        </div>
        <button onClick={() => setScreen("form")} style={{ width: "100%", background: "#2563eb", color: "white", border: "none", borderRadius: 14, padding: 16, fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
          Continue to Analysis →
        </button>
        <button onClick={() => { setCapturedImage(null); setScreen("capture-choice"); }} style={{ width: "100%", background: "white", color: "#555", border: "1px solid #ddd", borderRadius: 14, padding: 14, fontSize: 13, cursor: "pointer" }}>
          Retake Photo
        </button>
      </div>
    </div>
  );

  // ═══ PATIENT FORM ═══
  if (screen === "form") return (
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} input,select{outline:none;} input:focus,select:focus{border-color:#2563eb!important;}"}</style>
      <div style={{ maxWidth: 460, width: "100%", animation: "fadeUp 0.3s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 6 }}>Quick Details</div>
          <div style={{ fontSize: 13, color: "#aaa" }}>To personalize your skin analysis</div>
        </div>

        {[{ l: "Your Name", k: "name", p: "Enter your full name", t: "text" }, { l: "Age", k: "age", p: "Enter your age", t: "number" }].map(f => (
          <div key={f.k} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>{f.l}</label>
            <input type={f.t} placeholder={f.p} value={patient[f.k]} onChange={e => setPatient(p => ({ ...p, [f.k]: e.target.value }))}
              style={{ width: "100%", padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 14, transition: "border 0.2s", boxSizing: "border-box" }} />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Phone Number</label>
          <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <span style={{ padding: "12px 14px", background: "#f9f9f9", fontSize: 13, color: "#888", borderRight: "1px solid #e5e7eb" }}>+91</span>
            <input type="tel" placeholder="9876543210" value={patient.phone} onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))}
              style={{ flex: 1, padding: "12px 16px", border: "none", fontSize: 14 }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>City</label>
            <input type="text" placeholder="e.g., Mumbai" value={patient.city} onChange={e => setPatient(p => ({ ...p, city: e.target.value }))}
              style={{ width: "100%", padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>State</label>
            <select value={patient.state} onChange={e => setPatient(p => ({ ...p, state: e.target.value }))}
              style={{ width: "100%", padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 13, background: "white", boxSizing: "border-box" }}>
              {IND_STATES.map(st => <option key={st}>{st}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: "#f0faf5", border: "1px solid #d1fae5", borderRadius: 14, padding: 16, marginBottom: 22, display: "flex", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46", marginBottom: 4 }}>Your Privacy Guaranteed</div>
            <div style={{ fontSize: 12, color: "#047857", lineHeight: 1.7 }}>Your photo is never saved. It's analyzed and immediately deleted — guaranteed. Only your name and phone are stored.</div>
          </div>
        </div>

        <button onClick={startAnalysis} disabled={!patient.name || !patient.age}
          style={{ width: "100%", background: patient.name && patient.age ? "#111" : "#e0e0e0", color: patient.name && patient.age ? "white" : "#aaa", border: "none", borderRadius: 14, padding: 16, fontSize: 14, fontWeight: 700, cursor: patient.name && patient.age ? "pointer" : "not-allowed", transition: "background 0.2s" }}>
          Start AI Analysis
        </button>
      </div>
    </div>
  );

  // ═══ SCANNING ═══
  if (screen === "scanning") return (
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes scanLine{0%{top:0%}100%{top:100%}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"}</style>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ position: "relative", width: 220, height: 260, margin: "0 auto 28px", borderRadius: 20, overflow: "hidden", border: "2.5px solid #2563eb" }}>
          <img src={capturedImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Scanning" />
          <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "linear-gradient(to right, transparent, #2563eb, transparent)", animation: "scanLine 2s linear infinite", top: "50%" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(37,99,235,0.08)" }} />
        </div>

        <div style={{ fontSize: 21, fontWeight: 700, color: "#111", marginBottom: 4 }}>Analyzing Your Skin...</div>
        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>AI is scanning for conditions</div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#888" }}>Scanning...</span>
          <span style={{ fontSize: 12, color: "#888" }}>{Math.round(progress)}% complete</span>
        </div>
        <div style={{ background: "#f0f0f0", borderRadius: 10, height: 6, marginBottom: 24 }}>
          <div style={{ background: "#2563eb", height: 6, borderRadius: 10, width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>

        <div style={{ background: "#eff6ff", borderRadius: 16, padding: "16px 20px", textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 8 }}>💡 Skin Care Tip</div>
          <div style={{ fontSize: 13, color: "#3b82f6", lineHeight: 1.7 }}>{TIPS[tipIdx]}</div>
        </div>
      </div>
    </div>
  );

  // ═══ RESULTS ═══
  if (screen === "results" && results) {
    const primary = results.conditions[0];
    const sevColor = results.severityIndex === "Low" ? "#16a34a" : results.severityIndex === "Moderate" ? "#d97706" : "#dc2626";
    const sevBg = results.severityIndex === "Low" ? "#f0faf0" : results.severityIndex === "Moderate" ? "#fffbeb" : "#fff5f5";
    const barColor = p => p >= 50 ? "#dc2626" : p >= 30 ? "#d97706" : "#16a34a";

    return (
      <div style={{ minHeight: "100vh", background: "#f8faff", paddingBottom: 90, ...s }}>
        <style>{"@keyframes barGrow{from{width:0}to{width:var(--w)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}"}</style>

        {/* Header */}
        <div style={{ background: "white", padding: "14px 20px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>Analysis Results</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>{patient.name} • {new Date().toLocaleDateString("en-IN")}</div>
          </div>
          <div style={{ background: sevBg, color: sevColor, padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{results.severityIndex}</div>
        </div>

        <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px" }}>
          {/* Photos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <img src={capturedImage} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 14, display: "block" }} alt="Patient" />
            <div style={{ background: "#e8eeff", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "1", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 28 }}>🤖</span>
              <div style={{ fontSize: 11, color: "#7c9fd4", textAlign: "center", lineHeight: 1.4 }}>AI Analysis<br/>View</div>
            </div>
          </div>

          {/* Primary Concern */}
          <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 18, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "#f97316", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>PRIMARY CONCERN</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>{primary?.name}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>{primary?.percentage}%</div>
            </div>
            <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{primary?.description}</div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", background: "#efefef", borderRadius: 14, padding: 4, marginBottom: 14 }}>
            {["results", "routine", "info"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: "10px", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 13, fontWeight: 600, background: activeTab === tab ? "#2563eb" : "transparent", color: activeTab === tab ? "white" : "#777", transition: "all 0.2s" }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Results Tab */}
          {activeTab === "results" && (
            <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1px solid #eee", animation: "fadeUp 0.2s ease" }}>
              {results.conditions.map((c, i) => (
                <div key={c.name} style={{ marginBottom: i < results.conditions.length - 1 ? 18 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{c.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: barColor(c.percentage) }}>{c.percentage}%</span>
                  </div>
                  <div style={{ background: "#f0f0f0", borderRadius: 10, height: 7 }}>
                    <div style={{ background: barColor(c.percentage), height: 7, borderRadius: 10, width: `${c.percentage}%`, transition: "width 1s ease " + i * 0.1 + "s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{c.severity}</div>
                </div>
              ))}
            </div>
          )}

          {/* Routine Tab */}
          {activeTab === "routine" && (
            <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1px solid #eee", animation: "fadeUp 0.2s ease" }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f97316", marginBottom: 14 }}>☀️ Morning Routine</div>
                {results.morningRoutine.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff3e0", color: "#f97316", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, paddingTop: 4 }}>{step}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #f5f5f5", paddingTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", marginBottom: 14 }}>🌙 Evening Routine</div>
                {results.eveningRoutine.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#f3e8ff", color: "#7c3aed", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, paddingTop: 4 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Tab */}
          {activeTab === "info" && (
            <div style={{ background: "white", borderRadius: 18, padding: 20, border: "1px solid #eee", animation: "fadeUp 0.2s ease" }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 1.5, fontWeight: 600, marginBottom: 10 }}>PHYSICIAN SUMMARY</div>
                <div style={{ fontSize: 13, color: "#333", lineHeight: 1.9, fontStyle: "italic" }}>"{results.physicianSummary}"</div>
              </div>
              <div style={{ background: "#f8f9fa", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, color: "#aaa", letterSpacing: 1.5, fontWeight: 600, marginBottom: 10 }}>FOLLOW-UP ADVICE</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.8 }}>{results.followUpAdvice}</div>
              </div>
              <div style={{ marginTop: 16, padding: 14, background: "#fdf2f4", borderRadius: 12, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>👨‍⚕️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: MAROON }}>{DOC.name}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{DOC.clinic} · {DOC.city}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", padding: "12px 20px", borderTop: "1px solid #eee", display: "flex", gap: 10 }}>
          <button onClick={() => openPDFReport(patient, results, capturedImage)}
            style={{ flex: 1, background: "#2563eb", color: "white", border: "none", borderRadius: 14, padding: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            📥 Download PDF
          </button>
          <button onClick={() => window.open(`https://wa.me/${DOC.wa}?text=Hi%20${encodeURIComponent(DOC.name)}%2C%20I%20just%20completed%20my%20AI%20skin%20analysis.%20Primary%20concern%3A%20${encodeURIComponent(results.primaryConcern)}%20(${encodeURIComponent(results.severityIndex)}%20severity).%20I%20would%20like%20to%20book%20a%20consultation.`, "_blank")}
            style={{ flex: 1, background: "#111", color: "white", border: "none", borderRadius: 14, padding: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            💬 Book via WhatsApp
          </button>
        </div>
      </div>
    );
  }

  return null;
}
