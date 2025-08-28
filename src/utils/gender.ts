// src/utils/gender.ts
import type { GenderValue } from '../types/tale';

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

function primaryNameFromFull(full?: string): string {
  const s = strip(full || '');
  if (!s) return '';
  const tokens = s.replace(/-/g,' ').split(/\s+/);
  if (!tokens.length) return '';
  const joined = tokens.join(' ');
  
  // Nombres compuestos comunes en español
  if (joined.startsWith('jose maria')) return 'jose maria';   // m
  if (joined.startsWith('maria jose')) return 'maria jose';   // f
  if (joined.startsWith('maria jesus')) return 'maria jesus'; // f
  if (joined.startsWith('jesus maria')) return 'jesus maria'; // m
  if (joined.startsWith('jose luis')) return 'jose luis';     // m
  if (joined.startsWith('maria carmen')) return 'maria carmen'; // f
  if (joined.startsWith('ana maria')) return 'ana maria';     // f
  if (joined.startsWith('juan carlos')) return 'juan carlos'; // m
  
  return tokens[0];
}

const EXCEPTIONS: Record<string,'f'|'m'|'u'> = {
  // Femeninos que no acaban en 'a'
  'carmen':'f','luz':'f','mar':'f','sol':'f','isabel':'f','esther':'f','ruth':'f',
  'raquel':'f','belen':'f','cruz':'f','paz':'f','nuria':'f','emma':'f','andrea':'f',
  'ines':'f','beatriz':'f','mercedes':'f','pilar':'f','rocio':'f','ainhoa':'f',
  'naiara':'f','irene':'f','aitana':'f','noa':'f','ainara':'f','leire':'f',
  
  // Masculinos
  'angel':'m','miguel':'m','samuel':'m','jose':'m','luis':'m','carlos':'m',
  'jaime':'m','alex':'m','nacho':'m','joan':'m','jordi':'m','pau':'m',
  'daniel':'m','david':'m','gabriel':'m','rafael':'m','manuel':'m','ismael':'m',
  'abel':'m','israel':'m','ruben':'m','jesus':'m','andres':'m','marcos':'m',
  'unai':'m','iker':'m','asier':'m','aitor':'m','mikel':'m','jon':'m',
  
  // Nombres compuestos
  'jose maria':'m','maria jose':'f','maria jesus':'f','jesus maria':'m',
  'jose luis':'m','maria carmen':'f','ana maria':'f','juan carlos':'m',
  
  // Unisex/ambiguos
  'alexis':'u','ariel':'u','dana':'u','robin':'u','nico':'u',
  'trinidad':'u','guadalupe':'u','rosario':'u','camille':'u','dominique':'u'
};

// Patrones de contexto en español
const HINT_F = /\b(ella|novia|esposa|mujer|chica|hija|hermana|madre|mam[áa]|t[íi]a|abuela|yaya|nana|amiga|compañera|pareja\sfemenina|prima|sobrina|nuera|suegra)\b/i;
const HINT_M = /\b([eé]l(?!\s+ella)|novio|esposo|marido|hombre|chico|hijo|hermano|padre|pap[áa]|t[íi]o|abuelo|yayo|nono|amigo|compañero|pareja\smasculina|primo|sobrino|yerno|suegro)\b/i;

export interface GenderDecision {
  gender: GenderValue;
  confidence: number;
}

export function decideGender(name?: string, contextTexts: string[] = []): GenderDecision {
  const n = primaryNameFromFull(name);
  if (!n) return { gender: 'no-especificado', confidence: 0.0 };

  // 1. Analizar contexto primero (más fiable)
  const joined = (contextTexts || []).join(' ').toLowerCase();
  if (HINT_F.test(joined)) return { gender: 'femenino', confidence: 0.88 };
  if (HINT_M.test(joined)) return { gender: 'masculino', confidence: 0.88 };

  // 2. Verificar excepciones conocidas
  if (EXCEPTIONS[n] === 'f') return { gender: 'femenino', confidence: 0.95 };
  if (EXCEPTIONS[n] === 'm') return { gender: 'masculino', confidence: 0.95 };
  if (EXCEPTIONS[n] === 'u') return { gender: 'no-especificado', confidence: 0.4 };

  // 3. Heurísticas morfológicas españolas
  const last = n.slice(-1);
  const last2 = n.slice(-2);
  const last3 = n.slice(-3);
  
  // Terminaciones femeninas típicas
  if (last === 'a' && !n.endsWith('ema')) return { gender: 'femenino', confidence: 0.75 };
  if (last2 === 'ez' || last2 === 'iz') return { gender: 'femenino', confidence: 0.70 };
  if (last3 === 'dad' || last3 === 'tud') return { gender: 'femenino', confidence: 0.72 };
  
  // Terminaciones masculinas típicas
  if (last === 'o') return { gender: 'masculino', confidence: 0.78 };
  if (last === 'e' && n.length > 4) return { gender: 'masculino', confidence: 0.65 };
  if (last === 'r' || last === 'l' || last === 'n' || last === 's') {
    return { gender: 'masculino', confidence: 0.68 };
  }

  // Si no encaja en ningún patrón
  return { gender: 'no-especificado', confidence: 0.3 };
}

// Helper para verificar si necesitamos preguntar
export function shouldAskForGender(confidence: number): boolean {
  return confidence < 0.65;
}

// Helper para formatear nombre para mostrar
export function formatNameForDisplay(name: string): string {
  if (!name) return '';
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}