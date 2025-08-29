// src/utils/aiHelpers.ts
import { ConversationState } from '../types/tale';

export function generateOrderId(relationshipType: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  return `mt_${relationshipType}_${timestamp}_${randomSuffix}`;
}

export function validateUserData(userData: Partial<any>): boolean {
  const requiredFields = [
    'tipo',
    'user-name',
    'user-email', 
    'genero-autor',
    'nombre-destinatario',
    'genero-destinatario'
  ];
  
  return requiredFields.every(field => userData[field]);
}

export function formatDataForMake(conversationState: ConversationState): any {
  const { relationshipType, userData } = conversationState;
  
  return {
    tipo: relationshipType,
    'user-name': userData['user-name'],
    'user-email': userData['user-email'],
    'genero-autor': userData['genero-autor'],
    'nombre-destinatario': userData['nombre-destinatario'],
    'genero-destinatario': userData['genero-destinatario'],
    [`${relationshipType}-q1`]: userData[`${relationshipType}-q1`],
    [`${relationshipType}-q2`]: userData[`${relationshipType}-q2`],
    [`${relationshipType}-q3`]: userData[`${relationshipType}-q3`],
    [`${relationshipType}-q4`]: userData[`${relationshipType}-q4`],
    [`${relationshipType}-q5`]: userData[`${relationshipType}-q5`],
    [`${relationshipType}-q6`]: userData[`${relationshipType}-q6`],
    'estilo-libro': userData['estilo-libro'],
    'privacy-consent': userData['privacy-consent'],
    'order_id': userData['order_id']
  };
}

export function detectEmotionalCues(text: string): {
  emotion: string;
  intensity: number;
  keywords: string[];
} {
  const emotionalPatterns = {
    joy: {
      keywords: ['feliz', 'alegre', 'genial', 'fantástico', 'maravilloso', 'increíble', 'emocionado', 'encantado'],
      intensity: 0.8
    },
    love: {
      keywords: ['amor', 'quiero', 'adoro', 'amo', 'cariño', 'especial', 'único'],
      intensity: 0.9
    },
    nostalgia: {
      keywords: ['recuerdo', 'antes', 'cuando era', 'solíamos', 'época', 'tiempo', 'siempre'],
      intensity: 0.7
    },
    sadness: {
      keywords: ['triste', 'difícil', 'duro', 'complicado', 'perdida', 'dolor'],
      intensity: 0.6
    },
    excitement: {
      keywords: ['emocionante', 'ansioso', 'ilusión', 'ganas', 'espero'],
      intensity: 0.8
    }
  };

  const normalizedText = text.toLowerCase();
  let detectedEmotion = 'neutral';
  let maxIntensity = 0;
  let foundKeywords: string[] = [];

  for (const [emotion, data] of Object.entries(emotionalPatterns)) {
    const matchedKeywords = data.keywords.filter(keyword => 
      normalizedText.includes(keyword)
    );
    
    if (matchedKeywords.length > 0) {
      const intensity = data.intensity * (matchedKeywords.length / data.keywords.length);
      if (intensity > maxIntensity) {
        maxIntensity = intensity;
        detectedEmotion = emotion;
        foundKeywords = matchedKeywords;
      }
    }
  }

  return {
    emotion: detectedEmotion,
    intensity: maxIntensity,
    keywords: foundKeywords
  };
}

// Funciones adicionales para compatibilidad con aiService.ts
export function extractNameFromText(text: string): string | null {
  const namePatterns = [
    /me llamo (\w+)/i,
    /soy (\w+)/i,
    /mi nombre es (\w+)/i,
    /se llama (\w+)/i,
    /es (\w+)/i,
    /le digo (\w+)/i,
    /le llamo (\w+)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  const words = text.trim().split(' ');
  if (words.length === 1 && words[0].length > 1 && !/^(sí|si|no|él|ella|hombre|mujer)$/i.test(words[0])) {
    return words[0];
  }
  
  return null;
}

export function detectRelationshipType(text: string): string | null {
  // Importar la función de relationships.ts para evitar duplicación
  const { detectRelationship } = require('../data/relationships');
  return detectRelationship(text);
}
