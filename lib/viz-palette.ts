/**
 * Chart colors. Units keep a fixed slot (by their order in the store settings), never by rank, so a filter never
 * repaints them. Categorical set validated with the dataviz validator on white (adjacent CVD ΔE ≥ 7.9 with
 * 2px gaps + direct labels; slot 4 below 3:1 → always labelled). Status colors only with a text label.
 */
export const UNIT_COLORS=['#1a7aa0','#d0663a','#23a072','#c2952a'];
export const SERIES={primary:'#1a7aa0',secondary:'#d0663a',neutral:'#245b6e'};
export const STATUS={critical:'#d03b3b',serious:'#ec835a',good:'#0ca30c',muted:'#c3c2b7'};
export const INK={primary:'#22323a',secondary:'#52514e',muted:'#898781',grid:'#e1e0d9',axis:'#c3c2b7'};
export function unitColor(id:string,stores:{id:string;status?:string}[]){const order=stores.filter(s=>s.status!=='planned'&&s.status!=='inactive').map(s=>s.id);const i=order.indexOf(id);return UNIT_COLORS[i]??INK.muted}
