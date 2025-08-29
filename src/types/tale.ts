// src/types/tale.ts

// Relación del destinatario
export type RelationshipType =
  | 'partner'
  | 'sibling'
  | 'parent'
  | 'child'
  | 'friend';

// Tipo de género con opción inclusiva
export type GenderValue = 'femenino' | 'masculino' | 'no-especificado';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isHtml?: boolean;
}

export interface UserData {
  order_id?: string;
  'user-name'?: string;
  'user-email'?: string;
  'genero-autor'?: GenderValue;
  'nombre-destinatario'?: string;
  'genero-destinatario'?: GenderValue;
  'estilo-libro'?: 'estiloa' | 'estilob';
  'privacy-consent'?: 'accepted' | string;
  
  // 👇 Añadir esta propiedad para alinear con Make y con el uso en TaleChatbot.tsx
  tipo?: RelationshipType | string;
  [key: string]: any;
}

export type ConversationStep =
  | 'greeting'
  | 'basic-info'
  | 'questions'
  | 'email-capture'
  | 'style-selection'
  | 'preview'
  | 'sending-to-make'
  | 'awaiting-payment'
  | 'complete';

export interface RelationshipConfig {
  type: string;
  detectionKeywords: string[];
  questions: string[];
  contextualIntros: string[];
}

export interface ConversationState {
  step: ConversationStep;
  currentStep?: ConversationStep;
  relationshipType?: RelationshipType;
  relationshipTypeMapped?: RelationshipType;
  currentQuestionIndex: number;
  userData: UserData;
  conversationHistory: Message[];
  isInitialized?: boolean;
  __intro_shown?: boolean;
  __last_greet_ts?: number;
}

export interface PreviewData {
  previewText: string;
  previewImageUrl: string;
  success: boolean;
}

export interface TaleWorkerResponseContent {
  response_text: string;
  previewData?: PreviewData;
  showPreview?: boolean;
  isComplete?: boolean;
  nextStep?: ConversationStep;
}

export interface TaleWorkerFullResponse {
  taleResponse: TaleWorkerResponseContent;
  newState: ConversationState;
  sessionId: string;
  isComplete: boolean;
  error?: string;
}

export const createMessage = (type: 'user' | 'assistant', content: string, isHtml: boolean = false): Message => ({
  id: Math.random().toString(36).substring(2, 9),
  type,
  content,
  timestamp: new Date(),
  isHtml
});