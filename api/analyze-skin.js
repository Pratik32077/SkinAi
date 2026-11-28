import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { env } from 'node:process'

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024
const MAX_REQUEST_LENGTH = 4_000_000
const GEMINI_TIMEOUT_MS = 26_000
const MAX_TOTAL_RETRY_MS = 48_000
const RETRY_BASE_DELAY_MS = 1_400
const RETRY_MAX_DELAY_MS = 6_500
const MAX_ATTEMPTS_PRIMARY = 2
const MAX_ATTEMPTS_FALLBACK = 3
const PRIMARY_MODEL = 'gemini-4-hydrogen'
const LITE_MODEL = 'gemini-3.1-flash-lite'
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_SEVERITIES = new Set(['Mild', 'Moderate', 'Severe'])
const ALLOWED_EYEWEAR = new Set(['none', 'glasses', 'sunglasses', 'uncertain'])
const ALLOWED_QUALITY_ISSUES = new Set([
  'none',
  'too_far',
  'heavily_blurred',
  'poor_lighting',
  'face_covered',
  'low_resolution',
])
const OBSERVATION_NAMES = [
  'Acne and blemishes',
  'Hyperpigmentation',
  'Dark circles',
  'Enlarged pores',
  'Fine lines',
]

const EYEWEAR_REPORT_NOTE =
  'Eyewear detected: Glasses may have obstructed parts of the facial region, particularly the eye and under-eye areas. Observations in these regions may be less reliable. A new photograph without glasses is recommended.'

const VALIDATION_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'hasHumanFace',
    'detectedSubject',
    'isFaceSufficientlyVisible',
    'qualitySuitable',
    'qualityIssues',
    'lighting',
    'clarity',
    'framing',
    'eyewearDetected',
    'eyewearConfidenceNote',
    'rejectionReason',
  ],
  properties: {
    hasHumanFace: {
      type: Type.BOOLEAN,
      description: 'True only if a real human face is clearly present in the photo. False for objects, animals, screens, landscapes, hands only, or illustrations.',
    },
    detectedSubject: {
      type: Type.STRING,
      description: 'Short factual description of the main subject in the image under 80 characters.',
    },
    isFaceSufficientlyVisible: {
      type: Type.BOOLEAN,
      description: 'True if forehead, cheeks, nose, chin, and facial skin are sufficiently visible for preliminary visual screening.',
    },
    qualitySuitable: {
      type: Type.BOOLEAN,
      description: 'True if lighting, focus, distance, and visibility allow preliminary facial skin observations.',
    },
    qualityIssues: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [...ALLOWED_QUALITY_ISSUES],
      },
    },
    lighting: {
      type: Type.STRING,
      description: 'Concise lighting description under 80 characters.',
    },
    clarity: {
      type: Type.STRING,
      description: 'Concise sharpness/focus description under 80 characters.',
    },
    framing: {
      type: Type.STRING,
      description: 'Concise distance/framing description under 80 characters.',
    },
    eyewearDetected: {
      type: Type.STRING,
      enum: [...ALLOWED_EYEWEAR],
      description: 'Use glasses for clear/prescription eyeglasses, sunglasses for dark/tinted eyewear, none if clearly absent, uncertain if lighting/angle prevents certainty.',
    },
    eyewearConfidenceNote: {
      type: Type.STRING,
      description: 'Short note about eyewear visibility under 180 characters.',
    },
    rejectionReason: {
      type: Type.STRING,
      nullable: true,
      description: 'Friendly explanation if face is missing or image quality is unsuitable; null when suitable.',
    },
  },
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'faceDetected',
    'skinType',
    'primaryConcern',
    'summary',
    'imageQuality',
    'eyewearDetected',
    'conditions',
    'morningRoutine',
    'eveningRoutine',
    'followUpAdvice',
  ],
  properties: {
    faceDetected: {
      type: Type.BOOLEAN,
      description: 'True only if a real human face is visible. False for non-face subjects.',
    },
    skinType: {
      type: Type.STRING,
      enum: ['Oily', 'Dry', 'Combination', 'Normal', 'Unable to assess'],
    },
    primaryConcern: {
      type: Type.STRING,
      description: 'Concise primary visible observation title under 100 characters.',
    },
    summary: {
      type: Type.STRING,
      description: 'Cautious preliminary visual summary under 800 characters.',
    },
    imageQuality: {
      type: Type.OBJECT,
      required: ['lighting', 'clarity', 'framing', 'limitations'],
      properties: {
        lighting: { type: Type.STRING, description: 'Concise lighting assessment under 80 characters.' },
        clarity: { type: Type.STRING, description: 'Concise clarity/focus assessment under 80 characters.' },
        framing: { type: Type.STRING, description: 'Concise facial framing assessment under 80 characters.' },
        limitations: {
          type: Type.ARRAY,
          description: 'Up to 4 brief factual image limitations observed, or empty array if none.',
          items: { type: Type.STRING },
        },
      },
    },
    eyewearDetected: {
      type: Type.STRING,
      enum: [...ALLOWED_EYEWEAR],
      description: 'glasses if eyeglasses are clearly visible, sunglasses if dark/tinted eyewear, none if clearly absent, uncertain if unsure.',
    },
    conditions: {
      type: Type.ARRAY,
      description: 'Exactly 5 observations matching the required observation names.',
      items: {
        type: Type.OBJECT,
        required: ['name', 'assessable', 'visualScore', 'severity', 'description'],
        properties: {
          name: { type: Type.STRING, enum: OBSERVATION_NAMES },
          assessable: {
            type: Type.BOOLEAN,
            description: 'True if the region/feature is sufficiently visible to estimate; false if obscured, blurred, or unassessable.',
          },
          visualScore: {
            type: Type.INTEGER,
            nullable: true,
            description: 'Approximate visual indicator from 0 to 100 based solely on visible image features when assessable is true; MUST be null when assessable is false.',
          },
          severity: {
            type: Type.STRING,
            enum: [...ALLOWED_SEVERITIES],
            nullable: true,
            description: 'Approximate qualitative indicator (Mild, Moderate, Severe) when assessable; null when not assessable or minimal.',
          },
          description: {
            type: Type.STRING,
            description: 'Concise explanation under 400 characters distinguishing visible features from image-quality limitations.',
          },
        },
      },
    },
    morningRoutine: {
      type: Type.ARRAY,
      description: '2 to 5 concise non-prescription morning skincare steps, each under 250 characters.',
      items: { type: Type.STRING },
    },
    eveningRoutine: {
      type: Type.ARRAY,
      description: '2 to 5 concise non-prescription evening skincare steps, each under 250 characters.',
      items: { type: Type.STRING },
    },
    followUpAdvice: {
      type: Type.STRING,
      description: 'Cautious follow-up guidance under 800 characters encouraging dermatologist review.',
    },
  },
}

function isText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function logDiagnostic(event, details) {
  console.info(JSON.stringify({ event, ...details }))
}

function sendError(res, requestId, status, message, extra = {}) {
  return res.status(status).json({ error: message, requestId, ...extra })
}

function isRetryableGeminiError(error) {
  const status = Number.isInteger(error?.status) ? error.status : undefined
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true
  }
  const code = error?.code ?? error?.cause?.code
  return (
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError' ||
    ['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)
  )
}

function shouldSwitchModelImmediately(error) {
  const status = Number.isInteger(error?.status) ? error.status : undefined
  return status === 429 || status === 503 || status === 404
}

function computeBackoffWithJitter(attempt, baseMs = RETRY_BASE_DELAY_MS) {
  const exponentialDelay = Math.min(RETRY_MAX_DELAY_MS, baseMs * 2 ** (attempt - 1))
  const jitter = Math.floor(Math.random() * 450)
  return exponentialDelay + jitter
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function hasValidImageSignature(mimeType, bytes) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  }
  return (
    mimeType === 'image/webp' &&
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
}

function getResponseText(response) {
  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim()
  }

  return (response.candidates?.[0]?.content?.parts || [])
    .map(part => part.text)
    .filter(text => typeof text === 'string' && text.trim())
    .join('\n')
    .trim()
}

function parseGeminiJSON(text) {
  let candidate = text.replace(/^\uFEFF/, '').trim()
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) {
    candidate = fenced[1].trim()
  }

  try {
    return JSON.parse(candidate)
  } catch (directParseError) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) {
      throw directParseError
    }
    return JSON.parse(candidate.slice(start, end + 1))
  }
}

function buildValidationResponse(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The image validation response was invalid.')
  }

  const hasHumanFace = raw.hasHumanFace === true
  const isFaceSufficientlyVisible = raw.isFaceSufficientlyVisible === true
  const qualitySuitable = raw.qualitySuitable === true
  const eyewearDetected = ALLOWED_EYEWEAR.has(raw.eyewearDetected) ? raw.eyewearDetected : 'uncertain'
  const qualityIssues = Array.isArray(raw.qualityIssues)
    ? raw.qualityIssues.filter(issue => ALLOWED_QUALITY_ISSUES.has(issue) && issue !== 'none')
    : []

  const lighting = isText(raw.lighting, 120) ? raw.lighting.trim() : 'Assessed'
  const clarity = isText(raw.clarity, 120) ? raw.clarity.trim() : 'Assessed'
  const framing = isText(raw.framing, 120) ? raw.framing.trim() : 'Assessed'
  const detectedSubject = isText(raw.detectedSubject, 120) ? raw.detectedSubject.trim() : 'Image subject'

  if (!hasHumanFace) {
    return {
      approved: false,
      code: 'NO_FACE',
      hasHumanFace: false,
      detectedSubject,
      isFaceSufficientlyVisible: false,
      qualitySuitable: false,
      qualityIssues,
      lighting,
      clarity,
      framing,
      eyewearDetected: 'none',
      title: 'No human face detected.',
      message:
        'DermaLens AI can analyze facial skin images only. Please upload or capture a clear photograph of your face.',
      eyewearNote: null,
      qualityWarning: null,
    }
  }

  if (eyewearDetected === 'sunglasses') {
    return {
      approved: false,
      code: 'SUNGLASSES_DETECTED',
      hasHumanFace: true,
      detectedSubject,
      isFaceSufficientlyVisible: false,
      qualitySuitable: false,
      qualityIssues: [...new Set([...qualityIssues, 'face_covered'])],
      lighting,
      clarity,
      framing,
      eyewearDetected,
      title: 'Dark eyewear obscures facial skin',
      message:
        'Sunglasses or tinted lenses cover the eyes and under-eye skin. Please remove your glasses and capture a clear, front-facing photograph of your face.',
      eyewearNote: EYEWEAR_REPORT_NOTE,
      qualityWarning: null,
    }
  }

  if (!isFaceSufficientlyVisible || !qualitySuitable) {
    const fallbackReason =
      'The face is not sufficiently clear or visible for preliminary skin observations. Please capture a well-lit, front-facing photo at a comfortable distance.'
    return {
      approved: false,
      code: 'UNSUITABLE_QUALITY',
      hasHumanFace: true,
      detectedSubject,
      isFaceSufficientlyVisible,
      qualitySuitable,
      qualityIssues,
      lighting,
      clarity,
      framing,
      eyewearDetected,
      title: 'Image quality is not suitable for analysis',
      message: isText(raw.rejectionReason, 350) ? raw.rejectionReason.trim() : fallbackReason,
      eyewearNote: eyewearDetected === 'glasses' ? EYEWEAR_REPORT_NOTE : null,
      qualityWarning: null,
    }
  }

  return {
    approved: true,
    code: eyewearDetected === 'glasses' ? 'EYEWEAR_WARNING' : eyewearDetected === 'uncertain' ? 'QUALITY_WARNING' : 'PASSED',
    hasHumanFace: true,
    detectedSubject,
    isFaceSufficientlyVisible: true,
    qualitySuitable: true,
    qualityIssues,
    lighting,
    clarity,
    framing,
    eyewearDetected,
    title: eyewearDetected === 'glasses' ? 'Eyewear detected' : 'Face verified',
    message:
      eyewearDetected === 'glasses'
        ? 'For better skin analysis, please remove your glasses and capture a clear, front-facing photograph of your face. Glasses may obstruct the eye and under-eye regions.'
        : 'Human face and image quality verified.',
    eyewearNote: eyewearDetected === 'glasses' ? EYEWEAR_REPORT_NOTE : null,
    qualityWarning:
      eyewearDetected === 'uncertain'
        ? 'Visibility around the eye or facial contours could not be fully confirmed. Ensure even lighting and an unobstructed front-facing pose for best results.'
        : qualityIssues.length > 0 && isText(raw.eyewearConfidenceNote, 240)
          ? raw.eyewearConfidenceNote.trim()
          : null,
  }
}

function validateResult(result, clientContext = {}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('The AI response did not contain a valid assessment.')
  }

  if (result.faceDetected === false) {
    const err = new Error('No human face detected.')
    err.code = 'NO_FACE'
    throw err
  }

  const allowedSkinTypes = new Set(['Oily', 'Dry', 'Combination', 'Normal', 'Unable to assess'])
  if (!allowedSkinTypes.has(result.skinType)) {
    throw new Error('The AI response contained an invalid skin classification.')
  }
  if (!isText(result.primaryConcern, 140) || !isText(result.summary, 1000)) {
    throw new Error('The AI response was incomplete.')
  }
  if (
    !Array.isArray(result.conditions) ||
    result.conditions.length !== OBSERVATION_NAMES.length ||
    !Array.isArray(result.morningRoutine) ||
    result.morningRoutine.length < 1 ||
    result.morningRoutine.length > 6 ||
    !Array.isArray(result.eveningRoutine) ||
    result.eveningRoutine.length < 1 ||
    result.eveningRoutine.length > 6 ||
    !isText(result.followUpAdvice, 1000)
  ) {
    throw new Error('The AI response was incomplete.')
  }

  const conditions = OBSERVATION_NAMES.map(name => {
    const condition = result.conditions.find(item => item?.name === name)
    if (!condition || !isText(condition.description, 500)) {
      throw new Error('The AI response was missing a skin observation.')
    }
    if (condition.severity != null && !ALLOWED_SEVERITIES.has(condition.severity)) {
      throw new Error('The AI response contained an invalid severity estimate.')
    }

    const assessable = condition.assessable !== false
    let visualScore = null
    if (assessable && condition.visualScore != null) {
      const numeric = Number(condition.visualScore)
      if (!Number.isFinite(numeric)) {
        throw new Error('The AI response contained an invalid visual score.')
      }
      visualScore = Math.max(0, Math.min(100, Math.round(numeric)))
    }

    return {
      name,
      assessable: assessable && visualScore !== null,
      visualScore,
      description: condition.description.trim(),
      ...(assessable && condition.severity ? { severity: condition.severity } : {}),
    }
  })

  const validateRoutine = routine => {
    if (routine.some(step => !isText(step, 300))) {
      throw new Error('The AI response contained an invalid routine step.')
    }
    return routine.map(step => step.trim())
  }

  const rawQuality = result.imageQuality && typeof result.imageQuality === 'object' ? result.imageQuality : {}
  const limitations = Array.isArray(rawQuality.limitations)
    ? rawQuality.limitations.filter(item => isText(item, 200)).map(item => item.trim()).slice(0, 6)
    : []

  const detectedEyewear = ALLOWED_EYEWEAR.has(result.eyewearDetected)
    ? result.eyewearDetected
    : ALLOWED_EYEWEAR.has(clientContext.eyewearDetected)
      ? clientContext.eyewearDetected
      : 'uncertain'

  const effectiveEyewear =
    clientContext.eyewearDetected === 'glasses' || detectedEyewear === 'glasses'
      ? 'glasses'
      : detectedEyewear

  return {
    faceDetected: true,
    skinType: result.skinType,
    primaryConcern: result.primaryConcern.trim().slice(0, 120),
    summary: result.summary.trim(),
    imageQuality: {
      lighting: isText(rawQuality.lighting, 120) ? rawQuality.lighting.trim() : clientContext.lighting || 'Assessed',
      clarity: isText(rawQuality.clarity, 120) ? rawQuality.clarity.trim() : clientContext.clarity || 'Assessed',
      framing: isText(rawQuality.framing, 120) ? rawQuality.framing.trim() : clientContext.framing || 'Assessed',
      limitations,
    },
    eyewearDetected: effectiveEyewear,
    eyewearNote: effectiveEyewear === 'glasses' ? EYEWEAR_REPORT_NOTE : null,
    conditions,
    morningRoutine: validateRoutine(result.morningRoutine),
    eveningRoutine: validateRoutine(result.eveningRoutine),
    followUpAdvice: result.followUpAdvice.trim(),
  }
}

function buildRequestForModel(model, contents, baseConfig) {
  const thinkingLevel = model === LITE_MODEL ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW
  return {
    model,
    contents,
    config: {
      ...baseConfig,
      thinkingConfig: { thinkingLevel },
    },
  }
}

async function callGeminiWithFallback(apiKey, models, contents, baseConfig, requestId, action) {
  const startedAt = Date.now()
  const genAI = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: GEMINI_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })

  let lastError
  let lastModel = models[0]

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    const hasFallback = i < models.length - 1
    lastModel = model
    const maxAttemptsOnModel = hasFallback ? MAX_ATTEMPTS_PRIMARY : MAX_ATTEMPTS_FALLBACK

    for (let attempt = 1; attempt <= maxAttemptsOnModel; attempt++) {
      try {
        const response = await genAI.models.generateContent(
          buildRequestForModel(model, contents, baseConfig),
        )
        return { response, modelUsed: model }
      } catch (attemptError) {
        lastError = attemptError
        const elapsedMs = Date.now() - startedAt
        const status = Number.isInteger(attemptError?.status) ? attemptError.status : undefined

        // Fail fast on non-retryable client/authentication errors (400, 401, 403)
        if (!isRetryableGeminiError(attemptError) && status !== 404) {
          attemptError.modelUsed = model
          throw attemptError
        }

        // If the model is unsupported (404), switch immediately to fallback if available
        if (status === 404) {
          if (hasFallback) {
            logDiagnostic('gemini_model_fallback', {
              requestId,
              action,
              fromModel: model,
              toModel: models[i + 1],
              status,
              elapsedMs,
            })
            break
          }
          attemptError.modelUsed = model
          throw attemptError
        }

        // On rate-limit (429) or high demand (503) on the primary model, back off with jitter and switch to the fallback model
        if (hasFallback && shouldSwitchModelImmediately(attemptError)) {
          const delayMs = computeBackoffWithJitter(1)
          if (elapsedMs + delayMs >= MAX_TOTAL_RETRY_MS) {
            attemptError.modelUsed = model
            throw attemptError
          }
          logDiagnostic('gemini_model_fallback', {
            requestId,
            action,
            fromModel: model,
            toModel: models[i + 1],
            status,
            delayMs,
            elapsedMs,
          })
          await sleep(delayMs)
          break
        }

        if (attempt >= maxAttemptsOnModel || elapsedMs >= MAX_TOTAL_RETRY_MS) {
          if (hasFallback && elapsedMs < MAX_TOTAL_RETRY_MS) {
            logDiagnostic('gemini_model_fallback', {
              requestId,
              action,
              fromModel: model,
              toModel: models[i + 1],
              status,
              errorName: typeof attemptError?.name === 'string' ? attemptError.name : undefined,
              elapsedMs,
            })
            break
          }
          attemptError.modelUsed = model
          throw attemptError
        }

        const delayMs = computeBackoffWithJitter(attempt)
        if (elapsedMs + delayMs >= MAX_TOTAL_RETRY_MS) {
          if (hasFallback) {
            logDiagnostic('gemini_model_fallback', {
              requestId,
              action,
              fromModel: model,
              toModel: models[i + 1],
              status,
              elapsedMs,
            })
            break
          }
          attemptError.modelUsed = model
          throw attemptError
        }

        logDiagnostic('gemini_transient_retry', {
          requestId,
          action,
          model,
          attempt,
          delayMs,
          elapsedMs,
          errorName: typeof attemptError?.name === 'string' ? attemptError.name : undefined,
          status,
        })
        await sleep(delayMs)
      }
    }
  }

  if (lastError && typeof lastError === 'object') {
    lastError.modelUsed = lastModel
  }
  throw lastError
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const requestId = randomUUID()
  res.setHeader('X-Request-Id', requestId)

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return sendError(res, requestId, 405, 'Method not allowed.')
  }

  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    logDiagnostic('gemini_configuration_missing', { requestId })
    return sendError(res, requestId, 503, 'AI analysis is not configured on this deployment.')
  }

  let body = req.body
  if (Buffer.isBuffer(body)) {
    body = body.toString('utf8')
  }
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return sendError(res, requestId, 400, 'Invalid JSON request body.')
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendError(res, requestId, 400, 'Invalid JSON request body.')
  }

  const action = body?.action === 'validate' ? 'validate' : 'analyze'
  const image = body?.image
  if (typeof image !== 'string' || image.length > MAX_REQUEST_LENGTH) {
    return sendError(res, requestId, 413, 'The image is too large to analyze. Please choose a smaller image.')
  }

  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match || !ALLOWED_MIME_TYPES.has(match[1])) {
    return sendError(res, requestId, 400, 'Please upload a valid JPEG, PNG, or WebP image.')
  }

  const imageBytes = Buffer.from(match[2], 'base64')
  if (imageBytes.toString('base64') !== match[2]) {
    return sendError(res, requestId, 400, 'The uploaded image data is invalid.')
  }
  if (imageBytes.length === 0 || imageBytes.length > MAX_IMAGE_BYTES) {
    return sendError(res, requestId, 413, 'The image is too large to analyze. Please choose a smaller image.')
  }
  if (!hasValidImageSignature(match[1], imageBytes)) {
    return sendError(res, requestId, 400, 'The image contents do not match the selected image format.')
  }

  const candidateModels =
    action === 'validate' ? [LITE_MODEL, PRIMARY_MODEL] : [PRIMARY_MODEL, LITE_MODEL]

  logDiagnostic('gemini_analysis_started', {
    requestId,
    action,
    model: candidateModels[0],
    mimeType: match[1],
    imageBytes: imageBytes.length,
  })

  const validationPrompt = `Inspect this image strictly for facial skin screening suitability before skin analysis.
1. Determine whether a real human face is visible (hasHumanFace). Reject non-human objects, phones, laptops, tables, vehicles, animals, food, landscapes, illustrations, or body parts without a face.
2. Determine if the face is sufficiently visible (forehead, cheeks, nose, chin, under-eye region) and whether image quality is suitable (not too far away, not heavily blurred, not extremely dark/backlit, not heavily covered).
3. Detect eyewear: set eyewearDetected to "glasses" if clear/prescription eyeglasses are clearly visible, "sunglasses" if dark/tinted eyewear covers the eyes, "none" if clearly absent, or "uncertain" if unsure. Never claim glasses are detected when uncertain.
4. If rejected, write a concise, polite rejectionReason explaining why (e.g., blurred, poor lighting, too far away, face covered).`

  const analysisPrompt = `Analyze only visible facial skin features in the provided image for a preliminary, non-diagnostic educational screening report.
1. First verify faceDetected: if there is no real human face in the image, set faceDetected to false and do not fabricate observations.
2. Assess imageQuality (lighting, clarity, framing, limitations) and eyewearDetected ("none", "glasses", "sunglasses", or "uncertain").
3. Return all five exact observation names from the schema: "Acne and blemishes", "Hyperpigmentation", "Dark circles", "Enlarged pores", and "Fine lines".
4. For each observation:
   - If the feature is clearly visible, set assessable to true, provide a grounded approximate visualScore (integer 0-100 representing visual prominence only, never a medical severity diagnosis), an approximate severity ("Mild", "Moderate", or "Severe"), and a brief explanation.
   - If the feature cannot be reliably assessed due to poor lighting, grayscale, blur, framing, or eyewear obstruction, set assessable to false, visualScore to null, severity to null, and explain the limitation in description. Never invent or guess scores when uncertain.
5. Provide a cautious summary, 2-5 general non-prescription morning and evening skincare routine steps, and follow-up advice encouraging evaluation by a qualified dermatologist.`

  const contents = [
    {
      role: 'user',
      parts: [
        { text: action === 'validate' ? validationPrompt : analysisPrompt },
        { inlineData: { mimeType: match[1], data: match[2] } },
      ],
    },
  ]

  const baseConfig =
    action === 'validate'
      ? {
          systemInstruction:
            'You are a strict image-quality and face-detection validator for a facial skin screening app. Be accurate, conservative, and never invent features.',
          responseMimeType: 'application/json',
          responseSchema: VALIDATION_SCHEMA,
        }
      : {
          systemInstruction:
            'You are a cautious dermatology-education visual assistant. Provide preliminary, non-diagnostic observations based only on visible facial image features. Never fabricate scores for obscured or unassessable areas. Keep every field concise and within schema limits.',
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        }

  let response
  let modelUsed
  try {
    const result = await callGeminiWithFallback(
      apiKey,
      candidateModels,
      contents,
      baseConfig,
      requestId,
      action,
    )
    response = result.response
    modelUsed = result.modelUsed
  } catch (error) {
    modelUsed = error?.modelUsed || candidateModels[0]
    const status = Number.isInteger(error?.status) ? error.status : undefined
    const rawCode = error?.code ?? error?.cause?.code
    const code = typeof rawCode === 'string' ? rawCode.slice(0, 60) : undefined
    const rawMessage = typeof error?.message === 'string' ? error.message : ''
    const safeErrorMessage = rawMessage.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED]').slice(0, 300)
    const timedOut =
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError' ||
      ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(code)
    logDiagnostic('gemini_request_failed', {
      requestId,
      action,
      model: modelUsed,
      status,
      code,
      errorName: typeof error?.name === 'string' ? error.name : 'Error',
      errorMessage: safeErrorMessage || undefined,
    })
    if (status === 429) {
      return sendError(
        res,
        requestId,
        429,
        'Gemini is temporarily rate limited. Please wait a few moments and retry—your uploaded image and details are preserved.',
      )
    }
    if (status === 503) {
      return sendError(
        res,
        requestId,
        503,
        'Gemini is temporarily experiencing high demand. Please retry in a few moments—your uploaded image and details are preserved.',
      )
    }
    if (status === 500) {
      return sendError(
        res,
        requestId,
        502,
        'Gemini encountered a temporary internal server error. Please retry in a few moments.',
      )
    }
    if (status === 400) {
      if (/API_KEY_INVALID|API key not valid/i.test(rawMessage)) {
        return sendError(res, requestId, 502, 'AI service authentication failed on the server. Please verify GEMINI_API_KEY.')
      }
      return sendError(res, requestId, 400, 'Gemini could not process this image request. Please try a different JPEG, PNG, or WebP photo.')
    }
    if (status === 404) {
      return sendError(res, requestId, 502, 'The configured Gemini model is unavailable. Please contact the site administrator.')
    }
    if (status === 401 || status === 403) {
      return sendError(res, requestId, 502, 'AI service authentication failed on the server. Please verify GEMINI_API_KEY.')
    }
    if (timedOut || status === 504) {
      return sendError(res, requestId, 504, 'Gemini analysis timed out. Please retry—your uploaded image and details are preserved.')
    }
    return sendError(res, requestId, 502, 'Gemini could not complete the skin assessment. Please retry.')
  }

  if (!response || typeof response !== 'object') {
    logDiagnostic('gemini_empty_response', { requestId, action, model: modelUsed })
    return sendError(res, requestId, 502, 'Gemini returned an empty assessment. Please try again.')
  }

  const candidate = response.candidates?.[0]
  const finishReason = candidate?.finishReason
  const blockReason = response.promptFeedback?.blockReason
  const text = getResponseText(response)
  logDiagnostic('gemini_response_received', {
    requestId,
    action,
    model: modelUsed,
    candidateCount: response.candidates?.length || 0,
    finishReason,
    blockReason,
    responseTextLength: text.length,
  })

  if (
    blockReason ||
    ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(finishReason)
  ) {
    return sendError(res, requestId, 422, 'Gemini could not assess this image. Please try a different image.')
  }
  if (finishReason === 'MAX_TOKENS') {
    return sendError(res, requestId, 502, 'Gemini’s response exceeded its output limit. Please try again.')
  }
  if (!text) {
    return sendError(res, requestId, 502, 'Gemini returned an empty assessment. Please try again.')
  }

  let parsed
  try {
    parsed = parseGeminiJSON(text)
  } catch (error) {
    logDiagnostic('gemini_json_parse_failed', {
      requestId,
      action,
      model: modelUsed,
      responseTextLength: text.length,
      errorName: typeof error?.name === 'string' ? error.name : 'Error',
    })
    return sendError(res, requestId, 502, 'Gemini returned invalid JSON. Please try again.')
  }

  if (action === 'validate') {
    try {
      const validation = buildValidationResponse(parsed)
      logDiagnostic('gemini_validation_completed', {
        requestId,
        model: modelUsed,
        approved: validation.approved,
        code: validation.code,
        hasHumanFace: validation.hasHumanFace,
        eyewearDetected: validation.eyewearDetected,
      })
      return res.status(200).json({ validation, requestId })
    } catch (error) {
      logDiagnostic('gemini_validation_schema_failed', {
        requestId,
        model: modelUsed,
        reason: typeof error?.message === 'string' ? error.message : 'Invalid validation schema',
      })
      return sendError(res, requestId, 502, 'Unable to validate the uploaded image. Please try again.')
    }
  }

  try {
    const clientContext =
      body?.validationContext && typeof body.validationContext === 'object' ? body.validationContext : {}
    const result = validateResult(parsed, clientContext)
    logDiagnostic('gemini_assessment_validated', {
      requestId,
      model: modelUsed,
      conditionCount: result.conditions.length,
      morningStepCount: result.morningRoutine.length,
      eveningStepCount: result.eveningRoutine.length,
    })
    return res.status(200).json({ result, requestId })
  } catch (error) {
    if (error?.code === 'NO_FACE') {
      logDiagnostic('gemini_non_face_rejected', { requestId, model: modelUsed })
      return sendError(
        res,
        requestId,
        422,
        'No human face detected. DermaLens AI can analyze facial skin images only. Please upload or capture a clear photograph of your face.',
        { code: 'NO_FACE' },
      )
    }
    logDiagnostic('gemini_result_validation_failed', {
      requestId,
      model: modelUsed,
      reason: typeof error?.message === 'string' ? error.message : 'Invalid result schema',
    })
    return sendError(res, requestId, 502, 'Gemini returned an incomplete assessment. Please try again.')
  }
}
