import {useState} from 'react'
import {Btn,Card,Badge,Stat,Modal,Empty,Table,statusTone,run,toast,mins} from '../components/ui'
import {useDB,me,ahead,estWait,currentToken,isActive,joinQueue,cancelTicket,svcOf,waiting,TYPES,Ticket,syncAll} from '../services/store'
import {hasNotificationPermission,requestBrowserNotificationPermission,playChime} from '../utils/alerts'

export default function Customer({history}:{history?:boolean}){const db=useDB(),u=me()!;const [j,setJ]=useState(false),[org,setOrg]=useState(''),[view,setView]=useState<Ticket|null>(null),[joining,setJoining]=useState(false)
 const [hasPerm,setHasPerm]=useState(hasNotificationPermission())
 const mine=db.tickets.filter(t=>t.customerId===u?.id).sort((a,b)=>b.createdAt-a.createdAt),act=mine.filter(isActive),a=act[0]
 const on=(t:Ticket)=>db.orgs.find(o=>o.id===t.orgId)?.name,sn=(t:Ticket)=>db.services.find(s=>s.id===t.serviceId)?.name
 const cn=(t:Ticket)=>db.counters.find(c=>c.id===t.counterId)?.name

 const enableAlerts=async ()=>{
  playChime()
  const granted=await requestBrowserNotificationPermission()
  setHasPerm(granted)
  if(granted)toast('Desktop & audio alerts enabled!','ok')
  else toast('Audio alerts enabled!','ok')
 }

 return <>
 <div className="flex flex-wrap justify-between items-center gap-3"><h1 className="text-2xl font-bold">Welcome, {u?.name}</h1><Btn onClick={()=>setJ(true)}>＋ Join Queue</Btn></div>
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Stat label="Active token" value={a?.token||'—'} icon="🎟️"/><Stat label="Queue position" value={a?.status==='WAITING'?'#'+(ahead(a)+1):a?'Now':'—'} icon="📍" tone="green"/><Stat label="People ahead" value={a?ahead(a):'—'} icon="👥" tone="amber"/><Stat label="Estimated wait" value={a?mins(estWait(a)):'—'} icon="⏱️" tone="rose"/></div>

 {!hasPerm&&act.length>0&&<div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
  <div className="flex items-center gap-3"><span className="text-2xl">🔔</span><div><b className="text-sm text-indigo-950">Enable Sound & Desktop Alerts</b><p className="text-xs text-slate-600">Never miss your turn — receive an audible chime and native notification even if this tab is in the background.</p></div></div>
  <Btn onClick={enableAlerts}>Enable Alerts</Btn></div>}

 <h2 className="text-lg font-bold">My Queue</h2>
 {!act.length&&<Card><Empty icon="🎟️" text="You are not in any queue. Join one to get a token."/></Card>}
 <div className="grid lg:grid-cols-2 gap-5">{act.map(t=><Card key={t.id} className="text-center space-y-3">
 <div className="text-sm text-slate-500">{on(t)}</div>
 {t.status!=='WAITING'&&<div className="bg-emerald-50 text-emerald-700 rounded-xl p-2 font-semibold">🔔 Please proceed to {cn(t)||'the counter'}</div>}
 <div className="text-xs text-slate-500">TOKEN NUMBER</div><div className="text-7xl font-black text-indigo-600 tracking-tight">{t.token}</div>
 <div className="grid grid-cols-3 gap-2 text-sm"><div className="bg-slate-50 rounded-lg p-2"><b className="block">{currentToken(t.serviceId)}</b>Current</div><div className="bg-slate-50 rounded-lg p-2"><b className="block">{ahead(t)}</b>Ahead</div><div className="bg-slate-50 rounded-lg p-2"><b className="block">{mins(estWait(t))}</b>Est. wait</div></div>
 <div className="text-sm">{sn(t)} · <Badge tone={statusTone(t.status)}>{t.status}</Badge></div>
 <div className="flex flex-wrap gap-2 justify-center"><Btn v="s" onClick={()=>setView(t)}>View Token</Btn><Btn v="s" onClick={async ()=>{await syncAll();toast('Queue refreshed','info')}}>Refresh Queue</Btn>{t.status==='WAITING'&&<Btn v="d" onClick={async ()=>{if(confirm('Leave this queue?')){await run(()=>cancelTicket(t.id),'You left the queue')}}}>Leave Queue</Btn>}</div></Card>)}</div>
 {history&&<Card><h2 className="font-bold mb-3">Queue History</h2>{mine.length?<Table head={['Token','Organization','Service','Date','Status']}>{mine.slice(0,30).map(t=><tr key={t.id}><td className="font-mono font-semibold">{t.token}</td><td>{on(t)}</td><td>{sn(t)}</td><td>{new Date(t.createdAt).toLocaleDateString()}</td><td><Badge tone={statusTone(t.status)}>{t.status}</Badge></td></tr>)}</Table>:<Empty text="No history yet."/>}</Card>}
 <Modal open={j} onClose={()=>{setJ(false);setOrg('')}} title={org?'Select a service':'Choose an organization'}>
 {!org?<div className="space-y-2">{db.orgs.filter(o=>o.open).map(o=><button key={o.id} onClick={()=>setOrg(o.id)} className="w-full text-left border rounded-xl p-3 hover:bg-indigo-50">{TYPES[o.type]?.icon} <b>{o.name}</b><div className="text-xs text-slate-500">{o.city}</div></button>)}</div>
 :<div className="space-y-2">{svcOf(org).filter(s=>s.enabled&&s.open).map(s=><button key={s.id} disabled={joining} onClick={async ()=>{setJoining(true);try{const ok=await run(()=>joinQueue(org,s.id),'Token generated!');if(ok){setJ(false);setOrg('')}}finally{setJoining(false)}}} className="w-full text-left border rounded-xl p-3 hover:bg-indigo-50 disabled:opacity-50"><b>{s.name}</b><div className="text-xs text-slate-500">{waiting(s.id).length} waiting · ~{(waiting(s.id).length+1)*s.avg} min</div></button>)}<Btn v="s" onClick={()=>setOrg('')}>← Back</Btn></div>}</Modal>
 <Modal open={!!view} onClose={()=>setView(null)} title="Your Token">{view&&<div className="text-center space-y-2"><div className="text-sm text-slate-500">{on(view)} · {sn(view)}</div><div className="text-8xl font-black text-indigo-600">{view.token}</div><div className="text-sm">Current: <b>{currentToken(view.serviceId)}</b> · Ahead: <b>{ahead(view)}</b> · Wait: <b>{mins(estWait(view))}</b></div></div>}</Modal></>}
