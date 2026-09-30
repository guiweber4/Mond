'use client';
import {useMemo,useState} from 'react';
import {Info,FileSpreadsheet} from 'lucide-react';
import CatalogExplorer from './catalog-explorer';
import {Choice} from './importer';
import {totalsToCatalog,NOT_INFORMED,NO_CATEGORY,type CatalogRow} from '@/lib/catalog';
import {summarizeTotals,type Total} from '@/lib/totals';
import {type Store,dayBR} from '@/lib/model';
type Ranked={sku:string;model:string;category:string;color:string;size:string;qty:number;amount:number};
/** Products use the consolidated totalizations when they exist; transactional sales are an explicit alternative, never merged. */
export default function ProductsPanel({totals,ranked,hasSales,stores,channel,start,end,onImport}:{totals:Total[];ranked:Ranked[];hasSales:boolean;stores:Store[];channel:string;start:string;end:string;onImport:()=>void}){
 const periods=useMemo(()=>[...new Set(totals.map(t=>`${t.start}|${t.end}`))].sort().reverse(),[totals]);
 const [source,setSource]=useState<'totals'|'sales'>(periods.length?'totals':'sales'),[selected,setSelected]=useState('');
 const active=!periods.length?'sales':!hasSales?'totals':source;
 const period=periods.includes(selected)?selected:periods[0]||'',[pStart,pEnd]=period?period.split('|'):['',''];
 const totalRows=useMemo(()=>active==='totals'?summarizeTotals(totals,stores,pStart,pEnd,channel).rows:[],[active,totals,stores,pStart,pEnd,channel]);
 const rows=useMemo<CatalogRow[]>(()=>active==='totals'?totalsToCatalog(totalRows,stores):ranked.map(p=>({id:p.sku,reference:'',model:p.model,category:p.category||NO_CATEGORY,categoryStatus:p.category?'source':'missing',color:p.color||NOT_INFORMED,size:p.size||NOT_INFORMED,sizeCode:'',rawColor:p.color,rawSize:p.size,qty:p.qty,amount:p.amount})),[active,totalRows,ranked,stores]);
 if(!periods.length&&!hasSales)return <section className="panel empty-state"><FileSpreadsheet size={32}/><h3>Nenhuma venda importada</h3><p>Importe a Totalização por produto da Presence para explorar categorias, modelos e a grade vendida.</p><button className="btn primary" onClick={onImport}>Importar Excel</button></section>;
 return <div className="v2-stack">
  <div className="section-inline"><div className="inline-buttons">{periods.length>0&&hasSales&&<Choice label="Fonte de vendas" value={active} onChange={v=>setSource(v as 'totals'|'sales')} options={[{value:'totals',label:'Vendas consolidadas (totalização)'},{value:'sales',label:'Vendas transacionais (pedidos)'}]}/>}{active==='totals'&&<Choice label="Período consolidado" value={period} onChange={setSelected} options={periods.map(p=>{const [s,e]=p.split('|');return {value:p,label:`${dayBR(s)} a ${dayBR(e)}`}})}/>}</div><span className="source-badge">Fonte: {active==='totals'?'Totalização por produto (Presence)':'Itens de pedidos importados'}</span></div>
  <div className="notice"><Info size={17}/><span>{active==='totals'?'Totais por unidade e período declarado; sem pedidos, datas diárias ou ticket. Modelo = referência completa; nomes iguais com referências diferentes ficam separados. Unidade escolhida no filtro superior.':`Vendas transacionais de ${dayBR(start)} a ${dayBR(end)}, sem cancelamentos e com devoluções descontadas. O cadastro não traz referência: modelos são agrupados pelo nome cadastrado.`} Não somamos as duas fontes.</span></div>
  <CatalogExplorer key={active} rows={rows} mode="sales" title="Produtos e grade" context={active==='totals'?`${dayBR(pStart)} a ${dayBR(pEnd)}.`:''}/>
  <div className="notice"><Info size={17}/> A participação nas vendas reflete também a disponibilidade de estoque. Menos vendas de um tamanho não comprovam menor procura. Sell-through exige entradas e estoque inicial; não é calculado apenas com o saldo atual.</div>
 </div>
}
