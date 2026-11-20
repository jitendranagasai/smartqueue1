import {useState} from 'react'
import {Link,useNavigate,useParams} from 'react-router-dom'
import Nav from '../components/Nav'
import {Btn,Card,Badge,Modal,Stat,Empty,run,mins} from '../components/ui'
import {useDB,me,TYPES,svcOf,orgStats,waiting,currentToken,joinQueue,isActive} from '../services/store'

export default function OrgPortal(){const {id}=useParams(),db=useDB(),nav=useNavigate(),u=me();const [m,setM]=useState<''|'join'|'check'>(''),[joining,setJoining]=useState(false)
 const o=db.orgs.find(x=>x.id===id);if(!o)return <div><Nav/><Empty icon="❓" text="Organization not found."/></div>
 const t=TYPES[o.type]||TYPES.OFFICE,s=orgStats(o.id),svcs=svcOf(o.id).filter(x=>x.enabled)
 const cur=svcs.map(x=>currentToken(x.id)).find(x=>x!=='—')||'—'
 const join=()=>{if(!u)return nav('/login',{state:{from:'/organization/'+o.id}});if(u.role!=='CUSTOMER')return run(()=>{throw new Error('Only customers can join queues')});setM('join')}
 const pick=async (sid:string)=>{setJoining(true);try{const r=await run(()=>joinQueue(o.id,sid),'Token generated!');if(r){setM('');nav('/customer/queue')}}finally{setJoining(false)}}
 return <div><Nav/><div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
 <Card className="!p-8 bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-0"><div className="text-xs opacity-80">SmartQueue · {t.label} Portal</div><h1 className="text-3xl font-extrabold mt-1">{t.icon} {o.name}</h1>
 <div className="mt-2 text-sm opacity-90">📍 {o.address}, {o.city}, {o.state} {o.pin}</div><div className="mt-3 flex flex-wrap gap-2 items-center"><Badge tone={o.open?'green':'rose'}>{o.open?'Open':'Closed'}</Badge><span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded">{o.code}</span></div></Card>
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-4"><Stat label="Current queue" value={s.waiting} icon="👥"/><Stat label="Now serving" value={cur} icon="📣" tone="green"/><Stat label="Estimated wait" value={mins(s.wait)} icon="⏱️" tone="amber"/></div>
 <div className="flex flex-wrap gap-3"><Btn onClick={join} disabled={!o.open}>Join Queue</Btn><Btn v="s" onClick={()=>setM('check')}>Check Queue</Btn>{!u&&<><Link to="/login" state={{from:'/organization/'+o.id}}><Btn v="s">Login</Btn></Link><Link to="/register"><Btn v="s">Register</Btn></Link></>}</div>
 <Card><h2 className="font-bold mb-3">Available {t.unit}s / Services</h2><div className="grid sm:grid-cols-2 gap-3">{svcs.map(x=><div key={x.id} className="border rounded-xl p-3 flex justify-between items-center"><div><b>{x.name}</b><div className="text-xs text-slate-500">~{x.avg} min per {t.person.toLowerCase()}</div></div><Badge tone={x.open?'green':'rose'}>{x.open?waiting(x.id).length+' waiting':'Closed'}</Badge></div>)}</div></Card>
 <Modal open={m==='join'} onClose={()=>setM('')} title="Select a service"><div className="space-y-2">{svcs.filter(x=>x.open).map(x=>{const dup=db.tickets.some(k=>k.customerId===u?.id&&k.serviceId===x.id&&isActive(k));return <button key={x.id} disabled={dup||joining} onClick={()=>pick(x.id)} className="w-full text-left border rounded-xl p-3 hover:bg-indigo-50 disabled:opacity-50"><b>{x.name}</b><div className="text-xs text-slate-500">{dup?'Already in this queue':`${waiting(x.id).length} waiting · ~${(waiting(x.id).length+1)*x.avg} min`}</div></button>})}</div></Modal>
 <Modal open={m==='check'} onClose={()=>setM('')} title="Live queue status"><div className="space-y-2">{svcs.map(x=><div key={x.id} className="flex justify-between border rounded-xl p-3 text-sm"><span>{x.name}</span><span>Serving <b>{currentToken(x.id)}</b> · {waiting(x.id).length} waiting</span></div>)}</div></Modal>
 </div></div>}
