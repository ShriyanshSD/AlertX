import AIActivity from '../models/AIActivity.js';
import AIConversation from '../models/AIConversation.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { retrieveKnowledge } from '../services/knowledgeRetrieval.js';

const emergencyMatchers = [
  { type: 'fire', pattern: /\b(fire|smoke|burning|flames|house is on fire)\b/i },
  { type: 'accident', pattern: /\b(crash|collision|road accident|car accident|traffic accident)\b/i },
  { type: 'personal_safety', pattern: /\b(threat|being followed|unsafe|attacked|harassed|personal safety)\b/i },
  { type: 'medical', pattern: /\b(injur|bleed|unconscious|not breathing|chest pain|overdose|seizure|ambulance|medical emergency|hurt)\b/i },
];
const greetingPattern = /^(?:(?:hi|hello|hey|howdy)(?:\s+(?:there|resq|resq ai))?|good (?:morning|afternoon|evening)|how are you)[.!?,\s]*$/i;
const greetingAnswer = "Hi! I'm ResQ AI Assistant. I can help with first-aid basics, fire and road safety, personal safety, SOS, and trusted contacts. What would you like help with? For urgent danger, contact your local emergency services now. ResQ cannot place calls or dispatch a vehicle.";

function classifyEmergency(query) {
  return emergencyMatchers.find(({ pattern }) => pattern.test(query))?.type || null;
}

function safeSources(documents) {
  return documents.map((document) => ({
    title: document.title,
    sourceTitle: document.sourceTitle,
    sourceUrl: document.sourceUrl,
    category: document.category,
  }));
}

function groundedFallback(documents) {
  if (!documents.length) {
    return 'I could not find reliable guidance for that question in the ResQ knowledge base, so I will not guess. For urgent danger, contact your local emergency services.';
  }
  return documents.map((document, index) => `[${index + 1}] ${document.content}`).join('\n\n');
}

function generalFallback() {
  return 'I could not find a matching ResQ knowledge-base source, and Gemini is unavailable for a general reply right now. I will not guess about safety or medical guidance. You can ask about first aid, fire or road safety, ResQ SOS, or trusted contacts.';
}

function geminiFailureWarning(error, hasReferences) {
  const reasonByCode = {
    AUTH: 'Gemini rejected the API key or project access. Check the key and Gemini API permissions.',
    MODEL: 'The configured Gemini model was not found or is unavailable. Check GEMINI_MODEL.',
    QUOTA: 'Gemini quota or rate limits were reached. Check the project usage and quota.',
    BAD_REQUEST: 'Gemini rejected the request or configuration. Check the model and API settings.',
    TIMEOUT: 'Gemini did not respond before the timeout.',
    NETWORK: 'ResQ could not reach Gemini. Check the server network connection and provider status.',
    SERVICE: 'Gemini is currently reporting a server error.',
    INVALID_RESPONSE: 'Gemini returned an unreadable response.',
    NO_CONTENT: 'Gemini did not return a usable answer; try rephrasing the question.',
    HTTP_ERROR: 'Gemini rejected the request.',
    REQUEST_FAILED: 'ResQ could not complete the Gemini request.',
  };
  const knownCode = Object.hasOwn(reasonByCode, error?.code);
  const reason = knownCode ? reasonByCode[error.code] : 'Gemini could not complete the request.';
  const safeCode = knownCode ? error.code : 'UNKNOWN';
  console.warn(`ResQ Gemini request failed (${safeCode}).`);
  const fallback = hasReferences
    ? 'This reply uses only the cited ResQ knowledge base.'
    : 'No matching ResQ source was found, so no safety guidance was guessed.';
  return `${reason} ${fallback}`;
}

function emergencyAnswer(type, documents) {
  const introduction = type === 'fire'
    ? 'If this is happening now, leave the area by a safe exit and call local emergency services from a safe place. Do not re-enter.'
    : 'If someone is in immediate danger or seriously injured, call local emergency services now and follow the call handler. In India, call 112. ResQ will not call or dispatch automatically.';
  const guidance = documents.length ? `\n\n${groundedFallback(documents)}` : '';
  return `${introduction}${guidance}`;
}

const stressFailureMessages = {
  AUTH: 'Gemini rejected the request. Check the server API key and permissions.',
  MODEL: 'The configured Gemini model is unavailable. Check the server model setting.',
  QUOTA: 'Gemini quota or rate limits were reached. Try again later.',
  BAD_REQUEST: 'Gemini rejected the assessment request. Check the server model configuration.',
  TIMEOUT: 'Gemini did not respond in time. Please try again.',
  NETWORK: 'AlertX could not reach Gemini. Check the server connection.',
  SERVICE: 'Gemini is currently unavailable. Please try again later.',
  INVALID_RESPONSE: 'Gemini returned an unreadable result. No assessment was produced.',
  NO_CONTENT: 'Gemini returned no assessment. Please try again.',
  HTTP_ERROR: 'Gemini rejected the assessment request.',
  REQUEST_FAILED: 'AlertX could not complete the Gemini request.',
};

export const assessStress = asyncHandler(async (request, response) => {
  const provider = request.app.get('geminiService');
  if (typeof provider?.assessStress !== 'function') {
    throw new AppError(503, 'The AI stress check-in is unavailable because Gemini is not configured.');
  }

  let result;
  try {
    result = await provider.assessStress({ answers: request.body.answers });
  } catch (error) {
    const knownCode = Object.hasOwn(stressFailureMessages, error?.code);
    const code = knownCode ? error.code : 'UNKNOWN';
    console.warn(`ResQ Gemini stress assessment failed (${code}).`);
    throw new AppError(503, knownCode
      ? stressFailureMessages[code]
      : 'Gemini could not complete the AI stress check-in. Please try again later.');
  }

  if (!result) {
    throw new AppError(503, 'The AI stress check-in is unavailable because Gemini is not configured.');
  }
  if (!['low', 'moderate', 'high'].includes(result.level)) {
    console.warn('ResQ Gemini stress assessment failed (INVALID_RESPONSE).');
    throw new AppError(502, 'Gemini returned an unreadable result. No assessment was produced.');
  }

  response.json({ data: { level: result.level } });
});

export const getConversation = asyncHandler(async (request, response) => {
  const conversation = await AIConversation.findOne({ userId: request.user._id }).lean();
  response.json({ data: { messages: conversation?.messages || [] } });
});

export const clearConversation = asyncHandler(async (request, response) => {
  await Promise.all([
    AIConversation.deleteOne({ userId: request.user._id }),
    AIActivity.deleteMany({ userId: request.user._id }),
  ]);
  response.json({ data: { cleared: true } });
});

export const chat = asyncHandler(async (request, response) => {
  const isGreeting = greetingPattern.test(request.body.message);
  let documents = [];
  if (!isGreeting) {
    try {
      documents = await retrieveKnowledge(request.body.message);
    } catch {
      throw new AppError(503, 'The emergency knowledge base is unavailable. Please try again; for urgent danger call local emergency services.');
    }
  }

  const emergencyType = isGreeting ? null : classifyEmergency(request.body.message);
  const provider = request.app.get('geminiService');
  let answer;
  let answerProvider = isGreeting ? 'greeting' : 'knowledge_base';
  let warning = '';

  if (isGreeting) {
    answer = greetingAnswer;
  } else if (emergencyType) {
    answer = emergencyAnswer(emergencyType, documents);
  } else {
    try {
      answer = await provider.generate({ query: request.body.message, documents });
    } catch (error) {
      warning = geminiFailureWarning(error, documents.length > 0);
    }
    if (answer) {
      answerProvider = 'gemini';
    } else {
      answer = documents.length ? groundedFallback(documents) : generalFallback();
      if (!warning) {
        warning = documents.length
          ? 'Gemini is not configured. This reply uses only the cited ResQ knowledge base.'
          : 'Gemini is not configured, so general-chat replies are unavailable.';
      }
    }
  }

  const sources = safeSources(documents);
  const activityCategory = documents[0]?.category || 'general';
  await AIActivity.create({
    userId: request.user._id,
    category: activityCategory,
    emergencyRelated: Boolean(emergencyType),
    provider: answerProvider,
  });

  const messages = [
    { role: 'user', content: request.body.message, createdAt: new Date() },
    {
      role: 'assistant',
      content: answer,
      citations: sources,
      emergency: { detected: Boolean(emergencyType), type: emergencyType, offerSos: Boolean(emergencyType), askLocation: Boolean(emergencyType) },
      createdAt: new Date(),
    },
  ];
  if (request.body.saveHistory) {
    const conversation = await AIConversation.findOneAndUpdate(
      { userId: request.user._id },
      { $push: { messages: { $each: messages, $slice: -40 } } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    response.json({
      data: {
        answer,
        citations: sources,
        confidence: documents.length ? documents[0].relevance : 0,
        provider: answerProvider,
        warning,
        emergency: { detected: Boolean(emergencyType), type: emergencyType, offerSos: Boolean(emergencyType), askLocation: Boolean(emergencyType) },
        messages: conversation.messages,
      },
    });
    return;
  }

  response.json({
    data: {
      answer,
      citations: sources,
      confidence: documents.length ? documents[0].relevance : 0,
      provider: answerProvider,
      warning,
      emergency: { detected: Boolean(emergencyType), type: emergencyType, offerSos: Boolean(emergencyType), askLocation: Boolean(emergencyType) },
      messages: null,
    },
  });
});
