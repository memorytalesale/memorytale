import { RelationshipConfig } from '../types/tale';

export const relationshipConfigs: Record<string, RelationshipConfig> = {
  socio: {
    type: 'socio',
    detectionKeywords: ['pareja', 'novio', 'novia', 'marido', 'mujer', 'esposo', 'esposa', 'amor', 'mi chico', 'mi chica', 'compañero', 'compañera'],
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
  hermano: {
    type: 'hermano',
    detectionKeywords: ['hermano', 'hermana', 'hermanito', 'hermanita', 'ermanito', 'ermanita', 'brother', 'sister'],
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
      'Su don especial: ¿Qué calidad o talento te llena de orgullo?',
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
  amigo: {
    type: 'amigo',
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

// DETECCIÓN MEJORADA CON TYPOS Y VARIACIONES
export function detectRelationship(text: string): string | null {
  const normalizedText = text.toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n');
  
  // PATRONES EXTENDIDOS CON TYPOS COMUNES
  const extendedPatterns = {
    socio: ['pareja', 'novio', 'novia', 'marido', 'mujer', 'esposo', 'esposa', 'amor', 'mi chico', 'mi chica', 'compañero', 'compañera', 'mi amor'],
    hermano: ['hermano', 'hermana', 'hermanito', 'hermanita', 'ermanito', 'ermanita', 'ermano', 'ermana', 'brother', 'sister'],
    parent: ['padre', 'madre', 'papá', 'mamá', 'papi', 'mami', 'dad', 'mom', 'papa', 'mama', 'mi padre', 'mi madre'],
    child: ['hijo', 'hija', 'niño', 'niña', 'bebé', 'pequeño', 'pequeña', 'mi niño', 'mi niña', 'mi hijo', 'mi hija'],
    amigo: ['amigo', 'amiga', 'mejor amigo', 'mejor amiga', 'friend', 'colega', 'amiguito', 'amiguita', 'mi amigo', 'mi amiga']
  };
  
  for (const [key, keywords] of Object.entries(extendedPatterns)) {
    if (keywords.some(keyword => normalizedText.includes(keyword))) {
      return key;
    }
  }
  
  return null;
}