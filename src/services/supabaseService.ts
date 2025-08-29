import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ConversationState, Message, UserData } from '../types/tale';

export interface ConversationRecord {
  session_id: string;
  current_step: string;
  selected_recipient?: string;
  collected_data: Record<string, any>;
  emotional_profile: Record<string, any>;
  completion_time_minutes?: number;
  user_agent?: string;
  is_complete: boolean;
  final_outcome?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  session_id: string;
  sender: 'user' | 'assistant';
  content: string;
  step_at_message?: string;
  emotional_tone?: string;
  query_type?: string;
  response_time_ms?: number;
  timestamp: string;
}

export interface AnalyticsEvent {
  id: string;
  session_id: string;
  event_type: string;
  event_data: Record<string, any>;
  timestamp: string;
}

export class SupabaseService {
  private supabase: SupabaseClient;
  private sessionId: string;
  private startTime: number;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing. Please connect to Supabase.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.sessionId = this.getOrCreateSessionId();
    this.startTime = Date.now();
  }

  private getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('tale_session_id');
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem('tale_session_id', sessionId);
    }
    return sessionId;
  }

  // PERSISTENCIA DE CONVERSACIÓN
  async saveConversationState(state: ConversationState): Promise<void> {
    try {
      const conversationData = {
        session_id: this.sessionId,
        current_step: state.step,
        selected_recipient: state.relationshipType,
        collected_data: state.userData,
        emotional_profile: this.buildEmotionalProfile(state.conversationHistory),
        is_complete: state.step === 'completed',
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('conversations')
        .upsert(conversationData, { onConflict: 'session_id' });

      if (error) {
        console.error('Error saving conversation:', error);
      }
    } catch (error) {
      console.error('Error in saveConversationState:', error);
    }
  }

  // RECUPERACIÓN DE SESIÓN
  async loadConversationState(): Promise<ConversationState | null> {
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('session_id', this.sessionId)
        .single();

      if (error || !data) {
        return null;
      }

      // Cargar mensajes de la conversación
      const { data: messages } = await this.supabase
        .from('messages')
        .select('*')
        .eq('session_id', this.sessionId)
        .order('timestamp', { ascending: true });

      return {
        step: data.current_step as any,
        relationshipType: data.selected_recipient as any,
        currentQuestionIndex: this.calculateQuestionIndex(data.collected_data),
        userData: data.collected_data,
        conversationHistory: this.formatMessages(messages || [])
      };
    } catch (error) {
      console.error('Error loading conversation:', error);
      return null;
    }
  }

  // GUARDAR MENSAJE CON ANALYTICS
  async saveMessage(
    content: string, 
    sender: 'user' | 'assistant',
    currentStep: string,
    emotionalTone?: string,
    queryType?: string,
    responseTime?: number
  ): Promise<void> {
    try {
      const messageData = {
        session_id: this.sessionId,
        sender,
        content,
        step_at_message: currentStep,
        emotional_tone: emotionalTone,
        query_type: queryType,
        response_time_ms: responseTime,
        timestamp: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('messages')
        .insert(messageData);

      if (error) {
        console.error('Error saving message:', error);
      }
    } catch (error) {
      console.error('Error in saveMessage:', error);
    }
  }

  // EVENTOS PARA MACHINE LEARNING
  async trackEvent(
    eventType: 'step_completed' | 'abandoned' | 'emotional_trigger' | 'conversion' | 'error',
    eventData: Record<string, any>
  ): Promise<void> {
    try {
      const event = {
        session_id: this.sessionId,
        event_type: eventType,
        event_data: eventData,
        timestamp: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('analytics_events')
        .insert(event);

      if (error) {
        console.error('Error tracking event:', error);
      }
    } catch (error) {
      console.error('Error in trackEvent:', error);
    }
  }

  // FINALIZAR CONVERSACIÓN CON ANALYTICS
  async completeConversation(outcome: 'completed' | 'abandoned' | 'error'): Promise<void> {
    try {
      const completionTime = Math.round((Date.now() - this.startTime) / 60000); // minutos

      const { error } = await this.supabase
        .from('conversations')
        .update({
          is_complete: outcome === 'completed',
          final_outcome: outcome,
          completion_time_minutes: completionTime,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', this.sessionId);

      // Evento de finalización
      await this.trackEvent(outcome === 'completed' ? 'conversion' : 'abandoned', {
        completion_time_minutes: completionTime,
        total_messages: await this.getMessageCount(),
        final_step: await this.getCurrentStep()
      });

      if (error) {
        console.error('Error completing conversation:', error);
      }
    } catch (error) {
      console.error('Error in completeConversation:', error);
    }
  }

  // ANALYTICS HELPERS
  private buildEmotionalProfile(messages: Message[]): Record<string, any> {
    const emotions = messages
      .filter(m => m.metadata?.detectedEmotion)
      .map(m => m.metadata!.detectedEmotion);

    const emotionCounts = emotions.reduce((acc, emotion) => {
      acc[emotion!] = (acc[emotion!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      dominant_emotion: Object.keys(emotionCounts).reduce((a, b) => 
        emotionCounts[a] > emotionCounts[b] ? a : b, 'neutral'
      ),
      emotion_distribution: emotionCounts,
      total_emotional_messages: emotions.length
    };
  }

  private calculateQuestionIndex(collectedData: Record<string, any>): number {
    const questionKeys = Object.keys(collectedData).filter(key => key.includes('-q'));
    return questionKeys.length;
  }

  private formatMessages(dbMessages: any[]): Message[] {
    return dbMessages.map(msg => ({
      id: msg.id,
      type: msg.sender,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      metadata: {
        detectedEmotion: msg.emotional_tone as any,
        queryType: msg.query_type
      }
    }));
  }

  private async getMessageCount(): Promise<number> {
    const { count } = await this.supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', this.sessionId);
    
    return count || 0;
  }

  private async getCurrentStep(): Promise<string> {
    const { data } = await this.supabase
      .from('conversations')
      .select('current_step')
      .eq('session_id', this.sessionId)
      .single();
    
    return data?.current_step || 'unknown';
  }

  // NUEVA SESIÓN (para testing o reset)
  createNewSession(): void {
    this.sessionId = uuidv4();
    localStorage.setItem('tale_session_id', this.sessionId);
    this.startTime = Date.now();
  }

  // ANALYTICS QUERIES (para dashboard futuro)
  async getConversationAnalytics(days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: conversations } = await this.supabase
      .from('conversations')
      .select('*')
      .gte('created_at', since);

    const { data: events } = await this.supabase
      .from('analytics_events')
      .select('*')
      .gte('timestamp', since);

    return {
      total_conversations: conversations?.length || 0,
      completed_conversations: conversations?.filter(c => c.is_complete).length || 0,
      average_completion_time: this.calculateAverageTime(conversations || []),
      relationship_distribution: this.getRelationshipDistribution(conversations || []),
      abandonment_points: this.getAbandonmentAnalysis(events || [])
    };
  }

  private calculateAverageTime(conversations: any[]): number {
    const completed = conversations.filter(c => c.completion_time_minutes);
    if (completed.length === 0) return 0;
    
    const total = completed.reduce((sum, c) => sum + c.completion_time_minutes, 0);
    return Math.round(total / completed.length);
  }

  private getRelationshipDistribution(conversations: any[]): Record<string, number> {
    return conversations.reduce((acc, conv) => {
      const type = conv.selected_recipient || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  private getAbandonmentAnalysis(events: any[]): Record<string, number> {
    const abandonments = events.filter(e => e.event_type === 'abandoned');
    return abandonments.reduce((acc, event) => {
      const step = event.event_data?.final_step || 'unknown';
      acc[step] = (acc[step] || 0) + 1;
      return acc;
    }, {});
  }
}