import { UserData } from '../types/tale';

export class MakeWebhookService {
  private webhookUrl: string;
  private paymentWebhookUrl?: string;

  constructor(webhookUrl: string, paymentWebhookUrl?: string) {
    this.webhookUrl = webhookUrl;
    this.paymentWebhookUrl = paymentWebhookUrl || webhookUrl; // Fallback al mismo webhook si no se especifica
  }

  async sendBookData(userData: UserData): Promise<{
    success: boolean;
    previewUrl?: string;
    previewText?: string;
    previewImageUrl?: string;
    orderId?: string;
    error?: string;
  }> {
    if (!this.webhookUrl) {
      return {
        success: false,
        error: 'Webhook URL no configurada. Configura VITE_MAKE_WEBHOOK_URL en .env.local'
      };
    }

    try {
      // Validar datos antes de enviar
      const validation = this.validateUserData(userData);
      if (!validation.isValid) {
        console.warn('⚠️ Datos incompletos:', validation.missingFields);
        console.log('📊 Datos actuales:', userData);
      }
      
      const formattedData = this.formatDataForMake(userData);
      console.log('📤 Enviando a Make.com:', formattedData);
      
      // Log específico para verificar preguntas
      const includedQs = Object.keys(formattedData).filter(k => /-(q[1-6])$/.test(k));
      console.log('🔍 Preguntas incluidas:', includedQs);
      
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formattedData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 1) Leer como texto SIEMPRE
      const raw = await response.text();
      console.log('📥 Respuesta texto de Make.com:', raw);

      // 2) Parseo externo
      let outer: any;
      try {
        outer = JSON.parse(raw);
      } catch {
        outer = { message: raw }; // si viniera plano
      }

      // 3) Si el JSON real viene anidado en message/body/data como string -> parsear y mergear
      function tryMergeJsonStringField(base: any, field: string) {
        const v = base?.[field];
        if (typeof v === 'string' && v.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(v);
            return { ...base, ...parsed };
          } catch { /* ignorar si no parsea */ }
        }
        return base;
      }

      let merged = outer;
      merged = tryMergeJsonStringField(merged, 'message');
      merged = tryMergeJsonStringField(merged, 'body');
      merged = tryMergeJsonStringField(merged, 'data');

      console.log('📥 Respuesta JSON Make:', merged);
      console.log('🔍 Campos preview encontrados:', {
        previewText: merged.previewText || merged.preview_text || '',
        previewUrl: merged.previewUrl || merged.preview_url || '',
        previewImageUrl: merged.previewImageUrl || merged.preview_image_url || '',
        orderId: merged.order_id || merged.orderId || ''
      });

      // 4) Normalización final
      const isOk = response.ok || /^(ok|accepted|success)$/i.test(merged?.status || '');
      if (isOk || merged.previewText || merged.preview_text) {
        const returnData = {
          success: true,
          previewUrl: merged.previewUrl || merged.preview_url || '',
          previewText: merged.previewText || merged.preview_text || '',
          previewImageUrl: merged.previewImageUrl || merged.preview_image_url || merged.previewUrl || '',
          orderId: merged.order_id || merged.orderId || ''
        };
        console.log('➡️ Normalizado devuelto al chatbot:', returnData);
        return returnData;
      }

      throw new Error(`Respuesta inesperada de Make.com: ${raw}`);
    } catch (error) {
      console.error('❌ Error enviando a Make.com:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  // Helper de mapeo de tipo → prefijo
  private RELATION_PREFIX: Record<string, string> = {
    sibling: 'sibling',
    partner: 'partner', 
    parent: 'parent',
    child: 'child',
    friend: 'friend',
  };

  // FORMATO JSON EXACTO REQUERIDO - GARANTIZADO
  private formatDataForMake(userData: any): any {
    // Si por compatibilidad te llega un "state", normaliza a data:
    const data = userData?.userData ? userData.userData : userData;

    // Detectar tipo: prioridad data.tipo → userData.relationshipType → ''
    const tipo: string = (data.tipo ?? userData?.relationshipType ?? '').toString().trim();

    const prefix = this.RELATION_PREFIX[tipo] ?? null;

    const base = {
      // campos base
      'user-name': data['user-name'] ?? '',
      'user-email': data['user-email'] ?? '',
      'genero-autor': data['genero-autor'] ?? '',
      'nombre-destinatario': data['nombre-destinatario'] ?? '',
      'genero-destinatario': data['genero-destinatario'] ?? '',
      'estilo-libro': data['estilo-libro'] ?? '',
      'privacy-consent': data['privacy-consent'] ?? '',
      'order_id': data['order_id'] ?? '',
      // ⬇️ nuevo
      tipo: tipo || '',
    };

    // Incorporar preguntas solo con el prefijo correcto; no enviar undefined-q*
    if (prefix) {
      for (let i = 1; i <= 6; i++) {
        const key = `${prefix}-q${i}`;
        const fallback = `q${i}`; // por si existe en plano
        const value = data[key] ?? data[fallback] ?? '';
        if (value) {
          (base as any)[key] = value;
        }
      }
    }

    return base;
  }

  // MÉTODO PARA TESTING - MUESTRA JSON EXACTO
  testFormat(userData: UserData): string {
    return JSON.stringify(this.formatDataForMake(userData), null, 2);
  }

  // MÉTODO PARA ENVIAR SOLICITUD DE PAGO (SEGUNDO SCENARIO DE MAKE)
  async sendPaymentRequest(userData: UserData & { payment_request?: boolean; scenario?: number }): Promise<{
    success: boolean;
    stripeUrl?: string;
    stripeSessionId?: string;
    error?: string;
  }> {
    if (!this.paymentWebhookUrl) {
      return {
        success: false,
        error: 'Payment Webhook URL no configurada'
      };
    }

    try {
      const paymentData = {
        ...this.formatDataForMake(userData),
        payment_request: true,
        scenario: 2
      };
      
      console.log('💳 Enviando solicitud de pago a Make.com:', paymentData);
      
      const response = await fetch(this.paymentWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 1) Leer como texto SIEMPRE (igual que en sendBookData)
      const raw = await response.text();
      console.log('💳 Respuesta texto de Make.com (pago):', raw);

      // 2) Parseo externo
      let outer: any;
      try {
        outer = JSON.parse(raw);
      } catch {
        outer = { message: raw }; // si viniera plano
      }

      // 3) Si el JSON real viene anidado en message/body/data como string -> parsear y mergear
      function tryMergeJsonStringField(base: any, field: string) {
        const v = base?.[field];
        if (typeof v === 'string' && v.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(v);
            return { ...base, ...parsed };
          } catch { /* ignorar si no parsea */ }
        }
        return base;
      }

      let merged = outer;
      merged = tryMergeJsonStringField(merged, 'message');
      merged = tryMergeJsonStringField(merged, 'body');
      merged = tryMergeJsonStringField(merged, 'data');

      console.log('💳 Respuesta JSON Make parseada:', merged);

      // 4) Extraer stripeUrl de varias claves posibles
      const stripeUrl =
        merged.stripeUrl ||
        merged.stripe_url ||
        merged.checkoutUrl ||
        merged.checkout_url ||
        merged.paymentUrl ||
        merged.payment_url ||
        merged['session.url'] ||
        '';
      const sessionId = merged.session_id || merged.sessionId || merged.stripeSessionId || '';

      console.log('💳 URLs encontradas:', { stripeUrl, sessionId, status: merged.status });

      // 5) Normalización final
      const isOk = response.ok || response.status === 202 || /^(ok|accepted|success)$/i.test(merged?.status || '');

      if (stripeUrl) {
        return { success: true, stripeUrl, stripeSessionId: sessionId };
      } else if (isOk) {
        // Éxito sin URL de Stripe
        return { success: true };
      }

      // 6) Error explícito con el raw (mejor para depurar)
      return { success: false, error: `Respuesta inesperada de Make.com: ${raw}` };
    } catch (error) {
      console.error('❌ Error enviando solicitud de pago a Make.com:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  // VALIDACIÓN DE DATOS ANTES DE ENVÍO
  private validateUserData(userData: any): { isValid: boolean; missingFields: string[] } {
    const data = userData?.userData ? userData.userData : userData;
    const tipo = data.tipo ?? userData?.relationshipType ?? '';
    const prefix = this.RELATION_PREFIX[tipo] ?? '';

    const missing: string[] = [];
    if (!tipo) missing.push('tipo');

    const requiredFields = [
      'user-name',
      'user-email', 
      'genero-autor',
      'nombre-destinatario',
      'genero-destinatario',
      'estilo-libro',
      'privacy-consent',
      'order_id'
    ];

    requiredFields.forEach(field => {
      if (!data[field]) missing.push(field);
    });

    if (prefix) {
      for (let i = 1; i <= 6; i++) {
        if (!data[`${prefix}-q${i}`]) {
          missing.push(`${prefix}-q${i}`);
        }
      }
    }

    return {
      isValid: missing.length === 0,
      missingFields: missing,
    };
  }
}