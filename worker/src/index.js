// CLOUDFLARE WORKER (WRANGLER) - VERSIÓN COMPLETA
// Archivo: tale-worker.js
// Deploy: wrangler deploy

import { upsertConversation, appendMessage, getConversationBySession } from './supabaseService.js';

// Listener para promesas no manejadas
addEventListener('unhandledrejection', (e) => {
  console.error('🚨 Unhandled promise rejection:', e?.reason);
});

// Palancas de contenido mínimo/máximo
const MIN_WORDS_HARD = 18; // bloqueo duro para avanzar
const MAX_WORDS_HARD = 100; // límite superior por respuesta
const SOFT_TARGETS = [28, 30, 32, 34, 36, 38]; // guía UI/seguimientos (no bloquea)

function countWords(text = '') {
  // Normaliza espacios (incluye saltos de línea y múltiples espacios)
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

// Telemetría ligera (se puede sustituir por Supabase/Make)
async function logEvent(eventName, props = {}) {
  try {
    console.log('[analytics]', eventName, props);
  } catch (_) {}
}

function getTargetFor(relation, qIndex) {
  try {
    const arr = relationshipConfigs?.[relation]?.targetWords || SOFT_TARGETS;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr[Math.min(qIndex || 0, arr.length - 1)] || arr[0];
    }
  } catch {}
  return 30;
}

function trimToWordLimit(text = '', max = MAX_WORDS_HARD) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  const words = normalized ? normalized.split(/\s+/) : [];
  if (words.length <= max) return normalized;
  const clipped = words.slice(0, max).join(' ');
  // intento de corte al final de frase dentro del recorte
  const idx = clipped.lastIndexOf('. ');
  if (idx > Math.floor(max * 0.5)) return clipped.slice(0, idx + 1);
  return clipped;
}

async function generateFollowUpForShortAnswer({
  accumulated,
  remaining,
  relation,
  qIndex,
  apiKey
}) {
  const config = relationshipConfigs[relation] || {};
  const baseNext = config?.questions?.[qIndex] || 'Cuéntame un poco más con ejemplos o detalles sensoriales.';
  const target = SOFT_TARGETS[qIndex] || SOFT_TARGETS[SOFT_TARGETS.length - 1];

  // Prompt IA breve y empático
  const prompt = `Eres Tale (MemoryTale). El usuario empezó a responder pero aún es corto.
Respuesta del usuario (resumen): "${accumulated.slice(0, 260)}"
Escribe 1 frase empática reconociendo lo dicho y pide detalles concretos (sensaciones, lugar, época, personas, diálogos) para enriquecer.
Termina introduciendo la misma pregunta enfocada:
"${baseNext}"
Indica sutilmente: "unas ${remaining} palabras más y seguimos". Máximo 2 frases.`;

  try {
    const out = await generateWithGemini(prompt, apiKey, { temperature: 0.7, maxOutputTokens: 120 });
    if (out && out.trim().length > 3) {
      const total = countWords(accumulated);
      const n = Math.max(0, remaining);
      const soft = n <= 5 ? ` ¡Casi! añade ${n} palabra${n === 1 ? '' : 's'} más y pasamos 😊` : ` añade ${n} más…`;
      const suffix = ` (${total}/${MIN_WORDS_HARD})` + soft;
      return (out.trim() + suffix);
    }
  } catch (e) {
    console.warn('⚠️ Follow-up Gemini falló:', e?.message || e);
  }

  // Fallback sencillo y cálido
  const templates = [
    (next) => `Gracias por compartirlo. ¿Puedes añadir algún detalle más (cuándo fue, dónde, qué sentiste, alguna frase literal)? Con unas ${remaining} palabras más seguimos. ${next}`,
    (next) => `¡Qué bien suena! Para que el libro quede precioso, cuéntame un poco más: sensaciones, diálogos o un momento concreto. Unas ${remaining} palabras más y avanzamos. ${next}`
  ];
  const pick = templates[Math.floor(Math.random() * templates.length)];
  const base = pick(baseNext);
  const total = countWords(accumulated);
  const n = Math.max(0, remaining);
  const soft = n <= 5 ? ` ¡Casi! añade ${n} palabra${n === 1 ? '' : 's'} más y pasamos 😊` : ` añade ${n} más…`;
  return base + ` (${total}/${MIN_WORDS_HARD})` + soft;
}

// Función para generar order_id único
function generateOrderId(relationshipType) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `mt_${relationshipType || 'general'}_${timestamp}_${random}`;
}
// Configuración de Gemini AI - VERSIÓN CORREGIDA

// Helper de reintentos para Gemini con backoff + jitter + timeout
async function generateWithGemini(
  prompt,
  apiKey,
  {
    temperature = 0.7,
    maxOutputTokens = 120,
    attempts = 3,         // ↑ subimos a 3
    backoffMs = 700,      // base backoff
    timeoutMs = 9000      // timeout por intento
  } = {}
) {
  if (!apiKey || apiKey.length < 30) return null;

  let lastErr = null;

  for (let i = 0; i <= attempts; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }]}],
            generationConfig: { temperature, maxOutputTokens }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(t);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn(`⚠️ Gemini no OK (intento ${i + 1}/${attempts + 1}): ${res.status} - ${text}`);
        // Reintentar sólo en 429/503
        if (res.status === 429 || res.status === 503) {
          const jitter = Math.floor(Math.random() * 250);
          await new Promise(r => setTimeout(r, backoffMs * (i + 1) + jitter));
          continue;
        }
        throw new Error(`Gemini API error: ${res.status} - ${text}`);
      }

      const data = await res.json().catch(() => null);
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return out || null;

    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      const jitter = Math.floor(Math.random() * 250);
      console.warn(`⚠️ Error Gemini intento ${i + 1}: ${err?.message || err}`);
      await new Promise(r => setTimeout(r, backoffMs * (i + 1) + jitter));
    }
  }

  console.error('❌ Gemini no disponible tras reintentos:', lastErr?.message || lastErr);
  return null;
}

// --- Anti-meta para basic-info (evitar "paso", "sección", etc.)
const FORBIDDEN_META_RE = /(informaci[oó]n b[aá]sica|secci[oó]n|paso|flujo|completar este paso|rellenar|formulario)/i;
function sanitizeOrFallback(ai, fallback) {
  if (!ai) return fallback;
  const s = String(ai).trim();
  if (!s) return fallback;
  // si menciona cosas “meta” o se va de largo, usa el fallback
  if (FORBIDDEN_META_RE.test(s) || s.length > 180) return fallback;
  return s;
}

// Mostrar intro de onboarding una sola vez al entrar en basic-info
function maybePrependBasicIntro(state, prompt) {
  try {
    if (!state.__basic_intro_shown) {
      state.__basic_intro_shown = true;
      const nombre = state?.userData?.['nombre-destinatario'] || 'esa persona especial';
      const intro = '¡Genial! Vamos a crear algo bonito para ' + nombre +
        '. Te haré 6 preguntas para construir la historia; al terminar verás una previsualización y, si te gusta, podrás comprar el PDF. ' +
        'Suele llegar al email en menos de 15 minutos.';
      return `${intro} ${prompt}`;
    }
  } catch (_) { /* no-op */ }
  return prompt;
}

// Fallback empático sin IA (contextual)
function buildEmpathicTransition(userResponse, nextQuestion) {
  const text = (userResponse || '').trim();
  const s = text.toLowerCase();

  const year = text.match(/\b(19|20)\d{2}\b/);
  const season = text.match(/\b(verano|invierno|primavera|otoño)\b/i);
  // Comillas rectas y tipográficas
  const quoted = (text.match(/["""']([^"""']{3,80})["""']/) || [])[1];

  let line = 'Gracias por compartirlo.';
  if (s.includes('amor') || s.includes('orgullo') || s.includes('abrazo')) line = 'Qué tierno suena.';
  else if (s.includes('risa') || s.includes('divertid')) line = 'Me has sacado una sonrisa.';
  else if (s.includes('miedo') || s.includes('difícil') || s.includes('superar')) line = 'Qué valiente haber pasado por eso.';

  if (season && year) line += ` Ese ${season[0].toLowerCase()} de ${year[0]} os marcó.`;
  else if (year)      line += ` Aquel ${year[0]} quedó grabado.`;
  else if (season)    line += ` Ese ${season[0].toLowerCase()} fue especial.`;

  if (quoted) line += ` Me ha encantado lo de "${quoted}".`;

  // Evitar ladrillos
  const out = `${line} ${nextQuestion}`.replace(/\s+/g, ' ').trim();
  return out.length > 320 ? out.slice(0, 317) + '…' : out;
}

// Configuración de Gemini AI - VERSIÓN CORREGIDA FINAL
async function generateAIResponse(prompt, context = '', apiKey) {
  console.log('🔍 === INICIO DEBUGGING GEMINI ===');
  console.log('🔐 API Key presente:', !!apiKey);
  console.log('🔐 API Key length:', apiKey ? apiKey.length : 0);
  console.log('🔐 API Key válida:', apiKey && apiKey.length > 30);
  console.log('💬 Prompt recibido:', prompt);
  console.log('🌍 Contexto:', context.substring(0, 100) + '...');
  
  // Validación mejorada: solo verificar longitud mínima
  if (!apiKey || apiKey.length < 30) {
    console.log('❌ API Key no válida o muy corta, retornando null para usar fallback');
    return null;
  }
  
  try {
    console.log('🚀 Iniciando llamada a Gemini API...');
    
      const requestBody = {
    contents: [{
      parts: [{
        text: `${context}\n\nUsuario: ${prompt}\n\nResponde de forma empática y natural como Tale, el asistente de MemoryTale. Sé cálido y conciso (máximo 3 frases). Evita mencionar el precio o el tiempo de entrega a menos que la pregunta del usuario o el contexto lo hagan directamente relevante.`
      }]
    }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 200 // Reducido para concisión
    }
  };
    
    console.log('🧾 Request body preparado');
    
    const geminiCall = () => fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });
    
    const response = await callGeminiWithRetry(geminiCall, 2);

    console.log('💡 Status de respuesta Gemini:', response.status);
    console.log('💡 Status text:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('âŒ Error response body:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Respuesta de Gemini recibida correctamente');
    
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('📝 Texto extraído:', generatedText);
    console.log('🔍 === FIN DEBUGGING GEMINI ===');
    
    return generatedText || null;
  } catch (error) {
    console.error('❌ Error completo en generateAIResponse:', error);
    console.log('🔍 === FIN DEBUGGING GEMINI (CON ERROR) ===');
    return null;
  }
}

// CONFIGURACIÓN DE CORS - MEJORADA PARA DEV
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

// CONFIGURACIÓN DE RELACIONES CON DETECCIÓN ROBUSTA
const relationshipConfigs = {
  partner: {
    type: 'partner',
    detectionKeywords: ['pareja', 'novio', 'novia', 'marido', 'mujer', 'esposo', 'esposa', 'amor', 'mi chico', 'mi chica', 'compañero', 'compañera', 'mi amor'],
    questions: [
      '¿Cómo y dónde os conocisteis?',
      '¿Cuándo supiste que era especial y qué admiras más?',
      '¿Qué gestos suyos te derriten cada día?',
      '¿Cómo has cambiado gracias a él/ella?',
      '¿Qué futuro imagináis juntos?',
      '¿Cuál es el recuerdo que lo resume todo?'
    ],
    contextualIntros: [
      'Me encanta esa historia sobre cómo os conocisteis. Ahora cuéntame,',
      'Qué bonito lo que me cuentas. Me gustaría saber más:',
      'Eso suena muy especial. Profundicemos un poco más:',
      'Me emociona escuchar sobre vuestra relación. Dime,',
      'Qué hermoso futuro juntos. Para terminar,',
      'Para cerrar esta historia de amor perfecta,'
    ]
  },
  sibling: {
    type: 'sibling',
    detectionKeywords: ['hermano', 'hermana', 'hermanito', 'hermanita', 'ermanito', 'ermanita', 'ermano', 'ermana', 'brother', 'sister'],
    questions: [
      '¿Vuestro recuerdo más divertido de la infancia?',
      '¿Cuándo sentiste que vuestra relación era única?',
      '¿Qué bromas o rituales únicos tenéis?',
      '¿Qué admiras más de su personalidad?',
      '¿Cómo ha evolucionado vuestra relación?',
      '¿Qué promesas le harías para el futuro?'
    ],
    contextualIntros: [
      'Qué bonitos recuerdos de la infancia. Ahora cuéntame,',
      'Me encanta esa conexión especial. Dime,',
      'Eso me hace sonreír. Me gustaría saber:',
      'Qué hermosa relación fraternal. Cuéntame,',
      'Es increíble cómo han crecido juntos. Ahora,',
      'Para completar esta historia de hermanos,'
    ]
  },
  parent: {
    type: 'parent',
    detectionKeywords: ['padre', 'madre', 'papá', 'mamá', 'papi', 'mami', 'dad', 'mom', 'papa', 'mama'],
    questions: [
      'Recuerdo más preciado de la infancia: ¿Qué sentías a su lado en esos momentos y qué significaba para ti?',
      'Cualidad que más admiras: ¿Cómo ha influido en la persona que eres hoy?',
      'Su apoyo más significativo: ¿En qué momento difícil estuvo ahí para ti y qué enseñanza te dejó?',
      'Evolución de la relación: ¿Cómo ha cambiado con los años y qué significa para ti ahora?',
      'Tradición familiar especial: ¿Cuál atesoras más y por qué es tan significativa?',
      'Agradecimiento y legado: ¿Qué le agradecerías desde el corazón y qué legado sientes que te ha dejado?'
    ],
    contextualIntros: [
      'Qué recuerdo tan hermoso. Me emociona escucharte hablar así. Ahora,',
      'Es increíble el impacto que ha tenido en tu vida. Cuéntame,',
      'Qué apoyo tan valioso. Me gustaría profundizar:',
      'Es hermoso ver cómo han crecido juntos. Dime,',
      'Las tradiciones familiares son tan especiales. Para terminar,',
      'Para cerrar esta historia tan emotiva,'
    ]
  },
  child: {
    type: 'child',
    detectionKeywords: ['hijo', 'hija', 'niño', 'niña', 'bebé', 'pequeño', 'pequeña', 'mi niño', 'mi niña'],
    questions: [
      'El momento que lo cambió todo: ¿Qué sentiste al verle por primera vez?',
      'Su don especial: ¿Qué cualidad o talento te llena de orgullo?',
      'Vuestro momento más divertido: ¿Qué recuerdo os hace reír a los dos?',
      'Tu transformación como padre/madre: ¿Cómo te ha cambiado tenerle?',
      'Vuestra tradición especial: ¿Qué momento compartido atesoráis?',
      'Tus sueños para su futuro: ¿Qué deseas para su vida y qué quieres que recuerde siempre?'
    ],
    contextualIntros: [
      'Qué momento tan mágico debe haber sido. Ahora cuéntame,',
      'Me llena de alegría escuchar tu orgullo. Dime,',
      'Eso me hace sonreír. Me encantaría saber:',
      'La paternidad/maternidad es transformadora. Cuéntame,',
      'Las tradiciones crean vínculos tan especiales. Ahora,',
      'Para completar esta historia de amor paternal,'
    ]
  },
  friend: {
    type: 'friend',
    detectionKeywords: ['amigo', 'amiga', 'mejor amigo', 'mejor amiga', 'friend', 'colega', 'amiguito', 'amiguita'],
    questions: [
      'Cómo empezó todo: ¿Cómo os conocisteis y qué impresión te dio la primera vez?',
      'Cualidad que más admiras: ¿Qué hace que sea un amigo/a tan especial para ti?',
      'Momento más divertido: ¿Qué anécdota compartida siempre os hace reír?',
      'Apoyo en momentos difíciles: ¿En qué situación te demostró su amistad incondicional?',
      'Tradición o costumbre especial: ¿Qué actividad o ritual compartís que os une más?',
      'Recuerdo ancla de la amistad: ¿Qué imagen o momento representa mejor vuestra relación?'
    ],
    contextualIntros: [
      'Qué bonito comienzo de amistad. Ahora cuéntame,',
      'Es maravilloso tener amigos así. Dime,',
      'Me encanta escuchar sobre esos momentos divertidos. Cuéntame,',
      'La amistad verdadera se demuestra en esos momentos. Ahora,',
      'Las tradiciones entre amigos son tan especiales. Para terminar,',
      'Para completar esta historia de amistad,'
    ]
  }
};
// BASE DE CONOCIMIENTOS (KNOWLEDGE BASE) PARA TALE
const knowledgeBase = {
  "precio": "Cada libro personalizado en PDF cuesta 24,90€ y lo recibes en 15 minutos.",
  "tiempo_entrega": "Recibirás tu libro personalizado en PDF normalmente en menos de 15 minutos aproximadamente después de la compra.",
  "multiples_libros": "Sí, puedes crear tantos libros como desees. Cada libro es un pedido independiente y se personaliza individualmente.",
  "mismo_contenido_dos_libros": "No, no es posible recibir dos libros con el mismo contenido exacto. Cada libro se genera de forma única en base a las respuestas de las 6 preguntas. Si quieres dos copias para la misma persona, deberías pasar por el proceso dos veces, o contactar a soporte para una solución personalizada.",
  "envio_direcciones_distintas": "Actualmente, cada pedido de libro se asocia a una única dirección de envío. Si deseas enviar libros a direcciones distintas, deberás realizar pedidos separados para cada destino. Si necesitas ayuda con esto, por favor contacta a nuestro equipo de soporte.",
  "contacto_soporte": "Si tienes preguntas muy específicas o necesitas asistencia personalizada, por favor, contacta a nuestro equipo de soporte a través del correo electrónico: contacto@memorytale.es. Estaremos encantados de ayudarte.",
  "preview_version": "Una vez hayas completado el paso de las preguntas, verás una previsualización de un fragmento de cómo quedaría tu libro antes de realizar el pago.",
  "introduccion": "Soy Tale, tu asistente para crear un libro personalizado. Te haré 6 preguntas, luego verás una vista previa y, si te gusta, podrás comprarlo en PDF."
};
// Detección robusta de saludo / small‑talk (con bordes suaves)
function detectGreeting(message) {
  const text = (message || '').toLowerCase().trim();

  // Small‑talk explícito (coincide con generateGreetingResponse)
  const smallTalkRe = /(?:^|[\s¡!¿?,.])(?:como estas|que tal|cómo estás|qué tal)(?:$|[\s¡!¿?,.])/;

  // Saludos típicos (variante sin tildes y alargadas)
  // Nota: ya convertimos a lower, por eso usamos "dias" en lugar de "días".
  const greetingRe  = /(?:^|[\s¡!¿?,.])(?:buenos dias|buen dia|buenas tardes|buenas noches|hola+|buenas+|hello|hi|hey)(?:$|[\s¡!¿?,.])/;

  if (smallTalkRe.test(text)) return { isGreeting: true, kind: 'smalltalk' };
  if (greetingRe.test(text))  return { isGreeting: true, kind: 'greeting' };
  return { isGreeting: false, kind: null };
}

// Helpers para saludo contextual
function getDaypartGreeting(tz = 'Europe/Lisbon') {
  try {
    const now = new Date();
    const parts = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const h = parts.getHours();
    if (h < 12) return '¡Buenos días!';
    if (h < 20) return '¡Buenas tardes!';
    return '¡Buenas noches!';
  } catch {
    // Fallback si el entorno no soporta timeZone
    const h = new Date().getHours();
    if (h < 12) return '¡Buenos días!';
    if (h < 20) return '¡Buenas tardes!';
    return '¡Buenas noches!';
  }
}

function introAlreadyInHistory(state) {
  return !!state?.__intro_shown;
}

// --- Cooldown anti‑spam de saludos (10s por defecto) ---
function isGreetingThrottled(state, windowMs = 10_000) {
  const now = Date.now();
  const last = state?.__last_greet_ts || 0;
  const throttled = (now - last) < windowMs;
  if (!throttled && state) {
    state.__last_greet_ts = now;
  }
  return throttled;
}

// --- Emojis por tipo de saludo ---
function emojiForKind(kind) {
  if (kind === 'smalltalk') return '🙂';
  if (kind === 'greeting') return '👋';
  return '✨';
}

// Saludo inteligente (contexto + hora + Gemini opcional)
async function generateGreetingResponse(userMessage, apiKey, state, kind /* 'greeting' | 'smalltalk' */) {
  const lower = (userMessage || '').toLowerCase();
  const intro = (knowledgeBase['introduccion'] ||
    "Soy Tale, tu asistente para crear un libro personalizado. Te haré 6 preguntas, luego verás una vista previa y, si te gusta, podrás comprarlo en PDF.") + ' ';
  const CTA = "¿Para quién será este libro tan especial?";
  const daypart = getDaypartGreeting('Europe/Lisbon');

  const hasRelation = !!state?.relationshipType;
  const shownIntro = !!state?.__intro_shown;
  const icon = emojiForKind(kind);

  // Small‑talk
  if (kind === 'smalltalk' || /(?:^|[\s¡!¿?,.])(?:como estas|que tal|cómo estás|qué tal)(?:$|[\s¡!¿?,.])/.test(lower)) {
    return hasRelation
      ? `${daypart} ${icon} ¡Estoy aquí para ayudarte! ¿Seguimos con tu historia?`
      : `${daypart} ${icon} ${shownIntro ? CTA : (intro + CTA)}`;
  }

  // Saludos típicos
  if (kind === 'greeting' || /(?:^|[\s¡!¿?,.])(?:buenos dias|buen dia|buenas tardes|buenas noches|hola+|buenas+|hello|hi|hey)(?:$|[\s¡!¿?,.])/.test(lower)) {
    if (hasRelation) return `${daypart} ${icon} ¿Seguimos donde lo dejamos?`;
    if (!shownIntro && state) state.__intro_shown = true; // marcamos solo si realmente la incluimos
    return `${daypart} ${icon} ${shownIntro ? CTA : (intro + CTA)}`;
  }

  // Gemini opcional con estructura garantizada
  if (apiKey && apiKey.length > 30) {
    const target = hasRelation
      ? `${daypart} ${icon} ¿Seguimos donde lo dejamos?`
      : `${daypart} ${icon} ${shownIntro ? CTA : (intro + CTA)}`;

    const ai = await generateAIResponse(
      userMessage,
      `El usuario ha enviado un saludo o frase de apertura. Responde con calidez y brevedad (máx. 2 frases).
       Mantén SIEMPRE este remate final:
       "${target}"
       No repitas información innecesaria.`,
      apiKey
    );
    if (ai) return sanitizeOrFallback(ai, target);
  }

  // Fallback coherente
  return hasRelation
    ? `${daypart} ${icon} ¿Seguimos donde lo dejamos?`
    : `${daypart} ${icon} ${shownIntro ? CTA : (intro + CTA)}`;
}

// HELPERS CONTEXTUALES PARA UX INTELIGENTE
function isAffirmative(m) { 
  return /^(si|sí|claro|correcto|exacto|así es|vale|ok|de acuerdo)$/i.test((m || '').trim()); 
}

function isNegative(m) { 
  return /^(no|nop|nope|mejor no|prefiero que no)$/i.test((m || '').trim()); 
}

function getLastAssistant(history = []) {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if ((h.type || h.role) === 'assistant') return (h.content || '');
  }
  return '';
}

// HELPERS PARA VALIDACIÓN DE INFORMACIÓN BÁSICA
const hasAuthorName     = (st) => !!st?.userData?.['user-name'];
const hasAuthorGender   = (st) => {
  const ga = st?.userData?.['genero-autor'];
  return ga === 'masculino' || ga === 'femenino' || ga === 'no-especificado';
};
const hasRecipName      = (st) => !!st?.userData?.['nombre-destinatario'];
const hasRecipGender    = (st) => !!st?.userData?.['genero-destinatario'];

const allBasicInfoDone = (st) =>
  hasAuthorName(st) && hasAuthorGender(st) && hasRecipName(st) && hasRecipGender(st);

function nextBasicInfoPrompt(state) {
  const u = state?.userData || {};

  if (!u['nombre-destinatario']) {
    return '¡Genial! Empecemos por lo importante: ¿Cómo se llama la persona a quien va dirigido el libro?';
  }
  if (!u['genero-destinatario']) {
    const name = u['nombre-destinatario'];
    return `Perfecto. Y ${name}, ¿es él o ella? (Si prefieres no especificarlo, dímelo).`;
  }
  if (!u['user-name']) {
    return 'Ahora cuéntame sobre ti: ¿Cómo te llamas?';
  }
  {
    const ga = u['genero-autor'];
    const needsAuthorGender = !(ga === 'masculino' || ga === 'femenino' || ga === 'no-especificado');
    if (needsAuthorGender) {
      const you = u['user-name'];
      return `Encantado de conocerte, ${you}. ¿Prefieres que use pronombres masculinos, femeninos o “no especificado”?`;
    }
  }
  // Si no falta nada, que el caller salte a questions y pregunte la Q1
  return null;
}

// Detecta intención de preview usando contexto PERO evita bucle en confirmaciones
function detectPreviewIntent(lowerMessage, history = []) {
  const lastA = getLastAssistant(history).toLowerCase();
  
  // CRÍTICO: Si el último mensaje del asistente fue "¿Seguimos...?" y el usuario confirma,
  // NO actives preview para evitar el bucle
  if (isContinueMessage(lowerMessage) && (lastA.includes('¿seguimos') || lastA.includes('seguimos con'))) {
    console.log('⛔ Evitando bucle de preview - usuario confirmando continuación');
    return false;
  }

  // Detección directa en el mensaje
  if (
    lowerMessage.includes('previsual') ||
    lowerMessage.includes('preview') ||
    lowerMessage.includes('verlo') ||
    lowerMessage.includes('ver antes') ||
    lowerMessage.includes('antes de comprar') ||
    lowerMessage.includes('antes del envío') ||
    lowerMessage.includes('antes de pagar') ||
    lowerMessage.includes('muestra') ||
    lowerMessage.includes('fragmento') ||
    (lowerMessage.includes('ver') && lowerMessage.includes('antes'))
  ) return true;

  // Detección por contexto en historial (SOLO si no es una confirmación)
  if (
    lastA.includes('vista previa') ||
    lastA.includes('previsual') ||
    lastA.includes('mostrarte una vista previa') ||
    lastA.includes('verás una previsualización') ||
    lastA.includes('fragmento')
  ) return true;

  return false;
}

// Helper: detectar intención de "continuar" después de una pregunta de seguimiento
function isContinueMessage(m = '') {
  const s = (m || '').trim().toLowerCase();
  return /^(si|sí|vale|ok|de acuerdo|vamos|sigamos|seguimos|continuar|adelante|claro)\b/.test(s);
}

// Resuelve Sí/No en basic-info según contexto
function resolveYesNoInBasicInfo(userMessage, userData, conversationHistory) {
  const lastA = getLastAssistant(conversationHistory).toLowerCase();
  const yes = isAffirmative(userMessage);
  const no = isNegative(userMessage);
  if (!yes && !no) return null;

  // Caso específico: "¿y tú también eres mujer?"
  if (lastA.includes('¿y tú también eres mujer') || lastA.includes('también eres mujer')) {
    if (yes) {
      userData['genero-autor'] = 'femenino';
      return { 
        updatedUserData: userData, 
        responseText: "¡Genial! Para enviarte el libro, ¿cuál es tu email?" 
      };
    } else {
      return { 
        updatedUserData: userData, 
        responseText: "Gracias. ¿Prefieres que use pronombres masculinos o femeninos para ti?" 
      };
    }
  }

  // Caso: preguntas ambiguas de género
  if (lastA.includes('¿eres él o ella') || lastA.includes('eres el o ella')) {
    return { 
      updatedUserData: userData, 
      responseText: "Para personalizarlo bien, indícame si prefieres pronombres masculinos o femeninos." 
    };
  }

  return null;
}


export default {
  async fetch(request, env, ctx) {
    // ✅ Health checks locales (Wrangler): 200 OK para probes
    if (request.method === 'GET' || request.method === 'HEAD') {
      const { pathname } = new URL(request.url);
      if (pathname === '/' || pathname === '/favicon.ico') {
        return new Response('OK', {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
            ...corsHeaders
          }
        });
      }
      
      // ENDPOINT GET /state para rehidratación
      if (pathname === '/state') {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');
        
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
            status: 400,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
              ...corsHeaders
            }
          });
        }
        
        try {
          const conversation = await getConversationBySession(env, sessionId);
          return new Response(JSON.stringify({ conversation }), {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('❌ Error obteniendo conversación:', error);
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
              ...corsHeaders
            }
          });
        }
      }
    }

    // 🔥 LOGS TEMPORALES DE DEBUG
    console.log('🚀 Tale Worker iniciado');
    console.log('🔍 URL completa:', request.url);
    console.log('🔍 Método:', request.method);
    console.log('🌐 Origin:', request.headers.get('Origin') || 'No Origin');
    console.log('🔧 Headers relevantes:', {
      'Content-Type': request.headers.get('Content-Type'),
      'User-Agent': request.headers.get('User-Agent'),
      'Accept': request.headers.get('Accept')
    });
    
    // MANEJO DE CORS PREFLIGHT
    if (request.method === 'OPTIONS') {
      console.log('👋 Respondiendo a CORS preflight');
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    if (request.method !== 'POST') {
      console.log('❌ Método no permitido:', request.method);
      return new Response('Method not allowed', { 
        status: 405,
        headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders } 
      });
    }

    try {
      // ⚠️ CRÍTICO: LEER BODY SOLO UNA VEZ (parsing robusto)
      let raw = '';
      try {
        raw = await request.text();
      } catch (e) {
        console.error('❌ request.text() failed:', e);
        return new Response(JSON.stringify({ error: 'Failed to read body' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders }
        });
      }

      if (!raw || !raw.trim()) {
        return new Response(JSON.stringify({ error: 'Empty body' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders }
        });
      }

      // Eliminar posible BOM UTF-8 al inicio del body (0xFEFF) para compatibilidad con PowerShell/Windows
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1);
      }

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (e) {
        console.error('❌ Invalid JSON:', e, 'raw sample:', raw.slice(0, 200));
        return new Response(JSON.stringify({ error: 'Invalid JSON', detail: e.message }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders }
        });
      }

      console.log('📥 Request body recibido:', raw);
      console.log('📊 Payload parseado:', JSON.stringify(payload, null, 2));

      const { userMessage, conversationState, sessionId } = payload;
      
      // INICIALIZAR SUPABASE CON DEBUG
      console.log('🛠️ Verificando variables de Supabase:');
      console.log('🛠️ SUPABASE_URL:', env.SUPABASE_URL ? 'DEFINIDA' : 'UNDEFINED');
      console.log('🛠️ SUPABASE_SERVICE_KEY:', env.SUPABASE_SERVICE_KEY ? 'DEFINIDA' : 'UNDEFINED');
      console.log('🛠️ SUPABASE_URL value:', env.SUPABASE_URL);
      console.log('🛠️ SUPABASE_SERVICE_KEY length:', env.SUPABASE_SERVICE_KEY ? env.SUPABASE_SERVICE_KEY.length : 0);
      

      // PROCESAR MENSAJE CON IA CONVERSACIONAL (usando supabaseService.js)
      let result = await processConversationalMessage(
        userMessage, 
        conversationState, 
        sessionId,
        env,
        ctx
      );

      // Asegurar resultado seguro
      if (!result || typeof result !== 'object') {
        console.warn('⚠️ processConversationalMessage devolvió resultado vacío/inesperado. Aplicando fallback.');
        result = {
          taleResponse: {
            response_text: 'Lo siento, algo salió mal. ¿Podemos intentarlo de nuevo?',
            previewData: null,
            showPreview: false,
            isComplete: false
          },
          newState: conversationState || {},
          sessionId: sessionId || null,
          isComplete: false
        };
      }

      console.log('🗂️ Respuesta generada:', JSON.stringify(result, null, 2));

      // 🔥 LOGS ANTES DE RESPONDER
      const responseBody = JSON.stringify(result || {});
      console.log('✅ Status: 200 OK');
      try {
        console.log('🧾 Response body length:', responseBody.length);
        console.log('📦 Response body preview:', responseBody.substring(0, 200) + '...');
      } catch (_) {
        console.log('📦 Response body listo para enviar');
      }

      return new Response(responseBody, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          ...corsHeaders
        }
      });

    } catch (error) {
      console.error('Error en Worker:', error);
      
      return new Response(JSON.stringify({
        taleResponse: {
          response_text: "Disculpa, ha habido un pequeño problema técnico. ¿Podrías repetir eso?"
      },
      error: error.message
    }), {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          ...corsHeaders
        }
      });
    }
  }
};

// GENERAR SIGUIENTE PREGUNTA CON CONTEXTO
async function getNextQuestionWithContext(userResponse, nextQuestion, questionIndex, apiKey) {
  const prompt = `El usuario respondió: "${userResponse}"
Eres Tale (MemoryTale). Escribe 1–2 frases empáticas que reconozcan lo dicho sin repetirlo literal, y luego introduce la pregunta:
"${nextQuestion}"
Tono cálido, natural, conciso.`;

  try {
    const generated = await generateWithGemini(prompt, apiKey, {
      temperature: 0.7,
      maxOutputTokens: 120,
      attempts: 3,     // mantener 3 como en el helper
      backoffMs: 700,
      timeoutMs: 9000  // coherente con el helper mejorado
    });
    if (generated && generated.length > 5) {
      const out = generated.trim().replace(/\s+/g, ' ');
      return out.length > 320 ? out.slice(0, 317) + '…' : out;
    }
  } catch (e) {
    console.error('Error generando transición con Gemini:', e);
  }

  // Fallback contextual sin IA
  const local = buildEmpathicTransition(userResponse, nextQuestion);
  console.log('✨ Fallback transition (rule-based):', local);
  return local;
}

// DETECCIÓN ROBUSTA DE RELACIONES (INCLUYE TYPOS)
function detectRelationship(text) {
  const normalizedText = text.toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n');

  for (const [relation, config] of Object.entries(relationshipConfigs)) {
    const matched = config.detectionKeywords.find(k => normalizedText.includes(k));
    if (matched) {
      console.log('🎯 Relación detectada:', relation, 'con keyword:', matched);
      return relation;
    }
  }

  return null;
}

// EXTRACCIÓN DE INFORMACIÓN CONTEXTUAL INTELIGENTE (MEJORADO)
function extractInformation(text, currentStep, queryType = 'story_response') {
  const extracted = {};

  console.log('🔍 Extrayendo información para queryType:', queryType, 'en step:', currentStep);

  // Lista de palabras que NUNCA deben ser nombres (extendida y más agresiva)
  const invalidNames = new Set([
    'vez', 'tiempo', 'libros', 'libro', 'dos', 'tres', 'cuatro', 'cinco', 'varios',
    'duda', 'pregunta', 'ayuda', 'precio', 'pdf', 'pago', 'stripe', 'mismo', 'posible',
    'hacer', 'crear', 'escribir', 'generar', 'al', 'la', 'el', 'una', 'uno', 'esta',
    'este', 'esa', 'ese', 'cosa', 'cosas', 'forma', 'manera', 'tipo', 'clase',
    'si', 'no', 'ok', 'vale', 'bien', 'claro', 'gracias', 'por', 'quiero', 'regalarle',
    'genero', 'mi', 'yo', 'tu', 'para', 'y', 'es', 'soy', 'me', 'llamo', // <-- Muy comunes
    'hermana', 'ermana', 'hermano', 'ermano', 'ermanito', 'ermanita', // <-- CRÍTICO: Añadir aquí los términos de relación con y sin typos
    'pareja', 'novio', 'novia', 'marido', 'mujer', 'esposo', 'esposa', 'amor', 'compañero', 'compañera',
    'padre', 'madre', 'papá', 'mamá', 'papi', 'mami', 'hijo', 'hija', 'niño', 'niña', 'bebé', 'pequeño', 'pequeña',
    'amigo', 'amiga', 'colega',  'puedo', 'tengo', 'quiero', 'hacer', 'crear', 'ver', 'libro', 'libros',
  'ermana', 'ermanita', 'ermano', 'ermanito', 'pero', 'vamos', 'sigamos', 'seguimos', 'tengo', 'puedo', 'quiero', 'duda' // CRÍTICO para evitar typos como nombres
  ]);

  // Try to extract name for nombre-destinatario ONLY if it's a relationship_info or initial greeting
  if (queryType === 'relationship_info' || currentStep === 'greeting') {
    const nameFromRelation = extractNameAfterRelation(text);
    if (nameFromRelation && !invalidNames.has(nameFromRelation.toLowerCase()) && nameFromRelation.length > 2) {
      extracted.name = nameFromRelation;
      console.log('👤 Nombre de destinatario extraído (tras relación):', nameFromRelation);
    } else {
      // Fallback: Check if the message itself is just a name (e.g., "Luisa")
      const singleWord = text.trim();
      if (singleWord.length > 2 && singleWord.length < 20 && singleWord[0] === singleWord[0].toUpperCase()) {
         if (!invalidNames.has(singleWord.toLowerCase())) {
           extracted.name = toTitleCase(singleWord);
           console.log('👤 Nombre de destinatario extraído (palabra suelta):', extracted.name);
         }
      }
    }
  }

  // Extract name for user-name if it's personal_info or a general name mention
if (queryType === 'personal_info') {
    const properNameMatch = text.match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\b/g); // Find all capitalized words
    if (properNameMatch) {
      for (const possibleName of properNameMatch) {
        if (!invalidNames.has(possibleName.toLowerCase()) && possibleName.length > 2) {
          // If it's a "yo me llamo X" phrase, prioritize X
          const yoMeLlamoMatch = text.match(/(?:yo\s+me\s+llamo|mi\s+nombre\s+es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i);
          if (yoMeLlamoMatch && yoMeLlamoMatch[1]) {
            extracted.name = toTitleCase(yoMeLlamoMatch[1]);
            console.log('👤 Nombre de usuario extraído (yo me llamo):', extracted.name);
            break;
          } else if (!extracted.name) { // Only set if no name extracted yet for recipient or from "yo me llamo"
            extracted.name = toTitleCase(possibleName);
            console.log('👤 Nombre de usuario extraído (capitalizado):', extracted.name);
            break; // Take the first one
          }
        }
      }
    }
  }

  // Género (extract always if present explicitly)
  const lowerText = text.toLowerCase();
  if (/\b(él|masculino|hombre|chico)\b/.test(lowerText)) extracted.gender = 'masculino';
  else if (/\b(ella|femenino|mujer|chica)\b/.test(lowerText)) extracted.gender = 'femenino';

  // Email (extract always if present explicitly)
  const emailMatch = text.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) extracted.email = emailMatch[0];

  return extracted;
}

function extractNameAfterRelation(text) {
  const pattern = new RegExp(
    String.raw`(?:para|por|es\s+para|quiero\s+regalarle\s+a|para\s+mi|se\s+llama|es\s+mi|yo\s+me\s+llamo)\s+(?:mi\s+)?(?:h?ermana(?:ita)?|h?ermano(?:ito)?|pareja|novi[oa]|marido|mujer|espos[oa]|padre|madre|mam[aá]|pap[aá]|hij[oa]|niñ[oa]|amig[oa])?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b`,
    'i'
  );
  const m = text.match(pattern);
  if (!m) return null;
  
  const candidate = toTitleCase(m[1]);
  
  // FILTRO CRÍTICO: Nunca devolver términos de relación como nombres
  const relationWords = new Set([
    'hermana','hermanita','hermano','hermanito','ermana','ermanita','ermano','ermanito',
    'pareja','novio','novia','marido','mujer','esposo','esposa',
    'padre','madre','mama','mamá','papa','papá','hijo','hija','niño','niña',
    'amigo','amiga'
  ]);
  
  if (relationWords.has(candidate.toLowerCase())) return null;
  
  return candidate;
}

function toTitleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// FUNCIONES DE INFERENCIA DE GÉNERO
function inferGenderFromPhrase(text = '') {
  const t = (text || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita acentos

  // Femenino explícito
  if (/\bamig[ae]?\b/.test(t)) {
    if (/\bamiga\b/.test(t)) return 'femenino';
    if (/\bamigo\b/.test(t)) return 'masculino';
  }
  if (/\bhij[ao]a?\b/.test(t)) {
    if (/\bhija\b/.test(t)) return 'femenino';
    if (/\bhijo\b/.test(t)) return 'masculino';
  }
  if (/\bnovi[ao]a?\b/.test(t)) {
    if (/\bnovia\b/.test(t)) return 'femenino';
    if (/\bnovio\b/.test(t)) return 'masculino';
  }
  if (/\bherman[ao]a?\b/.test(t)) {
    if (/\bhermana\b/.test(t)) return 'femenino';
    if (/\bhermano\b/.test(t)) return 'masculino';
  }
  if (/\bmadre\b|\bmama\b/.test(t)) return 'femenino';
  if (/\bpadre\b|\bpapa\b/.test(t)) return 'masculino';
  if (/\bmami\b/.test(t)) return 'femenino';
  if (/\bpapi\b/.test(t)) return 'masculino';

  return null;
}

// Base ampliada de nombres y umbral de confianza
const GENDER_INFER_CONF_THRESHOLD = 0.8;
const FEMALE_NAMES_DB = new Set([
  'lucia','sofia','maria','laura','ana','paula','carmen','martina','valeria','noa','andrea','alba','ines','elena','irene','paola','eva','nuria','raquel','patricia','clara','sara','adriana','julieta','isabella','camila','antonella','bianca','marina','rosa','teresa','beatriz','susana','marta','olga','diana','veronica','alejandra','carla','natalia','daniela','carolina','gabriela','silvia','loreto','constanza','soledad','belen'
]);
const MALE_NAMES_DB = new Set([
  'juan','carlos','pedro','luis','alejandro','javier','miguel','alvaro','sergio','lucas','luca','diego','pablo','daniel','david','jorge','andres','andrés','francisco','antonio','manuel','victor','víctor','alberto','adrian','adrián','enrique','fernando','gonzalo','hector','héctor','hugo','iker','jaime','josé','jose','martin','martín','marcos','marco','mateo','nicolas','nicolás','oscar','óscar','rafael','ramon','ramón','roberto','rubén','ruben','santiago','tomás','tomas','vicente'
]);
const UNISEX_NAMES_DB = new Set(['andrea','alex','sam','cris','chris','francis','jose','josé','noa','luca','nicole','nicol']);

function inferGenderByNameWithConfidence(name = '') {
  const normalized = (name || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!normalized) return { gender: null, confidence: 0, source: 'empty' };

  if (UNISEX_NAMES_DB.has(normalized)) {
    return { gender: null, confidence: 0.4, source: 'unisex-db' };
  }
  if (FEMALE_NAMES_DB.has(normalized)) {
    return { gender: 'femenino', confidence: 0.98, source: 'name-db' };
  }
  if (MALE_NAMES_DB.has(normalized)) {
    return { gender: 'masculino', confidence: 0.98, source: 'name-db' };
  }

  // Heurística por terminación
  if (normalized.endsWith('a')) return { gender: 'femenino', confidence: 0.7, source: 'suffix' };
  if (normalized.endsWith('o')) return { gender: 'masculino', confidence: 0.7, source: 'suffix' };

  return { gender: null, confidence: 0, source: 'unknown' };
}

// Wrapper retrocompatible
function inferGenderByName(name = '') {
  const res = inferGenderByNameWithConfidence(name);
  if (res.confidence >= GENDER_INFER_CONF_THRESHOLD) return res.gender;
  return null;
}
// MANEJAR INFORMACIÓN BÁSICA (handleBasicInfo) - VERSIÓN MEJORADA CON ESTADO INTERNO
async function handleBasicInfo(userMessage, currentData, extractedInfo, apiKey) {
  let responseText = '';
  let updatedData = { ...currentData }; // Copiar userData para actualizar

  // 1. PROCESAR TODA LA INFORMACIÓN EXTRAÍDA DEL MENSAJE ACTUAL
  // PRIORIDAD: Recopilar toda la información disponible en este mensaje
  // Nombre de usuario
  if (extractedInfo.name && !updatedData['user-name']) {
    updatedData['user-name'] = extractedInfo.name;
    console.log('✅ Nombre de usuario actualizado:', extractedInfo.name);
    // ⬇️ Inferir género del autor por nombre en el Worker
    if (!updatedData['genero-autor']) {
      const gRes = inferGenderByNameWithConfidence(extractedInfo.name);
      console.log('🔎 Inferencia género autor por nombre:', extractedInfo.name, gRes);
      if (gRes.gender && gRes.confidence >= GENDER_INFER_CONF_THRESHOLD) {
        updatedData['genero-autor'] = gRes.gender;
        console.log('✅ Género autor inferido (Worker) con confianza', gRes.confidence, 'fuente', gRes.source);
      } else {
        console.log('⚠️ Inferencia de género autor no concluyente, se solicitará confirmación si es necesario');
      }
    }
  }
  // Email del autor
  if (extractedInfo.email && !updatedData['user-email']) {
    updatedData['user-email'] = extractedInfo.email;
    console.log('✅ Email actualizado:', extractedInfo.email);
  }
  // Género del destinatario
  if (extractedInfo.gender && !updatedData['genero-destinatario'] && updatedData['nombre-destinatario']) {
    updatedData['genero-destinatario'] = extractedInfo.gender;
    console.log('✅ Género destinatario actualizado:', extractedInfo.gender);
  }
  // Género del autor (solo si ya tenemos el nombre del autor y no se ha establecido)
  if (extractedInfo.gender && !updatedData['genero-autor'] && updatedData['user-name']) {
    // Evitar que el mismo género se use para destinatario y autor si solo se proporcionó una vez
    if (updatedData['genero-destinatario'] !== extractedInfo.gender || !updatedData['genero-destinatario']) {
      updatedData['genero-autor'] = extractedInfo.gender;
      console.log('✅ Género autor actualizado:', extractedInfo.gender);
    }
  }

  // 2. DETERMINAR QUÉ INFORMACIÓN FALTA Y FORMULAR LA SIGUIENTE PREGUNTA
  let nextQuestionPrompt = '';
  let contextForAI = '';

  if (!updatedData['genero-destinatario']) {
    nextQuestionPrompt = `Para personalizar la narrativa, ¿${updatedData['nombre-destinatario'] || 'esa persona especial'} es él o ella?`;
    contextForAI = `El usuario ha respondido "${userMessage}". Necesitas preguntar el género del destinatario (${updatedData['nombre-destinatario'] || 'esa persona especial'}).`;
  } else if (!updatedData['user-name']) {
    nextQuestionPrompt = "Ahora cuéntame sobre ti. ¿Cómo te llamas?";
    contextForAI = `El usuario ha respondido "${userMessage}" y ya sabes el género del destinatario. Necesitas preguntar su nombre.`;
  } else if (!updatedData['genero-autor']) {
    nextQuestionPrompt = "Y para usar los pronombres correctos, ¿eres él o ella?";
    contextForAI = `El usuario ha respondido "${userMessage}" y ya sabes su nombre. Necesitas preguntar su género.`;
  } else if (!updatedData['user-email']) {
    nextQuestionPrompt = "Perfecto. Para enviarte el libro, ¿cuál es tu email?";
    contextForAI = `El usuario ha respondido "${userMessage}" y ya sabes su género. Necesitas preguntar su email.`;
  } else {
    // Toda la información básica recopilada
    responseText = "¡Excelente! Ya tengo toda la información básica.";
    return { response: responseText, updatedData }; // Retornar si todo está completo
  }

  // Generar respuesta usando IA, con guardarraíles (máx. 1 frase, sin meta)
  let aiResponse = null;
  if (apiKey && apiKey.length > 20) {
    aiResponse = await generateAIResponse(
      userMessage,
      `Reformula en una única frase, cálida y directa, sin mencionar "paso", "sección", "información básica", "flujo" ni términos internos.
       No añadas explicaciones; devuelve solo la pregunta al usuario.
       Base de la pregunta: "${nextQuestionPrompt}"`,
      apiKey
    );
  }
  responseText = sanitizeOrFallback(aiResponse, nextQuestionPrompt);
  
  return { response: responseText, updatedData };
}
// RESPUESTAS DE DETECCIÓN DE RELACIÓN (getRelationshipResponse)
function getRelationshipResponse(relation, extractedName) {
  const responses = {
    partner: "¡Qué emocionante! Un libro para tu pareja es algo realmente especial. El amor merece ser celebrado de formas únicas.",
    sibling: "¡Me encanta! Los hermanos tienen historias increíbles juntos. Esas conexiones familiares son tan preciosas.",
    parent: "Qué hermoso gesto hacia tu padre/madre. Los padres merecen que sus historias sean recordadas para siempre.",
    child: "¡Qué regalo tan especial para tu hijo/a! Los niños atesoran estas historias toda la vida.",
    friend: "¡Fantástico! La amistad verdadera merece ser celebrada. Los mejores amigos son familia elegida."
  };
  
  let response = responses[relation] || "¡Qué especial!";
  
  if (extractedName) {
    response += ` ¿${extractedName} es él o ella?`;
  } else {
    response += " ¿Cómo se llama esa persona tan especial?";
  }
  
  return response;
}
// OBTENER LA PRIMERA PREGUNTA DEL FLUJO
function getFirstQuestion(relationshipType) {
  const config = relationshipConfigs[relationshipType];
  if (!config) return "Cuéntame sobre esa persona especial.";
  const firstQuestion = config.questions[0];
  const firstIntro = config.contextualIntros[0] || "Empecemos,";
  return `${firstIntro} ${firstQuestion}`;
}

// OBTENER LA PRIMERA PREGUNTA PARA UNA RELACIÓN (STUB SEGURO)
function getFirstQuestionFor(rel) {
  try {
    if (typeof relationshipConfigs !== 'undefined' && relationshipConfigs?.[rel]) {
      const cfg = relationshipConfigs[rel];
      const firstQuestion = cfg?.questions?.[0];
      const firstIntro = cfg?.contextualIntros?.[0] || 'Empecemos,';
      if (firstQuestion) return `${firstIntro} ${firstQuestion}`;
    }
  } catch (_) {
    // no-op: fallback abajo
  }
  return 'Perfecto. Empecemos con unas preguntas para personalizar tu libro.';
}
// VERIFICAR SI SE HA RECOPILADO TODA LA INFORMACIÓN BÁSICA (SIN EMAIL)
function hasAllBasicInfo(userData) {
  return userData['nombre-destinatario'] && 
         userData['genero-destinatario'] && 
         userData['user-name'] && 
         userData['genero-autor']; // ✅ sin user-email
}

// VERIFICAR SI TODAS LAS PREGUNTAS ESTÁN RESPONDIDAS
function allQuestionsCompleted(state) {
  const rel = state.relationshipType || state.relationshipTypeMapped;
  if (!rel) return false;
  const total = 6;
  const answeredHealthy = Object.entries(state.userData || {})
    .filter(([k, v]) => k.startsWith(`${rel}-q`) && countWords(String(v || '')) >= MIN_WORDS_HARD)
    .length;
  return answeredHealthy >= total;
}

// MANEJAR CAPTURA DE EMAIL (devuelve objeto plano para Supabase + json)
function handleEmailCapture(state, userMessage, sessionId) {
  // Asegurar userData como objeto
  state.userData = state.userData || {};
  
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  const email = (userMessage || '').trim();
  
  // Validar formato de email
  if (!EMAIL_RE.test(email)) {
    return {
      taleResponse: {
        response_text: 'Creo que ese email no es válido. ¿Puedes escribirlo así: nombre@dominio.com? Gracias 🙏',
      },
      newState: state, // mantener en email-capture
      sessionId,
      isComplete: false,
    };
  }
  
  // Email válido: guardar y avanzar a estilo
  state.userData['user-email'] = email;
  state.step = 'style-selection';
  state.currentStep = 'style-selection';
  
  return {
    taleResponse: {
      response_text: '¡Perfecto, gracias! Ahora elige el estilo que más te guste:',
      nextStep: 'style-selection',
    },
    newState: state,
    sessionId,
    isComplete: false,
  };
}

// DETECCIÓN DE TONO EMOCIONAL
function detectEmotionalTone(text) {
  const emotionalPatterns = {
    alegre: ['feliz', 'alegre', 'genial', 'fantástico', 'maravilloso', 'increíble'],
    nostálgico: ['recuerdo', 'antes', 'cuando era', 'solí­amos', 'Época', 'tiempo'],
    emocionado: ['emocionante', 'ansioso', 'ilusión', 'ganas', 'espero'],
    cariñoso: ['amor', 'quiero', 'adoro', 'amo', 'cariño', 'especial', 'Único']
  };

  const lowerText = text.toLowerCase();
  for (const [emotion, keywords] of Object.entries(emotionalPatterns)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return emotion;
    }
  }
  
  return 'neutral';
}

// ANÁLISIS INTELIGENTE CON GEMINI - CLASIFICA LA INTENCIÓN DEL USUARIO
async function classifyQueryWithAI(userMessage, conversationState, apiKey) {
  console.log('🤖 Analizando intención con Gemini:', userMessage.substring(0, 50) + '...');
  
  if (!apiKey || apiKey.length < 30) {
    console.log('⚠️ Sin API key válida para Gemini, usando clasificación básica de respaldo.');
    return classifyBasic(userMessage);
  }

  try {
    const currentStep = conversationState.step || conversationState.currentStep || 'greeting';
    const recentHistory = conversationState.conversationHistory ? 
                          conversationState.conversationHistory.slice(-2).map(m => `${m.type}: ${m.content}`).join('\n') : '';
    
    const prompt = `Analiza este mensaje del usuario en el contexto de crear libros personalizados en MemoryTale.es.
Considera el historial reciente de la conversación.

MENSAJE DEL USUARIO: "${userMessage}"
PASO ACTUAL DEL PROCESO: ${currentStep}
HISTORIAL RECIENTE:
${recentHistory}

Clasifica la INTENCIÓN principal del usuario en UNA de estas categorías exactas. Responde SOLO con el nombre de la categoría, sin explicaciones, texto adicional, ni JSON.

Categorías:
1. "help_request" - El usuario hace una pregunta, tiene una duda, pide ayuda o información general sobre el proceso, el producto, la entrega, o cualquier cosa que NO sea una respuesta directa a la pregunta actual del flujo de creación del libro. Incluye mensajes con "¿", "puedo", "se puede", "duda", "pregunta", "ayuda", "costo", "precio", "envío", "contenido", "varios libros", "al mismo tiempo", "a la vez", "si", "no".

2. "relationship_info" - El usuario menciona para quién es el libro (ej. "para mi hermana", "mi pareja", "un amigo").

3. "personal_info" - El usuario proporciona datos personales directos (ej. "me llamo Juan", "mi email es...", "soy hombre").

4. "story_response" - El usuario responde directamente a la pregunta que se le ha hecho sobre la historia o recuerdos para el libro. Esta es una respuesta narrativa.

5. "casual" - Saludo o conversación muy casual que no avanza el proceso (ej. "hola", "¿cómo estás?", "gracias").

6. "style_selection" - El usuario indica el estilo del libro (ej. "estiloa", "estilob").

REGLAS CRÍTICAS:
- La categoría "help_request" tiene prioridad si el mensaje es una pregunta o duda, incluso si contiene palabras de otras categorías.
- "story_response" es SOLO para respuestas a las 6 preguntas sobre el libro.
- Si la respuesta es "Si" o "No", casi siempre es "help_request" porque es ambiguo y requiere clarificación.
`;

    const geminiCall = () => fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1, // Baja temperatura para clasificación precisa
          maxOutputTokens: 50 // Suficiente para una palabra
        }
      })
    });
    
    const response = await callGeminiWithRetry(geminiCall, 2);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini API error en clasificación: ${response.status} - ${errorText}`);
      throw new Error(`Gemini API error en clasificación: ${response.status}`);
    }

    const result = await response.json();
    const classification = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    
    console.log('🤔 Gemini clasificó como:', classification);
    
    // Validar respuesta de Gemini
    const validTypes = ['help_request', 'relationship_info', 'personal_info', 'story_response', 'casual', 'commercial', 'style_selection'];
    if (validTypes.includes(classification)) {
      return classification;
    }
    
    console.log('⚠️ Gemini devolvió clasificación inválida, usando fallback:', classification);
    return classifyBasic(userMessage); // Fallback a clasificación básica si Gemini da una respuesta inesperada
    
  } catch (error) {
    console.error('❌ Error en clasificación con Gemini:', error);
    return classifyBasic(userMessage); // Fallback a clasificación básica en caso de error
  }
}
// HEURÍSTICA LOCAL PARA DETECTAR RELACIONES (FALLBACK ROBUSTO)
function detectRelationHeuristic(text = '') {
  const t = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // âœ… compatible y estable

  if (/\bhij[oa]s?\b/.test(t)) return 'child';
  if (/\bpareja\b|\bnovi[oa]s?\b/.test(t)) return 'partner';
  if (/\bmadre\b|\bmama\b|\bpadre\b|\bpapa\b/.test(t)) return 'parent';
  if (/\bherman[oa]s?\b/.test(t)) return 'sibling';
  if (/\bamig[oa]s?\b|\bcolegas?\b/.test(t)) return 'friend';
  return null;
}

// RETRY CON BACKOFF PARA ERRORES 503 Y 429
async function callGeminiWithRetry(fn, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { 
      return await fn(); 
    } catch (e) {
      lastErr = e;
      // Si es 503 (overloaded) o 429 (rate limit), espera un poco y reintenta
      if (/\b(503|429)\b/.test(String(e?.message || ''))) {
        await new Promise(r => setTimeout(r, 300 + 200 * i));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

// CLASIFICACIÓN BÁSICA DE RESPALDO (MEJORADA)
function classifyBasic(message) {
  const lowerMessage = message.toLowerCase().trim();  
  // Override de seguridad: preguntas tienen máxima prioridad
  if (lowerMessage.includes('?') || lowerMessage.includes('puedo') || 
      lowerMessage.includes('se puede') || lowerMessage.includes('duda') || 
      lowerMessage.includes('pregunta') || lowerMessage.includes('ayuda') ||
      lowerMessage === 'si' || lowerMessage === 'no') { // <-- Añadido "si", "no"
    console.log('🛡️ Override de seguridad: help_request (fallback)');
    return 'help_request';
  }
  
  // Detección de relaciones
  if (lowerMessage.includes('hermana') || lowerMessage.includes('hermano') ||
      lowerMessage.includes('pareja') || lowerMessage.includes('madre') ||
      lowerMessage.includes('padre') || lowerMessage.includes('hijo') ||
      lowerMessage.includes('amigo') || lowerMessage.includes('amiga')) {
    return 'relationship_info';
  }
  
  if (lowerMessage.includes('hola') || lowerMessage.includes('cómo estás')) {
    return 'casual';
  }
  
  if (lowerMessage.includes('precio') || lowerMessage.includes('cuánto') || lowerMessage.includes('cuesta')) {
    return 'commercial';
  }
  
  return 'story_response'; // Por defecto, asume que es una respuesta a una pregunta del flujo
}
// FUNCIÓN PRINCIPAL DE PROCESAMIENTO CONVERSACIONAL
async function processConversationalMessage(userMessage, conversationState, sessionId, env, ctx) {
  console.log('🧠 Procesando mensaje:', userMessage);
  console.log('📊 Estado actual:', conversationState.currentStep || conversationState.step);

  // DEBUGGING DE API KEY
  console.log('🔐 === VERIFICACIÓN DE API KEY ===');
  console.log('🔐 GEMINI_API_KEY existe:', !!env.GEMINI_API_KEY);
  console.log('🔐 GEMINI_API_KEY length:', env.GEMINI_API_KEY ? env.GEMINI_API_KEY.length : 0);
  console.log('🔐 GEMINI_API_KEY preview:', env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 10) + '...' + env.GEMINI_API_KEY.slice(-4) : 'NO_KEY');
  console.log('🔐 === FIN VERIFICACIÓN API KEY ===');

  const startTime = Date.now();

  // ESTADO NORMALIZADO
  let currentStep = conversationState.currentStep || conversationState.step || 'greeting';
  
  // âœ… Normalizar step para el switch
  const step = currentStep;
  let relationshipType = conversationState.selectedRecipient || conversationState.relationshipType;
  let userData = conversationState.collectedData || conversationState.userData || {};
  let conversationHistory = conversationState.history || conversationState.conversationHistory || [];
  let previewData = null;

  // ÍNDICE ROBUSTO DE PREGUNTAS
  let questionIndex = conversationState.currentQuestionIndex;
  if (currentStep === 'questions' && relationshipType) {
    const prefix = `${relationshipType}-q`;
    // Contar solo respuestas "sanas" (>= MIN_WORDS_HARD)
    const answeredCount = Object.entries(userData)
      .filter(([k, v]) => k.startsWith(prefix) && countWords(String(v || '')) >= MIN_WORDS_HARD)
      .length;
    if (typeof questionIndex !== 'number' || questionIndex < answeredCount) {
      questionIndex = answeredCount;
      console.log(`🛠️ Índice corregido de ${conversationState.currentQuestionIndex} a ${questionIndex} basado en respuestas existentes`);
    }
  } else {
    questionIndex = questionIndex || 0;
  }

  console.log(`🧭 Estado normalizado - Paso: ${currentStep}, Índice: ${questionIndex}, Respuestas guardadas: ${Object.keys(userData).filter(k => k.includes('-q')).length}`);

  // ✅ Crear objeto state unificado para los handlers
  const state = {
    step: currentStep,
    currentStep: currentStep,
    relationshipType: relationshipType,
    relationshipTypeMapped: relationshipType,
    userData: userData,
    conversationHistory: conversationHistory,
    currentQuestionIndex: questionIndex
  };

  let responseText = '';
  let newStep = currentStep;
  // 🔧 CRÍTICO: Declarar responseMeta al inicio para evitar TDZ
  let responseMeta = null;

  // RESOLVER SÍ/NO EN BASIC-INFO SEGÚN CONTEXTO (EVITA BUCLES)
  if (currentStep === 'basic-info') {
    const yn = resolveYesNoInBasicInfo(userMessage, userData, conversationHistory);
    if (yn) {
      userData = yn.updatedUserData;
      if (allBasicInfoDone(userData)) {
        newStep = 'questions';
        responseText = `${yn.responseText ? yn.responseText + ' ' : ''}¡Perfecto! Ahora viene la parte más emocionante. ${getFirstQuestion(relationshipType)}`;
      } else {
        newStep = 'basic-info';
        responseText = yn.responseText;
      }

      await persistTurn(env, ctx, {
        sessionId,
        userMessage,
        assistantMessage: responseText,
        state: {
          currentStep: newStep,
          relationshipType,
          userData,
          questionIndex,
          queryType: 'personal_info',
          responseTime: Date.now() - startTime
        }
      });

      return {
        taleResponse: {
          response_text: responseText,
          previewData: null,
          showPreview: false,
          isComplete: newStep === 'complete' || newStep === 'awaiting-payment'
        },
        newState: {
          step: newStep,
          currentStep: newStep,
          relationshipType,
          relationshipTypeMapped: mapRelationshipTypeForMake(relationshipType),
          userData,
          conversationHistory: [
            ...conversationHistory.slice(-5),
            { type: 'user', content: userMessage },
            { type: 'assistant', content: responseText }
          ],
          currentQuestionIndex: questionIndex
        },
        sessionId,
        isComplete: newStep === 'complete' || newStep === 'awaiting-payment'
      };
    }
  }

  // CLASIFICAR INTENCIÓN CON IA
  const queryType = await classifyQueryWithAI(userMessage, conversationState, env.GEMINI_API_KEY);
  console.log('🏷️ Query clasificado como:', queryType);

  // --- Corrección de relación/género + migración de respuestas (si el usuario lo rectifica)
  try {
    const tempState = {
      userData,
      relationshipType,
      relationshipTypeMapped: mapRelationshipTypeForMake(relationshipType),
      currentQuestionIndex: questionIndex
    };
    const correction = tryApplyRelationCorrection(tempState, userMessage || '');
    if (correction && (correction.changed || correction.word)) {
      await logEvent('relation_corrected', {
        prevRel: correction.prevRel || null,
        newRel: correction.newRel || null,
        word: correction.word || null
      });
    }
    // Propagar cambios al contexto local
    userData = tempState.userData;
    relationshipType = tempState.relationshipType;
    questionIndex = tempState.currentQuestionIndex;
  } catch (e) {
    console.warn('⚠️ Error aplicando corrección de relación:', e);
  }

  // FLUJO DIRIGIDO POR PASOS (LÓGICA PRINCIPAL)
if (currentStep === 'greeting') {
  // === AÑADIR AL INICIO DEL BLOQUE if (currentStep === 'greeting') { ===

  // 1) Usar intención y/o heurística local para avanzar de etapa
  const relFromHeu = detectRelationHeuristic(userMessage);
  const relFromNlp = detectRelationship(userMessage); // ya existe en tu worker
  const intentSaysRelation = (queryType === 'relationship_info');
  const resolvedRelation = relFromNlp || relFromHeu || relationshipType;
  
console.log('🔎 GREETING pre-check', { queryType, relFromNlp, relFromHeu, relationshipType });

  if (intentSaysRelation || resolvedRelation) {
    if (resolvedRelation) {
      relationshipType = resolvedRelation;
    }

    // 2) Intentar extraer nombre del destinatario del propio mensaje
    const maybeName = extractNameAfterRelation(userMessage);
    if (maybeName) {
      userData['nombre-destinatario'] = maybeName;
    }

    // ⚡ Intentar inferir género del destinatario por la frase o por el nombre
    if (!userData['genero-destinatario']) {
      const gFromPhrase = inferGenderFromPhrase(userMessage);
      let gFromName = null;
      const gResRec = inferGenderByNameWithConfidence(userData['nombre-destinatario']);
      console.log('🔎 Inferencia género destinatario:', userData['nombre-destinatario'], gResRec);
      if (gResRec.gender && gResRec.confidence >= GENDER_INFER_CONF_THRESHOLD) {
        gFromName = gResRec.gender;
      }
      userData['genero-destinatario'] = gFromPhrase || gFromName || userData['genero-destinatario'];
    }

    // 3) Decidir siguiente paso y respuesta (completar SIEMPRE basic-info)
    newStep = 'basic-info';
    if (!userData['nombre-destinatario']) {
      responseText = maybePrependBasicIntro(conversationState, '¡Genial! 😊 ¿Cómo se llama esa persona tan especial?');
    } else if (!userData['genero-destinatario']) {
      responseText = maybePrependBasicIntro(conversationState, `Para personalizarlo bien, ¿${userData['nombre-destinatario']} es él o ella?`);
    } else if (!userData['user-name']) {
      responseText = maybePrependBasicIntro(conversationState, 'Ahora cuéntame sobre ti. ¿Cómo te llamas?');
    } else if (!userData['genero-autor']) {
      responseText = maybePrependBasicIntro(conversationState, `¿Y tú eres hombre o mujer? Si prefieres no decirlo, dime "no especificado".`);
    } else {
      // Ya tenemos los 4 datos base → arrancamos preguntas
      newStep = 'questions';
      responseText = getFirstQuestion(relationshipType);
    }

    // 4) Persistir en Supabase
    await persistTurn(env, ctx, {
      sessionId,
      userMessage,
      assistantMessage: responseText,
      state: {
        currentStep: newStep,
        relationshipType,
        userData,
        questionIndex,
        queryType,
        responseTime: Date.now() - startTime
      }
    });

    // 5) Log de debug y responder (EARLY RETURN)
    console.log('🔜 GREETING→ADVANCE',
      { intentSaysRelation, relFromNlp, relFromHeu, resolvedRelation,
        hasName: !!userData['nombre-destinatario'] });

    return {
      taleResponse: {
        response_text: responseText,
        previewData: null,
        showPreview: false,
        isComplete: false
      },
      newState: {
        step: newStep,
        currentStep: newStep,
        relationshipType,
        relationshipTypeMapped: mapRelationshipTypeForMake(relationshipType),
        userData,
        __basic_intro_shown: !!conversationState.__basic_intro_shown,
        conversationHistory: [
          ...conversationHistory.slice(-5),
          { type: 'user', content: userMessage },
          { type: 'assistant', content: responseText }
        ],
        currentQuestionIndex: questionIndex
      },
      sessionId,
      isComplete: false
    };
  }

  // === A partir de aquí, DEJAS tu lógica actual de saludo como fallback ===

  // PASO 1: DETECTAR SI ES UN SALUDO CASUAL
  const greetInfo = detectGreeting(userMessage);
  if (greetInfo.isGreeting) {
    // Cooldown anti‑spam (10s). Si está en cooldown, responde algo mínimo.
    if (isGreetingThrottled(conversationState, 10_000)) {
      const hasRelation = !!conversationState?.relationshipType;
      const daypart = getDaypartGreeting('Europe/Lisbon');
      responseText = hasRelation
        ? `${daypart} 👀 ¿Seguimos donde lo dejamos?`
        : `¡Aquí estoy! ${emojiForKind(greetInfo.kind)} ¿Para quién será este libro tan especial?`;
    } else {
      responseText = await generateGreetingResponse(
        userMessage,
        env.GEMINI_API_KEY,
        conversationState,
        greetInfo.kind // ← pasamos el tipo
      );
    }
    // No cambiar el step; conservar el flujo actual
  } else {
    // PASO 2: DETECTAR RELACIÓN
    const detectedRelation = detectRelationship(userMessage);
    if (detectedRelation) {
      relationshipType = detectedRelation;
      
      // Intentar extraer nombre del destinatario
      const nameCandidate = extractNameAfterRelation(userMessage);
      if (nameCandidate) userData['nombre-destinatario'] = nameCandidate;

      newStep = 'basic-info';
      responseText = getRelationshipResponse(relationshipType, userData['nombre-destinatario'] || null);
    } else {
      // Si no detecta relación ni saludo, usar IA para respuesta genérica
      responseText = await generateAIResponse(
        userMessage, 
        "El usuario está iniciando una conversación. Responde de forma amigable y pregunta para quién quiere crear el libro personalizado.",
        env.GEMINI_API_KEY
      ) || "¡Hola! Soy Tale, tu asistente para crear historias únicas. ¿Para quién te gustaría crear un libro personalizado?";
      newStep = 'greeting';
    }
  }
  // Empaquetar respuesta para la rama 'greeting' y devolver de inmediato
  try {
    await persistTurn(env, ctx, {
      sessionId,
      userMessage,
      assistantMessage: responseText,
      state: {
        currentStep: newStep,
        relationshipType,
        userData,
        questionIndex,
        queryType,
        responseTime: Date.now() - startTime
      }
    });
  } catch (e) {
    console.warn('⚠️ Persistencia en greeting falló (no crítico):', e?.message || e);
  }

  return {
    taleResponse: {
      response_text: responseText || '¡Hola! Soy Tale. ¿Para quién te gustaría crear el libro?',
      previewData: null,
      showPreview: false,
      isComplete: false
    },
    newState: {
      step: newStep,
      currentStep: newStep,
      relationshipType,
      relationshipTypeMapped: mapRelationshipTypeForMake(relationshipType),
      userData,
      conversationHistory: [
        ...conversationHistory.slice(-5),
        { type: 'user', content: userMessage },
        { type: 'assistant', content: responseText || '¡Hola! Soy Tale. ¿Para quién te gustaría crear el libro?' }
      ],
      currentQuestionIndex: questionIndex
    },
    sessionId,
    isComplete: false
  };

} else if (currentStep === 'basic-info') {
  // PASO 2: RECOLECCIÓN DE INFORMACIÓN BÁSICA - VERSIÓN MEJORADA
  const lower = (userMessage || '').toLowerCase().trim();
  // Micro-acks: no quedarse en meta, empujar al siguiente dato/pregunta
  if (/^(si|sí|ok|vale|de acuerdo|claro|genial|perfecto)$/i.test((userMessage || '').trim())) {
    const hint = nextBasicInfoPrompt(state);
    if (!hint) {
      // Todo completo → iniciar preguntas
      state.step = state.currentStep = 'questions';
      state.currentQuestionIndex = 0;
      const rel = state.relationshipType || state.relationshipTypeMapped || 'friend';
      const q = (typeof getFirstQuestionFor === 'function') ? getFirstQuestionFor(rel) : getFirstQuestion(rel);
      responseText = q || 'Perfecto. Empecemos con unas preguntas para personalizar tu libro.';
      newStep = 'questions';
    } else {
      responseText = hint; // No onboarding dentro de basic-info
      newStep = 'basic-info';
    }

    return {
      taleResponse: {
        response_text: responseText,
        previewData: null,
        showPreview: false,
        isComplete: false
      },
      newState: {
        step: newStep,
        currentStep: newStep,
        relationshipType,
        relationshipTypeMapped: mapRelationshipTypeForMake(relationshipType),
        userData,
        conversationHistory: [
          ...conversationHistory.slice(-5),
          { type: 'user', content: userMessage },
          { type: 'assistant', content: responseText }
        ],
        currentQuestionIndex: state.currentQuestionIndex
      },
      sessionId,
      isComplete: false
    };
  }
  const isQuestion = lower.includes('?') || lower.includes('puedo') ||
                     lower.includes('duda') || lower.includes('ver') ||
                     lower.includes('previsual') || lower.includes('precio') ||
                     lower.includes('ayuda');
  
  // Manejar dudas/preguntas sin avanzar el flujo
  if (isQuestion) {
    responseText = await handleUserQuestion(userMessage, conversationState, env.GEMINI_API_KEY);
    newStep = currentStep;
  } else {
    // Procesar información básica
    const raw = (userMessage || '').trim().toLowerCase();
    const wc = raw.split(/\s+/).filter(Boolean).length;
    
    // CRÍTICO: Si ya tenemos todos los datos básicos y el usuario envía una story_response,
    // forzar transición a questions inmediatamente
    if (queryType === 'story_response' && allBasicInfoDone(state)) {
      console.log('🚀 Datos básicos completos + story_response detectado → forzando transición a questions');
      state.step = state.currentStep = 'questions';
      state.currentQuestionIndex = 0;
      const rel = state.relationshipType || state.relationshipTypeMapped || 'friend';
      // 🔧 CRÍTICO: Normalizar y propagar relationshipType
      state.relationshipType = rel;
      relationshipType = rel;
      
      // Procesar la respuesta como Q1 directamente
      const qKey = `${rel}-q1`;
      const trimmed = (userMessage || '').trim();
      const combined = trimToWordLimit(trimmed, MAX_WORDS_HARD);
      const total = countWords(combined);
      
      // Guardar la respuesta
      state.userData[qKey] = combined;
      
      // Calcular meta para el badge
      const wordsTarget = getTargetFor(rel, 0) || 30;
      responseMeta = { wordsNow: total, wordsMin: MIN_WORDS_HARD, wordsTarget, maxWords: MAX_WORDS_HARD };
      
      if (total < MIN_WORDS_HARD) {
        // Respuesta corta - pedir más detalles
        const remaining = Math.max(0, MIN_WORDS_HARD - total);
        responseText = await generateFollowUpForShortAnswer({
          accumulated: combined,
          remaining,
          relation: rel,
          qIndex: 0,
          apiKey: env.GEMINI_API_KEY
        });
        newStep = 'questions';
      } else {
        // Respuesta suficiente - avanzar a Q2
        const cfg = relationshipConfigs[rel];
        if (cfg && cfg.questions && cfg.questions.length > 1) {
          state.currentQuestionIndex = 1;
          responseText = await getNextQuestionWithContext(
            combined,
            cfg.questions[1],
            1,
            env.GEMINI_API_KEY
          );
        } else {
          responseText = '¡Perfecto! Continuemos con la siguiente pregunta.';
        }
        newStep = 'questions';
      }
      
      // Early return para evitar procesar como basic-info
      await persistTurn(env, ctx, {
        sessionId,
        userMessage,
        assistantMessage: responseText,
        state: {
          currentStep: newStep,
          relationshipType: rel,
          userData: state.userData,
          questionIndex: state.currentQuestionIndex,
          queryType,
          responseTime: Date.now() - startTime
        }
      });

      return {
        taleResponse: {
          response_text: responseText,
          previewData: null,
          showPreview: false,
          isComplete: false,
          meta: responseMeta
        },
        newState: {
          step: newStep,
          currentStep: newStep,
          relationshipType: rel,
          relationshipTypeMapped: mapRelationshipTypeForMake(rel),
          userData: state.userData,
          conversationHistory: [
            ...conversationHistory.slice(-5),
            { type: 'user', content: userMessage },
            { type: 'assistant', content: responseText }
          ],
          currentQuestionIndex: state.currentQuestionIndex
        },
        sessionId,
        isComplete: false
      };
    }
    
    // Detección MÍNIMA de género (solo respuestas explícitas en frases cortas)
    if (wc <= 6 && /\b(ella|mujer|chica|femenin[oa])\b/.test(raw)) {
      if (!hasAuthorGender(state) && hasAuthorName(state)) {
        state.userData['genero-autor'] = 'femenino';
      } else if (!hasRecipGender(state) && hasRecipName(state)) {
        state.userData['genero-destinatario'] = 'femenino';
      }
    } else if (wc <= 6 && /\b(?:soy\s+)?(el|él|hombre|chico|masculin[oa])\b/.test(raw)) {
      if (!hasAuthorGender(state) && hasAuthorName(state)) {
        state.userData['genero-autor'] = 'masculino';
      } else if (!hasRecipGender(state) && hasRecipName(state)) {
        state.userData['genero-destinatario'] = 'masculino';
      }
    } else {
      // Si no es género explícito, procesar como nombre
      const nameCandidate = userMessage.trim();
      const isValidName = nameCandidate.length > 1 && nameCandidate.length < 25 &&
                         /^[A-Za-záéíóúñÑüÜ\s]+$/.test(nameCandidate) &&
                         !['si', 'sí', 'no', 'ok', 'vale', 'gracias', 'hola'].includes(nameCandidate.toLowerCase());
      
      if (isValidName) {
        if (!hasAuthorName(state)) {
          state.userData['user-name'] = toTitleCase(nameCandidate);
          // ⬇️ Inferir género del autor por nombre también en la ruta sin IA
          if (!state.userData['genero-autor']) {
            const gRes = inferGenderByNameWithConfidence(nameCandidate);
            console.log('🔎 Inferencia género autor (ruta básica):', nameCandidate, gRes);
            if (gRes.gender && gRes.confidence >= GENDER_INFER_CONF_THRESHOLD) {
              state.userData['genero-autor'] = gRes.gender;
              console.log('✅ Género autor inferido (ruta básica) con confianza', gRes.confidence, 'fuente', gRes.source);
            }
          }
        } else if (!hasRecipName(state)) {
          state.userData['nombre-destinatario'] = toTitleCase(nameCandidate);
        }
      }
    }
    
    // Micro-ack para evitar bucles: si falta genero-autor y el usuario dice "seguimos" o similar,
    // asumimos "no-especificado" para poder avanzar sin fricción.
    try {
      const basicTrim = String(userMessage || '').trim().toLowerCase();
      const MICRO_ACK_RE = /^(?:si|sí|vale|ok|de acuerdo|claro|perfecto|seguimos?|continuamos?|contin(?:ua|úa)|sigue)\b/i;
      const isAck = MICRO_ACK_RE.test(basicTrim);
      if (isAck) {
        const ga = state?.userData?.['genero-autor'];
        const valid = ga === 'masculino' || ga === 'femenino' || ga === 'no-especificado';
        if (!valid) {
          state.userData = state.userData || {};
          state.userData['genero-autor'] = 'no-especificado';
        }
        // Flag para que ningún helper vuelva a pedirlo en esta sesión
        state.__basic_info_gender_autofilled = true;
      }
    } catch {}

    // Determinar siguiente prompt
    const prompt = nextBasicInfoPrompt(state);
    
    if (!prompt) {
      // âœ… basic-info completa â†’ avanzar a preguntas
      state.step = state.currentStep = 'questions';
      state.currentQuestionIndex = 0;
      const rel = state.relationshipType || state.relationshipTypeMapped || 'friend';
      const firstQuestion = (typeof getFirstQuestionFor === 'function') ? getFirstQuestionFor(rel) : null;
      responseText = firstQuestion || 'Perfecto. Empecemos con unas preguntas para personalizar tu libro.';
      newStep = 'questions';
    } else {
      responseText = prompt; // No onboarding dentro de basic-info
      newStep = 'basic-info';
    }
    
    // Fallback final: nunca vacío
    if (!responseText || !responseText.trim()) {
      responseText = '¡Perfecto! Continuamos con la creación de tu libro. 😊';
    }
    
    // Actualizar userData con los cambios de state
    state.userData = state.userData || {};
  }

  // Meta opcional para Front (badge) — llenamos en ramas donde haya conteo
  // responseMeta ya declarado al inicio

  if (currentStep === 'questions') {
    // 🔜 Enriquecimiento: acumular y validar longitud mínima (A)
    const trimmed = (userMessage || '').trim();
    // Blindaje: relación segura para acceder a configuración y targets
    const relSafe = (relationshipType && relationshipConfigs[relationshipType]) ? relationshipType : 'friend';
    if (!relationshipType || !relationshipConfigs[relationshipType]) {
      // Persistir relación segura si venimos sin tipo (evita ramas inconsistentes) y propagar a la variable local
      state.relationshipType = relSafe;
      relationshipType = relSafe;
      console.log('🛠️ relationshipType normalizado a:', relSafe);
    }
    const qKey = `${relSafe}-q${questionIndex + 1}`;

    // Ignora micro-acks tipo "ok, vale, sí..." sin tocar userData ni índice
    if (/^(si|sí|no|ok|vale|de acuerdo|claro|genial|perfecto)$/i.test(trimmed)) {
      // Devolver la pregunta actual y meta para que el badge funcione
      const cfg = relationshipConfigs[relSafe] || {};
      const currentQ = Array.isArray(cfg.questions) ? cfg.questions[questionIndex] : null;
      const prevText = String(userData[qKey] || '');
      const wordsNow = countWords(prevText);
      const wordsTarget = getTargetFor(relSafe, questionIndex) || 30;
      responseMeta = { wordsNow, wordsMin: MIN_WORDS_HARD, wordsTarget, maxWords: MAX_WORDS_HARD };
      responseText = currentQ || 'Cuéntame un poco más 🙂';
      newStep = 'questions';
    } else {
      // qKey ya definido arriba

      // 6) Detección de edición/sustitución
      const EDIT_RE = /^(editar|reemplazar|corrijo)\s*:\s*(.+)$/i;
      const mEdit = trimmed.match(EDIT_RE);
      if (mEdit) {
        const replacement = mEdit[2].trim();
        const safe = trimToWordLimit(replacement, MAX_WORDS_HARD);
        // Sustituir por completo
        userData[qKey] = safe;
        // Si estaba marcado como skipped, quitar flag
        if (userData[`${qKey}__skipped`]) delete userData[`${qKey}__skipped`];

        const totalEdit = countWords(safe);
        const wordsMin = MIN_WORDS_HARD;
        const wordsTarget = getTargetFor(relSafe, questionIndex) || 30;
        responseMeta = { wordsNow: totalEdit, wordsMin, wordsTarget, maxWords: MAX_WORDS_HARD };

        await logEvent('answer_edited', { rel: relationshipType, qIndex: questionIndex, words: totalEdit });

        if (totalEdit < MIN_WORDS_HARD) {
          const remaining = Math.max(0, MIN_WORDS_HARD - totalEdit);
          const follow = await generateFollowUpForShortAnswer({
            accumulated: safe,
            remaining,
            relation: relationshipType,
            qIndex: questionIndex,
            apiKey: env.GEMINI_API_KEY
          });
          await logEvent('answer_short_followup', { rel: relationshipType, qIndex: questionIndex, words: totalEdit });
          responseText = follow;
          newStep = 'questions'; // ⛔ NO avanzar
        } else {
          // ✅ Umbral alcanzado: avanzar como camino normal
          const cfg = relationshipConfigs[relSafe];
          if (questionIndex < cfg.questions.length - 1) {
            questionIndex += 1;
            responseText = await getNextQuestionWithContext(
              safe,
              cfg.questions[questionIndex],
              questionIndex,
              env.GEMINI_API_KEY
            );
            newStep = 'questions';
          } else {
            if (!userData['user-email']) {
              responseText = '¡Genial! 🔓 Solo un paso más: para poder enviarte tu libro en PDF cuando esté listo, ¿me dejas tu correo?';
              newStep = 'email-capture';
            } else {
              responseText = '¡Qué historia tan hermosa! Ya tengo todo lo necesario. Ahora elige el estilo visual que más te guste para tu libro.';
              newStep = 'style-selection';
            }
          }
          await logEvent('answer_completed', { rel: relationshipType, qIndex: questionIndex, words: totalEdit });
        }

        // Evitar continuar con el flujo normal tras edición
        // (dejamos que el return estándar empaquete la respuesta)
      } else {
      const prev = String(userData[qKey] || '');
      const combinedRaw = [prev, trimmed]
        .filter(Boolean)
        .join(prev && trimmed ? ' ' : '')
        .replace(/\s+/g, ' ')
        .trim();
      let combined = combinedRaw;
      let total = countWords(combined);

      // ⛔️ Límite superior: recortar con cariño si excede
      if (total > MAX_WORDS_HARD) {
        combined = trimToWordLimit(combined, MAX_WORDS_HARD);
        total = countWords(combined);
      }

      // Guarda SIEMPRE el acumulado
      userData[qKey] = combined;

      // 3) Escape hatch (intención explícita + mínimo alterno)
      const SKIP_RE = /(?:^|\s)(no recuerdo|prefiero saltar|pasar esta|paso esta|skip)(?:\s|$)/i;
      const MIN_WORDS_ALT = 12;
      if (SKIP_RE.test(trimmed)) {
        if (total < MIN_WORDS_ALT) {
          const remainAlt = MIN_WORDS_ALT - total;
          responseText = `Lo entiendo. Para mantener la coherencia del libro, ¿podrías añadir ${remainAlt} palabra${remainAlt===1?'':'s'} más con una idea general (por ejemplo, época o sentimiento)?`;
          newStep = 'questions';
          const wordsTarget = getTargetFor(relSafe, questionIndex) || 30;
          responseMeta = { wordsNow: total, wordsMin: MIN_WORDS_HARD, wordsTarget, maxWords: MAX_WORDS_HARD };
        } else {
          // marcar skip y avanzar como válido
          userData[qKey] = trimToWordLimit(combined, MAX_WORDS_HARD);
          userData[`${qKey}__skipped`] = true;
          await logEvent('answer_skipped', { rel: relationshipType, qIndex: questionIndex, words: total });

          const cfg = relationshipConfigs[relSafe];
          if (questionIndex < cfg.questions.length - 1) {
            questionIndex += 1;
            responseText = await getNextQuestionWithContext(
              combined,
              cfg.questions[questionIndex],
              questionIndex,
              env.GEMINI_API_KEY
            );
            newStep = 'questions';
          } else {
            if (!userData['user-email']) {
              responseText = '¡Genial! 🔓 Solo un paso más: para poder enviarte tu libro en PDF cuando esté listo, ¿me dejas tu correo?';
              newStep = 'email-capture';
            } else {
              responseText = '¡Qué historia tan hermosa! Ya tengo todo lo necesario. Ahora elige el estilo visual que más te guste para tu libro.';
              newStep = 'style-selection';
            }
          }
          const wordsTarget = getTargetFor(relationshipType, questionIndex) || 30;
          responseMeta = { wordsNow: total, wordsMin: MIN_WORDS_HARD, wordsTarget, maxWords: MAX_WORDS_HARD };
        }
      } else if (total < MIN_WORDS_HARD) {
        const remaining = Math.max(0, MIN_WORDS_HARD - total);
        const follow = await generateFollowUpForShortAnswer({
          accumulated: combined,
          remaining,
          relation: relationshipType,
          qIndex: questionIndex,
          apiKey: env.GEMINI_API_KEY
        });
        await logEvent('answer_short_followup', { rel: relationshipType, qIndex: questionIndex, words: total });
        responseText = follow;
        newStep = 'questions'; // ⛔ NO avanzar
        const wordsTarget = getTargetFor(relSafe, questionIndex) || 30;
        responseMeta = { wordsNow: total, wordsMin: MIN_WORDS_HARD, wordsTarget, maxWords: MAX_WORDS_HARD };
      } else {
        // ✅ Umbral alcanzado: pasar a la siguiente
        const cfg = relationshipConfigs[relSafe];
        if (questionIndex < cfg.questions.length - 1) {
          questionIndex += 1;
          responseText = await getNextQuestionWithContext(
            combined,
            cfg.questions[questionIndex],
            questionIndex,
            env.GEMINI_API_KEY
          );
          newStep = 'questions';
          {
            const wordsTarget = getTargetFor(relSafe, questionIndex - 1) || 30;
            responseMeta = { wordsNow: total, wordsMin: MIN_WORDS_HARD, wordsTarget, maxWords: MAX_WORDS_HARD };
          }
        } else {
          // Fin de preguntas → email o estilo
          if (!userData['user-email']) {
            responseText = '¡Genial! 🔓 Solo un paso más: para poder enviarte tu libro en PDF cuando esté listo, ¿me dejas tu correo?';
            newStep = 'email-capture';
          } else {
            responseText = '¡Qué historia tan hermosa! Ya tengo todo lo necesario. Ahora elige el estilo visual que más te guste para tu libro.';
            newStep = 'style-selection';
          }
          {
            const wordsTarget = getTargetFor(relSafe, questionIndex) || 30;
            responseMeta = { wordsNow: total, wordsMin: MIN_WORDS_HARD, wordsTarget, maxWords: MAX_WORDS_HARD };
          }
        }
      }
    }

    // CRÍTICO: Return al final del bloque questions
    await persistTurn(env, ctx, {
      sessionId,
      userMessage,
      assistantMessage: responseText,
      state: {
        currentStep: newStep,
        relationshipType,
        userData,
        questionIndex,
        queryType,
        responseTime: Date.now() - startTime
      }
    });

    return {
      taleResponse: {
        response_text: responseText,
        previewData: null,
        showPreview: false,
        isComplete: newStep === 'complete' || newStep === 'awaiting-payment',
        meta: responseMeta
      },
      newState: {
        step: newStep,
        currentStep: newStep,
        relationshipType: relationshipType,
        relationshipTypeMapped: mapRelationshipTypeForMake(relationshipType),
        userData: userData,
        conversationHistory: [
          ...conversationHistory.slice(-5),
          { type: 'user', content: userMessage },
          { type: 'assistant', content: responseText }
        ],
        currentQuestionIndex: questionIndex
      },
      sessionId,
      isComplete: newStep === 'complete' || newStep === 'awaiting-payment'
    };
  } // Fin del bloque if (currentStep === 'questions')

  } else if (currentStep === 'email-capture') {
    // âœ… NUEVO STEP: CAPTURA DE EMAIL
    const payload = handleEmailCapture(state, userMessage, sessionId); // devuelve objeto plano: { taleResponse, newState, sessionId, isComplete }

    // Guardar en Supabase con los datos del payload
    await persistTurn(env, ctx, {
      sessionId,
      userMessage,
      assistantMessage: payload.taleResponse.response_text,
      state: {
        currentStep: payload.newState.step,
        relationshipType: state.relationshipType || state.relationshipTypeMapped,
        userData: payload.newState.userData,
        questionIndex,                 // conserva tu índice actual
        queryType: 'personal_info',    // etiqueta
        responseTime: Date.now() - startTime
      }
    });

    // Responder al cliente respetando el contrato
    return payload;

  } else if (currentStep === 'style-selection') {
    // PASO 4: SELECCIÓN DE ESTILO
    const lower = String(userMessage || '').toLowerCase();
    const isQuestion = lower.includes('?') || lower.includes('duda') || lower.includes('ver') || 
                      lower.includes('previsual') || lower.includes('precio') || lower.includes('ayuda');

    if (isQuestion) {
      responseText = await handleUserQuestion(userMessage, conversationState, env.GEMINI_API_KEY);
      newStep = currentStep;
    } else if (lower.includes('estiloa') || lower.includes('estilo a')) {
      userData['estilo-libro'] = 'estiloa';
      userData['privacy-consent'] = 'accepted';
      userData['order_id'] = generateOrderId(relationshipType);
      newStep = 'awaiting-payment';
      responseText = "¡Excelente elección! Tu libro está listo para ser creado.";
    } else if (lower.includes('estilob') || lower.includes('estilo b')) {
      userData['estilo-libro'] = 'estilob';
      userData['privacy-consent'] = 'accepted';
      userData['order_id'] = generateOrderId(relationshipType);
      newStep = 'awaiting-payment';
      responseText = "¡Perfecto! Has elegido un estilo moderno y elegante.";
    } else {
      responseText = "Por favor, elige uno de los estilos disponibles: EstiloA o EstiloB. ¿Cuál prefieres?";
    }

  } else {
    // Paso desconocido -> tratar como duda
    responseText = await handleUserQuestion(userMessage, conversationState, env.GEMINI_API_KEY);
    newStep = currentStep;
  }

  // GUARDAR EN SUPABASE
  await persistTurn(env, ctx, {
    sessionId,
    userMessage,
    assistantMessage: responseText,
    state: {
      currentStep: newStep,
      relationshipType,
      userData,
      questionIndex,
      queryType,
      responseTime: Date.now() - startTime
    }
  });

  // RESPUESTA FINAL
  return {
    taleResponse: {
      response_text: responseText,
      previewData: previewData,
      showPreview: !!(previewData && previewData.success),
      isComplete: newStep === 'complete' || newStep === 'awaiting-payment',
      meta: responseMeta || undefined
    },
    newState: {
      step: newStep,
      currentStep: newStep,
      relationshipType: relationshipType,
      relationshipTypeMapped: mapRelationshipTypeForMake(relationshipType),
      userData: userData,
      conversationHistory: [
        ...conversationHistory.slice(-5),
        { type: 'user', content: userMessage },
        { type: 'assistant', content: responseText }
      ],
      currentQuestionIndex: questionIndex
    },
    sessionId: sessionId,
    isComplete: newStep === 'complete' || newStep === 'awaiting-payment'
  };
}

// --- Mapas y utilidades para corrección de relación/género ---
const REL_WORD_TO_TYPE = {
  hermano: 'sibling', hermana: 'sibling',
  padre: 'parent', madre: 'parent',
  hijo: 'child', hija: 'child',
  amigo: 'friend', amiga: 'friend'
};

const GENDER_BY_WORD = {
  hermana: 'femenino', madre: 'femenino', hija: 'femenino', amiga: 'femenino',
  hermano: 'masculino', padre: 'masculino', hijo: 'masculino', amigo: 'masculino'
};

// (Eliminado CORRECTION_RE global; la corrección usa una regex local dentro de tryApplyRelationCorrection)

// Devuelve el número de preguntas configuradas para una relación
function getQuestionsCountFor(relationType) {
  try {
    const cfg = relationshipConfigs?.[relationType];
    return Array.isArray(cfg?.questions) ? cfg.questions.length : 6;
  } catch {
    return 6;
  }
}

// Migra todas las claves oldRel-qN → newRel-qN preservando __skipped
function migrateAnswersForRelation(state, oldRel, newRel) {
  if (!state?.userData || !oldRel || !newRel || oldRel === newRel) return;

  const oldPrefix = `${oldRel}-q`;
  const newPrefix = `${newRel}-q`;
  const newData = { ...(state.userData || {}) };

  Object.keys(state.userData).forEach((k) => {
    if (k.startsWith(oldPrefix) && /^.+-q\d+$/.test(k)) {
      const suffix = k.slice(oldPrefix.length); // e.g. "1", "2"
      const from = k;
      const to = `${newPrefix}${suffix}`;
      // No sobrescribir si ya existe destino
      if (newData[to] == null) newData[to] = state.userData[from];
      delete newData[from];

      // mover flag __skipped si existe
      const fromFlag = `${from}__skipped`;
      const toFlag = `${to}__skipped`;
      if (state.userData[fromFlag]) {
        newData[toFlag] = true;
        delete newData[fromFlag];
      }
    }
  });

  state.userData = newData;
}

// Aplica la corrección de relación/género si se detecta en el texto.
// Devuelve { changed: boolean, prevRel, newRel, word }
function tryApplyRelationCorrection(state, userText) {
  if (!state || !userText) return { changed: false };

  // Hacer la función auto-contenida para evitar problemas de inicialización/TDZ con el bundler
  const REL_WORD_TO_TYPE_LOCAL = {
    // pareja
    pareja: 'partner', novio: 'partner', novia: 'partner',
    marido: 'partner', mujer: 'partner', esposo: 'partner', esposa: 'partner',
    // familia y amigos
    hermano: 'sibling', hermana: 'sibling',
    padre: 'parent', madre: 'parent', papa: 'parent', mama: 'parent',
    hijo: 'child', hija: 'child',
    amigo: 'friend', amiga: 'friend'
  };
  const GENDER_BY_WORD_LOCAL = {
    // masculino
    novio: 'masculino', marido: 'masculino', esposo: 'masculino',
    hermano: 'masculino', padre: 'masculino', papa: 'masculino', hijo: 'masculino', amigo: 'masculino',
    // femenino
    novia: 'femenino', mujer: 'femenino', esposa: 'femenino',
    hermana: 'femenino', madre: 'femenino', mama: 'femenino', hija: 'femenino', amiga: 'femenino',
    // neutro
    pareja: null
  };
  // Normalizar a minúsculas sin acentos para detectar
  const normalized = String(userText)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const CORRECTION_RE_LOCAL = new RegExp(
    // disparadores típicos + palabra objetivo
    String.raw`(?:perdon|me\s+equivoque|quise\s+decir|rectifico|corrijo|en\s+realidad|no\s+era|mejor\s+dicho)\s+(?:que\s+)?(?:es|quise\s+decir)?\s*(pareja|novio|novia|marido|mujer|esposo|esposa|hermano|hermana|padre|madre|papa|mama|hijo|hija|amigo|amiga)\b`
  );

  const m = normalized.match(CORRECTION_RE_LOCAL);
  if (!m) return { changed: false };

  const word = (m[1] || '');                    // ej. "hermano"
  const newRel = REL_WORD_TO_TYPE_LOCAL[word];  // ej. "sibling"
  if (!newRel) return { changed: false };

  const prevRel = state.relationshipType || state.relationshipTypeMapped;
  const prevRelNorm = prevRel || null;

  // Ajuste de género del destinatario según la palabra explícita
  const newGender = GENDER_BY_WORD_LOCAL[word];    // "masculino" | "femenino" | null
  if (newGender) {
    state.userData = state.userData || {};
    state.userData['genero-destinatario'] = newGender;
  }

  // Migrar respuestas si cambia relación (inline para evitar dependencias externas)
  if (prevRelNorm && prevRelNorm !== newRel) {
    const oldPrefix = `${prevRelNorm}-q`;
    const newPrefix = `${newRel}-q`;
    const src = state.userData || {};
    const newData = { ...src };
    Object.keys(src).forEach((k) => {
      if (k.startsWith(oldPrefix) && /^.+-q\d+$/.test(k)) {
        const suffix = k.slice(oldPrefix.length);
        const from = k;
        const to = `${newPrefix}${suffix}`;
        if (newData[to] == null) newData[to] = src[from];
        delete newData[from];
        const fromFlag = `${from}__skipped`;
        const toFlag = `${to}__skipped`;
        if (src[fromFlag]) {
          newData[toFlag] = true;
          delete newData[fromFlag];
        }
      }
    });
    state.userData = newData;
  }

  // Asignamos la nueva relación
  state.relationshipType = newRel;
  state.relationshipTypeMapped = newRel;
  try {
    state.userData = state.userData || {};
    state.userData.tipo = newRel;
  } catch {}

  // Validar índice de pregunta para el nuevo set
  const totalQs = getQuestionsCountFor(newRel);
  const idx = Math.max(0, Math.min((state.currentQuestionIndex || 0), totalQs - 1));
  state.currentQuestionIndex = idx;

  return { changed: prevRelNorm !== newRel, prevRel: prevRelNorm, newRel, word };
}

// Helper seguro para encolar tareas en segundo plano
function enqueue(ctx, promise) {
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
    return;
  }
  return promise;
}

// PERSISTENCIA EN SUPABASE (servicio centralizado)
async function persistTurn(env, ctx, { sessionId, userMessage, assistantMessage, state }) {
  try {
    const conversationData = {
      session_id: sessionId,
      current_step: state.currentStep,
      selected_recipient: mapRelationshipTypeForMake(state.relationshipType),
      collected_data: state.userData,
      emotional_profile: {
        last_query_type: state.queryType
      },
      is_complete: state.currentStep === 'complete',
      updated_at: new Date().toISOString()
    };

    const persist = (async () => {
      await upsertConversation(env, conversationData);

      await appendMessage(env, {
        session_id: sessionId,
        sender: 'user',
        content: userMessage,
        step_at_message: state.currentStep,
        query_type: state.queryType,
        timestamp: new Date().toISOString()
      });

      await appendMessage(env, {
        session_id: sessionId,
        sender: 'assistant',
        content: assistantMessage,
        step_at_message: state.currentStep,
        response_time_ms: state.responseTime,
        timestamp: new Date().toISOString()
      });
    })();

    // No invocar la promesa: pasarla tal cual a waitUntil o await
    const maybeAwait = enqueue(ctx, persist);
    if (maybeAwait instanceof Promise) {
      await maybeAwait;
    }

    console.log('✅ Persistencia completada');
  } catch (err) {
    console.error('❌ Error en persistTurn:', err);
  }
}
// MANEJAR PREGUNTAS DEL USUARIO (VERSIÓN HÍBRIDA MEJORADA)
async function handleUserQuestion(userMessage, conversationState, apiKey) {
  const currentStep = conversationState.step || conversationState.currentStep || 'greeting';
  const lowerMessage = (userMessage || '').toLowerCase();
  const history = conversationState.conversationHistory || conversationState.history || [];
  const userData = conversationState.userData || conversationState.collectedData || {};

  // 1. RESPUESTAS DIRECTAS PARA SALUDOS (Nueva funcionalidad)
  if (lowerMessage.includes('como estas') || lowerMessage.includes('cómo estás') || 
      lowerMessage.includes('que tal') || lowerMessage.includes('qué tal') ||
      (lowerMessage.includes('hola') && lowerMessage.includes('tale'))) {
    return "¡Hola! Estoy genial, gracias por preguntar. Me emociona ayudarte a crear una historia única y especial. ¿En qué puedo ayudarte hoy?";
  }

  // 2. RESPUESTAS DIRECTAS PARA DUDAS GENERALES (Nueva funcionalidad)
  if (lowerMessage.includes('duda') || lowerMessage.includes('pregunta') || lowerMessage.includes('ayuda')) {
    return "¡Por supuesto! Estoy aquí para resolver todas tus dudas. ¿Qué te gustaría saber sobre el proceso de creación de tu libro personalizado?";
  }

  // 3. DETECCIÓN CONTEXTUAL DE PREVIEW (Tu funcionalidad existente - MANTENER)
  if (detectPreviewIntent(lowerMessage, history)) {
    const tail = userData['nombre-destinatario']
      ? ` ¿Seguimos con ${userData['nombre-destinatario']}?`
      : " ¿Seguimos con la creación?";
    return knowledgeBase['preview_version'] + tail;
  }

  // 4. KNOWLEDGE BASE DIRECTA (Tu funcionalidad existente - MANTENER Y EXPANDIR)
  if (lowerMessage.includes('precio') || lowerMessage.includes('cuesta') || lowerMessage.includes('cuánto')) {
    return knowledgeBase['precio'];
  }
  if (lowerMessage.includes('tiempo') || lowerMessage.includes('entrega') || lowerMessage.includes('minutos')) {
    return knowledgeBase['tiempo_entrega'];
  }
  if (lowerMessage.includes('previsual') || lowerMessage.includes('preview') || lowerMessage.includes('ver antes')) {
    return knowledgeBase['preview_version'];
  }
  if (
    lowerMessage.includes('dos libros') ||
    lowerMessage.includes('varios libros') ||
    lowerMessage.includes('mismo contenido') ||
    (lowerMessage.includes('a la vez') && lowerMessage.includes('libro'))
  ) {
    return knowledgeBase['multiples_libros'];
  }
  if (lowerMessage.includes('direcciones distintas') || lowerMessage.includes('envío diferente')) {
    return knowledgeBase['envio_direcciones_distintas'];
  }
  if (lowerMessage.includes('soporte') || lowerMessage.includes('contactar') || lowerMessage.includes('ayuda personalizada') || lowerMessage.includes('email')) {
    return knowledgeBase['contacto_soporte'];
  }

  // 4. GUARDIA TEMPRANA: en basic-info no abrimos chat ni llamamos a Gemini
  if (currentStep === 'basic-info') {
    // Si falta algún dato básico, pedir el siguiente
    const nextP = nextBasicInfoPrompt(conversationState);
    if (nextP) {
      return nextP;
    }
    // Si ya están los 4 básicos, lanzar Q1 directamente
    const rel = conversationState?.relationshipType || conversationState?.relationshipTypeMapped || 'friend';
    let firstQ = null;
    if (typeof getFirstQuestionFor === 'function') {
      try { firstQ = getFirstQuestionFor(rel); } catch {}
    }
    if (!firstQ && typeof getFirstQuestion === 'function') {
      try { firstQ = getFirstQuestion(rel); } catch {}
    }
    firstQ = firstQ || (relationshipConfigs?.[rel]?.questions?.[0]) || '¡Empecemos! ¿Cuál es vuestro recuerdo más bonito?';
    return firstQ;
  }

  // 5. FALLBACK INTELIGENTE CON GEMINI (Tu funcionalidad existente - MEJORAR)
  const prompt = `Eres Tale, el asistente empático de MemoryTale.es. El usuario está en el paso "${currentStep}" y ha dicho: "${userMessage}"

Responde de forma empática y útil en máximo 2-3 frases. Si es un saludo, sé cálido y personal. Si es una duda, ofrece ayuda específica. Mantén el tono conversacional y empático. Evita mencionar precio/tiempo salvo que sea necesario.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
      })
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText || generatedText.trim().length < 5) {
      return "Lo siento, no estoy seguro de haber entendido tu pregunta. ¿Podrías explicarme un poco más tu duda? También puedes contactarnos en contacto@memorytale.es si lo prefieres.";
    }
    let fallbackShort;
    if (currentStep === 'basic-info') {
      const hasGender = ['masculino','femenino','no-especificado'].includes(conversationState?.userData?.['genero-autor']);
      if (!conversationState?.userData?.['user-name']) {
        fallbackShort = 'Puedo ayudarte, pero antes sigamos con los datos: ¿Cómo te llamas?';
      } else if (!hasGender) {
        fallbackShort = 'Puedo ayudarte, pero antes sigamos con los datos: ¿Me dices tu pronombre (él/ella/no especificado)?';
      } else {
        fallbackShort = 'Te escucho. ¿Qué te gustaría añadir o preguntar?';
      }
    } else {
      fallbackShort = '¿Te ayudo con algo concreto sobre tu libro?';
    }
    return sanitizeOrFallback(generatedText, fallbackShort);

  } catch (error) {
    console.error('❌ Error manejando pregunta con Gemini:', error);
    return "Disculpa, estoy teniendo problemas para responder a tu duda. ¿Podrías reformularla? Si no, puedes contactarnos en contacto@memorytale.es para ayudarte.";
  }
}

// MAPEO DE TIPOS DE RELACIÓN PARA MAKE.COM
function mapRelationshipTypeForMake(relationshipType) {
  const mapping = {
    'partner': 'partner',
    'sibling': 'sibling', 
    'parent': 'parent',
    'child': 'child',
    'friend': 'friend',
    // Fallbacks para casos legacy:
    'socio': 'partner',
    'hermano': 'sibling',
    'amigo': 'friend'
  };
  return mapping[relationshipType] || relationshipType;
}
}
