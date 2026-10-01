/**
 * Display swatch for a color name from the Presence files (`3 - CHUMBO`, `OFF WHITE`, `JEANS CLARO`).
 * Presentation only: the name stays the identity. Unknown names get a neutral swatch and are labelled as such.
 */
import {searchKey} from './catalog';
export type Swatch={label:string;hex:string|null;pattern?:'print'};
// Longer phrases first: "azul marinho" must win over "azul", "off white" over "branco".
const table:[string[],string][]=[
 [['off white','offwhite','off','cru','creme','marfim','gelo','perola'],'#efe9dc'],
 [['jeans claro','azul claro','celeste','azul bebe'],'#9fb9d6'],
 [['jeans escuro','indigo','azul escuro'],'#2f4466'],
 [['jeans','denim','stone'],'#5c7aa3'],
 [['azul marinho','marinho','navy'],'#1f2f52'],
 [['verde militar','oliva','militar','musgo'],'#5f6b3a'],
 [['preto','black','onix'],'#1d1d1f'],
 [['ebano'],'#2b2522'],
 [['cacau','trufa'],'#5a3d33'],
 [['toffee','canela'],'#9a6a3f'],
 [['manteiga','baunilha'],'#f2e3b3'],
 [['floresta'],'#2f5d43'],
 [['matcha','pistache'],'#8fa864'],
 [['burgundy','rubi'],'#8a1c2e'],
 [['branco','white'],'#f7f7f5'],
 [['chumbo','grafite','carvao'],'#4a4d52'],
 [['cinza','mescla','gris','grey','gray'],'#9a9ea3'],
 [['azul','blue'],'#3d6fb6'],
 [['marrom','cafe','chocolate','tabaco','castanho'],'#6b4630'],
 [['caramelo','camelo','whisky','conhaque'],'#b07a45'],
 [['bege','areia','nude','kaki','caqui','taupe','fendi','palha'],'#cdb79a'],
 [['verde'],'#3f8a5a'],
 [['vinho','bordo','marsala'],'#6e1f2e'],
 [['vermelho','red'],'#c0392b'],
 [['rosa','pink'],'#e8a5b8'],
 [['lilas','lavanda'],'#b9a6d6'],
 [['roxo','violeta','uva'],'#6c4a9e'],
 [['amarelo','mostarda'],'#d9b23a'],
 [['laranja','terracota','ferrugem','telha'],'#c8693c'],
 [['dourado','ouro'],'#c9a548'],
 [['prata'],'#c0c3c7'],
];
/** `3 - CHUMBO` → `CHUMBO`; keeps the name when there is no numeric code. */
export function colorLabel(raw:unknown){return String(raw??'').trim().replace(/\s+/g,' ').replace(/^[^\s-]+\s*-\s*/,'').trim()||String(raw??'').trim()}
export function swatch(raw:unknown):Swatch{
 const label=colorLabel(raw),key=' '+searchKey(label).replace(/[^a-z0-9]+/g,' ').trim()+' ';
 if(/ (estampad|estampa|print|multi|xadrez|listrad|floral)/.test(key))return {label,hex:null,pattern:'print'};
 for(const [names,hex] of table)if(names.some(n=>key.includes(` ${n} `)))return {label,hex};
 return {label,hex:null};
}
