import { GoogleGenAI, Type } from '@google/genai'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { env } from 'node:process'

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024
const MAX_REQUEST_LENGTH = 4_000_000
const GEMINI_TIMEOUT_MS = 45_000
const MODEL = 'gemini-3.8-flash'
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_SEVERITIES = new Set(['Mild', 'Moderate', 'Severe'])
const OBSERVATION_NAMES = [
  'Acne and blemishes',
  'Hyperpigmentation',
  'Dark circles',
  'Enlarged pores',
  'Fine lines',
]
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'skinType',
    'primaryConcern',
    'summary',
    'conditions',
    'morningRoutine',
    'eveningRoutine',
    'followUpAdvice',
  ],
  properties: {
    skinType: {
      type: Type.STRING,
      enum: ['Oily', 'Dry', 'Combination', 'Normal', 'Unable to assess'],
    },
    primaryConcern: { type: Type.STRING },
    summary: { type: Type.STRING },
    conditions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['name', 'severity', 'description'],
        properties: {
          name: { type: Type.STRING, enum: OBSERVATION_NAMES },
          severity: { type: Type.STRING, enum: [...ALLOWED_SEVERITIES], nullable: true },
          description: { type: Type.STRING },
        },
      },
    },
    morningRoutine: { type: Type.ARRAY, items: { type: Type.STRING } },
    eveningRoutine: { type: Type.ARRAY, items: { type: Type.STRING } },
    followUpAdvice: { type: Type.STRING },
  },
}

function isText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function logDiagnostic(event, details) {
  console.info(JSON.stringify({ event, ...details }))
}

function sendError(res, requestId, status, message) {
  return res.status(status).json({ error: message, requestId })
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

function validateResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('The AI response did not contain a valid assessment.')
  }

  const allowedSkinTypes = new Set(['Oily', 'Dry', 'Combination', 'Normal', 'Unable to assess'])
  if (!allowedSkinTypes.has(result.skinType)) {
    throw new Error('The AI response contained an invalid skin classification.')
  }
  if (!isText(result.primaryConcern, 120) || !isText(result.summary, 1000)) {
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

    return {
      name,
      description: condition.description.trim(),
      ...(condition.severity ? { severity: condition.severity } : {}),
    }
  })

  const validateRoutine = routine => {
    if (routine.some(step => !isText(step, 300))) {
      throw new Error('The AI response contained an invalid routine step.')
    }
    return routine.map(step => step.trim())
  }

  return {
    skinType: result.skinType,
    primaryConcern: result.primaryConcern.trim(),
    summary: result.summary.trim(),
    conditions,
    morningRoutine: validateRoutine(result.morningRoutine),
    eveningRoutine: validateRoutine(result.eveningRoutine),
    followUpAdvice: result.followUpAdvice.trim(),
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const requestId = randomUUID()
  res.setHeader('X-Request-Id', requestId)

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendError(res, requestId, 405, 'Method not allowed.')
  }

  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    logDiagnostic('gemini_configuration_missing', { requestId })
    return sendError(res, requestId, 503, 'AI analysis is not configured on this deployment.')
  }

  const image = req.body?.image
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

  logDiagnostic('gemini_analysis_started', {
    requestId,
    model: MODEL,
    mimeType: match[1],
    imageBytes: imageBytes.length,
  })

  const prompt = `Describe only visible skin features in the provided image. This is a preliminary AI observation, not a medical diagnosis or medical advice. Do not infer identity or medical history, claim certainty, or recommend prescriptions. Return all five required observations, with exact names from the response schema. If a feature cannot be assessed from image quality or lighting, say so in its description and set severity to null. Severity must be an approximate visual indicator only when supported; never generate percentages.

Also provide a cautious preliminary summary, general non-prescription morning and evening skincare suggestions, and follow-up advice that encourages consulting a qualified dermatologist where appropriate.`

  let response
  try {
    const genAI = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    })
    response = await genAI.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: match[1], data: match[2] } },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 2048,
      },
    })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : undefined
    const code = typeof error?.code === 'string' ? error.code.slice(0, 60) : undefined
    const timedOut =
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError' ||
      ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)
    logDiagnostic('gemini_request_failed', {
      requestId,
      model: MODEL,
      status,
      code,
      errorName: typeof error?.name === 'string' ? error.name : 'Error',
    })
    if (status === 429) {
      return sendError(res, requestId, 429, 'Gemini is temporarily rate limited. Please try again shortly.')
    }
    if (status === 401 || status === 403) {
      return sendError(res, requestId, 502, 'Gemini rejected the server configuration. Please contact the site administrator.')
    }
    if (timedOut) {
      return sendError(res, requestId, 504, 'Gemini analysis timed out. Please try again.')
    }
    return sendError(res, requestId, 502, 'Gemini could not complete the skin assessment. Please try again.')
  }

  if (!response || typeof response !== 'object') {
    logDiagnostic('gemini_empty_response', { requestId, model: MODEL })
    return sendError(res, requestId, 502, 'Gemini returned an empty assessment. Please try again.')
  }

  const candidate = response.candidates?.[0]
  const finishReason = candidate?.finishReason
  const blockReason = response.promptFeedback?.blockReason
  const text = getResponseText(response)
  logDiagnostic('gemini_response_received', {
    requestId,
    model: MODEL,
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
      model: MODEL,
      responseTextLength: text.length,
      errorName: typeof error?.name === 'string' ? error.name : 'Error',
    })
    return sendError(res, requestId, 502, 'Gemini returned invalid JSON. Please try again.')
  }

  try {
    const result = validateResult(parsed)
    logDiagnostic('gemini_assessment_validated', {
      requestId,
      model: MODEL,
      conditionCount: result.conditions.length,
      morningStepCount: result.morningRoutine.length,
      eveningStepCount: result.eveningRoutine.length,
    })
    return res.status(200).json({ result, requestId })
  } catch (error) {
    logDiagnostic('gemini_result_validation_failed', {
      requestId,
      model: MODEL,
      reason: typeof error?.message === 'string' ? error.message : 'Invalid result schema',
    })
    return sendError(res, requestId, 502, 'Gemini returned an incomplete assessment. Please try again.')
  }
}
