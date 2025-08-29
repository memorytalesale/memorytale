// === MemoryTale – main.js (Versión única y depurada - 20 JUN 2025) ===
// ⚠️  IMPORTANTE: asegúrate de que solo se carga **una** copia de este archivo para evitar duplicar listeners.
let abrirDesdeVisor = false;
// ────  FUSIBLE PARA BLOQUEAR EL AUTO-SAVE CUANDO RESETEAMOS ────
let skipAutoSave = false;      // si es true, NO se guarda en beforeunload

// --- Centro de control: textos y rutas de imágenes ---
const designContent = {
  partner: {
    estiloa: {
      images: {
        cover      : 'assets/libro_imagenes/partner/EstiloA/part_port_est_A.webp',
        chapter    : 'assets/libro_imagenes/partner/EstiloA/part_cap_est_A.webp',
        conclusion : 'assets/libro_imagenes/partner/EstiloA/part_conc_est_A.webp'
      },
      title: 'Estilo A: Romántico',
      description: 'Un diseño clásico y evocador, perfecto para vuestra historia de amor.'
    },
    estilob: {
      images: {
        cover      : 'assets/libro_imagenes/partner/EstiloB/part_port_est_B.webp',
        chapter    : 'assets/libro_imagenes/partner/EstiloB/part_cap_est_B.webp',
        conclusion : 'assets/libro_imagenes/partner/EstiloB/part_conc_est_B.webp'
      },
      title: 'Estilo B: Moderno',
      description: 'Minimalista y elegante, donde vuestras palabras y recuerdos son los protagonistas.'
    }
  },

  parent: {
    estiloa: {
      images: {
        cover      : 'assets/libro_imagenes/parent/EstiloA/parent_port_est_A.webp',
        chapter    : 'assets/libro_imagenes/parent/EstiloA/parent_cap_est_A.webp',
        conclusion : 'assets/libro_imagenes/parent/EstiloA/parent_conc_est_A.webp'
      },
      title: 'Estilo A: Legado',
      description: 'Un diseño atemporal y respetuoso para honrar una vida de amor y enseñanzas.'
    },
    estilob: {
      images: {
        cover      : 'assets/libro_imagenes/parent/EstiloB/parent_port_est_B.webp',
        chapter    : 'assets/libro_imagenes/parent/EstiloB/parent_cap_est_B.webp',
        conclusion : 'assets/libro_imagenes/parent/EstiloB/parent_conc_est_B.webp'
      },
      title: 'Estilo B: Afectuoso',
      description: 'Con tonos cálidos y detalles que evocan la sensación de un abrazo familiar.'
    }
  },

  child: {
    estiloa: {
      images: {
        cover      : 'assets/libro_imagenes/child/EstiloA/child_port_est_A.webp',
        chapter    : 'assets/libro_imagenes/child/EstiloA/child_cap_est_A.webp',
        conclusion : 'assets/libro_imagenes/child/EstiloA/child_conc_est_A.webp'
      },
      title: 'Estilo A: Aventura',
      description: 'Un diseño vibrante y dinámico que captura la energía y la alegría de la infancia.'
    },
    estilob: {
      images: {
        cover      : 'assets/libro_imagenes/child/EstiloB/child_port_est_B.webp',
        chapter    : 'assets/libro_imagenes/child/EstiloB/child_cap_est_B.webp',
        conclusion : 'assets/libro_imagenes/child/EstiloB/child_conc_est_B.webp'
      },
      title: 'Estilo B: Cuento',
      description: 'Mágico y tierno, con ilustraciones y colores que parecen sacados de un sueño.'
    }
  },

  sibling: {
    estiloa: {
      images: {
        cover      : 'assets/libro_imagenes/Sibling/EstiloA/sibling_port_est_A.webp',
        chapter    : 'assets/libro_imagenes/Sibling/EstiloA/sibling_cap_est_A.webp',
        conclusion : 'assets/libro_imagenes/Sibling/EstiloA/sibling_conc_est_A.webp'
      },
      title: 'Estilo A: Cómplices',
      description: 'Un diseño fresco y divertido que refleja la energía de vuestra complicidad única.'
    },
    estilob: {
      images: {
        cover      : 'assets/libro_imagenes/Sibling/EstiloB/sibling_port_est_B.webp',
        chapter    : 'assets/libro_imagenes/Sibling/EstiloB/sibling_cap_est_B.webp',
        conclusion : 'assets/libro_imagenes/Sibling/EstiloB/sibling_conc_est_B.webp'
      },
      title: 'Estilo B: Recuerdos',
      description: 'Con un aire nostálgico, como un álbum de fotos, ideal para vuestras anécdotas.'
    }
  },

  friend: {
    estiloa: {
      images: {
        cover      : 'assets/libro_imagenes/friend/EstiloA/friend_port_est_A.webp',
        chapter    : 'assets/libro_imagenes/friend/EstiloA/friend_cap_est_A.webp',
        conclusion : 'assets/libro_imagenes/friend/EstiloA/friend_conc_est_A.webp'
      },
      title: 'Estilo A: Incondicional',
      description: 'Limpio y directo, celebrando una amistad sólida y a prueba de todo.'
    },
    estilob: {
      images: {
        cover      : 'assets/libro_imagenes/friend/EstiloB/friend_port_est_B.webp',
        chapter    : 'assets/libro_imagenes/friend/EstiloB/friend_cap_est_B.webp',
        conclusion : 'assets/libro_imagenes/friend/EstiloB/friend_conc_est_B.webp'
      },
      title: 'Estilo B: Confidencias',
      description: 'Acogedor e íntimo, como sentarse a tomar un café y contarse la vida.'
    }
  }
};
window.memoryTaleBridge = window.memoryTaleBridge || {};
window.memoryTaleBridge.designContent = designContent;


window.memoryTaleBridge.triggerPreviewFromChatbot = async (chatbotCollectedData, previewData) => {
  console.log("MemoryTale Bridge: Received data from chatbot.", chatbotCollectedData);

  // 1. Poblar datos globales
  window.jsonData = window.jsonData || {};
  Object.assign(window.jsonData, chatbotCollectedData);

  // ✅ VALIDACIÓN DEFENSIVA: Asegurar order_id (fallback si el Worker falla)
  if (!window.jsonData.order_id) {
    window.jsonData.order_id = `mt_${window.jsonData.tipo || 'partner'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log('🆔 Order ID generado como fallback:', window.jsonData.order_id);
  } else {
    console.log('✅ Order ID recibido del Worker:', window.jsonData.order_id);
  }

  // ✅ VALIDACIÓN DEFENSIVA: Asegurar user-email
  if (!window.jsonData['user-email']) {
    console.error('❌ CRÍTICO: Falta user-email en datos del chatbot');
    console.error('📊 Datos recibidos:', chatbotCollectedData);
    
    // Mostrar mensaje de error en el chatbot
    const chatbotElement = document.querySelector('memorytale-chatbot');
    if (chatbotElement && typeof chatbotElement.addMessage === 'function') {
      chatbotElement.addMessage('tale', {
        response_text: 'Ha ocurrido un problema técnico al procesar tu email. Por favor, intenta de nuevo o usa el formulario principal.',
        tips: 'Si el problema persiste, puedes contactarnos directamente.'
      });
    }
    return;
  }

  // ✅ VALIDACIÓN DEFENSIVA: Asegurar tipo de destinatario
  if (!window.jsonData.tipo) {
    window.jsonData.tipo = 'partner';
    console.log('⚠️ Tipo de destinatario no encontrado, usando fallback: partner');
  }

  // ✅ VALIDACIÓN DEFENSIVA: Asegurar privacy-consent
  if (!window.jsonData['privacy-consent']) {
    window.jsonData['privacy-consent'] = 'accepted';
    console.log('✅ Privacy consent añadido automáticamente');
  }

  // 2. Configurar variables globales
  if (chatbotCollectedData.tipo) {
    window.selectedRecipient = chatbotCollectedData.tipo;
    const tipoInput = document.getElementById('tipo-input');
    if (tipoInput) tipoInput.value = window.selectedRecipient;
  }
  
  window.currentOrderId = window.jsonData.order_id;
  
  // ✅ DEBUG: Mostrar payload completo antes de enviar a Make
  console.log('📦 Payload completo para Make.com:', window.jsonData);
  
  // ✅ VALIDACIÓN: Verificar campos críticos antes de continuar
  const requiredFields = ['user-email', 'order_id', 'tipo'];
  const missingFields = requiredFields.filter(field => !window.jsonData[field]);
  
  if (missingFields.length > 0) {
    console.error('❌ CRÍTICO: Faltan campos obligatorios:', missingFields);
    console.error('📊 Datos actuales:', window.jsonData);
    
    // Mostrar mensaje de error en el chatbot
    const chatbotElement = document.querySelector('memorytale-chatbot');
    if (chatbotElement && typeof chatbotElement.addMessage === 'function') {
      chatbotElement.addMessage('tale', {
        response_text: 'Ha ocurrido un problema técnico al procesar tus datos. Por favor, intenta de nuevo.',
        tips: 'Si el problema persiste, puedes usar el formulario principal para completar tu libro.'
      });
    }
    return;
  }

  // 3. ✅ SIMPLIFICADO: Llamar directamente a generateAndShowPreview
  // Esta función ahora se encarga de todo: generar imagen Y pasarla al chatbot
  console.log('✅ Generando preview y mostrando en chatbot...');
  
  try {
    await window.generateAndShowPreview(window.jsonData);
    console.log('✅ Preview generado exitosamente');
  } catch (error) {
    console.error('❌ Error generando preview:', error);
    
    // Mostrar mensaje de error en el chatbot
    const chatbotElement = document.querySelector('memorytale-chatbot');
    if (chatbotElement && typeof chatbotElement.addMessage === 'function') {
      chatbotElement.addMessage('tale', {
        response_text: 'Ha ocurrido un problema al generar tu preview. Estamos trabajando para solucionarlo.',
        tips: 'Puedes intentar de nuevo en unos minutos o contactarnos para ayudarte personalmente.'
      });
    }
    return;
  }

  // 4. ✅ NUEVO: Función global para proceder al pago
  window.proceedToPayment = function() {
    console.log('💳 Procediendo al pago desde el chatbot...');
    console.log('💳 Order ID para pago:', window.currentOrderId);
    
    // Abrir el formulario modal y ir al paso de preview/pago
    const formModal = document.getElementById('form-modal');
    if (formModal) {
      formModal.style.display = 'flex';
      formModal.removeAttribute('aria-hidden');
      document.body.classList.add('modal-open');
    }
    
    // Ir al paso de preview donde está el botón de pago
    const formSteps = Array.from(document.querySelectorAll('.form-step'));
    const previewStepIndex = formSteps.findIndex(s => s.id === 'preview');
    if (previewStepIndex !== -1 && typeof window.showStep === 'function') {
      window.showStep(previewStepIndex);
    } else {
      console.error('❌ No se pudo encontrar el paso de preview');
    }
  };

  // 5. Analytics con datos más completos
  if (typeof window.track === 'function') {
    window.track('chatbot_completed_and_handed_off', { 
      recipient: window.selectedRecipient,
      order_id: window.currentOrderId,
      user_email: window.jsonData['user-email'],
      via_chatbot: true
    });
  }

  console.log('✅ Bridge ejecutado exitosamente');
  console.log('🎯 Datos finales transferidos:', {
    order_id: window.currentOrderId,
    recipient: window.selectedRecipient,
    email: window.jsonData['user-email']
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // Selectores Globales
  const modal                = document.getElementById('form-modal');
  const createBookBtn        = document.getElementById('create-book-btn');
  createBookBtn?.addEventListener('click', () => {
  track('form_opened');
});
const createBookBtnHeader = document.querySelector('.open-formulario');
  createBookBtnHeader?.addEventListener('click', () => {
  track('form_opened');
});
  const closeModal           = document.querySelector('.close-modal');
  const bookForm             = document.getElementById('book-form');
  const nextButtons          = document.querySelectorAll('.next-btn');
  const backButtons          = document.querySelectorAll('.back-btn');
    const recipientOptions = document.querySelectorAll('.recipient-option');

recipientOptions.forEach(option => {
  option.addEventListener('click', () => {
    const tipo = option.dataset.recipient || option.value || option.id || 'desconocido';
    track('recipient_selected', { recipient: tipo });
  });
});
  const progressTitle        = document.getElementById('progress-title');
  const startBtn             = document.getElementById('start-btn');
  const consejosContinuarBtn = document.querySelector('.continuar-consejos');



  // Pasos del formulario (deben estar listos desde el inicio)
  const formSteps = Array.from(document.querySelectorAll('.form-step'));
 const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // === Accesibilidad ARIA para los paneles ===
  (function initAriaPanels() {
    const wrapper = document.getElementById('wizard-panels') || document.querySelector('.modal-content');
    if (wrapper) wrapper.setAttribute('role', 'tablist');

    document.querySelectorAll('.form-step').forEach(step => {
      step.setAttribute('role', 'tabpanel');
      step.setAttribute('tabindex', '0');

      const title = step.querySelector('.question-title, h3, h2');
      if (title) {
        if (!title.id) title.id = `title-${step.id || Math.random().toString(36).slice(2)}`;
        step.setAttribute('aria-labelledby', title.id);
      }
    });
  })();

function track(name, params = {}) {
  if (typeof gtag === 'function') {
    gtag('event', name, params);
    console.log('📈 Evento GA4 enviado:', name, params);
  } else {
    console.warn('❗gtag no está disponible aún:', name);
  }
}


// === Estado del formulario ===
window.currentStep = 0;
window.selectedRecipient = '';
window.jsonData = {};
window.currentOrderId = null;
window.lastTrigger = null;



/* === Autoguardado persistente === */
const LS_KEY = 'memorytale_form_progress';
const resumeDialog = document.getElementById('resume-dialog');
let btnReset = null;
let btnContinue = null;

if (resumeDialog) {
  btnReset    = resumeDialog.querySelector('[data-action="reset"]');
  btnContinue = resumeDialog.querySelector('[data-action="continue"]');

  // Mostrar el diálogo si hay borrador guardado
  if (localStorage.getItem(LS_KEY)) resumeDialog.showModal();
}


/* mostrar el diálogo si hay borrador */
if (localStorage.getItem(LS_KEY)) resumeDialog.showModal();

/* cancelar = vaciar y recargar */
btnReset.addEventListener('click', () => {
  localStorage.removeItem(LS_KEY);   // 1. borrar borrador
  skipAutoSave = true;               // 2. desactivar autoguardado temporal
  resumeDialog.close();              // 3. cerrar diálogo
  
    bookForm?.reset();                 // 💡 limpiar los campos visibles
  selectedRecipient = '';           // 💡 reiniciar lógica interna
  // 4. ARRANCAR WIZARD DESDE CERO (sin recargar)
  openModal();                       // abre #form-modal
  showStep(0);                       // primer paso: selector de destinatario
});

/* continuar = cerrar y abrir wizard */
btnContinue.addEventListener('click', () => {
  resumeDialog.close();
  document.body.classList.remove('dialog-backdrop');
  openModal();          // tu función que abre #form-modal
});

function saveFormProgress() {
  if (!bookForm) return;

  /* ① Activamos temporalmente TODOS los campos para que FormData los capture */
  const previouslyDisabled = [];
  bookForm.querySelectorAll('[disabled]').forEach(el => {
    previouslyDisabled.push(el);
    el.disabled = false;
  });

  /* ② Recogemos SOLO los valores relevantes */
  const formData = new FormData(bookForm);

  const COMMON_KEYS = [
    'tipo', 'user-name', 'user-email', 'genero-autor',
    'nombre-destinatario', 'genero-destinatario', 'estilo-libro',
    'privacy-consent'
  ];

  const filteredData = {};
  for (const [key, value] of formData.entries()) {
    if (
      COMMON_KEYS.includes(key) ||
      (selectedRecipient && key.startsWith(`${selectedRecipient}-`))
    ) {
      filteredData[key] = value;
    }
  }

  // 🔥 CRÍTICO: Capturar radio buttons específicamente (incluso si FormData los perdió)
  if (selectedRecipient && !filteredData['tipo']) {
    filteredData['tipo'] = selectedRecipient;
  }

  // Capturar estilo seleccionado específicamente
  const estiloRadio = document.querySelector('input[name="estilo-libro"]:checked');
  if (estiloRadio && !filteredData['estilo-libro']) {
    filteredData['estilo-libro'] = estiloRadio.value;
  }

  // Capturar género destinatario específicamente
  const generoDestinatario = document.querySelector('input[name="genero-destinatario"]:checked');
  if (generoDestinatario && !filteredData['genero-destinatario']) {
    filteredData['genero-destinatario'] = generoDestinatario.value;
  }

  // Capturar género autor específicamente
  const generoAutor = document.querySelector('input[name="genero-autor"]:checked');
  if (generoAutor && !filteredData['genero-autor']) {
    filteredData['genero-autor'] = generoAutor.value;
  }

  const dataToSave = {
    form_data: filteredData,
    selected_recipient: selectedRecipient,
    last_step_id: formSteps[currentStep]?.id || null
  };
  
  localStorage.setItem(LS_KEY, JSON.stringify(dataToSave));
  console.log('💾 Autoguardado completado:', filteredData);

  /* ③ Restauramos el estado original */
  previouslyDisabled.forEach(el => { el.disabled = true; });
}

window.addEventListener('beforeunload', () => {
  if (!skipAutoSave) {               // ← se salta cuando pulsemos “Cancelar”
    try { saveFormProgress(); } catch (_) {}
  }
});

/* ----------  Modal legal interno  ---------- */
const legalDialog   = document.getElementById('legal-dialog');
const legalContent  = legalDialog.querySelector('.legal-content');
const closeLegalBtn = legalDialog.querySelector('.legal-close');

document.querySelectorAll('.legal-btn').forEach(btn=>{
  btn.addEventListener('click', async () => {
    const doc = btn.dataset.doc;              // "privacidad" o "terminos"
    saveFormProgress();                       // 💾 por si acaso

    // Lazy-load: cada doc se trae solo la 1.ª vez
    if(!legalContent.dataset[doc]){
      const res  = await fetch(`/${doc}.html`);
      legalContent.innerHTML = await res.text();
      legalContent.dataset[doc] = "loaded";
    }

    legalDialog.showModal();
    legalContent.scrollTop = 0;               // empieza arriba
  });
});

closeLegalBtn.addEventListener('click', ()=> legalDialog.close());

/* === Restaurar progreso desde localStorage (VERSIÓN ORIGINAL FUNCIONAL) === */
function restoreFormProgress() {
  const saved = localStorage.getItem(LS_KEY);
  if (!saved) return;

  try {
    const { form_data, selected_recipient, last_step_id } = JSON.parse(saved);

Object.entries(form_data).forEach(([k, v]) => {
  const field = bookForm.querySelector(`[name="${k}"]`);
  if (!field) return;

  if (field.type === 'checkbox') {
    // Lógica específica para checkboxes: marcamos si el valor guardado coincide.
    field.checked = (field.value === v);
  } else if (field.type === 'radio') {
    // La lógica para radios ya era correcta.
    field.checked = Array.isArray(v) ? v.includes(field.value) : field.value === v;
  } else {
    // Para todos los demás campos (text, email, textarea).
    field.value = v;
  }
  // Disparamos un evento para que cualquier otra lógica (como contadores) se actualice.
  field.dispatchEvent(new Event('input', { bubbles: true }));
});

    /* Restaurar destinatario */
    if (selected_recipient) {
      selectedRecipient = selected_recipient;
      document.querySelector(`.recipient-option[data-recipient="${selectedRecipient}"]`)
        ?.classList.add('selected');
      document.querySelector('#recipient-selection .next-btn')
        ?.removeAttribute('disabled');
      document.getElementById('tipo-input').value = selectedRecipient;
      document.getElementById('summary-recipient').textContent =
        getRecipientLabel(selectedRecipient);
    }

    /* Volver al último paso */
    const idx = last_step_id
      ? formSteps.findIndex(s => s.id === last_step_id)
      : 0;
    if (idx !== -1) showStep(idx);

  } catch (err) {
    console.warn('Error al restaurar el formulario. Limpiando…', err);
    localStorage.removeItem(LS_KEY);
    showStep(0); // Si hay error, abre en el primer paso.
  }
}
// ==================================================================
// AUTOGUARDADO AUTOMÁTICO PARA RADIO BUTTONS Y CHECKBOXES
// ==================================================================
function setupAutoSaveListeners() {
  console.log('🔧 Configurando listeners de autoguardado...');

  // 1. Autoguardado cuando se cambian radio buttons
  document.addEventListener('change', function(event) {
    if (event.target.type === 'radio' && 
        ['genero-autor', 'genero-destinatario', 'estilo-libro'].includes(event.target.name)) {
      console.log('🔄 Radio button cambiado:', event.target.name, '=', event.target.value);
      setTimeout(saveFormProgress, 100); // Pequeño delay para asegurar DOM actualizado
    }
  });

  // 2. Autoguardado cuando se cambian checkboxes
  document.addEventListener('change', function(event) {
    if (event.target.type === 'checkbox' && event.target.name === 'privacy-consent') {
      console.log('🔄 Checkbox cambiado:', event.target.name, '=', event.target.checked);
      setTimeout(saveFormProgress, 100);
    }
  });

  // 3. Autoguardado cuando se selecciona destinatario
  document.addEventListener('click', function(event) {
    if (event.target.closest('.recipient-option')) {
      const recipientCard = event.target.closest('.recipient-option');
      const recipient = recipientCard.dataset.recipient;
      if (recipient) {
        console.log('🔄 Destinatario seleccionado:', recipient);
        setTimeout(saveFormProgress, 100);
      }
    }
  });

  // 4. Autoguardado en campos de texto (refuerzo del existente)
  document.addEventListener('input', function(event) {
    if (event.target.matches('input[type="text"], input[type="email"], textarea')) {
      setTimeout(saveFormProgress, 500); // Delay mayor para no saturar
    }
  });

  console.log('✅ Listeners de autoguardado configurados');
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  setupAutoSaveListeners();
});



/* ===== Debounce: ejecuta saveFormProgress 400 ms después del último input ===== */
let autosaveTimer;
function debouncedSave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveFormProgress, 400); // ajusta si quieres
}

/* Ejecutar restauración y registrar autoguardado */
 restoreFormProgress(); 
bookForm?.addEventListener('input', debouncedSave);


/* =======================================================
   ✅ FUNCIÓN UPDATEQUALITYINDICATOR UNIFICADA Y COMPLETA
======================================================= */

function updateQualityIndicator(tx) {
    // 1. Solo procesar textareas del modal
    if (!tx.closest('#form-modal')) return;
    
    // 2. Buscar elementos de retroalimentación
    const qualityText = tx.parentElement.querySelector('.quality-text');
    const qualityFill = tx.parentElement.querySelector('.quality-fill');
    
    // 3. Verificar que existen los elementos necesarios
    if (!qualityText) {
        console.warn(`⚠️ No se encontró .quality-text para: ${tx.id}`);
        return;
    }
    

    
    // 5. Conteo de palabras y validación
    const words = tx.value.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const MIN_WORDS = 20;
    
    // 6. Lógica principal: Contador de palabras mínimas
    if (wordCount > 0 && wordCount < MIN_WORDS) {
        const faltan = MIN_WORDS - wordCount;
        qualityText.textContent = `Añade al menos ${faltan} palabra${faltan === 1 ? '' : 's'} más…`;
        qualityText.classList.add('error', 'word-count-warning');
        if (qualityFill) qualityFill.style.width = '0%';
        tx.setCustomValidity('Respuesta demasiado corta');
        
        // Log para debugging (puedes eliminar después)
        console.log(`📝 ${tx.id}: ${wordCount}/${MIN_WORDS} palabras - Faltan ${faltan}`);
        
    } else if (wordCount >= MIN_WORDS) {
        // 7. Lógica de calidad cuando se cumple el mínimo
        qualityText.classList.remove('error', 'word-count-warning');
        tx.setCustomValidity('');
        
        // Calcular puntuación de calidad
        let score = 25; // Base por cumplir mínimo
        if (wordCount > 50) score += 25;
        if (['sentí', 'emoción', 'corazón', 'amor', 'feliz', 'alegría'].some(w => 
            tx.value.toLowerCase().includes(w))) score += 25;
        if (['llevaba', 'color', 'sonrisa', 'ojos', 'olor', 'sonido'].some(w => 
            tx.value.toLowerCase().includes(w))) score += 25;
        
        // Actualizar barra de calidad
        if (qualityFill) qualityFill.style.width = `${score}%`;
        
        // Mensaje de calidad
        qualityText.textContent = score < 50 ? 
            'Añade más detalles para una historia más emotiva' : 
            score < 75 ? 
            '¡Muy bien! La historia está tomando forma' : 
            '¡Perfecto! Esta historia tocará el corazón';
            
        console.log(`✅ ${tx.id}: ${wordCount} palabras - Calidad ${score}%`);
        
    } else {
        // 8. Campo vacío - limpiar todo
        qualityText.textContent = '';
        qualityText.classList.remove('error', 'word-count-warning');
        if (qualityFill) qualityFill.style.width = '0%';
        tx.setCustomValidity('');
    }
}

/* =======================================================
   ✅ CONFIGURACIÓN UNIFICADA DE TEXTAREAS
======================================================= */

document.querySelectorAll('textarea').forEach(tx => {
    // Configuración inicial solo para textareas del modal
    if (tx.closest('#form-modal')) {
        autoResize(tx);
        updateQualityIndicator(tx);
        console.log(`✅ Textarea configurado: ${tx.id || 'sin-id'}`);
    }
    
    // Event listeners unificados
    tx.addEventListener('input', function() {
        autoResize(tx);
        if (tx.closest('#form-modal')) {
            updateQualityIndicator(tx);
        }
    });
    
    tx.addEventListener('blur', function() {
        if (tx.closest('#form-modal')) {
            updateQualityIndicator(tx);
        }
    });
});


/* ---------- Auto-resize de <textarea> ---------- */
function autoResize(el){
  el.style.height = 'auto';                               // reinicia
  el.style.height = Math.min(el.scrollHeight, 220) + 'px';// máx.≈10 líneas
}
/* ----------------------------------------------------------
   Abre el wizard
---------------------------------------------------------- */
function openModal () {
  if (!modal) return;
  lastTrigger = document.activeElement; // <-- AÑADE ESTA LÍNEA

  /* 1. Mostrar y anunciar que YA NO está oculto para lectores de pantalla */
  modal.style.display = 'flex';
  modal.removeAttribute('aria-hidden');

  /* 2. Bloquear scroll del fondo */
  document.body.classList.add('modal-open');

  /* 3. Llevar el foco al primer control del paso 1
        (o al propio modal como fallback) */
  const firstFocusable = modal.querySelector(
        'input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
  (firstFocusable || modal).focus();
}

/* ----------------------------------------------------------
   Cierra el wizard
---------------------------------------------------------- */
function closeModalFunc () {
  if (!modal) return;

  /* 1. Limpia el foco que pudiera quedar dentro */
  document.activeElement?.blur();

  /* 2. Oculta y marca como no expuesto a tecnologías de asistencia */
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');

  /* 3. Devuelve el foco al elemento que lo abrió (accesibilidad) */
  (lastTrigger || document.body).focus();
  lastTrigger = null;  // opcional: evita referencias “colgadas”

  /* 4. Permite de nuevo el scroll de la página */
  document.body.classList.remove('modal-open');

  /* 5. Limpieza de seguridad: vacía la plantilla de preview, si existe */
  const templateContainer = document.getElementById('preview-template');
  if (templateContainer) templateContainer.textContent = '';
}


  createBookBtn?.addEventListener('click', openModal);
  createBookBtnHeader?.addEventListener('click', openModal);
  closeModal?.addEventListener('click', closeModalFunc);


// --- Listener para el botón de compra ---
document.getElementById('preview-digital')?.addEventListener('click', () => {
    if (!currentOrderId) {
        alert('Error: no se pudo identificar el pedido.');
        return;
    }

    track('stripe_checkout', {
        order_id: currentOrderId,
        recip: selectedRecipient
    });

    // Reemplaza 'TU_PAYMENT_LINK_ID' con el ID real de tu Payment Link
const paymentLinkUrl = `https://buy.stripe.com/test_eVq6oA81Wckw1MS14Y2wU01?client_reference_id=${currentOrderId}&prefilled_email=${encodeURIComponent(jsonData['user-email'])}&customer_name=${encodeURIComponent(jsonData['user-name'])}`;
    
    console.log('Redirigiendo a Payment Link:', paymentLinkUrl);
    
    window.location.href = paymentLinkUrl;
});



 // Navegación de Pasos
// ==================================================================
// FUNCIÓN showStep() - VERSIÓN FINAL Y CORREGIDA
// ==================================================================
function showStep(i) {
  const formSteps = Array.from(document.querySelectorAll('.form-step'));

  // Manejo directo del error-step (tu lógica original, mantenida)
  if (i === -1) {
    console.log('🚨 Mostrando pantalla de error (caso especial i=-1)...');
    formSteps.forEach(step => {
      step.style.display = 'none';
      step.classList.remove('active');
      step.setAttribute('aria-hidden', 'true');
    });
    const errorStep = document.getElementById('error-step');
    if (errorStep) {
      errorStep.style.display = 'block';
      errorStep.classList.add('active');
      errorStep.setAttribute('aria-hidden', 'false');
      errorStep.querySelectorAll('button').forEach(btn => {
        btn.disabled = false;
      });
      // ✅ SCROLL CORREGIDO: Apuntando a .modal-body
      document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      console.error('❌ No se encontró el elemento error-step');
    }
    return;
  }

  // Comprobación de seguridad para pasos normales (tu lógica original, mantenida)
  if (i < 0 || i >= formSteps.length) {
    console.error("Error: Se intentó mostrar un paso inválido:", i);
    return;
  }

  // 1. Oculta/muestra el paso correcto y gestiona campos (tu lógica original, mantenida)
  formSteps.forEach((step, idx) => {
    const active = (idx === i);
    step.style.display = active ? 'block' : 'none';
    step.classList.toggle('active', active);
    step.setAttribute('aria-hidden', String(!active));

    step.querySelectorAll('input, textarea, select, button').forEach(el => {
      el.disabled = !active;
      const isRelaxedStep = ['processing', 'preview', 'error-step', 'preparacion-emocional-step', 'consejos-practicos-step', 'recipient-selection'].includes(step.id);
      if (el.hasAttribute('data-required-original')) {
         el.required = active && !isRelaxedStep;
      }
    });
  });

  // 2. Actualiza el estado y la UI (título, barra de progreso, etc.)
  currentStep = i;
  updateProgress(); // Esta función ahora se encarga de los títulos y la barra
  // ─── Inicializa los carruseles de estilos (solo la primera vez) ───
  if (formSteps[i].id === 'design-selection-step') {
    initDesignSwipers();
  }

  // 3. Foco para accesibilidad
  formSteps[i].focus({ preventScroll: true });
  
  // 4. ✅ SCROLL INTELIGENTE: Esta es la corrección clave.
  
  document.querySelector('.modal-content')?.scrollTo({ top: 0, behavior: 'smooth' });


  // 5. Envía evento de analítica (tu lógica original, mantenida)
  if (formSteps[i].dataset.step && formSteps[i].dataset.step !== 'error') {
    track('wizard_step', {
      step:  formSteps[i].dataset.step,
      recip: selectedRecipient || 'intro'
    });
  }
}

// =======================================================
// ✅ FUNCIÓN updateProgress() - CON LÓGICA DE TÍTULOS MEJORADA
// =======================================================
function updateProgress() {
  const step = formSteps[currentStep];
  if (!step) return; // Comprobación de seguridad

  const progressTitle = document.getElementById('progress-title');
  const modalHeaderSubtitle = document.querySelector('.modal-header-subtitle');
  const progressBar = document.getElementById('progress-bar');
  
  let mainTitle = '';
  let subTitle = '';
  
  // Lógica de títulos para cada paso
  switch (step.id) {
    case 'recipient-selection':
      mainTitle = '¡Bienvenido a MemoryTale!';
      subTitle = 'Tu historia personalizada está a punto de comenzar';
      break;
    case 'preparacion-emocional-step':
      mainTitle = '✨ Un momento antes de empezar...';
      subTitle = 'Prepárate para crear un legado emocional';
      break;
    case 'consejos-practicos-step':
      mainTitle = '💡 Consejos para crear magia';
      subTitle = 'Herramientas para una historia inolvidable';
      break;
    case 'recipient-details-step':
      mainTitle = 'Cuéntanos sobre esta persona especial';
      subTitle = 'Algunos datos básicos nos ayudan a personalizar la narrativa';
      break;
    // ✅ "GIRO DE PERSPECTIVA" APLICADO AQUÍ
    case 'author-details-step':
      mainTitle = '✨ Ahora, cuéntanos sobre ti';
      subTitle = 'Esto nos ayuda a personalizar tu historia desde tu perspectiva';
      break;
    case 'final-touches-step':
      mainTitle = 'Los toques finales';
      subTitle = 'Ya casi hemos terminado, ¡qué emoción!';
      break;
    case 'form-summary':
      mainTitle = '¡Ya casi está!';
      subTitle = 'Confirma tu email para recibir tu historia';
      break;
    case 'processing':
      mainTitle = 'Generando tu previsualización…';
      subTitle = 'La magia está ocurriendo...';
      break;
    case 'preview':
      mainTitle = '¡Tu historia comienza aquí!';
      subTitle = 'Esta es una muestra de tu libro personalizado';
      break;
    case 'error-step':
      mainTitle = 'Ha surgido un problema';
      subTitle = 'Pero no te preocupes, lo solucionaremos';
      break;
    default:
      if (step.dataset.recipient) {
        const recipientQuestions = formSteps.filter(s => s.dataset.recipient === selectedRecipient);
        const totalStepsInFlow = recipientQuestions.length;
        const currentQuestionNum = parseInt(step.dataset.step, 10);
        mainTitle = `Paso ${currentQuestionNum} de ${totalStepsInFlow} – Tu historia está tomando forma...`;
        subTitle = 'Cada respuesta hace tu libro más especial';
      } else {
        mainTitle = 'Continuemos...';
        subTitle = '';
      }
      break;
  }

  if (progressTitle) progressTitle.textContent = mainTitle;
  if (modalHeaderSubtitle) {
    modalHeaderSubtitle.textContent = subTitle;
    modalHeaderSubtitle.style.display = subTitle ? 'block' : 'none';
  }

  // Lógica de la barra de progreso (sin cambios, se mantiene la tuya)
  if (progressBar) {
    const recipientQuestions = formSteps.filter(s => s.dataset.recipient === selectedRecipient);
    const totalStepsInFlow = recipientQuestions.length;
    const currentQuestionIndex = recipientQuestions.findIndex(s => s.id === step.id);
    progressBar.style.display = 'block';
    if (totalStepsInFlow > 0 && currentQuestionIndex !== -1) {
      progressBar.value = ((currentQuestionIndex + 1) / totalStepsInFlow) * 100;
    } else {
      const progressValues = {
        'recipient-selection': 5, 'preparacion-emocional-step': 10,
        'consejos-practicos-step': 15, 'recipient-details-step': 20,
        'author-details-step': 25, 'final-touches-step': 90,
        'form-summary': 95, 'preview': 100,
      };
      progressBar.value = progressValues[step.id] || 0;
      if (!progressValues[step.id]) progressBar.style.display = 'none';
    }
  }
}


  function getRecipientLabel(r) { return ({ partner:'Tu pareja',
    parent :'Tu padre/madre',
    child  :'Tu hijo/a',
    sibling:'Tu hermano/a',
    friend :'Tu amigo/a'  })[r] || ''; }

// =======================================================
// ✅ FUNCIÓN PARA ACTUALIZAR EL CONTENIDO DE SELECCIÓN DE DISEÑO
// =======================================================
function updateDesignSelectionStep(recipient) {
  // Obtenemos la colección correcta; si no existe, caemos en 'partner'
  const content = designContent[recipient] || designContent.partner;

  /* ---------- Estilo A ---------- */
  ['cover', 'chapter', 'conclusion'].forEach(tag => {
    const img = document.querySelector(`[data-design-image="estiloa-${tag}"]`);
    if (img) {
      img.src = content.estiloa.images[tag];
      img.alt = `Vista previa ${tag} del ${content.estiloa.title}`;
    }
  });
  const estiloaTitle = document.querySelector('[data-design-title="estiloa"]');
  const estiloaDesc  = document.querySelector('[data-design-description="estiloa"]');
  if (estiloaTitle) estiloaTitle.textContent = content.estiloa.title;
  if (estiloaDesc)  estiloaDesc.textContent  = content.estiloa.description;

  /* ---------- Estilo B ---------- */
  ['cover', 'chapter', 'conclusion'].forEach(tag => {
    const img = document.querySelector(`[data-design-image="estilob-${tag}"]`);
    if (img) {
      img.src = content.estilob.images[tag];
      img.alt = `Vista previa ${tag} del ${content.estilob.title}`;
    }
  });
  const estilobTitle = document.querySelector('[data-design-title="estilob"]');
  const estilobDesc  = document.querySelector('[data-design-description="estilob"]');
  if (estilobTitle) estilobTitle.textContent = content.estilob.title;
  if (estilobDesc)  estilobDesc.textContent  = content.estilob.description;
}



  // Handlers Principales
  startBtn?.addEventListener('click', () => {
    const inputs = formSteps[currentStep].querySelectorAll('input[required], textarea[required]');
    for (const i of inputs) { if (!i.checkValidity()) { i.reportValidity(); return; } }
    showStep(formSteps.findIndex(s => s.id === 'preparacion-emocional-step'));

  });
  consejosContinuarBtn?.addEventListener('click', () => {
  const idx = formSteps.findIndex(s => s.id === 'recipient-details-step');
    if (idx !== -1) { showStep(idx); formSteps[idx].querySelector('input')?.focus(); }
  });
// =======================================================
// ✅ NAVEGACIÓN DE BOTONES "SIGUIENTE" - CON LÓGICA DE DISEÑO
// =======================================================

nextButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const currentStepElement = formSteps[currentStep];

    // 1. Validación de campos (tu lógica actual se mantiene, es correcta)
    const requiredInputs = currentStepElement.querySelectorAll(
      'input[required]:not([disabled]), textarea[required]:not([disabled])'
    );
    let isAllValid = true;
    for (const input of requiredInputs) {
      if (input.type === 'radio') {
        const radioGroupName = input.name;
        const anyRadioChecked = currentStepElement.querySelector(`input[name="${radioGroupName}"]:checked`);
        if (!anyRadioChecked) {
          input.reportValidity(); // Llama a la validación en el primer radio del grupo
          isAllValid = false;
          break;
        }
      } else if (!input.checkValidity()) {
        input.reportValidity();
        isAllValid = false;
        break;
      }
    }
    if (!isAllValid) {
      return;
    }

    // 2. Guardar progreso (se mantiene)
    saveFormProgress();
// 2.1. Track GA4: wizard_step
track('wizard_step', {
  step: currentStepElement.dataset.step || 'unknown',
  recip: selectedRecipient || 'unknown'
});
    // 3. Lógica para decidir a qué paso saltar (AQUÍ ESTÁ LA MODIFICACIÓN)
    const isLastQuestion = currentStepElement.dataset.recipient &&
                           currentStepElement.id.endsWith('-q6-step');
                           
    const isDesignSelectionStep = currentStepElement.id === 'design-selection-step';
    const isAuthorDetailsStep = currentStepElement.id === 'author-details-step';
    const isFinalTouchesStep = currentStepElement.id === 'final-touches-step';

    // --- LÓGICA DE NAVEGACIÓN MEJORADA ---

    // Si estamos en la última pregunta (q6 de cualquier relación)...
    if (isLastQuestion) {
      // 1. Preparamos el contenido del siguiente paso ANTES de mostrarlo.
      updateDesignSelectionStep(selectedRecipient); 
      
      // 2. Buscamos y mostramos el paso de selección de diseño.
      const designStepIdx = formSteps.findIndex(s => s.id === 'design-selection-step');
      if (designStepIdx !== -1) {
        showStep(designStepIdx);
      }
      return; // Salimos para no continuar con otra lógica.
    }

// Si venimos del paso de selección de diseño...
if (isDesignSelectionStep) {
  const summaryIdx = formSteps.findIndex(s => s.id === 'form-summary');
  if (summaryIdx !== -1) {
    showStep(summaryIdx);

    // 🔥 Track GA4: form_completed
    track('form_completed', {
      recip: selectedRecipient || 'unknown'
    });
  }
  return;
}


  // 🔁 🔁 Lógica actualizada para mostrar el paso de autor ANTES de las preguntas
    const nextIsAuthorDetails = formSteps.findIndex(s => s.id === 'author-details-step');
    if (nextIsAuthorDetails > currentStep) {
      showStep(nextIsAuthorDetails);
      return;
    }

    // Lógica por defecto: buscar el siguiente paso disponible.
    for (let j = currentStep + 1; j < formSteps.length; j++) {
      const nextStepElement = formSteps[j];
      if (!nextStepElement.dataset.recipient || nextStepElement.dataset.recipient === selectedRecipient) {
        showStep(j);
        return;
      }
    }
  });
});

 backButtons.forEach(btn => btn.addEventListener('click', () => {
  const cur = formSteps[currentStep];

  /* --- 1. Si estamos en el RESUMEN → saltamos a la PREGUNTA 1/8 del destinatario --- */
  if (cur.id === 'form-summary') {
    saveFormProgress();   // guardar antes de saltar
    const firstIdx = formSteps.findIndex(
      s => s.dataset.recipient === selectedRecipient && s.dataset.step === '1'
    );
    if (firstIdx !== -1) { showStep(firstIdx); return; }
  }

  /* --- 2. Comportamiento estándar --- */
  const firstOfBlock =
    cur.dataset.recipient === selectedRecipient && cur.dataset.step === '1';

  /* guardamos SIEMPRE antes de movernos */
  saveFormProgress();

  if (firstOfBlock) {
    // Vuelve al selector de destinatario
    showStep(formSteps.findIndex(s => s.id === 'recipient-selection'));
  } else {
    // Paso inmediatamente anterior
    showStep(currentStep - 1);
  }
}));


// REEMPLAZA el bloque recipientOptions.forEach por este:

// === LÓGICA MEJORADA PARA LA SELECCIÓN DE TARJETAS ===
const recipientCards = document.querySelectorAll('.recipient-card');
const continueBtn = document.getElementById('continue-selection');

recipientCards.forEach(card => {
    card.addEventListener('click', () => {
        // Limpia el autoguardado para empezar de cero con el nuevo destinatario
        if (!selectedRecipient || selectedRecipient !== card.dataset.recipient) {
  localStorage.removeItem('memorytale_form_progress');
}

        // Marca la opción seleccionada
        recipientCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Guarda el estado
        selectedRecipient = card.dataset.recipient;
        document.getElementById('tipo-input').value = selectedRecipient;
        document.getElementById('summary-recipient').textContent = getRecipientLabel(selectedRecipient);

        // Habilita el botón de continuar
        if (continueBtn) {
            continueBtn.disabled = false;
        }

        // ✅ AUTO-AVANCE: Feedback visual y transición suave
        card.style.transform = 'scale(1.05)';
        setTimeout(() => {
            card.style.transform = '';
            const preparacionIdx = formSteps.findIndex(s => s.id === 'preparacion-emocional-step');
            if (preparacionIdx !== -1) {
                showStep(preparacionIdx);
            }
        }, 300); // Delay para que el usuario vea su selección
    });
});


// Listener para el botón de continuar
if (continueBtn) {
    continueBtn.addEventListener('click', () => {
        if (selectedRecipient) {
            // Buscamos el paso de consejos para ir allí primero
const preparacionIdx = formSteps.findIndex(s => s.id === 'preparacion-emocional-step');
          if (preparacionIdx !== -1) {
    showStep(preparacionIdx);
                // Enfocamos el botón para mejorar accesibilidad
                formSteps[consejosIdx].querySelector('.continuar-consejos')?.focus();
            }
        }
    });
}
  const nombreInput = document.getElementById('nombre-destinatario');
  const previewName = document.getElementById('preview-nombre');
  nombreInput?.addEventListener('input', () => {
    const val = nombreInput.value.trim();
    previewName.style.display = val ? 'block' : 'none';
    previewName.innerHTML = val ? `Así hablaremos de <strong>${val}</strong> a lo largo de tu historia.` : '';
  });
/* ------------------------------------------------------------------
   Construye la portada/mini-capítulo según el tipo de destinatario
-------------------------------------------------------------------*/
/* ------------------------------------------------------------------
   ✅ Construye la portada según la RELACIÓN y el ESTILO elegido
-------------------------------------------------------------------*/
function buildPreviewHTML(relacion, estilo, previewText) {
  const backgroundMatrix = {
    partner: {
      estiloa: 'assets/libro_imagenes/partner_estiloa.jpg',
      estilob: 'assets/libro_imagenes/partner_estilob.jpg'
    },
    parent: {
      estiloa: 'assets/libro_imagenes/parent_estiloa.jpg',
      estilob: 'assets/libro_imagenes/parent_estilob.jpg'
    },
    child: {
      estiloa: 'assets/libro_imagenes/child_estiloa.jpg',
      estilob: 'assets/libro_imagenes/child_estilob.jpg'
    },
    sibling: {
      estiloa: 'assets/libro_imagenes/sibling_estiloa.jpg',
      estilob: 'assets/libro_imagenes/sibling_estilob.jpg'
    },
    friend: {
      estiloa: 'assets/libro_imagenes/friend_estiloa.jpg',
      estilob: 'assets/libro_imagenes/friend_estilob.jpg'
    }
  };

  const backgroundImage = backgroundMatrix[relacion]?.[estilo] || backgroundMatrix[relacion]?.estiloa || '';
  
  // Asegurar ruta absoluta para evitar problemas de carga
  const absoluteBackground = backgroundImage.startsWith('http') 
    ? backgroundImage 
    : `${window.location.origin}/${backgroundImage}`;

  return `
    <div class="page" style="background-image: url('${absoluteBackground}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
      <div class="content-wrapper">
        <p>${previewText}</p>
      </div>
    </div>
  `;
}


// === INICIO DEL BLOQUE CORRECTO HÍBRIDO (WEBHOOK + HTML2CANVAS) ===

// ==================================================================
// BLOQUE FINAL DE GESTIÓN DE FORMULARIO, PREVIEW Y ERRORES
// ==================================================================


bookForm?.addEventListener('submit', async function (e) {
  e.preventDefault();
  
  // 1. Validación y Recopilación de Datos (sin cambios)
  if (!selectedRecipient) {
    alert('Por favor, selecciona para quién es el libro.');
    showStep(formSteps.findIndex(s => s.id === 'recipient-selection'));
    return;
  }
  bookForm.querySelectorAll('input, textarea, select').forEach(el => { el.disabled = false; el.required = false; });
  const fd = new FormData(bookForm);
const entries = [...fd.entries()].filter(([k]) =>
  ['tipo', 'ubicacion', 'user-name', 'user-email', 'nombre-destinatario', 'genero-autor',
 'genero-destinatario', 'estilo-libro'].includes(k)
  || k.startsWith(`${selectedRecipient}-`)
);
  jsonData = Object.fromEntries(entries);
  // 🔥 CRÍTICO: Fallbacks desde localStorage para campos que puedan faltar
const saved = localStorage.getItem(LS_KEY);
if (saved) {
  try {
    const { form_data } = JSON.parse(saved);
    
    // Fallback para estilo
    if (!jsonData['estilo-libro'] && form_data['estilo-libro']) {
      jsonData['estilo-libro'] = form_data['estilo-libro'];
      console.log('🔄 Estilo recuperado desde localStorage:', form_data['estilo-libro']);
    }
    
    // Fallback para género destinatario
    if (!jsonData['genero-destinatario'] && form_data['genero-destinatario']) {
      jsonData['genero-destinatario'] = form_data['genero-destinatario'];
      console.log('🔄 Género destinatario recuperado:', form_data['genero-destinatario']);
    }
    
    // Fallback para género autor
    if (!jsonData['genero-autor'] && form_data['genero-autor']) {
      jsonData['genero-autor'] = form_data['genero-autor'];
      console.log('🔄 Género autor recuperado:', form_data['genero-autor']);
    }
    
    // Fallback para tipo
    if (!jsonData['tipo'] && form_data['tipo']) {
      jsonData['tipo'] = form_data['tipo'];
      console.log('🔄 Tipo recuperado:', form_data['tipo']);
    }
    
  } catch (err) {
    console.warn('Error al recuperar fallbacks:', err);
  }
}

// Valores por defecto si aún faltan campos críticos
if (!jsonData['estilo-libro']) {
  jsonData['estilo-libro'] = 'estiloa';
  console.log('⚠️ Usando estilo por defecto:', jsonData['estilo-libro']);
}

if (!jsonData['tipo']) {
  jsonData['tipo'] = selectedRecipient || 'partner';
  console.log('⚠️ Usando tipo por defecto:', jsonData['tipo']);
}

console.log('📤 Payload final para envío:', jsonData);

  jsonData.order_id = `mt_${selectedRecipient}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  currentOrderId = jsonData.order_id;
  
  // 2. Mostrar "Procesando" y llamar a la función principal
  showStep(formSteps.findIndex(s => s.id === 'processing'));
  await generateAndShowPreview(jsonData);

  localStorage.removeItem(LS_KEY);
});

// ✅ LISTENER DELEGADO PARA ACCIONES EN EL PANEL DE ERROR
document.addEventListener('click', function (e) {

  // --- Acción para el botón de CONTACTO ---
  if (e.target && e.target.id === 'contact-team-btn') {
    console.log('📧 Botón "Escribir al equipo" pulsado.');
    
    // Abrir el modal de contacto
    openContactModal();
  }

  // --- Acción para el botón de REINTENTAR (NO SE MODIFICA) ---
// --- Acción para el botón de REINTENTAR (VERSIÓN MEJORADA) ---
if (e.target && e.target.id === 'retry-preview-btn') {
  console.log('🔁 Botón "Reintentar ahora" pulsado.');

  // 1. CRÍTICO: Restaurar datos guardados ANTES del retry
  restoreFormProgress();
  
  // 2. Pausa para que se apliquen los datos restaurados
  setTimeout(() => {
    // 3. Recopilar datos frescos del formulario
    if (!selectedRecipient) {
      console.warn('⚠️ No hay destinatario seleccionado después de restaurar');
      alert('Error: No se pudo restaurar el destinatario. Por favor, reinicia el proceso.');
      return;
    }

    // Activar todos los campos temporalmente
    bookForm.querySelectorAll('input, textarea, select').forEach(el => { 
      el.disabled = false; 
      el.required = false; 
    });

    const fd = new FormData(bookForm);
    const entries = [...fd.entries()].filter(([k]) =>
      ['tipo', 'ubicacion', 'user-name', 'user-email', 'nombre-destinatario', 'genero-autor',
       'genero-destinatario', 'estilo-libro'].includes(k)
      || k.startsWith(`${selectedRecipient}-`)
    );
    
    let freshJsonData = Object.fromEntries(entries);
    
    // 4. CRÍTICO: Fallbacks desde localStorage para campos que falten
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        const { form_data } = JSON.parse(saved);
        
        // Fallback para estilo
        if (!freshJsonData['estilo-libro'] && form_data['estilo-libro']) {
          freshJsonData['estilo-libro'] = form_data['estilo-libro'];
          console.log('🔄 Estilo recuperado desde localStorage:', form_data['estilo-libro']);
        }
        
        // Fallback para género destinatario
        if (!freshJsonData['genero-destinatario'] && form_data['genero-destinatario']) {
          freshJsonData['genero-destinatario'] = form_data['genero-destinatario'];
          console.log('🔄 Género destinatario recuperado:', form_data['genero-destinatario']);
        }
        
        // Fallback para género autor
        if (!freshJsonData['genero-autor'] && form_data['genero-autor']) {
          freshJsonData['genero-autor'] = form_data['genero-autor'];
          console.log('🔄 Género autor recuperado:', form_data['genero-autor']);
        }
        
        // Fallback para tipo
        if (!freshJsonData['tipo'] && form_data['tipo']) {
          freshJsonData['tipo'] = form_data['tipo'];
          console.log('🔄 Tipo recuperado:', form_data['tipo']);
        }
        
      } catch (err) {
        console.warn('Error al recuperar fallbacks:', err);
      }
    }

    // 5. Valores por defecto si aún faltan campos críticos
    if (!freshJsonData['estilo-libro']) {
      freshJsonData['estilo-libro'] = 'estiloa';
      console.log('⚠️ Usando estilo por defecto:', freshJsonData['estilo-libro']);
    }
    
    if (!freshJsonData['tipo']) {
      freshJsonData['tipo'] = selectedRecipient || 'partner';
      console.log('⚠️ Usando tipo por defecto:', freshJsonData['tipo']);
    }

    // 6. Generar nuevo order_id
    freshJsonData.order_id = `mt_${selectedRecipient}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentOrderId = freshJsonData.order_id;
    
    console.log('🔄 Payload completo para retry:', freshJsonData);
    
    // 7. Actualizar jsonData global y ejecutar
    jsonData = freshJsonData;
    
    const loadingStepIndex = formSteps.findIndex(s => s.id === 'processing');
    if (loadingStepIndex !== -1) {
      showStep(loadingStepIndex);
    }
    generateAndShowPreview(freshJsonData);
    
  }, 300); // Pausa de 300ms para asegurar que la restauración se complete
}

});

// ✅ FUNCIONES PARA MANEJAR EL MODAL DE CONTACTO
function openContactModal() {
  const contactModal = document.getElementById('contact-modal');
  if (!contactModal) return;

  // Pre-rellenar algunos campos
  const nombreField = document.getElementById('contact-nombre');
  const mensajeField = document.getElementById('contact-mensaje');
  
  if (nombreField) nombreField.value = '-';
  if (mensajeField) {
    mensajeField.value = `Hola equipo de MemoryTale,

He tenido un problema al generar la vista previa de mi libro.

Mi teléfono de contacto es: [tú número de teléfono aquí]

¡Gracias por la ayuda!`;
  }

  // Mostrar modal
  contactModal.style.display = 'flex';
  contactModal.removeAttribute('aria-hidden');
  document.body.classList.add('modal-open');

  // Enfocar el primer campo editable (email)
  const emailField = document.getElementById('contact-email');
  if (emailField) {
    setTimeout(() => emailField.focus(), 100);
  }
}

function closeContactModal() {
  const contactModal = document.getElementById('contact-modal');
  if (!contactModal) return;

  // Ocultar modal
  contactModal.style.display = 'none';
  contactModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  // Limpiar formulario
  const form = contactModal.querySelector('form');
  if (form) form.reset();
}

// ✅ LISTENERS PARA CERRAR EL MODAL DE CONTACTO
document.addEventListener('click', function(e) {
  // Cerrar con la X o botón cancelar
  if (e.target && e.target.classList.contains('close-contact-modal')) {
    closeContactModal();
  }
  
  // Cerrar haciendo clic fuera del modal
  if (e.target && e.target.id === 'contact-modal') {
    closeContactModal();
  }
});

// Cerrar con Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const contactModal = document.getElementById('contact-modal');
    if (contactModal && contactModal.style.display === 'flex') {
      closeContactModal();
    }
  }
});




// ==================================================================
// FUNCIÓN DE PREVIEW FINAL (VERSIÓN DEFINITIVA Y CORREGIDA)
// ==================================================================
async function generateAndShowPreview(payload) {
  const webhookUrl = 'https://hook.eu2.make.com/mepyw27vi6xaspowtx2nkkyyvtyegz0m';
  const spinner = document.querySelector('#processing .loading-spinner');
  // 🔍 AÑADIR AQUÍ - Detección específica para Google App
  const isGoogleApp = navigator.userAgent.includes('GSA/');
  if (isGoogleApp) {
    console.log('🔍 Google App detectada, aplicando configuración especial');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  try {
        // 🔥 AÑADIR ESTAS 2 LÍNEAS AQUÍ (justo al inicio del try) 🔥
    console.log('📤 DEBUG: Enviando a Make.com:', payload);
    console.log('📤 DEBUG: URL del webhook:', webhookUrl);
    // PASO A: Llamada al webhook

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(`El servidor respondió con un error: ${res.status}`);
    const data = await res.json();
    if (!data.previewText) throw new Error('La respuesta del servidor no contenía el texto de la preview.');

    // PASO B: Construir la página
    const templateContainer = document.getElementById('preview-template');
    templateContainer.innerHTML = buildPreviewHTML(selectedRecipient, payload['estilo-libro'], data.previewText.trim());
    
    const elementToCapture = templateContainer.querySelector('.page');
    if (!elementToCapture) {
      throw new Error('Error crítico: No se pudo encontrar el elemento .page para la captura.');
    }

    // PASO C: CRÍTICO - Pre-cargar imagen de fondo
    const backgroundMatrix = {
      partner: {
        estiloa: 'assets/libro_imagenes/partner_estiloa.jpg',
        estilob: 'assets/libro_imagenes/partner_estilob.jpg'
      },
      parent: {
        estiloa: 'assets/libro_imagenes/parent_estiloa.jpg',
        estilob: 'assets/libro_imagenes/parent_estilob.jpg'
      },
      child: {
        estiloa: 'assets/libro_imagenes/child_estiloa.jpg',
        estilob: 'assets/libro_imagenes/child_estilob.jpg'
      },
      sibling: {
        estiloa: 'assets/libro_imagenes/sibling_estiloa.jpg',
        estilob: 'assets/libro_imagenes/sibling_estilob.jpg'
      },
      friend: {
        estiloa: 'assets/libro_imagenes/friend_estiloa.jpg',
        estilob: 'assets/libro_imagenes/friend_estilob.jpg'
      }
    };

    const backgroundImageURL = backgroundMatrix[selectedRecipient]?.[payload['estilo-libro']] || 
                              backgroundMatrix[selectedRecipient]?.estiloa || '';

    // Esperar a que la imagen de fondo se cargue completamente
    if (backgroundImageURL) {
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Para CORS
        img.src = backgroundImageURL.startsWith('http') ? backgroundImageURL : `${window.location.origin}/${backgroundImageURL}`;
        
        if (img.complete) {
          resolve();
        } else {
          img.onload = resolve;
          img.onerror = () => {
            console.warn('Error cargando imagen de fondo, continuando...', backgroundImageURL);
            resolve(); // Continuar aunque falle la imagen
          };
        }
      });
    }

    // PASO D: Configurar html2canvas específicamente para móviles
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const canvas = await html2canvas(elementToCapture, {
      useCORS: !isMobile, // Desactivar CORS en móviles
      scale: isMobile ? 1 : 2, // Escala menor en móviles para mejor rendimiento
      backgroundColor: null,
      allowTaint: isMobile, // Permitir contenido "tainted" en móviles
      foreignObjectRendering: false, // Mejor compatibilidad
      logging: false // Desactivar logs en producción
    });

    // PASO E: Mostrar resultado
    const previewContainer = document.querySelector('.preview-image-container');
    previewContainer.innerHTML = '';
    previewContainer.appendChild(canvas);

    templateContainer.innerHTML = '';
// ✅ NUEVO: Convertir canvas a Base64 para el chatbot
  const imageDataUrl = canvas.toDataURL('image/png');
  
    // PASO F: Cambiar al paso de preview
    const idxPreview = formSteps.findIndex(s => s.id === 'preview');
    if (idxPreview !== -1) showStep(idxPreview);

    document.getElementById('preview-digital')?.removeAttribute('disabled');
    track('preview_generated', { recip: selectedRecipient, method: 'webhook_html2canvas' });
  // ✅ NUEVO: Pasar imagen y texto al chatbot si está activo
  const chatbotElement = document.querySelector('memorytale-chatbot');
  if (chatbotElement && typeof chatbotElement.showPreviewInChatbot === 'function') {
    // Obtener el texto de preview del DOM
    const previewTextElement = document.getElementById('preview-text');
    const previewText = previewTextElement ? previewTextElement.textContent : data.previewText;

    // Llamar al método del chatbot con imagen y texto
    chatbotElement.showPreviewInChatbot({
      previewText: previewText,
      previewImageUrl: imageDataUrl // Base64 de la imagen generada
    });
  }

  // ✅ NUEVO: Retornar datos para otras funciones si es necesario
  return {
    previewText: data.previewText,
    previewImageUrl: imageDataUrl
  };

  } catch (err) {
    console.error('❌ Error generando la preview:', err);
    const errorStepIndex = formSteps.findIndex(s => s.id === 'error-step');
    if (errorStepIndex !== -1) {
      showStep(errorStepIndex);
    } else {
      console.error('💥 El paso de error "error-step" no se encuentra en el DOM.');
      alert('Ha ocurrido un error inesperado. Por favor, contacta con nuestro equipo.');
    }
  } finally {
    if (spinner) {
      spinner.style.display = 'none';
    }
  }
}

// ← AÑADIR ESTA LÍNEA
window.generateAndShowPreview = generateAndShowPreview;

// === FIN DEL NUEVO BLOQUE DE ENVÍO Y PREVIEW ===

/* =======================================================
   ✅ CONTROL INTELIGENTE DEL TOOLTIP
======================================================= */

// Función para posicionar y mostrar tooltip
function showTooltip(icon, tooltip) {
    const iconRect = icon.getBoundingClientRect();
    const tooltipWidth = 240;
    
    // Posición vertical: encima del icono
    let topPosition = iconRect.top - 8; // 8px de separación
    
    // Posición horizontal: centrado, con ajuste inteligente
    let leftPosition = iconRect.left + (iconRect.width / 2) - (tooltipWidth / 2);
    
    // Ajustes para evitar que se salga de pantalla
    if (leftPosition < 10) {
        leftPosition = 10;
    }
    if (leftPosition + tooltipWidth > window.innerWidth - 10) {
        leftPosition = window.innerWidth - tooltipWidth - 10;
    }
    
    // Si el tooltip se saldría por arriba, ponerlo debajo del icono
    if (topPosition < 10) {
        topPosition = iconRect.bottom + 8;
        // Cambiar la flecha para que apunte hacia arriba
        tooltip.style.setProperty('--arrow-direction', 'up');
    } else {
        tooltip.style.setProperty('--arrow-direction', 'down');
    }
    
    // Aplicar posiciones y mostrar
    tooltip.style.top = topPosition + 'px';
    tooltip.style.left = leftPosition + 'px';
    tooltip.classList.add('show');
}

// Función para ocultar tooltip
function hideTooltip(tooltip) {
    tooltip.classList.remove('show');
}

// Configurar todos los tooltips
document.querySelectorAll('.info-tooltip-container').forEach(container => {
    const icon = container.querySelector('.info-icon');
    const tooltip = container.querySelector('.tooltip-text');
    
    if (!icon || !tooltip) return;
    
    // Eventos de mouse
    icon.addEventListener('mouseenter', () => showTooltip(icon, tooltip));
    icon.addEventListener('mouseleave', () => hideTooltip(tooltip));
    
    // Ocultar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            hideTooltip(tooltip);
        }
    });
    
    // Ocultar al hacer scroll en el modal
    const modalBody = tooltip.closest('.modal-body');
    if (modalBody) {
        modalBody.addEventListener('scroll', () => hideTooltip(tooltip));
    }
});

// ===== FAQ toggle (versión original y funcional) =====
document.querySelectorAll('.faq-toggle').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const open = item.classList.contains('active');
    document.querySelectorAll('.faq-item').forEach(i => { i.classList.remove('active'); i.querySelector('.faq-toggle').textContent = '+'; });
    if (!open) { item.classList.add('active'); btn.textContent = '−'; }
}));



// ✅ NUEVO: Story Coaching Desplegable 
// =======================================================
document.querySelectorAll('.coaching-trigger').forEach(trigger => {
  trigger.addEventListener('click', function() {
    const content = this.nextElementSibling;
    const isExpanded = this.getAttribute('aria-expanded') === 'true';
    
    // Toggle estado
    this.setAttribute('aria-expanded', !isExpanded);
    content.classList.toggle('show');
    
    // Scroll suave al expandir (mejor UX)
    if (!isExpanded) {
      setTimeout(() => {
        content.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        });
      }, 150);
    }
    
    // Guardar estado en autoguardado
    if (typeof debouncedSave === 'function') {
      debouncedSave();
    }
  });
});

// Ejemplos Desplegables (NUEVO - Mejorado)
document.querySelectorAll('.ejemplo-trigger').forEach(trigger => {
  trigger.addEventListener('click', function() {
    const content = this.nextElementSibling;
    const isExpanded = this.getAttribute('aria-expanded') === 'true';
    
    // Toggle estado
    this.setAttribute('aria-expanded', !isExpanded);
    content.classList.toggle('show');
    
    // Actualizar texto y flecha
    const titleSpan = this.querySelector('.ejemplo-title');
    const arrowSpan = this.querySelector('.ejemplo-arrow');
    
    if (content.classList.contains('show')) {
      titleSpan.textContent = 'Ocultar ejemplos';
      if (arrowSpan) arrowSpan.style.transform = 'rotate(180deg)';
    } else {
      titleSpan.textContent = 'Ver ejemplos para inspirarte';
      if (arrowSpan) arrowSpan.style.transform = 'rotate(0deg)';
    }
    
    // Scroll suave al expandir
    if (!isExpanded) {
      setTimeout(() => {
        content.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        });
      }, 150);
    }
    
    // Guardar estado en autoguardado
    if (typeof debouncedSave === 'function') {
      debouncedSave();
    }
  });
});

  // Fade-in on scroll
  const obs = new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = 1; o.unobserve(e.target); } }), { threshold: 0.1 });
  document.querySelectorAll('.step, .example, .testimonial, .price-card').forEach(el => obs.observe(el));
  document.querySelectorAll('input, textarea').forEach(inp => inp.addEventListener('focus', () => setTimeout(() => inp.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)));

  // Clic en tarjetas externas
  document.querySelectorAll('.open-formulario').forEach(link =>
    link.addEventListener('click', e => {
      e.preventDefault();
      openModal();
      const rec = link.dataset.recipient;
      if (!abrirDesdeVisor && rec) {
        setTimeout(() => document.querySelector(`.recipient-option[data-recipient="${rec}"]`)?.click(), 100);
      }
      abrirDesdeVisor = false;
    })
  );
  
  // ----------  VISOR DE LIBROS DE EJEMPLO (LÓGICA ORIGINAL Y FUNCIONAL) ----------
// ----------  VISOR DE LIBROS DE EJEMPLO (LÓGICA ORIGINAL Y FUNCIONAL) ----------
const visorModal = document.getElementById('visor-modal');
const visorWrap = visorModal?.querySelector('.visor-carrusel');
const visorClose = visorModal?.querySelector('.visor-close');
const visorPrev = visorModal?.querySelector('.visor-prev');
const visorNext = visorModal?.querySelector('.visor-next');
const visorCTA = visorModal?.querySelector('.visor-cta');
const visorIndicator = document.getElementById('visor-page-indicator'); // <-- AÑADE ESTA LÍNEA
const librosEjemplo = {

  partner: [
    '/assets/ejemplos/partner-01.webp',
    '/assets/ejemplos/partner-02.webp',
    '/assets/ejemplos/partner-03.webp',
    '/assets/ejemplos/partner-04.webp',
    '/assets/ejemplos/partner-05.webp'
  ],
  parent: [
    '/assets/ejemplos/parent-01.webp',
    '/assets/ejemplos/parent-02.webp',
    '/assets/ejemplos/parent-03.webp',
    '/assets/ejemplos/parent-04.webp',
    '/assets/ejemplos/parent-05.webp'
  ],
  child: [
    '/assets/ejemplos/child-01.webp',
    '/assets/ejemplos/child-02.webp',
    '/assets/ejemplos/child-03.webp',
    '/assets/ejemplos/child-04.webp',
    '/assets/ejemplos/child-05.webp'
  ],
  sibling: [
    '/assets/ejemplos/sibling-01.webp',
    '/assets/ejemplos/sibling-02.webp',
    '/assets/ejemplos/sibling-03.webp',
    '/assets/ejemplos/sibling-04.webp',
    '/assets/ejemplos/sibling-05.webp'
  ],
  friend:[
  '/assets/ejemplos/friend-01.webp',
  '/assets/ejemplos/friend-02.webp',
  '/assets/ejemplos/friend-03.webp',
  '/assets/ejemplos/friend-04.webp',
  '/assets/ejemplos/friend-05.webp'
]
};
  let slides = [], slideIdx = 0, tipoActual = '';
function renderSlides(imgArr) {
  if (!visorWrap) return; // Añadimos una comprobación de seguridad
  visorWrap.innerHTML = imgArr.map((src, idx) =>
    // El cambio clave está aquí: la primera imagen ya tiene la clase "activo"
    `<img class="${idx === 0 ? 'activo' : ''}" src="${src}" alt="Página de ejemplo" loading="lazy">`
  ).join('');
  slides = Array.from(visorWrap.children);
}

function showSlide(i) {
  if (!visorWrap || !slides.length) return; // Comprobación de seguridad

  // 1. Oculta la diapositiva anterior (si existe) quitando la clase '.activo'
  const slideAnterior = visorWrap.querySelector('.activo');
  if (slideAnterior) {
    slideAnterior.classList.remove('activo');
  }

  // 2. Muestra la nueva diapositiva añadiendo la clase '.activo'
  const slideActual = slides[i];
  if (slideActual) {
    slideActual.classList.add('activo');
  }

  // 3. (OPCIONAL PERO RECOMENDADO) Actualiza el indicador de página
  const visorIndicator = document.getElementById('visor-page-indicator');
  if (visorIndicator) {
    visorIndicator.textContent = `${i + 1} / ${slides.length}`;
  }
}
  function openVisor(tipo) { const imgs = librosEjemplo[tipo] || []; if (!imgs.length) return; tipoActual = tipo; renderSlides(imgs); slideIdx = 0; showSlide(slideIdx); visorModal.hidden = false; document.body.classList.add('modal-open'); }
  function closeVisor() { visorModal.hidden = true; document.body.classList.remove('modal-open'); }
  function nextSlide(dir) { slideIdx = (slideIdx + dir + slides.length) % slides.length; showSlide(slideIdx); }

  document.querySelectorAll('.tarjeta-relacion').forEach(card => card.addEventListener('click', e => { e.preventDefault(); openVisor(card.dataset.target); }));
  visorClose?.addEventListener('click', closeVisor);
  visorModal?.addEventListener('click', e => e.target === visorModal && closeVisor());
  visorPrev?.addEventListener('click', () => nextSlide(-1));
  visorNext?.addEventListener('click', () => nextSlide(1));
  visorCTA?.addEventListener('click', () => { closeVisor(); abrirDesdeVisor = true; document.querySelector(`.open-formulario[data-recipient="${tipoActual}"]`)?.click(); });
/* -----------------------------------------------------------
   Swiper carrusel “¿Para quién será el libro?”
   ----------------------------------------------------------- */
/* --- Swiper “¿Para quién será…?” ------------------------- */
const swiperRecipients = new Swiper('.recipient-swiper', {
  slidesPerView : 1.2,
  spaceBetween  : 12,
  centeredSlides: true,
  pagination    : { el: '.swiper-pagination', clickable: true },
  breakpoints   : {
    768: { slidesPerView: 3, spaceBetween: 24, centeredSlides:false }
  },
  /* estos dos desactivan el bloqueo de clic de Swiper */
  preventClicks           : false,
  preventClicksPropagation: false
});
/* --- Delegación de clic dentro del slider ---------------- */
swiperRecipients.on('click', (_swiper, evt) => {
  const card = evt.target.closest('.tarjeta-relacion');
  if (!card) return;      // no era una tarjeta

  evt.preventDefault();   // evita el “#”
  openVisor(card.dataset.target);   // función que ya tienes
});
/* -----------------------------------------------------------
   Swiper carrusel Selección de Estilo del Libro
   ----------------------------------------------------------- */
let designSwiperInit = false;

function initDesignSwipers() {
  if (designSwiperInit) return;      // Evita doble setup
  designSwiperInit = true;

  /* --- Carrusel padre (Estilo A / Estilo B) ---------------- */
  const parentSwiper = new Swiper('.design-swiper', {
    slidesPerView : 1,
    centeredSlides: true,
    spaceBetween  : 20,
    pagination    : { el: '.design-swiper > .swiper-pagination', clickable: true },
    on: {
      slideChange() {
        const value = parentSwiper.activeIndex === 0 ? 'estiloa' : 'estilob';
        const radio = document.querySelector(`input[name="estilo-libro"][value="${value}"]`);
        if (radio) radio.checked = true;          // sincroniza radio
      }
    }
  });

/* --- Carruseles hijos (portada / capítulo / conclusión) --- */
document.querySelectorAll('.design-preview-swiper').forEach(previewEl => {
  new Swiper(previewEl, {
    nested: true,                     // vive dentro de otro Swiper
    slidesPerView: 1,
    touchMoveStopPropagation: false,  // el swipe no “arrastra” al padre
    pagination: {
      el: previewEl.querySelector('.swiper-pagination'),
      clickable: true
    }
  });
});


  /* --- Cuando cambia el radio → desliza al slide correcto -- */
  document.querySelectorAll('input[name="estilo-libro"]').forEach(radio => {
    radio.addEventListener('change', () => {
      parentSwiper.slideTo(radio.value === 'estiloa' ? 0 : 1);
    });
  });
}

 // =================================================
  //  CÓDIGO PARA LA BARRA DE ANUNCIOS (Añadir aquí)
  // =================================================
  const promoBar = document.getElementById('promo-bar');
  const closeButton = document.getElementById('close-promo-bar');

  // Si no existen los elementos, no continuamos
  if (!promoBar || !closeButton) {
    return;
  }

  // Comprobar si el usuario ya cerró la barra anteriormente
  if (localStorage.getItem('promoBarClosed') === 'true') {
    promoBar.classList.add('hidden');
  } else {
    promoBar.classList.remove('hidden');
  }

  // Añadir el evento al botón de cerrar
  closeButton.addEventListener('click', function() {
    promoBar.classList.add('hidden');
    // Guardar la preferencia del usuario en su navegador
    localStorage.setItem('promoBarClosed', 'true');
  });
  console.log('✅ main.js cargado sin duplicados.');

function validarNombreSimple(input) {
  const valor = input.value.trim();
  const dosPalabrasMax = /^[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,20}(?: [A-Za-zÁÉÍÓÚáéíóúÑñ]{2,20})?$/;

  if (!dosPalabrasMax.test(valor)) {
    input.setCustomValidity("Por favor, escribe solo un nombre o nombre compuesto (máx. 2 palabras, sin símbolos).");
  } else {
    input.setCustomValidity("");
  }
}


// === Validación específica para nombre de autor y destinatario ===
const nombreAutorInput = document.getElementById("user-name");
const nombreDestinatarioInput = document.getElementById("nombre-destinatario");

[nombreAutorInput, nombreDestinatarioInput].forEach(campo => {
  if (campo) {
    campo.addEventListener("input", () => validarNombreSimple(campo));
  }
});

});



// Auto-capitalización
document.addEventListener('input', e => {
  const el = e.target;
  const isTxt = el.tagName.toLowerCase() === 'textarea' || (el.tagName.toLowerCase() === 'input' && el.type === 'text');
  if (!isTxt || !el.closest('#form-modal')) return;
  const txt = el.value, lead = txt.match(/^\s*/)[0], trimmed = txt.trimStart();
  if (trimmed && trimmed[0] !== trimmed[0].toUpperCase()) {
    const pos = el.selectionStart;
    el.value = lead + trimmed[0].toUpperCase() + trimmed.slice(1);
    el.setSelectionRange(pos, pos);
  }


});
function optimizeModalExperience() {
    const modal = document.getElementById('form-modal');
    const body = document.body;
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const isModalOpen = modal.style.display === 'block';
                
                if (isModalOpen) {
                    body.classList.add('modal-open');
                } else {
                    body.classList.remove('modal-open');
                }
            }
        });
    });
    
    if (modal) {
        observer.observe(modal, { attributes: true });
    }
}
// En js/main.js


