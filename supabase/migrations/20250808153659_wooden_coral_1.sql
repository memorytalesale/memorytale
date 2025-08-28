/*
  # Tale Analytics Schema for MemoryTale.es

  1. New Tables
    - `conversations` - Persistencia de sesiones con analytics ML-ready
    - `messages` - Historial completo de mensajes con análisis emocional
    - `analytics_events` - Eventos para machine learning y data science

  2. Security
    - Enable RLS on all tables
    - Public access policies for anonymous users (widget público)

  3. Analytics Features
    - Emotional tone detection per message
    - Query type classification
    - Response time tracking
    - Abandonment analysis
    - Conversion funnel tracking
*/

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tabla principal de conversaciones (persistencia + analytics)
CREATE TABLE IF NOT EXISTS conversations (
    session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    current_step text NOT NULL DEFAULT 'greeting',
    selected_recipient text,
    collected_data jsonb DEFAULT '{}',
    emotional_profile jsonb DEFAULT '{}',
    completion_time_minutes integer,
    user_agent text,
    is_complete boolean DEFAULT false,
    final_outcome text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tabla de mensajes (historial + análisis conversacional)
CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES conversations(session_id) ON DELETE CASCADE,
    sender text NOT NULL CHECK (sender IN ('user', 'assistant')),
    content text NOT NULL,
    step_at_message text,
    emotional_tone text,
    query_type text,
    response_time_ms integer,
    timestamp timestamptz DEFAULT now()
);

-- Tabla de eventos para machine learning
CREATE TABLE IF NOT EXISTS analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES conversations(session_id) ON DELETE CASCADE,
    event_type text NOT NULL,
    event_data jsonb DEFAULT '{}',
    timestamp timestamptz DEFAULT now()
);

-- Índices para analytics y performance
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_recipient ON conversations(selected_recipient);
CREATE INDEX IF NOT EXISTS idx_conversations_outcome ON conversations(final_outcome);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_emotional_tone ON messages(emotional_tone);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);

-- Triggers para updated_at
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (widget accesible sin autenticación)
CREATE POLICY "Public conversations access" ON conversations
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public messages access" ON messages
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public analytics access" ON analytics_events
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);