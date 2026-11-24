// Inspirações de destino (cidades reais como referência de imaginário). NÃO representam rotas operadas,
// disponibilidade, autonomia de aeronave ou tempo de voo. A distância é calculada (fórmula de haversine).
export type RegionId = 'todos' | 'americas' | 'europa' | 'africa-me' | 'asia-oceania';
export const REGIONS: { id: RegionId; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'americas', label: 'Américas' },
  { id: 'europa', label: 'Europa' },
  { id: 'africa-me', label: 'África e Oriente Médio' },
  { id: 'asia-oceania', label: 'Ásia e Oceania' },
];

export interface Destination { id: string; name: string; country: string; region: Exclude<RegionId, 'todos'>; lat: number; lon: number; mood: string }

export const ORIGIN = { name: 'São Paulo', lat: -23.55, lon: -46.63 };

export const DESTINATIONS: Destination[] = [
  { id: 'noronha', name: 'Fernando de Noronha', country: 'Brasil', region: 'americas', lat: -3.85, lon: -32.42, mood: 'Água transparente e um horizonte sem interrupções.' },
  { id: 'punta', name: 'Punta del Este', country: 'Uruguai', region: 'americas', lat: -34.96, lon: -54.95, mood: 'Fim de semana à beira do Atlântico Sul.' },
  { id: 'aspen', name: 'Aspen', country: 'Estados Unidos', region: 'americas', lat: 39.19, lon: -106.82, mood: 'Montanha, neve e lareira ao fim do dia.' },
  { id: 'novayork', name: 'Nova York', country: 'Estados Unidos', region: 'americas', lat: 40.71, lon: -74.0, mood: 'Uma agenda cheia, resolvida em poucos dias.' },
  { id: 'lisboa', name: 'Lisboa', country: 'Portugal', region: 'europa', lat: 38.72, lon: -9.14, mood: 'Luz dourada sobre o Tejo e a língua de casa.' },
  { id: 'paris', name: 'Paris', country: 'França', region: 'europa', lat: 48.86, lon: 2.35, mood: 'Ateliês, galerias e jantares sem relógio.' },
  { id: 'courchevel', name: 'Courchevel', country: 'França', region: 'europa', lat: 45.41, lon: 6.63, mood: 'Altitude alpina para quem prefere o silêncio da neve.' },
  { id: 'marrakech', name: 'Marrakech', country: 'Marrocos', region: 'africa-me', lat: 31.63, lon: -7.99, mood: 'Riads, especiarias e o Atlas no horizonte.' },
  { id: 'dubai', name: 'Dubai', country: 'Emirados Árabes Unidos', region: 'africa-me', lat: 25.2, lon: 55.27, mood: 'Deserto e skyline na mesma janela.' },
  { id: 'maldivas', name: 'Maldivas', country: 'Maldivas', region: 'asia-oceania', lat: 4.17, lon: 73.51, mood: 'Atóis, lagoas e o tempo medido pela maré.' },
  { id: 'toquio', name: 'Tóquio', country: 'Japão', region: 'asia-oceania', lat: 35.68, lon: 139.69, mood: 'Precisão, design e o outro lado do mundo.' },
];

/** Distância ortodrômica em km (haversine, raio médio 6371 km). */
export function greatCircleKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
