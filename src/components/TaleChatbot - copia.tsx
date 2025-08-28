// src/components/TaleChatbot.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ConversationState, createMessage, TaleWorkerFullResponse, PreviewData } from '../types/tale';
import type { UserData, RelationshipType, GenderValue, ConversationStep } from '../types/tale';
import { AIService } from '../services/aiService';
import { formatDataForMake } from '../utils/aiHelpers';
import { MakeWebhookService } from '../services/makeWebhook';
import { BookPreview } from './BookPreview';
import { decideGender } from '../utils/gender';

interface TaleChatbotProps {
  isModal?: boolean;
  onClose?: () => void;
  className?: string;
}

export const TaleChatbot: React.FC<TaleChatbotProps> = ({
  isModal = false,
  onClose,
  className = ''
}) => {
  // Estados para la conversación
  const [conversationState, setConversationState] = useState<ConversationState>(() => {
    const saved = localStorage.getItem('memorytale_conversation_state');
    return saved ? JSON.parse(saved) : {
      step: 'greeting',
      relationshipType: undefined,
      currentQuestionIndex: 0,
      userData: {},
      conversationHistory: []
    };
  });

  // Estado del input y UI
  const [userMessage, setUserMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showBookPreview, setShowBookPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  
  // Gestión de sessionId para persistencia (CRÍTICO)
  const [sessionId, setSessionId] = useState<string>(() => {
    const stored = localStorage.getItem('memorytale_session_id');
    return stored || `mt_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  });

  // Helper para componer imagen con texto overlay con auto-ajuste de fuente
  const composePreviewImage = async (
    baseImageUrl: string,
    text: string
  ): Promise<{ url: string; linesCount: number }> => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = baseImageUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Escala para nitidez en pantallas hi-dpi
      const dpr = window.devicePixelRatio || 1;
      canvas.width = img.width * dpr;
      canvas.height = img.height * dpr;
      ctx.scale(dpr, dpr);
      
      const W = img.width;
      const H = img.height;

      // Esperar a fuentes para evitar medir mal y perder líneas
      try {
        if ((document as any).fonts?.ready) {
          await (document as any).fonts.ready;
        }
      } catch {}

      // Suavizado en canvas (mejor calidad)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fondo
      ctx.drawImage(img, 0, 0, W, H);

      // --- NORMALIZACIÓN DEL TEXTO ---
      const cleanText = (text || '')
        .replace(/[“”«»]/g, '"')
        .replace(/[’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      // Asegurar modo de composición por si quedó alterado
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Caja más alta para dar espacio
      const padX = W * 0.06;
      const boxW = W - padX * 2;
      const boxH = H * 0.42;
      const boxY = H * 0.48 - boxH / 2;

      // Rectángulo redondeado semitransparente
      const fillRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
        const min = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + min, y);
        ctx.arcTo(x + w, y, x + w, y + h, min);
        ctx.arcTo(x + w, y + h, x, y + h, min);
        ctx.arcTo(x, y + h, x, y, min);
        ctx.arcTo(x, y, x + w, y, min);
        ctx.closePath();
        ctx.fill();
      };
      ctx.fillStyle = 'rgba(22, 18, 25, 0.68)';
      fillRoundRect(padX, boxY, boxW, boxH, 24);

      // 4) Auto‑ajuste de fuente (VARIANTE MÁS GRANDE)
      const fontFamily = "Georgia, 'Segoe UI', Arial, sans-serif";
      const lineHeightFactor = 1.28;

      // Más grande y con menos padding lateral para aprovechar el ancho
      let fontSize = Math.min(60, W * 0.07, boxH * 0.24);
      const minFont = Math.max(18, W * 0.022);
      const textPadding = boxW * 0.05;
      const maxTextWidth = boxW - textPadding * 2;

      const wrapText = (text: string, maxWidth: number, font: string): string[] => {
        ctx.font = font;
        const words = (text || '').replace(/\s+/g, ' ').trim().split(' ');
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width <= maxTextWidth) {
            line = test;
          } else {
            if (line) lines.push(line);
            line = w;
          }
        }
        if (line) lines.push(line);
        return lines;
      };

      let lines: string[] = wrapText(cleanText, maxTextWidth, `700 ${fontSize}px ${fontFamily}`);

      // Encaje principal (hasta ~92% de la caja)
      while (fontSize >= minFont) {
        const lineH = fontSize * lineHeightFactor;
        const totalH = lines.length * lineH;
        if (totalH <= boxH * 0.92) break;
        fontSize -= 0.5;
        lines = wrapText(cleanText, maxTextWidth, `700 ${fontSize}px ${fontFamily}`);
      }

      // Reajuste fino si se pasa por poco (escala a 94% del alto)
      {
        const lineH = fontSize * lineHeightFactor;
        const totalH = lines.length * lineH;
        if (totalH > boxH * 0.98) {
          const scale = (boxH * 0.94) / totalH;
          fontSize = Math.max(minFont, fontSize * scale);
          lines = wrapText(cleanText, maxTextWidth, `700 ${fontSize}px ${fontFamily}`);
        }
      }

      ctx.font = `700 ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = Math.max(1, fontSize * 0.08);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = Math.max(0, fontSize * 0.08);

      const lineH = fontSize * lineHeightFactor;
      const totalH = lines.length * lineH;
      const startX = padX + boxW / 2;
      let startY = boxY + Math.max((boxH - totalH) / 2, boxH * 0.08);

      for (const line of lines) {
        ctx.strokeText(line, startX, startY);
        ctx.fillText(line, startX, startY);
        startY += lineH;
      }

      // 👉 exportar cuántas líneas se pintaron
      const linesCount = lines.length;

      return { url: canvas.toDataURL('image/jpeg', 0.92), linesCount };
    } catch (e) {
      console.warn('No se pudo componer imagen, usando base:', e);
      return { url: baseImageUrl, linesCount: 0 };
    }
  };

  // Referencias para scroll automático y servicios
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiService = useRef(new AIService());
  const makeService = useRef(new MakeWebhookService(
    import.meta.env.VITE_MAKE_WEBHOOK_URL,
    import.meta.env.VITE_MAKE_PAYMENT_WEBHOOK_URL || import.meta.env.VITE_MAKE_WEBHOOK_URL
  ));

  // Guardar estado automáticamente
  useEffect(() => {
    localStorage.setItem('memorytale_session_id', sessionId);
  }, [sessionId]);

  useEffect(() => {
    localStorage.setItem('memorytale_conversation_state', JSON.stringify(conversationState));
  }, [conversationState]);

  // Scroll automático al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationState.conversationHistory, currentResponse]);
useEffect(() => {
  setShowStyleSelector(conversationState.step === 'style-selection');
}, [conversationState.step]);

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (conversationState.conversationHistory.length === 0 && !currentResponse) {
      setCurrentResponse(
        "¡Hola! Soy Tale, tu asistente para crear un libro personalizado lleno de recuerdos. " +
        "En solo 3 pasos te haré 6 preguntas sencillas para conocer vuestra relación y después verás una vista previa antes de comprarlo. 💫 " +
        "Cuéntame, ¿para quién será este libro tan especial?"
      );
      // Marcar intro como mostrada para evitar duplicados desde el Worker
      setConversationState(prev => ({ ...prev, __intro_shown: true }));
    }
  }, []);


  type GenderTarget = 'autor' | 'destinatario';

  // Mini-prompt (solo si hay duda)
  function pushAskGenderMessage(
    state: ConversationState,
    target: GenderTarget
  ): ConversationState {
    const label = target === 'autor' ? 'tu género' : 'el género del destinatario';
    const html = `
      <div style="margin-top:12px">
        <div style="margin-bottom:8px">¿Cómo prefieres que lo tratemos en el libro? Puedes elegir "Prefiero no especificarlo".</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="window.__setGender && window.__setGender('${target}','femenino')" 
                  style="background:#5e3b4d;color:#fff;padding:10px 14px;border:none;border-radius:8px;cursor:pointer;font-weight:600">Femenino</button>
          <button onclick="window.__setGender && window.__setGender('${target}','masculino')" 
                  style="background:#5e3b4d;color:#fff;padding:10px 14px;border:none;border-radius:8px;cursor:pointer;font-weight:600">Masculino</button>
          <button onclick="window.__setGender && window.__setGender('${target}','no-especificado')" 
                  style="background:#5e3b4d;color:#fff;padding:10px 14px;border:none;border-radius:8px;cursor:pointer;font-weight:600">Prefiero no especificarlo</button>
        </div>
      </div>
    `;

    // definir handler global (idempotente)
    if (!(window as any).__setGender) {
      (window as any).__setGender = (t: GenderTarget, val: GenderValue) => {
        setConversationState(prev => ({
          ...prev,
          userData: {
            ...prev.userData,
            [t === 'autor' ? 'genero-autor' : 'genero-destinatario']: val
          }
        }));
        setCurrentResponse('¡Perfecto! Continuamos.');
      };
    }

    const msg = createMessage('assistant', html, true);
    return {
      ...state,
      userData: { ...state.userData, __asked_gender: true },
      conversationHistory: [...state.conversationHistory, msg]
    };
  }

  // Inferencia principal
  async function inferGenderIfNeeded(
    state: ConversationState,
    lastUserMessage?: string
  ): Promise<ConversationState> {
    const ud = (state.userData || {}) as UserData;
    const historyTexts = (state.conversationHistory || []).map(m => m.content);
    if (lastUserMessage) historyTexts.push(lastUserMessage);

    let nextState = state;

    // Destinatario
    if (!ud['genero-destinatario'] && ud['nombre-destinatario']) {
      const { gender, confidence } = decideGender(ud['nombre-destinatario'], historyTexts);
      if (confidence >= 0.65) {
        nextState = {
          ...nextState,
          userData: { ...nextState.userData, 'genero-destinatario': gender as GenderValue }
        };
      } else if (!(ud as any).__asked_gender) {
        nextState = pushAskGenderMessage(nextState, 'destinatario');
      }
    }

    // Autor
    if (!ud['genero-autor'] && ud['user-name']) {
      const { gender, confidence } = decideGender(ud['user-name'], historyTexts);
      if (confidence >= 0.65) {
        nextState = {
          ...nextState,
          userData: { ...nextState.userData, 'genero-autor': gender as GenderValue }
        };
      } else if (!(ud as any).__asked_gender) {
        nextState = pushAskGenderMessage(nextState, 'autor');
      }
    }

    return nextState;
  }

  // Función principal de envío de mensajes
const handleSendMessage = async () => {
  if (!userMessage.trim() || isLoading) return;

  setIsLoading(true);
  const messageToSend = userMessage.trim();
  setUserMessage('');

  try {
    const response: TaleWorkerFullResponse = await aiService.current.generateResponse(
      messageToSend,
      conversationState,
      sessionId
    );

    let newState = response.newState;
    
    // Inferir género automáticamente cuando se detectan nombres
    newState = await inferGenderIfNeeded(newState, messageToSend);
    
    setConversationState(newState);
    setShowStyleSelector(newState.step === 'style-selection');

    if (response.taleResponse?.response_text) {
      setCurrentResponse(response.taleResponse.response_text);
    }

    if (response.sessionId && response.sessionId !== sessionId) {
      setSessionId(response.sessionId);
    }

    // Manejar preview
   // ✅ NUEVA LÓGICA PARA WEBHOOK
if (response.taleResponse?.showPreview && response.taleResponse?.previewData) {
  setPreviewData(response.taleResponse.previewData as PreviewData);
  setShowBookPreview(true);
  setCurrentResponse(''); // Limpiamos el texto del asistente al mostrar la preview
}

// ENVIAR A MAKE CUANDO EL FLUJO ESTÉ LISTO
if (newState.step === 'awaiting-payment' || response.isComplete) {
  console.log('🎯 Enviando a Make.com - Step:', newState.step);
  try {
    await handleCompletedConversation(newState);
  } catch (e) {
    console.error('❌ Error enviando a Make:', e);
  }
}


  } catch (error) {
    console.error('Worker/AI error:', error);

    try {
      // Inferencia local (no depende del Worker)
      const recoveredState = await inferGenderIfNeeded(conversationState, messageToSend);

      // Añadimos el mensaje del usuario al historial (necesario porque el Worker no pudo procesarlo)
      const updatedState: ConversationState = {
        ...recoveredState,
        conversationHistory: [
          ...recoveredState.conversationHistory,
          createMessage('user', messageToSend),
        ],
      };

      setConversationState(updatedState);

      const friendlyMsg =
        (error as any)?.message?.includes('503') || (error as any)?.message?.includes('overloaded')
          ? 'Estoy teniendo picos de carga. Seguimos adelante, y en breve reintento la parte más inteligente. 🙏'
          : 'Ups, tuve un pequeño problema técnico. Pero no te preocupes, seguimos con tu libro. 💪';

      setCurrentResponse(friendlyMsg);
    } catch (recoveryError) {
      console.error('❌ Error en recuperación:', recoveryError);
      setCurrentResponse('Lo siento, algo salió mal. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false); // Garantizar que el loader se apaga siempre
    }

    return; // Salimos para no ejecutar lógica posterior
  }

  setIsLoading(false);
};


const handleStyleClick = async (style: 'estiloa' | 'estilob') => {
  setIsLoading(true);
  setShowStyleSelector(false);
  
  try {
    // Asegurar tipo desde conversationState
    const relation = conversationState.relationshipType; // 'sibling' | 'partner' | 'parent' | 'child' | 'friend' | undefined

    // Asegurar valores de género por defecto (última red)
    const ensuredUserData: UserData = {
      ...conversationState.userData,
      'genero-autor': conversationState.userData['genero-autor'] ?? 'no-especificado',
      'genero-destinatario': conversationState.userData['genero-destinatario'] ?? 'no-especificado',
    };
    
    // Sanitizar userData removiendo campos internos
    const { __asked_gender: _ignored, ...rest } = ensuredUserData as Record<string, any>;
    const sanitizedUserData: UserData = rest as UserData;
    
    // Construir userData actualizado con tipo ANTES del order_id
    const updatedUserData = {
      ...sanitizedUserData,
      tipo: relation ?? (conversationState.userData.tipo as any) ?? 'general',
      'estilo-libro': style,
      'privacy-consent': 'accepted',
    };

    const orderId = `mt_${updatedUserData.tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // 1) Guardar order_id en localStorage al generarlo
    localStorage.setItem('memorytale_last_order_id', orderId);

    const updatedState = {
      ...conversationState,
      userData: {
        ...updatedUserData,
        order_id: orderId,
      },
      step: 'sending-to-make' as const,
      currentStep: 'sending-to-make' as const
    };
    
    setConversationState(updatedState);
    
    // Mensaje inmediato sobre el estilo seleccionado
    const styleMessage = style === 'estiloa' 
      ? '¡Perfecto! Has elegido un estilo clásico y elegante.'
      : '¡Perfecto! Has elegido un estilo moderno y elegante.';
    
    setCurrentResponse(styleMessage);
    
    // Enviar datos a Make automáticamente
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 1) Feedback inmediato al usuario
    setCurrentResponse(
      "¡Genial! Estoy preparando una vista previa de tu libro. No cierres esta ventana; en muy poquito te la enseño aquí mismo. 😊"
    );
    
    const result = await makeService.current.sendBookData(updatedState.userData);
    console.log('📤 Resultado completo de Make.com:', result);
    console.log('✅ Paso a preview con:', result);

    if (result.success) {
      // Pasamos a preview preservando estilo y tipo
      const stateAfterMake = {
        ...updatedState,
        step: 'preview' as const,
        currentStep: 'preview' as const
      };
      setConversationState(stateAfterMake);
      
      // 2) También cuando recibimos la preview, asegurarnos de persistir
      localStorage.setItem('memorytale_last_order_id', orderId);

if (result.previewText || result.previewImageUrl || result.previewUrl) {
  setCurrentResponse('¡Hemos terminado el proceso! Te muestro una vista previa de tu libro.');
  
  // Determinar imagen base con guardas defensivas
  const selectedStyle = (stateAfterMake.userData['estilo-libro'] as 'estiloa'|'estilob') || 'estiloa';
  const relation = stateAfterMake.relationshipType || stateAfterMake.userData.tipo || 'sibling';
  let baseImage = result.previewImageUrl || result.previewUrl || '';
  
  if (!baseImage) {
    baseImage = `/assets/libro_imagenes/${relation}_${selectedStyle}.jpg`;
    console.log('🖼️ Usando imagen local:', baseImage);
  }

  let composedUrl = baseImage;
  let overlayOk: boolean | undefined = undefined;
  if (result.previewText && !result.previewImageUrl) {
    // solo componemos si Make no envía imagen
    try {
      const composed = await composePreviewImage(baseImage, result.previewText);
      overlayOk = (composed?.linesCount ?? 0) > 0;
      composedUrl = composed?.url || baseImage;
      console.log('🎨 Imagen compuesta creada con éxito');
      console.log('🖋️ Overlay líneas dibujadas:', overlayOk ? 'sí' : 'no');
    } catch (e) {
      console.warn('No se pudo componer imagen, uso base:', e);
      overlayOk = false;
    }
  }

  const previewDataForComponent = {
    success: true,
    ready: true,
    previewText: result.previewText || '',
    previewImageUrl: composedUrl,
    overlayTextRendered: overlayOk,
    orderId: result.orderId || stateAfterMake.userData.order_id,
    pages: result.previewText ? [{ type: 'text', content: result.previewText }] : []
  };
  
  setPreviewData(previewDataForComponent);
  
  setTimeout(() => {
    setShowBookPreview(true);
    setCurrentResponse('');
  }, 600);
} else {
  setCurrentResponse(
    '¡Hemos terminado el proceso! Mantente unos minutos sin salir para ver la previsualización de un fragmento de cómo sería tu libro.'
  );
  // Establecer datos de preview fallback
  setPreviewData({ ready: true, pages: [] });
  // Si usas un modal/componente de preview, aquí lo activarías:
  setTimeout(() => { setShowBookPreview(true); setCurrentResponse(''); }, 3000);
}
    } else {
      // Manejo de error real
      console.error('❌ Error Make.com:', result.error);
      setCurrentResponse(`Ha habido un problema al procesar tu libro: ${result.error ?? 'inténtalo de nuevo.'}`);
      // Si de verdad hubo fallo, puedes volver a 'style-selection'; si fue un "ok" sin preview, no lo hagas.
      setConversationState(prev => ({ ...prev, step: 'style-selection' as const }));
      setShowStyleSelector(true);
    }
  } catch (error) {
    console.error('❌ Error en handleStyleClick:', error);
    setCurrentResponse('Ha ocurrido un problema técnico. Por favor, selecciona el estilo de nuevo.');
    setShowStyleSelector(true);
    setConversationState(prev => ({
      ...prev,
      step: 'style-selection' as const
    }));
  } finally {
    setIsLoading(false);
  }
};


  // Manejar pago con Stripe (Scenario 2)
  const handlePayment = async () => {
    // Blindaje doble clic
    if (isLoading) return;
    setIsLoading(true);
    setCurrentResponse('Procesando tu pedido... Te voy a redirigir a la pasarela de pago segura.');

    try {
      const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK_URL?.trim();
      const DEBUG = import.meta.env.VITE_DEBUG === 'true';
      
      // Rehidratar order_id si falta
      let orderId = (conversationState.userData as any)?.order_id;
      if (DEBUG) console.log('💾 Estado inicial orderId:', orderId);
      
      if (!orderId) {
        try { 
          orderId = localStorage.getItem('memorytale_last_order_id') || '';
          if (DEBUG) console.log('💾 Rehidratando desde localStorage:', orderId);
          if (orderId) {
            setConversationState(prev => ({ 
              ...prev, 
              userData: { ...prev.userData, order_id: orderId }
            }));
          }
        } catch {}
      }
      
      // Fallback a previewData si existe
      if (!orderId && previewData?.orderId) {
        orderId = previewData.orderId;
        try { localStorage.setItem('memorytale_last_order_id', orderId); } catch {}
        setConversationState(prev => ({ 
          ...prev, 
          userData: { ...prev.userData, order_id: orderId }
        }));
      }
      
      if (!orderId) {
        console.error('❌ No se encontró order_id');
        setCurrentResponse('Falta el identificador del pedido. Por favor, vuelve a elegir el estilo del libro.');
        setShowStyleSelector(true);
        setConversationState(prev => ({ ...prev, step: 'style-selection' as const }));
        setIsLoading(false);
        return;
      }

      const email = (conversationState.userData as any)?.['user-email'] ?? '';
      const name = (conversationState.userData as any)?.['user-name'] ?? '';

      // Prioridad 1: Payment Link directo si está configurado
      if (paymentLink) {
        if (DEBUG) {
          console.log('🔧 URL params:', {
            paymentLink: !!paymentLink,
            orderId,
            emailLen: (email || '').length,
            nameLen: (name || '').length,
          });
        }
        const url = buildPaymentLinkUrl(paymentLink, orderId, email, name);
        if (url) {
          console.log('🔗 Usando Payment Link directo:', url);
          
          // Tracking analytics si está disponible
          try {
            (window as any).track?.('stripe_checkout', {
              order_id: orderId,
              recip: conversationState.relationshipType
            });
          } catch {}
          
          setCurrentResponse('¡Perfecto! Te redirijo a la pasarela de pago segura…');
          setTimeout(() => { window.location.href = url; }, 1200);
          return;
        }
      }

      // 🔁 Fallback: Make (flujo actual)
      if (DEBUG) console.log('🔁 Payment Link no configurado o inválido, usando fallback a Make');
      const paymentData = { 
        ...(conversationState.userData as any), 
        payment_request: true, 
        scenario: 2,
        order_id: orderId
      };
      
      if (DEBUG) console.log('📤 Enviando a Make:', { scenario: 2, orderId });
      const result = await makeService.current.sendPaymentRequest(paymentData);

      if (result.success && result.stripeUrl) {
        const stripeUrl = result.stripeUrl;
        console.log('🔗 Redirigiendo a Stripe (via Make):', stripeUrl);
        setCurrentResponse('¡Perfecto! Te redirijo a la pasarela de pago segura…');
        setTimeout(() => { window.location.href = stripeUrl; }, 1200);
        return;
      }
      
      if (result.success && !result.stripeUrl) {
        setCurrentResponse('¡Listo! Tu libro está siendo procesado. Lo recibirás por email.');
        setTimeout(() => { handleNewConversation(); }, 3000);
        return;
      }
      
      setCurrentResponse(`Ha habido un problema con el pago: ${result.error ?? 'inténtalo de nuevo'}.`);
    } catch (error) {
      console.error('Error en flujo de pago:', error);
      setCurrentResponse('Ha habido un problema técnico con el procesamiento del pago. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Nueva conversación
  const handleNewConversation = () => {
    setConversationState({
      step: 'greeting',
      relationshipType: undefined,
      currentQuestionIndex: 0,
      userData: {},
      conversationHistory: [],
      __intro_shown: true
    });
    setShowBookPreview(false);
    setShowStyleSelector(false);
    setPreviewData(null);
    setCurrentResponse(
      "¡Hola! Soy Tale, tu asistente para crear un libro personalizado lleno de recuerdos. " +
      "En solo 3 pasos te haré 6 preguntas sencillas para conocer vuestra relación y después verás una vista previa antes de comprarlo. 💫 " +
      "Cuéntame, ¿para quién será este libro tan especial?"
    );
    localStorage.removeItem('memorytale_conversation_state');
    localStorage.removeItem('memorytale_last_order_id'); // Limpiar también el order_id
    
    // Limpiar handler global de género
    if ((window as any).__setGender) {
      delete (window as any).__setGender;
    }
    
    const newSessionId = `mt_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setSessionId(newSessionId);
  };
  
  // Manejar conversación completada (obsoleto, mantenido por compatibilidad)
  const handleCompletedConversation = async (state: ConversationState) => {
    // Esta función ya no se usa, el envío a Make se hace en handleStyleClick
    console.log('handleCompletedConversation llamado (obsoleto)');
  };

  // Manejar Enter en el input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

// Porcentaje base por etapa
const STEP_PROGRESS: Partial<Record<ConversationStep | 'completed', number>> = {
  'greeting': 5,
  'basic-info': 15,
  'questions': 40,           // se interpola entre 20-60
  'email-capture': 65,       // después de preguntas, antes de estilo
  'style-selection': 70,
  'preview': 85,             // evitar volver a 0% al mostrar la preview
  'sending-to-make': 90,
  'awaiting-payment': 95,
  'complete': 100,
  'completed': 100,          // compatibilidad si se usa 'completed'
};

// Preguntas totales por relación
const QUESTIONS_TOTAL: Partial<Record<RelationshipType, number>> = {
  partner: 6,
  sibling: 6,
  parent: 6,
  child: 6,
  friend: 6,
};

const getProgress = () => {
const rawStep = (conversationState.step ?? conversationState.currentStep ?? 'greeting') as ConversationStep | 'completed';
const step: ConversationStep = rawStep === 'completed' ? 'complete' : (rawStep as ConversationStep);

  // Interpolación especial para preguntas
  if (step === 'questions' && conversationState.relationshipType) {
    const total = QUESTIONS_TOTAL[conversationState.relationshipType] ?? 6;
    // Contar solo respuestas no vacías
    const answered = Object.entries(conversationState.userData || {})
      .filter(([k, v]) =>
        k.startsWith(`${conversationState.relationshipType}-q`) &&
        String(v ?? '').trim().length > 0
      ).length;

    const start = 20; // progreso al iniciar preguntas
    const end = 60;   // progreso al terminar preguntas
    const fraction = total > 0 ? Math.min(1, answered / total) : 0;

    const value = Math.round(start + (end - start) * fraction);
    return Math.max(0, Math.min(100, value));
  }

  // Para cualquier otro step, usar el mapeo directo
  const value = STEP_PROGRESS[step] ?? 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

// Helper para construir la URL de pago con blindaje
const buildPaymentLinkUrl = (base: string, orderId: string, email?: string, name?: string) => {
  try {
    const url = new URL(base);
    if (orderId) url.searchParams.set('client_reference_id', orderId);
    if (email) url.searchParams.set('prefilled_email', email);
    if (name) url.searchParams.set('customer_name', name);
    return url.toString();
  } catch {
    return ''; // fuerza fallback a Make
  }
};

// ✅ Añade esto justo aquí:
// Mejora la función getImageSrc:
const getImageSrc = (style: 'estiloa' | 'estilob') => {
  const relation = conversationState.relationshipType;
  if (!relation) return '';
  
  // Como tu Worker ya devuelve tipos en inglés, no necesitas mapeo adicional
  return `/assets/libro_imagenes/${relation}_${style}.jpg`;
};
const formatTimestamp = (timestamp: any) => {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp === 'string' 
      ? new Date(timestamp) 
      : timestamp;
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) {
    console.error('Error formateando timestamp:', e);
    return '';
  }
};

  // Renderizado del componente
return (
  <div className={`memorytale-chatbot tale-chatbot ${isModal ? 'tale-chatbot-modal' : ''} ${className}`}>

      {/* Header del chatbot */}
      <div className="tale-chatbot-header">
        <div className="tale-chatbot-info">
          <h3>Tale - Asistente MemoryTale</h3>
          <p>Creando tu historia personalizada • Sesión: {sessionId.slice(-8)}</p>
        </div>
        {onClose && (
          <button className="tale-chatbot-close" onClick={onClose} aria-label="Cerrar chat">
            ✕
          </button>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="tale-progress-container">
        <div className="tale-progress-bar">
          <div 
            className="tale-progress-fill" 
            style={{ width: `${getProgress()}%` }}
          />
        </div>
        <span className="tale-progress-text">
          {Math.round(getProgress())}% completado
        </span>
      </div>

      {/* Área de mensajes */}
      <div className="tale-messages-container">
        {/* Historial de mensajes */}
        {conversationState.conversationHistory.map((message, index) => (
          <div 
            key={message.id || index} 
            className={`tale-message tale-message-${message.type}`}
          >
            <div className="tale-message-content">
<div className="tale-message-bubble">
  {(message as any).isHtml ? (
    <div dangerouslySetInnerHTML={{ __html: message.content }} />
  ) : (
    message.content
  )}
</div>
<div className="tale-message-time">
  {formatTimestamp(message.timestamp)}
</div>

            </div>
          </div>
        ))}


{currentResponse && !conversationState.conversationHistory.some(msg => 
  msg.type === 'assistant' && msg.content === currentResponse
) && (
  <div className="tale-message tale-message-assistant">
    <div className="tale-message-content">
      <div className="tale-message-bubble">
        {currentResponse}
      </div>
      <div className="tale-message-time">
        {new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </div>
    </div>
  </div>
)}


        {/* Indicador de escritura */}
        {isLoading && (
          <div className="tale-message tale-message-assistant">
            <div className="tale-message-content">
              <div className="tale-message-bubble tale-typing-indicator">
                <span></span><span></span><span></span>
                Tale está escribiendo...
              </div>
            </div>
          </div>
        )}

        {showBookPreview && (
          <BookPreview 
            userData={conversationState.userData as UserData}
            previewData={previewData}
            onPayment={handlePayment}
          />
        )}
        
        <div ref={messagesEndRef} />
{showStyleSelector && (
  <div className="tale-style-selector">
    <div
      onClick={() => handleStyleClick('estiloa')}
      style={{ 
        cursor: 'pointer', 
        border: '1px solid #eee', 
        borderRadius: 12, 
        overflow: 'hidden', 
        marginBottom: 12 
      }}
      title="Estilo A (romántico / clásico)"
    >
      <img
        src={getImageSrc('estiloa')}
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          // Fallback 1: Intentar .webp
          if (target.src.includes('.jpg')) {
            target.src = target.src.replace('.jpg', '.webp');
          } else if (target.src.includes('.webp')) {
            // Fallback 2: SVG placeholder elegante
            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjZjhmNmY0Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzVlM2I0ZCI+RXN0aWxvIEE8L3RleHQ+Cjwvc3ZnPgo=';
          }
        }}
        alt="Estilo A"
        style={{ width: '100%', display: 'block' }}
      />
      <div style={{ padding: 8, fontSize: 12, textAlign: 'center' }}>
        Estilo A (romántico / clásico)
      </div>
    </div>

    <div
      onClick={() => handleStyleClick('estilob')}
      style={{ 
        cursor: 'pointer', 
        border: '1px solid #eee', 
        borderRadius: 12, 
        overflow: 'hidden' 
      }}
      title="Estilo B (moderno / minimalista)"
    >
      <img
        src={getImageSrc('estilob')}
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          if (target.src.includes('.jpg')) {
            target.src = target.src.replace('.jpg', '.webp');
          } else if (target.src.includes('.webp')) {
            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjZjBmZGZmIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iNzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzM2NzNkYyI+RXN0aWxvIEI8L3RleHQ+Cjwvc3ZnPgo=';
          }
        }}
        alt="Estilo B"
        style={{ width: '100%', display: 'block' }}
      />
      <div style={{ padding: 8, fontSize: 12, textAlign: 'center' }}>
        Estilo B (moderno / minimalista)
      </div>
    </div>
  </div>
)}

      </div>

      {/* Área de input */}
      <div className="tale-input-container">
        <div className="tale-input-wrapper">
          <input
            type="text"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Cuéntame tu historia..."
            className="tale-input"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!userMessage.trim() || isLoading}
            className="tale-send-button"
            aria-label="Enviar mensaje"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
        
        {/* Información contextual */}
        <div className="tale-context-info">
          {conversationState.relationshipType && (
            <span className="tale-context-tag">
              {conversationState.relationshipType === 'partner' ? '💕 Pareja' :
               conversationState.relationshipType === 'sibling' ? '👫 Hermano/a' :
               conversationState.relationshipType === 'parent' ? '👨‍👩‍👧‍👦 Padre/Madre' :
               conversationState.relationshipType === 'child' ? '👶 Hijo/a' :
               conversationState.relationshipType === 'friend' ? '👯‍♀️ Amigo/a' : ''}
            </span>
          )}
          {conversationState.userData['nombre-destinatario'] && (
            <span className="tale-context-tag">
              📝 Para: {conversationState.userData['nombre-destinatario'] ?? ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};


export default TaleChatbot;
