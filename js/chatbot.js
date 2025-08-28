// MemoryTale Chatbot Widget - Versión Mejorada con Integración Completa
// Integración perfecta con la marca MemoryTale y flujo conversacional inteligente

class MemoryTaleChatbot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Configuración
    this.config = {
      workerUrl: 'https://memorytale-tale-chatbot.memorytalesale.workers.dev',
      storageKey: 'memorytale_chatbot_state',
      maxRetries: 3,
      retryDelay: 1000
    };
    
    // Estado del chatbot
    this.state = {
      isOpen: false,
      isTyping: false,
      isConnected: true,
      sending: false,
      retryCount: 0,
      conversationState: {
        currentStep: 'welcome',
        selectedRecipient: null,
        collectedData: {},
        userDetails: {},
        history: []
      },
      messages: [],
      startTime: Date.now()
    };
    
    // Inicialización
    this.init();
  }

  async init() {
    this.render();
    this.attachEventListeners();
    this.loadSavedState();
    
    // Mensaje de bienvenida inicial
    if (this.state.messages.length === 0) {
      this.addMessage('tale', {
        response_text: '¡Hola! Soy Tale, tu asistente personal para crear libros únicos. ¿Te gustaría crear un libro personalizado para alguien especial?',
        tips: 'Puedes crear libros para tu pareja, padres, hijos, hermanos o amigos.',
        examples: [
          { title: 'Para tu pareja', text: 'Un libro romántico con vuestra historia de amor' },
          { title: 'Para tus padres', text: 'Un homenaje lleno de gratitud y recuerdos' },
          { title: 'Para tus hijos', text: 'Un tesoro emocional que guardarán para siempre' }
        ]
      });
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        /* Importar fuentes de MemoryTale */
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Quicksand:wght@300;400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        .chatbot-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 10000;
          font-family: 'Lato', sans-serif;
        }
        
        .chat-trigger {
          background: linear-gradient(135deg, #5e3b4d 0%, #3e1b2d 100%);
          color: white;
          padding: 15px 25px;
          border-radius: 30px;
          cursor: pointer;
          box-shadow: 0 8px 25px rgba(94, 59, 77, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 14px;
          border: none;
          outline: none;
          font-family: 'Quicksand', sans-serif;
        }
        
        .chat-trigger:hover {
          background: linear-gradient(135deg, #3e1b2d 0%, #2d1421 100%);
          transform: translateY(-3px);
          box-shadow: 0 12px 35px rgba(94, 59, 77, 0.4);
        }
        
        .chat-trigger.disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        
   
.chat-window {
  display: ${this.state.isOpen ? 'flex' : 'none'};
  flex-direction: column;
  width: 500px;
  height: 80vh;                /* ✅ Altura relativa al viewport */
  max-height: 750px;           /* ✅ Límite máximo */
  background: #faf7f5;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  margin-bottom: 15px;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
  border: 1px solid #e0ddd9;
}

        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .chat-header {
          background: linear-gradient(135deg, #5e3b4d 0%, #3e1b2d 100%);
          color: white;
          padding: 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .chat-header-content {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        
        .chat-header h3 {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        
        .chat-header .status {
          font-size: 12px;
          opacity: 0.9;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Quicksand', sans-serif;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${this.state.isConnected ? '#4ade80' : '#ef4444'};
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.3s;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: rotate(90deg);
        }
        
.chat-messages {
  flex: 1 1 auto;              /* ✅ Permite expansión y contracción */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 25px;
  background: #faf7f5;
  scroll-behavior: smooth;
  min-height: 0;               /* ✅ CLAVE: Permite que flexbox funcione */
  max-height: calc(80vh - 200px); /* ✅ Altura específica para scroll */
  position: relative;
}
        /* ✅ NUEVO: Estilos para imágenes de preview en el chatbot */
.chatbot-preview-image {
  max-width: 100% !important;
  height: auto !important;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  margin: 10px 0;
  display: block;
}

.chatbot-preview-container {
  text-align: center;
  margin: 20px 0;
  max-width: 100%;
  overflow: hidden;
}

/* ✅ NUEVO: Estilos para selección de estilo */
/* ✅ Estilos para selección de estilo */
.style-selection-container {
  display: flex;
  gap: 15px;
  margin: 20px 0;
  flex-wrap: wrap;
  justify-content: center;
}

.style-option {
  flex: 1;
  min-width: 200px;
  max-width: 250px;
  border: 2px solid #e0ddd9;
  border-radius: 12px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  background: white;
  box-sizing: border-box;
}

.style-option:hover {
  border-color: #5e3b4d;
  background: #f8f6f4;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(94, 59, 77, 0.1);
}

.style-option.selected {
  border-color: #5e3b4d;
  background: #f0ede9;
  box-shadow: 0 4px 12px rgba(94, 59, 77, 0.2);
}

.style-option img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin-bottom: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.style-option h4 {
  margin: 10px 0 5px 0;
  color: #5e3b4d;
  font-size: 16px;
  font-family: 'Playfair Display', serif;
  font-weight: 600;
}

.style-option p {
  font-size: 14px;
  color: #666;
  margin: 0 0 15px 0;
  font-family: 'Quicksand', sans-serif;
  line-height: 1.4;
}

.style-select-btn {
  background: linear-gradient(135deg, #e6c9bc 0%, #d4b5a6 100%);
  color: #3e1b2d;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
  font-family: 'Quicksand', sans-serif;
  transition: all 0.2s ease;
  width: 100%;
  font-size: 14px;
}

.style-select-btn:hover {
  background: linear-gradient(135deg, #d4b5a6 0%, #c2a495 100%);
  transform: translateY(-1px);
}

.style-select-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
  .style-select-btn:active {
  transform: translateY(0);
}
        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }
        
        .chat-messages::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .chat-messages::-webkit-scrollbar-thumb {
          background: #e6c9bc;
          border-radius: 3px;
        }
        
        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: #d4b5a6;
        }
        
        .message {
          margin-bottom: 25px;
          animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .message.user {
          text-align: right;
        }
        
        .message-bubble {
          display: inline-block;
          max-width: 85%;
          padding: 18px 22px;
          border-radius: 20px;
          word-wrap: break-word;
          line-height: 1.6;
          font-family: 'Lato', sans-serif;
        }
        
        .message.user .message-bubble {
          background: linear-gradient(135deg, #e6c9bc 0%, #d4b5a6 100%);
          color: #3e1b2d;
          border-bottom-right-radius: 8px;
          font-weight: 500;
        }
        
        .message.tale {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        
        .tale-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #5e3b4d 0%, #3e1b2d 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
          font-family: 'Playfair Display', serif;
          flex-shrink: 0;
          margin-top: 3px;
        }
        
        .tale-message-content {
          flex: 1;
        }
        
        .tale-message-content .message-bubble {
          background: white;
          color: #2c2c2c;
          border: 1px solid #e0ddd9;
          border-bottom-left-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          width: 100%;
          max-width: none;
          display: block;
        }
        
        .tale-tips {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 1px solid #f59e0b;
          border-radius: 12px;
          padding: 16px;
          margin-top: 15px;
          font-size: 14px;
          font-family: 'Quicksand', sans-serif;
        }
        
        .tale-tips strong {
          color: #92400e;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-weight: 600;
        }
        
        .tale-examples {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border: 1px solid #3b82f6;
          border-radius: 12px;
          padding: 16px;
          margin-top: 15px;
          font-size: 14px;
          font-family: 'Quicksand', sans-serif;
        }
        
        .tale-examples strong {
          color: #1e40af;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          font-weight: 600;
        }
        
        .example-item {
          margin-bottom: 10px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 8px;
          border-left: 3px solid #3b82f6;
        }
        
        .example-item:last-child {
          margin-bottom: 0;
        }
        
        .example-item strong {
          color: #1e40af;
          font-size: 13px;
          font-weight: 600;
          display: block;
          margin-bottom: 4px;
        }
        
        .typing-indicator {
          display: ${this.state.isTyping ? 'flex' : 'none'};
          align-items: center;
          gap: 12px;
          padding: 20px 25px;
          color: #6c6c6c;
          font-style: italic;
          background: #f5f5f5;
          border-top: 1px solid #e0ddd9;
          font-family: 'Quicksand', sans-serif;
        }
        
        .typing-dots {
          display: flex;
          gap: 4px;
        }
        
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #5e3b4d;
          animation: typing 1.4s infinite;
        }
        
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }
        
        .chat-input {
          display: flex;
          padding: 25px;
          background: white;
          border-top: 1px solid #e0ddd9;
          gap: 15px;
          align-items: flex-end;
        }
        
        .chat-input input {
          flex: 1;
          padding: 15px 18px;
          border: 2px solid #e0ddd9;
          border-radius: 25px;
          outline: none;
          font-size: 14px;
          font-family: 'Lato', sans-serif;
          transition: border-color 0.2s;
          background: #fdfcfc;
          resize: none;
          min-height: 50px;
          max-height: 120px;
        }
        
        .chat-input input:focus {
          border-color: #5e3b4d;
          box-shadow: 0 0 0 3px rgba(94, 59, 77, 0.1);
        }
        
        .chat-input input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .send-btn {
          background: linear-gradient(135deg, #5e3b4d 0%, #3e1b2d 100%);
          color: white;
          border: none;
          padding: 15px 22px;
          border-radius: 25px;
          cursor: pointer;
          font-weight: 600;
          font-family: 'Quicksand', sans-serif;
          transition: all 0.2s;
          min-width: 90px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .send-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #3e1b2d 0%, #2d1421 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(94, 59, 77, 0.3);
        }
        
        .send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 15px;
          border-radius: 12px;
          margin: 15px 25px;
          font-size: 14px;
          font-family: 'Quicksand', sans-serif;
        }
        
        .retry-btn {
          background: #dc2626;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-family: 'Quicksand', sans-serif;
          margin-top: 10px;
          transition: all 0.2s;
        }
        
        .retry-btn:hover {
          background: #b91c1c;
          transform: translateY(-1px);
        }
        
        /* Responsive */
        @media (max-width: 480px) {
          .style-selection-container {
    flex-direction: column;
    gap: 10px;
  }
  
  .style-option {
    min-width: unset;
    max-width: unset;
  }
          .chat-window {
            width: calc(100vw - 20px);
            height: calc(100vh - 100px);
            right: 10px;
            bottom: 80px;
          }
          
          .chatbot-container {
            right: 10px;
            bottom: 10px;
          }
          
          .chat-trigger {
            padding: 12px 20px;
            font-size: 13px;
          }
          
          .chat-header {
            padding: 20px;
              flex-shrink: 0;              /* ✅ Evita que el header se comprima */

          }
          
          .chat-messages {
            padding: 20px;
          }
          
          .chat-input {
              flex-shrink: 0;              /* ✅ Evita que el indicator se comprima */

          }
          
          .message-bubble {
            max-width: 90%;
            padding: 15px 18px;
          }
        }
        
        /* Accesibilidad */
        .chat-trigger:focus,
        .close-btn:focus,
        .send-btn:focus,
        .chat-input input:focus {
          outline: 2px solid #5e3b4d;
          outline-offset: 2px;
        }
        
        /* Prevenir interferencias con otros elementos */
        .chatbot-container {
          isolation: isolate;
        }
        
        /* Animación de entrada del trigger */
        .chat-trigger {
          animation: bounceIn 0.6s ease-out;
        }
        
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
          }
        }


/* En css/chatbot.css */

.chatbot-buy-section {
  margin-top: 20px;
  text-align: center;
}

.chatbot-buy-btn {
  background: linear-gradient(135deg, #5e3b4d 0%, #3e1b2d 100%);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 25px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(94, 59, 77, 0.3);
  font-family: 'Quicksand', sans-serif;
}

.chatbot-buy-btn:hover {
  background: linear-gradient(135deg, #3e1b2d 0%, #2d1421 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(94, 59, 77, 0.4);
}


          /* Responsive mejorado */
@media (max-width: 1200px) {
  .chat-window {
    width: 500px;
    height: 700px;
  }
}

@media (max-width: 768px) {
  .chat-window {
    width: calc(100vw - 20px);
    height: calc(100vh - 120px);
    right: 10px;
    bottom: 80px;
    max-width: 500px;
  }
  
  .chatbot-container {
    right: 10px;
    bottom: 10px;
  }
}

@media (max-width: 480px) {
  .chat-window {
    width: calc(100vw - 20px);
    height: calc(100vh - 100px);
    right: 10px;
    bottom: 80px;
  }
  
  .chat-trigger {
    padding: 12px 20px;
    font-size: 13px;
  }
  
  .chat-header {
    padding: 20px;
  }
  
  .chat-messages {
    padding: 20px;
  }
  
  .chat-input {
    padding: 20px;
  }
  
  .message-bubble {
    max-width: 90%;
    padding: 15px 18px;
  }
}

      </style>
      
      <div class="chatbot-container">
        <div class="chat-window">
          <div class="chat-header">
            <div class="chat-header-content">
              <h3>Tale</h3>
              <div class="status">
                <div class="status-dot"></div>
                <span>${this.state.isConnected ? 'Conectado' : 'Desconectado'}</span>
              </div>
            </div>
            <button class="close-btn" id="close-chat">×</button>
          </div>
          
          <div class="chat-messages" id="messages-container">
            <!-- Los mensajes se insertan aquí -->
          </div>
          
          <div class="typing-indicator" id="typing-indicator">
            <div class="tale-avatar">T</div>
            <span>Tale está escribiendo</span>
            <div class="typing-dots">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
          
          <div class="chat-input">
            <input 
              type="text" 
              id="message-input" 
              placeholder="Escribe tu mensaje..."
              maxlength="500"
              ${this.state.isTyping || this.state.sending ? 'disabled' : ''}
            />
            <button class="send-btn" id="send-btn" ${this.state.isTyping || this.state.sending ? 'disabled' : ''}>
              Enviar
            </button>
          </div>
        </div>
        
        <button class="chat-trigger" id="chat-trigger">
          <span>💬</span>
          <span>Crear mi libro con Tale</span>
        </button>
      </div>
    `;
  }

  attachEventListeners() {
    const trigger = this.shadowRoot.getElementById('chat-trigger');
    const closeBtn = this.shadowRoot.getElementById('close-chat');
    const sendBtn = this.shadowRoot.getElementById('send-btn');
    const messageInput = this.shadowRoot.getElementById('message-input');

    trigger?.addEventListener('click', () => this.toggleChat());
    closeBtn?.addEventListener('click', () => this.toggleChat());
    sendBtn?.addEventListener('click', () => this.sendMessage());
    
    messageInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.state.sending && !this.state.isTyping) {
          this.sendMessage();
        }
      }
    });
  }

 toggleChat() {
  this.state.isOpen = !this.state.isOpen;
  this.render();
  this.attachEventListeners();
  
  if (this.state.isOpen) {
    // ✅ SOLUCIÓN: Esperar a que termine la animación antes de renderizar contenido
    setTimeout(() => {
      this.renderMessages();
      this.focusInput();
      this.scrollToBottom();
      
      // Analytics
      if (typeof track === 'function') {
        track('chatbot_opened', { timestamp: new Date().toISOString() });
      }
    }, 350); // 350ms > 300ms de la animación slideUp
  }
}


async sendMessage() {
  const messageInput = this.shadowRoot.getElementById('message-input');
  const userMessage = messageInput?.value.trim();
  
  // Verificaciones estrictas
  if (!userMessage || this.state.isTyping || userMessage.length === 0 || this.state.sending) {
    return;
  }

  this.state.sending = true;
  this.updateUI(); // ✅ AÑADIR ESTA LÍNEA

  try {
    // Añadir mensaje del usuario
    this.addMessage('user', { response_text: userMessage });
    messageInput.value = '';
    
// ❌ ELIMINAR ESTAS LÍNEAS:
// const isCasual = /^(hola|hey|gracias|favor|ayuda|qué|cuánto|cómo)/i.test(userMessage);
// if (isCasual) {
//   this.addConversationalFeedback('casual');
// }

    // Mostrar indicador de escritura
    this.setTyping(true);
    
    console.log('📤 Enviando mensaje:', userMessage);
    console.log('🔄 Estado actual:', this.state.conversationState);

    // Timeout para evitar bucles
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

    // Llamar al Worker
    const response = await fetch(this.config.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage,
        conversationState: this.state.conversationState
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('📥 Respuesta recibida:', data);
    
    if (data.error) {
      throw new Error(data.error);
    }

    // ✅ NUEVA DETECCIÓN: Mostrar selección de estilo
    if (data.taleResponse && data.taleResponse.show_style_selection) {
      console.log('🎨 Activando selección de estilo...');
      
      // Actualizar estado ANTES de mostrar la selección
      this.state.conversationState = data.newState;
      this.state.isConnected = true;
      this.state.retryCount = 0;
      
      // Añadir el mensaje de introducción de Tale
      this.addMessage('tale', data.taleResponse);
      
      // Mostrar la selección de estilo
      this.showStyleSelection();
      
      // Guardar estado
      this.saveState();
      
      // Analytics
      if (typeof track === 'function') {
        track('chatbot_style_selection_shown', { 
          step: data.newState?.currentStep || 'style_selection',
          recipient: data.newState?.selectedRecipient || 'unknown'
        });
      }
      
      // Limpiar estado de envío
      this.setTyping(false);
      this.state.sending = false;
      this.updateUI();
      
      return; // ✅ CRÍTICO: Salir sin procesar más
    }

    // Actualizar estado (flujo normal)
    this.state.conversationState = data.newState;
    this.state.isConnected = true;
    this.state.retryCount = 0;
    
    // Añadir respuesta de Tale (flujo normal)
    this.addMessage('tale', data.taleResponse);
    
    // Guardar estado
    this.saveState();
    
    // Analytics
    if (typeof track === 'function') {
      track('chatbot_message_sent', { 
        step: data.newState?.currentStep || 'unknown',
        recipient: data.newState?.selectedRecipient || 'unknown'
      });
    }
    
    // Si la conversación está completa, transferir al sistema principal
    if (data.isComplete) {
      console.log('🎯 Conversación completada, iniciando transferencia...');
      
      // Mostrar mensaje de transferencia elegante
      this.addMessage('tale', {
        response_text: '¡Increíble! He enviado toda tu información para crear el libro. Ahora te voy a transferir al sistema de previsualización donde podrás ver el resultado en unos minutos.',
        tips: 'Tu libro se está generando en este momento con el estilo que elegiste. ¡La espera valdrá la pena!'
      });
      
      // Transferir inmediatamente (sin esperar más respuestas del Worker)
      setTimeout(() => {
        this.handleConversationComplete(data.newState.collectedData);
      }, 3000);
      
      return; // Importante: salir sin procesar más
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('❌ Request timed out');
      this.addMessage('tale', {
        response_text: 'La conversación está tardando más de lo esperado, pero no te preocupes. Voy a transferirte al sistema donde podrás ver tu preview cuando esté lista.',
        tips: 'Tu información se ha guardado correctamente.'
      });
      
      // Si estamos cerca del final, transferir de todas formas
      if (this.state.conversationState.currentStep === 'complete' || 
          this.state.conversationState.currentStep === 'user_email') {
        setTimeout(() => {
          this.handleConversationComplete(this.state.conversationState.collectedData);
        }, 2000);
      }
    } else {
      console.error('❌ Error enviando mensaje:', error);
      this.handleError(error);
    }
  } finally {
    this.setTyping(false);
    this.state.sending = false;
    this.updateUI(); // ✅ AÑADIR ESTA LÍNEA
  }
}


  addMessage(sender, messageData) {
    this.state.messages.push({
      sender,
      data: messageData,
      timestamp: new Date().toISOString()
    });
    
    this.renderMessages();
    this.scrollToBottom();
  }
// En js/chatbot.js, actualizar renderMessages para incluir el botón:
// En js/chatbot.js, actualizar el método renderMessages():

renderMessages() {
  const container = this.shadowRoot.getElementById('messages-container');
  if (!container) return;

  container.innerHTML = this.state.messages.map(msg => {
    if (msg.sender === 'user') {
      return `
        <div class="message user">
          <div class="message-bubble">
            ${this.escapeHtml(msg.data.response_text)}
          </div>
        </div>
      `;
    } else {
      // ✅ LÓGICA MEJORADA: Detectar HTML vs texto plano
      let messageContent;
      if (msg.data.messageType === 'html') {
        messageContent = msg.data.response_text; // HTML directo sin escapar
      } else {
        messageContent = `<p>${this.escapeHtml(msg.data.response_text)}</p>`;
      }

      return `
        <div class="message tale">
          <div class="tale-avatar">T</div>
          <div class="tale-message-content">
            <div class="message-bubble">
              ${messageContent}
              ${msg.data.tips ? `
                <div class="tale-tips">
                  <strong>💡 Consejo:</strong>
                  ${this.escapeHtml(msg.data.tips)}
                </div>
              ` : ''}
              ${msg.data.examples && msg.data.examples.length > 0 ? `
                <div class="tale-examples">
                  <strong>✨ Ejemplos para inspirarte:</strong>
                  ${msg.data.examples.map(ex => `
                    <div class="example-item">
                      <strong>${this.escapeHtml(ex.title)}:</strong>
                      ${this.escapeHtml(ex.text)}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${msg.data.showBuyButton ? `
                <div class="chatbot-buy-section">
                  <button class="chatbot-buy-btn" onclick="window.proceedToPayment()">
                    ¡Quiero comprarlo! 💳
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }
  }).join('');

  // ✅ CRÍTICO: Event listeners para selección de estilo
  // Esto debe ejecutarse DESPUÉS de que el HTML esté en el DOM
  this.shadowRoot.querySelectorAll('.style-select-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const style = e.target.dataset.style;
      this.handleStyleSelection(style);
    });
  });
  
  // Event listeners para las tarjetas completas (opcional)
  this.shadowRoot.querySelectorAll('.style-option').forEach(option => {
    option.addEventListener('click', (e) => {
      // Evitar doble disparo si se hace clic en el botón
      if (e.target.classList.contains('style-select-btn')) return;
      
      e.preventDefault();
      e.stopPropagation();
      const style = option.dataset.style;
      this.handleStyleSelection(style);
    });
  });
}



 setTyping(isTyping) {
  this.state.isTyping = isTyping;
  
  // ✅ CORRECCIÓN: Actualizar la UI inmediatamente
  this.updateUI();
}

// ✅ NUEVO MÉTODO: Actualizar UI
updateUI() {
  const typingIndicator = this.shadowRoot.getElementById('typing-indicator');
  const messageInput = this.shadowRoot.getElementById('message-input');
  const sendBtn = this.shadowRoot.getElementById('send-btn');
  
  if (typingIndicator) {
    typingIndicator.style.display = this.state.isTyping ? 'flex' : 'none';
  }
  
  if (messageInput) {
    messageInput.disabled = this.state.isTyping || this.state.sending;
  }
  
  if (sendBtn) {
    sendBtn.disabled = this.state.isTyping || this.state.sending;
    sendBtn.textContent = this.state.sending ? 'Enviando...' : 'Enviar';
  }
}


  handleError(error) {
    this.state.isConnected = false;
    this.state.retryCount++;
    
    const errorMessage = this.state.retryCount < this.config.maxRetries
      ? `Lo siento, he tenido un problema técnico. ¿Podrías intentarlo de nuevo?`
      : `He tenido varios problemas de conexión. Por favor, intenta más tarde o usa el formulario principal.`;
    
    this.addMessage('tale', {
      response_text: errorMessage,
      tips: this.state.retryCount >= this.config.maxRetries 
        ? 'Si el problema persiste, puedes usar el formulario tradicional haciendo clic en "Crear mi libro" en la página principal.'
        : null
    });
    
    this.render();
    this.attachEventListeners();
    this.renderMessages();
  }
handleConversationComplete(collectedData) {
  console.log('🔄 Iniciando transferencia con datos:', collectedData);

  
  // Analytics
  if (typeof track === 'function') {
    track('chatbot_conversation_completed', {
      recipient: this.state.conversationState.selectedRecipient,
      duration: Date.now() - this.state.startTime
    });
  }
  
  // Limpiar estado guardado
  //localStorage.removeItem(this.config.storageKey);
  
  // ✅ TRANSFERIR INMEDIATAMENTE - Sin delay ni mensajes adicionales
  this.transferToMainSystem(collectedData);
}


transferToMainSystem(collectedData = null) {
  console.log('🔄 Transfiriendo al sistema principal...');
  console.log('📊 Datos a transferir:', collectedData);
  
  // ✅ NO AÑADIR MÁS MENSAJES AQUÍ - Ya se añadió uno en handleConversationComplete
  
  // Verificar que existe el bridge
  if (window.memoryTaleBridge && typeof window.memoryTaleBridge.triggerPreviewFromChatbot === 'function') {
    console.log('✅ Bridge encontrado, ejecutando transferencia...');
    
    // Transferir datos al sistema principal
    window.memoryTaleBridge.triggerPreviewFromChatbot(collectedData, null);
  } else {
    console.error('❌ Bridge no encontrado');
    console.log('🔍 window.memoryTaleBridge:', window.memoryTaleBridge);
    
    // Fallback
    this.addMessage('tale', {
      response_text: 'Ha ocurrido un problema técnico. Por favor, usa el formulario principal para completar tu pedido.'
    });
  }
}

showPreviewInChatbot(previewData) {
  console.log('🎨 Mostrando preview en el chatbot:', previewData);
  
  // Limpiar mensajes anteriores (opcional)
  this.state.messages = [];
  
  // Mensaje de éxito
  this.addMessage('tale', {
    response_text: '¡Tu historia comienza aquí! Esta es una muestra de tu libro personalizado ✨'
  });
  
  // ✅ NUEVO: Mostrar la imagen de preview
  if (previewData && previewData.previewImageUrl) {
   // ✅ LÍNEA CORREGIDA (eliminar escapeHtml de la URL):
  this.addMessage('tale', {
    response_text: `<div style="text-align: center; margin: 20px 0;">
      <img src="${previewData.previewImageUrl}" 
           alt="Vista previa de tu libro" 
           style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
    </div>`,
    messageType: 'html' // Asegurar que se trate como HTML
  });
}
  
  // Mostrar el texto de preview si está disponible
  if (previewData && previewData.previewText) {
    this.addMessage('tale', {
      response_text: `<div style="font-style: italic; padding: 15px; background: #f8f6f4; border-radius: 8px; margin: 10px 0;">
        "${this.escapeHtml(previewData.previewText)}"
      </div>`
    });
  }
  
  // Botón de compra
  this.addMessage('tale', {
    response_text: '¿Te gusta cómo está quedando tu libro? ¡Puedes comprarlo ahora por solo 24,90€!',
    tips: 'Al comprarlo recibirás el libro completo en PDF en tu email en menos de 15 minutos.',
    showBuyButton: true
  });
  
  this.renderMessages();
  this.scrollToBottom();
  
  // ✅ AÑADIR ESTA LÍNEA AL FINAL:
  localStorage.removeItem(this.config.storageKey);
  console.log('💾 Estado limpiado después de mostrar preview exitosamente');
}


  saveState() {
    try {
      const stateToSave = {
        conversationState: this.state.conversationState,
        messages: this.state.messages,
        startTime: this.state.startTime
      };
      
      localStorage.setItem(this.config.storageKey, JSON.stringify(stateToSave));
      console.log('💾 Estado guardado correctamente');
    } catch (error) {
      console.warn('⚠️ No se pudo guardar el estado del chatbot:', error);
    }
  }

  loadSavedState() {
    try {
      const saved = localStorage.getItem(this.config.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        
        this.state.conversationState = data.conversationState || this.state.conversationState;
        this.state.messages = data.messages || [];
        this.state.startTime = data.startTime || Date.now();
        
        console.log('📂 Estado cargado desde localStorage');
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cargar el estado guardado:', error);
      // Limpiar localStorage corrupto
      localStorage.removeItem(this.config.storageKey);
    }
  }

scrollToBottom() {
  // ✅ Múltiples intentos para asegurar que funcione
  setTimeout(() => {
    const messagesContainer = this.shadowRoot.getElementById('messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // Segundo intento por si el primer renderizado no estaba completo
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
      
      // Tercer intento para asegurar completamente
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 300);
    }
  }, 50);
}


  focusInput() {
    setTimeout(() => {
      const messageInput = this.shadowRoot.getElementById('message-input');
      if (messageInput && !this.state.isTyping && !this.state.sending) {
        messageInput.focus();
      }
    }, 100);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
   // ✅ AÑADIR ESTE MÉTODO AQUÍ, ANTES DEL ÚLTIMO }
  addConversationalFeedback(messageType) {
    const chatWindow = this.shadowRoot.querySelector('.chat-window');
    if (chatWindow && messageType === 'casual') {
      chatWindow.classList.add('casual-thinking');
      setTimeout(() => {
        chatWindow.classList.remove('casual-thinking');
      }, 800);
    }
  }

  // ✅ MÉTODO AUXILIAR OPCIONAL PARA DETECTAR MENSAJES CASUALES
  detectCasualMessage(userMessage) {
    return /^(hola|hey|gracias|favor|ayuda|qué|cuánto|cómo|tengo una duda|duda)/i.test(userMessage);
  }

// En js/chatbot.js, dentro de la clase MemoryTaleChatbot:

// En js/chatbot.js, dentro de la clase MemoryTaleChatbot:
showStyleSelection() {
  console.log('🎨 Mostrando selección de estilo...');
  
  const designContent = window.memoryTaleBridge?.designContent;
  
  if (!designContent) {
    console.error('❌ designContent no disponible');
    this.addMessage('tale', {
      response_text: 'Elige el estilo que prefieras:\n**Estilo A: Romántico** - Clásico y evocador\n**Estilo B: Moderno** - Minimalista y elegante\n\nResponde "A" o "B"'
    });
    return;
  }

  const selectedRecipient = this.state.conversationState.selectedRecipient || 'partner';
  const content = designContent[selectedRecipient] || designContent.partner;
  
  const styleSelectionHTML = `
    <div class="style-selection-container">
      <div class="style-option" data-style="estiloa">
        <img src="${content.estiloa.images.cover}" alt="${content.estiloa.title}" loading="lazy">
        <h4>${content.estiloa.title}</h4>
        <p>${content.estiloa.description}</p>
        <button class="style-select-btn" data-style="estiloa">Seleccionar este estilo</button>
      </div>
      <div class="style-option" data-style="estilob">
        <img src="${content.estilob.images.cover}" alt="${content.estilob.title}" loading="lazy">
        <h4>${content.estilob.title}</h4>
        <p>${content.estilob.description}</p>
        <button class="style-select-btn" data-style="estilob">Seleccionar este estilo</button>
      </div>
    </div>
  `;
  
  this.addMessage('tale', {
    response_text: styleSelectionHTML,
    messageType: 'html'
  });
  
  this.renderMessages();
  this.scrollToBottom();
}



// En js/chatbot.js, dentro de la clase MemoryTaleChatbot:

handleStyleSelection(style) {
  console.log('🎨 Estilo seleccionado:', style);
  
  // Feedback visual inmediato
  this.shadowRoot.querySelectorAll('.style-option').forEach(option => {
    option.classList.remove('selected');
    if (option.dataset.style === style) {
      option.classList.add('selected');
    }
  });
  
  // Deshabilitar todos los botones
  this.shadowRoot.querySelectorAll('.style-select-btn').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.6';
  });
  
  // Mostrar la elección del usuario (solo visual)
  const styleText = style === 'estiloa' ? 'He elegido el Estilo A' : 'He elegido el Estilo B';
  this.addMessage('user', { response_text: styleText });
  
  // ✅ CORRECCIÓN CRÍTICA: Usar sendMessageToWorker en lugar de sendMessage
  setTimeout(() => {
    this.sendMessageToWorker(style); // Envía "estiloa" o "estilob" directamente
  }, 500);
}


// En js/chatbot.js, dentro de la clase MemoryTaleChatbot:

async sendMessageToWorker(message) {
  console.log('📤 Enviando al Worker:', message);
  
  this.state.sending = true;
  this.setTyping(true);
  this.updateUI();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(this.config.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: message,
        conversationState: this.state.conversationState
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    // Actualizar estado
    this.state.conversationState = data.newState;
    this.state.isConnected = true;
    this.state.retryCount = 0;
    
    // Añadir respuesta de Tale
    this.addMessage('tale', data.taleResponse);
    
    // Guardar estado
    this.saveState();
    
    // Si está completo, transferir al sistema principal
    if (data.isComplete) {
      console.log('🎯 Conversación completada desde sendMessageToWorker');
      setTimeout(() => {
        this.handleConversationComplete(data.newState.collectedData);
      }, 2000);
    }
    
  } catch (error) {
    console.error('❌ Error en sendMessageToWorker:', error);
    
    if (error.name === 'AbortError') {
      this.addMessage('tale', {
        response_text: 'La respuesta está tardando más de lo esperado. Voy a transferirte al sistema principal para completar tu libro.',
        tips: 'Tu información se ha guardado correctamente.'
      });
      
      // Si estamos cerca del final, transferir de todas formas
      if (this.state.conversationState.currentStep === 'complete' || 
          this.state.conversationState.currentStep === 'user_email') {
        setTimeout(() => {
          this.handleConversationComplete(this.state.conversationState.collectedData);
        }, 2000);
      }
    } else {
      this.addMessage('tale', {
        response_text: 'Ha ocurrido un error al procesar tu selección. Por favor, intenta escribir "A" o "B" en el campo de mensaje.',
        tips: 'Si el problema persiste, puedes usar el formulario principal.'
      });
    }
  } finally {
    this.setTyping(false);
    this.state.sending = false;
    this.updateUI();
  }
}
}

// Registrar el componente
customElements.define('memorytale-chatbot', MemoryTaleChatbot);

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Verificar que no exista ya un chatbot
  if (!document.querySelector('memorytale-chatbot')) {
    const chatbot = document.createElement('memorytale-chatbot');
    document.body.appendChild(chatbot);
    console.log('✅ MemoryTale Chatbot inicializado correctamente');
  }
});
// 🎨 MEJORAS VISUALES PARA CONVERSACIÓN NATURAL
function addConversationalFeedback(messageType) {
  const chatWindow = this.shadowRoot.querySelector('.chat-window');
  if (chatWindow && messageType === 'casual') {
    chatWindow.classList.add('casual-thinking');
    setTimeout(() => {
      chatWindow.classList.remove('casual-thinking');
    }, 800);
  }
}

