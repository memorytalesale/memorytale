// src/services/aiService.ts

import { ConversationState, TaleWorkerFullResponse, createMessage } from '../types/tale';

export class AIService {
  private workerUrl: string;

  constructor() {
    this.workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!this.workerUrl) {
      console.error("VITE_WORKER_URL no está definida en tu archivo .env.");
      throw new Error("VITE_WORKER_URL no está definida.");
    }
  }

  async generateResponse(
    userMessage: string,
    conversationState: ConversationState,
    sessionId: string
  ): Promise<TaleWorkerFullResponse> {
    try {
      // 🔥 DEBUG: Log de la URL que se está usando
      console.log('🎯 AIService usando URL:', this.workerUrl);
      console.log('📤 Enviando payload:', { 
        userMessage: userMessage.substring(0, 50) + '...', 
        step: conversationState.step,
        sessionId 
      });
      
      const response = await fetch(this.workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userMessage, conversationState, sessionId }),
      });

      // 🔥 DEBUG: Log del response
      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error de respuesta del Worker:', errorText);
        throw new Error(`Error del Worker: ${response.status} - ${errorText}`);
      }

      const data: TaleWorkerFullResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error al obtener respuesta del AI Service:', error);
      
      // Fallback robusto con tipos correctos
      const fallbackState: ConversationState = {
        ...conversationState,
        conversationHistory: [
          ...conversationState.conversationHistory,
          createMessage('assistant', 'Lo siento, algo salió mal. Por favor, inténtalo de nuevo.')
        ].slice(-20)
      };

      return {
        taleResponse: {
          response_text: 'Lo siento, algo salió mal. Por favor, inténtalo de nuevo.',
          isComplete: false,
        },
        newState: fallbackState,
        sessionId: sessionId,
        isComplete: false,
        error: (error as Error).message
      };
    }
  }
}
