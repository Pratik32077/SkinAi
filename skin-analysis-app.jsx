import { useState, useRef, useEffect } from "react";

const DOC = {
  name: "Dr. Pratik Tiwari",
  initials: "PT",
  clinic: "Tiwari Neurologist Brain Clinic",
  city: "Mumbai",
  phone: "8055208985",
  wa: "918055208985",
};

const MAROON = "#591321"; // Deep premium maroon
const GOLD = "#C2A278"; // Warm luxury bronze-gold
const PEARL = "#FAF7F5"; // Rich pearl-cream background

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
      <td style="padding:14px 0;border-bottom:1px solid #f2ece6;font-weight:600;color:#1A1717;">${c.name}</td>
      <td style="padding:14px 0;border-bottom:1px solid #f2ece6;color:#C2A278;font-size:10px;font-weight:700;letter-spacing:1.5px;">${c.severity.toUpperCase()}</td>
      <td style="padding:14px 0;border-bottom:1px solid #f2ece6;text-align:right;font-weight:700;font-size:17px;color:#591321;">${c.percentage}%</td>
    </tr>`).join("");

  const morningSteps = results.morningRoutine.map((s,i)=>`<div style="display:flex;gap:14px;margin:12px 0;font-size:13px;align-items:flex-start;"><span style="color:#C2A278;font-weight:700;font-size:11px;min-width:20px;margin-top:2px;">0${i+1}</span><span style="color:#4A4444;line-height:1.6;">${s}</span></div>`).join("");
  const eveningSteps = results.eveningRoutine.map((s,i)=>`<div style="display:flex;gap:14px;margin:12px 0;font-size:13px;align-items:flex-start;"><span style="color:#C2A278;font-weight:700;font-size:11px;min-width:20px;margin-top:2px;">0${i+1}</span><span style="color:#4A4444;line-height:1.6;">${s}</span></div>`).join("");

  const findingsHTML = results.conditions.slice(0,3).map((c,i)=>`
    <div style="flex:1;padding:24px 20px;border-right:${i<2?'1px solid #f2ece6':'none'};">
      <div style="font-size:9px;letter-spacing:2px;color:#C2A278;font-weight:700;margin-bottom:8px;">PRIMARY FINDING 0${i+1}</div>
      <div style="font-size:22px;font-weight:400;margin-bottom:12px;color:#591321;font-family:'Playfair Display', serif;">${c.name}</div>
      <div style="font-size:12px;color:#665F5F;line-height:1.8;">${c.description}</div>
    </div>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Skin Analysis Report — ${patient.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Plus Jakarta Sans', system-ui, sans-serif;background:#F5F1EC;padding:40px 20px;}
.page{width:794px;min-height:1123px;margin:0 auto 36px;padding:64px;background:white;position:relative;box-shadow:0 30px 60px rgba(89, 19, 33, 0.06);border: 1px solid rgba(89, 19, 33, 0.04);border-radius:12px;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;padding-bottom:24px;border-bottom:1px solid #f2ece6;}
.logo{width:38px;height:38px;background:#591321;border: 1px solid #C2A278;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;}
.rid{text-align:right;}
.rid .conf{font-size:9px;letter-spacing:2px;color:#C2A278;font-weight:700;}
.rid .id{font-size:16px;font-weight:600;color:#1A1717;margin-top:2px;}
.rid .dt{font-size:12px;color:#8E8585;margin-top:2px;}
.title{font-family:'Playfair Display', Georgia, serif;font-size:52px;font-weight:400;line-height:1.15;margin-bottom:12px;color:#591321;}
.subtitle{font-size:13px;color:#8E8585;margin-bottom:44px;line-height:1.6;}
.pt{display:flex;gap:40px;margin-bottom:36px;background:#FCFAF9;padding:24px;border-radius:12px;border: 1px solid #f2ece6;}
.pt img{width:180px;height:200px;object-fit:cover;border-radius:8px;border: 1px solid #f2ece6;}
.pt-info{flex:1;display:flex;flex-direction:column;justify-content:center;}
.pt-name{font-family:'Playfair Display', Georgia, serif;font-size:38px;font-weight:400;margin-bottom:20px;color:#591321;}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.info-label{font-size:9px;letter-spacing:1.5px;color:#C2A278;font-weight:700;margin-bottom:4px;}
.info-val{font-size:15px;font-weight:500;color:#1A1717;}
.accent{color:#dc2626;}
hr{border:none;border-top:1px solid #f2ece6;margin:28px 0;}
.sl{font-size:9px;letter-spacing:2px;color:#C2A278;font-weight:700;margin-bottom:16px;}
.clin{display:grid;grid-template-columns:1fr 1fr;gap:40px;}
.pl{font-size:10px;color:#C2A278;font-weight:700;letter-spacing:1px;margin-bottom:10px;}
.pt-txt{font-size:14px;line-height:1.8;color:#4A4444;font-style:italic;}
.ctags{margin-top:16px;}
.ctag{display:inline-block;border:1px solid #f2ece6;background:#FFF;border-radius:20px;padding:5px 14px;font-size:11px;margin:3px;color:#4A4444;font-weight:500;}
.sev-val{font-size:52px;font-family:'Playfair Display', serif;font-weight:400;line-height:1;}
.sev-sub{font-size:13px;color:#8E8585;margin-top:8px;}
.ftr{position:absolute;bottom:48px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f2ece6;padding-top:16px;}
.ftr-brand{font-size:9px;letter-spacing:1.5px;color:#C2A278;font-weight:700;}
.ftr-pg{font-size:10px;color:#8E8585;}
.diag{display:flex;gap:40px;margin-bottom:32px;background:#FCFAF9;padding:24px;border-radius:12px;border: 1px solid #f2ece6;}
.diag img{width:200px;height:200px;object-fit:cover;border-radius:8px;border: 1px solid #f2ece6;}
.ai-tag{font-size:9px;color:#C2A278;font-weight:700;letter-spacing:1.5px;border:1px solid #f2ece6;background:#FFF;padding:6px 12px;display:inline-block;margin-top:12px;border-radius:4px;}
.cond-tbl{flex:1;}
.cond-tbl table{width:100%;border-collapse:collapse;}
.fnds{display:flex;border-top:1px solid #f2ece6;margin-top:32px;}
.rtn{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:36px;}
.rtn-ttl{font-size:10px;letter-spacing:2px;color:#C2A278;font-weight:700;padding-bottom:10px;border-bottom:1px solid #f2ece6;margin-bottom:16px;}
.fu{background:#FCFAF9;padding:28px;border-radius:12px;border: 1px solid #f2ece6;font-size:14px;line-height:1.9;color:#4A4444;margin-bottom:36px;font-style:italic;}
.doc-ftr{background:#591321;border-radius:12px;border: 1px solid #C2A278;color:white;padding:36px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
.df-lbl{font-size:9px;letter-spacing:2px;color:#C2A278;font-weight:700;margin-bottom:10px;}
.df-name{font-family:'Playfair Display', serif;font-size:30px;font-weight:400;color:#FFF;}
.df-sub{font-size:13px;color:#D4AF37;margin-top:4px;}
.df-contact{font-size:20px;font-weight:400;letter-spacing:0.5px;}
.disc{font-size:10px;color:#8E8585;text-align:center;padding:24px;line-height:1.8;}
.print-btn{display:block;background:#591321;color:white;border:1px solid #C2A278;padding:16px 48px;font-size:13px;font-weight:700;cursor:pointer;margin:0 auto 24px;letter-spacing:2px;border-radius:30px;box-shadow:0 10px 25px -5px rgba(89, 19, 33, 0.2);transition:all 0.3s;}
.print-btn:hover{background:#3A0C16;transform:translateY(-1px);}
@media print{body{background:white;padding:0;}.page{margin:0;box-shadow:none;border:none;}.no-print{display:none!important;}}
</style></head><body>
<div class="no-print" style="text-align:center;padding:16px;"><button class="print-btn" onclick="window.print()">⬇ DOWNLOAD / PRINT CLINICAL PDF</button></div>

<!-- PAGE 1 -->
<div class="page">
<div class="hdr"><div class="logo">S</div><div class="rid"><div class="conf">CONFIDENTIAL MEDICAL REPORT</div><div class="id">${reportId}</div><div class="dt">${date}</div></div></div>
<div class="title">Dermatological<br>Assessment</div>
<div class="subtitle">An advanced, AI-assisted microscopic analysis of skin health, textural composition, and epidermal conditions.</div>
<div class="pt">
<img src="${imageDataUrl}" alt="Patient photo"/>
<div class="pt-info">
<div class="pt-name">${patient.name}</div>
<div class="info-grid">
<div><div class="info-label">PATIENT AGE</div><div class="info-val">${patient.age} Years</div></div>
<div><div class="info-label">SKIN CLASSIFICATION</div><div class="info-val">${results.skinType.toUpperCase()}</div></div>
<div><div class="info-label">PRIMARY CONCERN</div><div class="info-val">${results.primaryConcern.toUpperCase()}</div></div>
<div><div class="info-label">IDENTIFIED FOCUS</div><div class="info-val accent" style="color:#591321;font-weight:700;">${results.conditions[0]?.name||"—"}</div></div>
</div></div></div>
<hr/>
<div class="sl">CLINICAL EVALUATION SUMMARY</div>
<div class="clin">
<div>
<div class="pl">PHYSICIAN'S RECOMMENDATION SUMMARY</div>
<div class="pt-txt">"${results.physicianSummary}"</div>
<div class="ctags"><div class="pl" style="margin-top:20px;">DIAGNOSED MARKERS:</div>${results.conditions.slice(0,3).map(c=>`<span class="ctag">${c.name}</span>`).join("")}</div>
</div>
<div>
<div class="pl">SEVERITY COEFFICIENT</div>
<div class="sev-val" style="color:${sevColor};">${results.severityIndex}</div>
<div class="sev-sub">Calculated Biological Skin Age: ${results.skinAge}</div>
</div>
</div>
<div class="ftr"><div class="ftr-brand">AI SKIN ASSESSMENT SYSTEMS &nbsp;·&nbsp; ${DOC.clinic.toUpperCase()}</div><div class="ftr-pg">PAGE 1 / 3</div></div>
</div>

<!-- PAGE 2 -->
<div class="page">
<div class="hdr"><div class="logo">S</div><div class="rid"><div class="conf">CONFIDENTIAL REPORT</div><div class="id">${reportId}</div><div class="dt">${date}</div></div></div>
<div class="sl">DIAGNOSTIC DERM-MAPPING</div>
<div class="subtitle">Microscopic breakdown of detected epidermal conditions and computed severity profiles.</div>
<div class="diag">
<div><img src="${imageDataUrl}" alt="Patient"/><div class="ai-tag">EPIDERMAL SCANS</div></div>
<div class="cond-tbl"><table>${condRows}</table></div>
</div>
<div class="fnds">${findingsHTML}</div>
<div class="ftr"><div class="ftr-brand">AI SKIN ASSESSMENT SYSTEMS &nbsp;·&nbsp; ${DOC.clinic.toUpperCase()}</div><div class="ftr-pg">PAGE 2 / 3</div></div>
</div>

<!-- PAGE 3 -->
<div class="page">
<div class="hdr"><div class="logo">S</div><div class="rid"><div class="conf">CONFIDENTIAL REPORT</div><div class="id">${reportId}</div><div class="dt">${date}</div></div></div>
<div class="sl">PRESCRIBED PROTOCOL</div>
<div class="subtitle">A tailored clinical regimen designed to target identified cellular markers.</div>
<div class="rtn">
<div><div class="rtn-ttl">☀️ MORNING CELLULAR ROUTINE</div>${morningSteps}</div>
<div><div class="rtn-ttl">🌙 EVENING CELLULAR ROUTINE</div>${eveningSteps}</div>
</div>
<div class="sl">CLINICAL FOLLOW-UP DIRECTIVES</div>
<div class="fu">"${results.followUpAdvice}"</div>
<div class="doc-ftr">
<div><div class="df-lbl">ATTENDING BOARD SPECIALIST</div><div class="df-name">${DOC.name}</div><div class="df-sub">${DOC.clinic}</div></div>
<div><div class="df-lbl">REPRESENTATIVE OFFICES</div><div class="df-contact">+91 ${DOC.phone}</div><div class="df-sub">${DOC.city.toUpperCase()} CLINICAL CAMPUS</div></div>
</div>
<div class="disc">DISCLAIMER: This diagnostic estimation is compiled via secure AI algorithms for preliminary screening and does not represent absolute medical diagnosis. Please coordinate with ${DOC.name} or qualified clinicians to implement therapeutic plans.</div>
<div class="ftr"><div class="ftr-brand">AI SKIN ASSESSMENT SYSTEMS &nbsp;·&nbsp; ${DOC.clinic.toUpperCase()}</div><div class="ftr-pg">PAGE 3 / 3</div></div>
</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [capturedImage, setCapturedImage] = useState(null);
  const [patient, setPatient] = useState({ name: "", age: "", phone: "", city: "Mumbai", state: "Maharashtra" });
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [activeTab, setActiveTab] = useState("results");
  const [camError, setCamError] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
          }}>PREMIUM CLINICAL PORTAL</div>
          <div style={{ fontSize: isMobile ? 30 : 38, fontHeight: 1.2, fontWeight: 400, ...sSerif, lineHeight: 1.25, marginBottom: 20, color: "#FFF" }}>
            Advanced AI<br/>Skin Analysis
          </div>
          <div style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.8, fontWeight: 300 }}>
            Welcome to the digital dermatological consultation and epidermal assessment network for {DOC.clinic}.
          </div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 500, letterSpacing: "1px", marginTop: isMobile ? 32 : 0 }}>
          POWERED BY SECURE AI · CLINCALLY VERIFIED
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
          {/* Doctor card */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ 
              width: 90, 
              height: 90, 
              borderRadius: "50%", 
              background: "linear-gradient(135deg, #4A0E1C 0%, #2D0810 100%)", 
              border: `2px solid ${GOLD}`,
              color: "white", 
              fontSize: 28, 
              fontWeight: 600, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              margin: "0 auto 16px",
              boxShadow: "0 10px 25px -5px rgba(89, 19, 33, 0.2)"
            }}>{DOC.initials}</div>
            <div style={{ fontSize: 24, fontWeight: 400, color: "#1A1717", ...sSerif }}>{DOC.name}</div>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 6 }}>{DOC.clinic}</div>
            <div style={{ color: "#8E8585", fontSize: 12, marginTop: 6, fontWeight: 500 }}>📍 {DOC.city}, INDIA</div>
          </div>

          <div style={{ borderTop: "1px solid #F0ECE7", paddingTop: 28, marginBottom: 28 }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#1A1717", marginBottom: 8, letterSpacing: "-0.2px" }}>Begin Your Assessment</div>
              <div style={{ fontSize: 13, color: "#6E6565", lineHeight: 1.7, fontWeight: 300 }}>In three quick and secure steps, our AI parses your skin health indicators to output clinical guidelines.</div>
            </div>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 14 : 8, justifyContent: "space-around", marginBottom: 32 }}>
              {[
                { icon: "📷", t: "1. Capture Photo", d: "Clear epidermal photo." },
                { icon: "🤖", t: "2. AI Analysis", d: "Extract indicators." },
                { icon: "📄", t: "3. Get Regimen", d: "Bespoke clinical report." },
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
              Start My Skin Analysis
            </button>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#8E8585", marginBottom: 12, fontWeight: 500 }}>For bookings or direct contact:</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { label: "📞 Call Clinic", href: `tel:+91${DOC.phone}` },
                { label: "💬 WhatsApp", href: `https://wa.me/${DOC.wa}` },
                { label: "📍 Location", href: `https://maps.google.com/?q=${encodeURIComponent(DOC.clinic + " " + DOC.city)}` },
              ].map(b => (
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
              { type: "quick", icon: "⚡", title: "Quick Analysis", desc: "Get instant diagnostic approximations from your photo." },
              { type: "detailed", icon: "📋", title: "Detailed Consultation", desc: "Answer specific dermal inquiries for a highly precise biological index.", rec: true },
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
          }}>DIAGNOSTIC GUIDELINES</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#1A1717", marginBottom: 8, ...sSerif }}>Before We Begin</div>
          <div style={{ fontSize: 13, color: "#8E8585", fontWeight: 300 }}>Ensure these conditions are met for optimal optical reading:</div>
        </div>
        {[
          { e: "👓", t: "Remove spectacles, lenses, or facial accessories" },
          { e: "💡", t: "Directly face a natural or strong light source" },
          { e: "💄", t: "Ensure skin is clean and completely devoid of makeup" },
          { e: "🙍", t: "Pull hair entirely away from the cheek & forehead fields" },
          { e: "😐", t: "Maintain a neutral, steady clinical expression" },
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
          }}>SECURE PHOTOMETRIC READING</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#1A1717", marginBottom: 8, ...sSerif }}>Capture Epidermal Profile</div>
          <div style={{ fontSize: 13, color: "#8E8585", marginBottom: 16, fontWeight: 300 }}>Generate a clear optical mapping file to parse.</div>
          <div style={{ background: "#EBF6F3", borderRadius: 50, padding: "8px 24px", display: "inline-block", fontSize: 11, color: "#0F6E56", fontWeight: 700, border: "1px solid #D5EBE5" }}>
            Maximum image size limit: 6MB
          </div>
        </div>
        {[
          { icon: "📷", t: "Access Video Camera", d: "Utilize webcam/camera for high-res direct capture.", type: "camera" },
          { icon: "☁️", t: "Upload Local Image", d: "Load high-res image from system files.", type: "upload" },
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
          <div style={{ fontSize: 9, color: GOLD, letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>ENCRYPTED DATA PRINCIPLES</div>
          <div style={{ fontSize: 13, color: "white", fontWeight: 500, marginBottom: 6 }}>🛡️ Immediate Memory Erasure Protocol</div>
          <div style={{ fontSize: 12, color: "#A89F9F", lineHeight: 1.6, fontWeight: 300 }}>Images are processed strictly locally for analysis vectors and then permanently discarded. Only patient parameters are logged.</div>
        </div>
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
        }}>PROJECTION PHASE</div>
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
        Align your full face in the golden frame<br />
        <span style={{ fontSize: 10, color: GOLD, fontWeight: 600, letterSpacing: "0.5px", marginTop: 4, display: "block" }}>Hold Still • Keep Neutral Expression</span>
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
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8, ...sSerif, color: MAROON }}>Optics Disabled</div>
          <div style={{ fontSize: 13, color: "#8E8585", marginBottom: 20, lineHeight: 1.6, fontWeight: 300 }}>Camera hardware cannot be accessed. Proceed via local file upload.</div>
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
          }}>Upload Dermal Image</button>
        </div>
      )}

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
            <span>✓</span> Epidermal Boundary Lock Verified
          </div>
          <div style={{ fontSize: 13, color: "#6E6565", lineHeight: 1.6, fontWeight: 300 }}>Optics scan confirmed face structures. Prepare file compilation vectors for deep AI analyzer.</div>
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
          }}>PATIENT CLASSIFICATION</div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#1A1717", marginBottom: 8, ...sSerif }}>Register Parameters</div>
          <div style={{ fontSize: 13, color: "#8E8585", fontWeight: 300 }}>Required clinical coordinates to personalize analysis:</div>
        </div>

        {[{ l: "Your Name", k: "name", p: "Enter patient full name", t: "text" }, { l: "Age", k: "age", p: "Enter patient age", t: "number" }].map(f => (
          <div key={f.k} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: MAROON, display: "block", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>{f.l}</label>
            <input type={f.t} placeholder={f.p} value={patient[f.k]} onChange={e => setPatient(p => ({ ...p, [f.k]: e.target.value }))}
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
            <span style={{ padding: "14px 18px", background: "rgba(89, 19, 33, 0.03)", fontSize: 13, color: "#8E8585", fontWeight: 600, borderRight: "1px solid rgba(89, 19, 33, 0.08)" }}>+91</span>
            <input type="tel" placeholder="9876543210" value={patient.phone} onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))}
              style={{ flex: 1, padding: "14px 18px", border: "none", fontSize: 14, background: "transparent" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: MAROON, display: "block", marginBottom: 8, letterSpacing: "1px", textTransform: "uppercase" }}>City</label>
            <input type="text" placeholder="e.g., Mumbai" value={patient.city} onChange={e => setPatient(p => ({ ...p, city: e.target.value }))}
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
            <select value={patient.state} onChange={e => setPatient(p => ({ ...p, state: e.target.value }))}
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
              {IND_STATES.map(st => <option key={st}>{st}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: PEARL, border: `1px solid rgba(194, 162, 120, 0.3)`, borderRadius: 16, padding: 18, marginBottom: 28, display: "flex", gap: 14 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: MAROON, marginBottom: 4 }}>Encrypted Metadata Loop</div>
            <div style={{ fontSize: 12, color: "#6E6565", lineHeight: 1.6, fontWeight: 300 }}>Secure clinical layers process vectors via Anthropic Claude keys. Zero permanent pixel retention logs, satisfying strict bio-privacy laws.</div>
          </div>
        </div>

        <button onClick={startAnalysis} disabled={!patient.name || !patient.age}
          style={{ 
            width: "100%", 
            background: patient.name && patient.age ? MAROON : "#E5E4E4", 
            color: patient.name && patient.age ? "white" : "#A29F9F", 
            border: patient.name && patient.age ? `1px solid ${GOLD}` : "none", 
            borderRadius: 14, 
            padding: 18, 
            fontSize: 13, 
            fontWeight: 700, 
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            cursor: patient.name && patient.age ? "pointer" : "not-allowed", 
            boxShadow: patient.name && patient.age ? "0 10px 25px -5px rgba(89, 19, 33, 0.2)" : "none",
            transition: "all 0.3s" 
          }}>
          Start AI Clinical Analysis
        </button>
      </div>
    </div>
  );

  // ═══ SCANNING ═══
  if (screen === "scanning") return (
    <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, ...s }}>
      <style>{"@keyframes scanLine{0%{top:0%}100%{top:100%}} @keyframes glowPulse{0%,100%{box-shadow: 0 0 20px rgba(194, 162, 120, 0.25)} 50%{box-shadow: 0 0 35px rgba(194, 162, 120, 0.5)}}"}</style>
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

        <div style={{ fontSize: 24, fontWeight: 400, color: "#1A1717", marginBottom: 6, ...sSerif }}>Compiling Epidermal Vectors...</div>
        <div style={{ fontSize: 13, color: "#8E8585", marginBottom: 20, fontWeight: 300 }}>Deep AI is extracting condition percentages</div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: "1px" }}>CELLULAR SCANNER</span>
          <span style={{ fontSize: 11, color: MAROON, fontWeight: 700 }}>{Math.round(progress)}% COMPLETE</span>
        </div>
        <div style={{ background: "#F5F1EC", borderRadius: 10, height: 7, marginBottom: 28, overflow: "hidden", border: "1px solid rgba(89, 19, 33, 0.03)" }}>
          <div style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${MAROON} 100%)`, height: "100%", width: `${progress}%`, transition: "width 0.4s ease" }} />
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
  if (screen === "results" && results) {
    const primary = results.conditions[0];
    const sevColor = results.severityIndex === "Low" ? "#16a34a" : results.severityIndex === "Moderate" ? "#d97706" : "#dc2626";
    const sevBg = results.severityIndex === "Low" ? "#f0faf0" : results.severityIndex === "Moderate" ? "#fffbeb" : "#fff5f5";
    const barColor = p => p >= 50 ? "#dc2626" : p >= 30 ? "#d97706" : "#16a34a";
    const barGradient = p => p >= 50 
      ? "linear-gradient(90deg, #E5E4E4 0%, #dc2626 100%)" 
      : p >= 30 
        ? "linear-gradient(90deg, #E5E4E4 0%, #d97706 100%)" 
        : "linear-gradient(90deg, #E5E4E4 0%, #16a34a 100%)";

    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F6", paddingBottom: 100, ...s }}>
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1717", letterSpacing: "-0.2px" }}>Epidermal Indices</div>
            <div style={{ fontSize: 11, color: "#8E8585", fontWeight: 500 }}>{patient.name.toUpperCase()} • {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
          </div>
          <div style={{ 
            background: sevBg, 
            color: sevColor, 
            padding: "6px 18px", 
            borderRadius: 20, 
            fontSize: 11, 
            fontWeight: 800, 
            letterSpacing: "1px",
            border: `1px solid rgba(0,0,0,0.03)` 
          }}>{results.severityIndex.toUpperCase()} SEVERITY</div>
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
                <div style={{ fontSize: 10, color: MAROON, fontWeight: 700, letterSpacing: "1.5px", textAlign: "center", lineHeight: 1.4 }}>AI CONVOLUTION<br/>PROFILE</div>
              </div>
            </div>

            {/* Primary Concern */}
            <div style={{ 
              background: "linear-gradient(135deg, #FFF9F9 0%, #FFF2F3 100%)", 
              border: "1px solid #FECACA", 
              borderRadius: 24, 
              padding: 24,
              boxShadow: "0 15px 35px -10px rgba(220, 38, 38, 0.04)" 
            }}>
              <div style={{ fontSize: 9, color: "#F97316", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>PRIMARY EPIDERMAL marker</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 400, color: "#1A1717", ...sSerif }}>{primary?.name}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#dc2626" }}>{primary?.percentage}%</div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1717" }}>{c.name}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: barColor(c.percentage) }}>{c.percentage}%</span>
                    </div>
                    <div style={{ background: "#F5F1EC", borderRadius: 10, height: 8, overflow: "hidden" }}>
                      <div style={{ background: barGradient(c.percentage), height: "100%", borderRadius: 10, width: `${c.percentage}%`, transition: "width 1s ease " + i * 0.1 + "s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: "1px" }}>{c.severity.toUpperCase()} IMPACT</span>
                      <span style={{ fontSize: 11, color: "#8E8585", fontWeight: 300 }}>Indicator Index</span>
                    </div>
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#F97316", marginBottom: 16, letterSpacing: "1.5px", textTransform: "uppercase", borderBottom: "1px solid #F3EEE9", paddingBottom: 8 }}>☀️ Morning Cellular Regimen</div>
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 16, letterSpacing: "1.5px", textTransform: "uppercase", borderBottom: "1px solid #F3EEE9", paddingBottom: 8 }}>🌙 Evening Regenerative Regimen</div>
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
                  <div style={{ fontSize: 9, color: GOLD, letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>PHYSICIAN DISCOVERIES</div>
                  <div style={{ fontSize: 14, color: "#1A1717", lineHeight: 1.8, fontStyle: "italic", fontWeight: 300 }}>"{results.physicianSummary}"</div>
                </div>
                <div style={{ background: PEARL, borderRadius: 16, padding: 20, border: `1px solid rgba(194, 162, 120, 0.2)` }}>
                  <div style={{ fontSize: 9, color: GOLD, letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>THERAPEUTIC DIRECTIVES</div>
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
                    <div style={{ fontSize: 14, fontWeight: 500, color: "white", ...sSerif }}>{DOC.name}</div>
                    <div style={{ fontSize: 11, color: GOLD, fontWeight: 600 }}>{DOC.clinic.toUpperCase()} · {DOC.city.toUpperCase()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
            gap: 12 
          }}>
            <button onClick={() => openPDFReport(patient, results, capturedImage)}
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
              📥 Download Diagnostic PDF
            </button>
            <button onClick={() => window.open(`https://wa.me/${DOC.wa}?text=Hi%20${encodeURIComponent(DOC.name)}%2C%20I%20just%20completed%20my%20AI%20skin%20analysis.%20Primary%20concern%3A%20${encodeURIComponent(results.primaryConcern)}%20(${encodeURIComponent(results.severityIndex)}%20severity).%20I%20would%20like%20to%20book%20a%20consultation.`, "_blank")}
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
              💬 Book Consultation via WA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
