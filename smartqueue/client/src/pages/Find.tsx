import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import Nav from '../components/Nav'
import OrgCard from '../components/OrgCard'
import {Btn,Card,Field,Empty,toast,cx} from '../components/ui'
import {useDB,Org} from '../services/store'
const dist=(a:number,b:number,c:number,d:number)=>{const t=Math.PI/180,x=Math.sin((c-a)*t/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin((d-b)*t/2)**2;return 12742*Math.asin(Math.sqrt(x))}
export default function Find(){const db=useDB(),nav=useNavigate()
 const [tab,setTab]=useState<'name'|'loc'|'code'>('name'),[q,setQ]=useState(''),[foc,setFoc]=useState(false),[pos,setPos]=useState<any>(null),[code,setCode]=useState(''),[bad,setBad]=useState(false),[busy,setBusy]=useState(false)
 const ql=q.trim().toLowerCase()
 const byName=db.orgs.filter(o=>!ql||o.name.toLowerCase().includes(ql))
 let loc:{o:Org;km?:number}[]=db.orgs.filter(o=>!ql||[o.city,o.address,o.pin,o.state].some(x=>x.toLowerCase().includes(ql))).map(o=>({o,km:pos?dist(pos.lat,pos.lng,o.lat,o.lng):undefined}))
 if(pos)loc.sort((a,b)=>(a.km as number)-(b.km as number))
 const gps=()=>{if(!navigator.geolocation)return toast('Geolocation not supported','err');setBusy(true)
  navigator.geolocation.getCurrentPosition(p=>{setPos({lat:p.coords.latitude,lng:p.coords.longitude});setBusy(false);toast('Location found')},()=>{setBusy(false);toast('Location permission denied. Search by city or PIN instead.','err')})}
 const go=(e:any)=>{e.preventDefault();const o=db.orgs.find(x=>x.code===code.trim().toUpperCase());if(o)nav('/organization/'+o.id);else setBad(true)}
 const T=(k:any,l:string)=><button onClick={()=>{setTab(k);setQ('')}} className={cx('flex-1 py-2 rounded-lg text-sm font-semibold',tab===k?'bg-white shadow text-indigo-700':'text-slate-500')}>{l}</button>
 return <div><Nav/><div className="max-w-5xl mx-auto px-4 py-10 space-y-6"><div className="text-center"><h1 className="text-3xl font-extrabold">Find Your Organization</h1><p className="text-slate-600 mt-1">Search by name, location, or SmartQueue code.</p></div>
 <div className="flex gap-1 bg-slate-100 p-1 rounded-xl max-w-md mx-auto">{T('name','By Name')}{T('loc','By Location')}{T('code','By Code')}</div>
 {tab==='name'&&<><div className="max-w-xl mx-auto relative"><Field placeholder="Search organization by name..." value={q} onChange={(e:any)=>setQ(e.target.value)} onFocus={()=>setFoc(true)} onBlur={()=>setTimeout(()=>setFoc(false),150)}/>
  {foc&&ql&&<div className="absolute z-10 w-full bg-white border rounded-xl shadow-lg mt-1 overflow-hidden">{byName.slice(0,5).map(o=><button key={o.id} onMouseDown={()=>nav('/organization/'+o.id)} className="block w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm">{o.name} <span className="text-slate-400">· {o.city}</span></button>)}</div>}</div>
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{byName.map(o=><OrgCard key={o.id} o={o}/>)}</div>{!byName.length&&<Empty icon="🔍" text="No organizations match your search."/>}</>}
 {tab==='loc'&&<><Card className="max-w-xl mx-auto space-y-3"><Btn onClick={gps} disabled={busy} className="w-full">{busy?'Locating...':'📍 Use My Location'}</Btn><div className="text-center text-xs text-slate-400">or search by city, area or PIN code</div><Field placeholder="City, area or PIN code" value={q} onChange={(e:any)=>setQ(e.target.value)}/></Card>
  <h2 className="font-bold text-lg">{pos?'Organizations Near You':'Organizations'}</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{loc.map(x=><OrgCard key={x.o.id} o={x.o} km={x.km}/>)}</div>{!loc.length&&<Empty icon="📍" text="No organizations found in that area."/>}</>}
 {tab==='code'&&<Card className="max-w-md mx-auto"><form onSubmit={go} className="space-y-3"><h2 className="font-bold">Have an Organization Code?</h2><Field placeholder="Enter organization code (e.g. SQ-HOSP-1024)" value={code} onChange={(e:any)=>{setCode(e.target.value);setBad(false)}}/>
  {bad&&<div className="text-sm text-rose-600">Organization not found. Please check the code and try again.</div>}<Btn className="w-full">Find Organization</Btn></form></Card>}
 </div></div>}
