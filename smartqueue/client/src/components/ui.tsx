import React,{useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
export const cx=(...a:any[])=>a.filter(Boolean).join(' ')
const bc:any={p:'bg-indigo-600 text-white hover:bg-indigo-700',s:'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',d:'bg-rose-600 text-white hover:bg-rose-700',g:'bg-emerald-600 text-white hover:bg-emerald-700',w:'bg-amber-500 text-white hover:bg-amber-600'}
export function Btn({v='p',className='',...r}:any){return <button {...r} className={cx('px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed',bc[v],className)}/>}
export const Card=({className='',...r}:any)=><div {...r} className={cx('bg-white rounded-2xl border border-slate-200 shadow-sm p-5 anim',className)}/>
const tones:any={indigo:'bg-indigo-50 text-indigo-700',green:'bg-emerald-50 text-emerald-700',amber:'bg-amber-50 text-amber-700',rose:'bg-rose-50 text-rose-700',slate:'bg-slate-100 text-slate-600'}
export const Badge=({tone='slate',children}:any)=><span className={cx('px-2 py-0.5 rounded-full text-xs font-semibold',tones[tone])}>{children}</span>
export const statusTone=(s:string)=>({WAITING:'amber',CALLED:'indigo',SERVING:'indigo',COMPLETED:'green',SKIPPED:'rose',CANCELLED:'slate',ACTIVE:'green',DISABLED:'rose',OPEN:'green',CLOSED:'rose'} as any)[s]||'slate'
export const Stat=({label,value,icon,tone='indigo'}:any)=><Card className="flex items-center gap-4"><div className={cx('w-11 h-11 rounded-xl grid place-items-center text-xl',tones[tone])}>{icon}</div><div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-500">{label}</div></div></Card>
export const Field=({label,...r}:any)=><label className="block text-sm font-medium text-slate-700">{label}<input {...r} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-indigo-500"/></label>
export const Sel=({label,children,...r}:any)=><label className="block text-sm font-medium text-slate-700">{label}<select {...r} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">{children}</select></label>
export const Empty=({icon='📭',text}:any)=><div className="text-center py-10 text-slate-500"><div className="text-4xl mb-2">{icon}</div>{text}</div>
export const Spinner=()=><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"/>
export function Modal({open,onClose,title,children}:any){if(!open)return null
 return <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/50" onClick={onClose}><div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto p-6 anim" onClick={e=>e.stopPropagation()}>
 <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">✕</button></div>{children}</div></div>}
export const Table=({head,children}:any)=><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="text-xs uppercase text-slate-500 border-b">{head.map((h:string)=><th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 [&_td]:py-2.5 [&_td]:pr-4 [&_td]:whitespace-nowrap">{children}</tbody></table></div>
export const confirmAsk=(m:string)=>window.confirm(m)
// toasts
let push:any=()=>{};export const toast=(msg:string,type:'ok'|'err'|'info'='ok')=>push(msg,type)
export const run=async (f:()=>any,ok?:string)=>{try{const r=await f();if(ok)toast(ok);return r}catch(e:any){toast(e.message||'An error occurred','err');return undefined}}
export function Toaster(){const [l,s]=useState<any[]>([])
 useEffect(()=>{push=(m:string,t:string)=>{const id=Math.random();s(x=>[...x,{id,m,t}]);setTimeout(()=>s(x=>x.filter(y=>y.id!==id)),4000)};return()=>{push=()=>{}}},[])
 return <div className="fixed top-4 right-4 z-[60] space-y-2 w-[min(92vw,22rem)]">{l.map(x=><div key={x.id} className={cx('anim rounded-xl px-4 py-3 text-sm text-white shadow-lg',x.t==='err'?'bg-rose-600':x.t==='info'?'bg-indigo-600':'bg-emerald-600')}>{x.m}</div>)}</div>}
export const Logo=({to='/'}:any)=><Link to={to} className="flex items-center gap-2 font-extrabold text-xl text-indigo-700"><span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-500 text-white grid place-items-center text-base">Q</span>SmartQueue</Link>
export const mins=(m:number)=>m<=0?'—':m<60?`${m} min`:`${Math.floor(m/60)}h ${m%60}m`
export const ago=(t:number)=>mins(Math.max(0,Math.round((Date.now()-t)/6e4)))
