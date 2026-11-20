import {useState} from 'react'
import {Navigate,useParams} from 'react-router-dom'
import {ResponsiveContainer,LineChart,Line,BarChart,Bar,PieChart,Pie,Cell,XAxis,YAxis,Tooltip,CartesianGrid,Legend} from 'recharts'
import {Btn,Card,Badge,Stat,Table,Empty,Modal,Field,Sel,statusTone,run,confirmAsk,toast,mins,ago} from '../components/ui'
import * as S from '../services/store'

const {useDB,me,svcOf,waiting,isActive,todayT,avgOf}=S
const COL=['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
const Head=({t,children}:any)=><div className="flex flex-wrap justify-between items-center gap-3"><h1 className="text-2xl font-bold">{t}</h1>{children}</div>

export default function Admin(){const {tab}=useParams();const db=useDB(),u=me()!,oid=u?.orgId as string
 const org=db.orgs.find(o=>o.id===oid) || { name: 'Admin Portal', code: '', address: '', city: '', state: '', pin: '', open: true } as any
 const svcs=svcOf(oid),ctrs=db.counters.filter(c=>c.orgId===oid),staff=db.users.filter(x=>x.orgId===oid&&x.role==='STAFF'),ts=db.tickets.filter(t=>t.orgId===oid)
 const sn=(id?:string)=>db.services.find(s=>s.id===id)?.name||'—',cn=(id?:string)=>db.counters.find(c=>c.id===id)?.name||'—'
 const done=ts.filter(t=>t.status==='COMPLETED'&&t.calledAt&&t.completedAt)
 const avgWait=avgOf(done.map(t=>(t.calledAt!-t.createdAt)/6e4)),avgSvc=avgOf(done.map(t=>(t.completedAt!-t.calledAt!)/6e4))
 const custIds=Array.from(new Set(ts.map(t=>t.customerId)))
 const [m,setM]=useState<any>(null),[f,setF]=useState<any>({}),[q,setQ]=useState(''),[open,setOpen]=useState('')
 const edit=(kind:string,v:any={})=>{setF(v);setM(kind)}
 const set=(k:string)=>(e:any)=>setF({...f,[k]:e.target.value}),close=()=>setM(null)
 const submit=(fn:()=>any,msg:string)=>async (e:any)=>{e.preventDefault();try{await fn();toast(msg);close()}catch(x:any){toast(x.message,'err')}}
 const mask=(e:string)=>e?[e[0]+'***@'+e.split('@')[1]]:'—'

 if(tab==='dashboard')return <><Head t={`${org.name} — Dashboard`}/>
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-4"><Stat label="Total customers" value={custIds.length} icon="🧑‍🤝‍🧑"/><Stat label="Active queues" value={svcs.filter(s=>s.open&&s.enabled).length} icon="📋" tone="green"/><Stat label="Waiting customers" value={ts.filter(t=>t.status==='WAITING'&&todayT(t)).length} icon="⏳" tone="amber"/><Stat label="Staff members" value={staff.length} icon="👥"/><Stat label="Completed today" value={ts.filter(t=>t.status==='COMPLETED'&&todayT(t)).length} icon="✅" tone="green"/><Stat label="Avg waiting time" value={mins(Math.round(avgWait))} icon="⏱️" tone="rose"/></div>
 <Card><h2 className="font-bold mb-3">Live queues</h2><Table head={['Service','Serving','Waiting','Status']}>{svcs.map(s=><tr key={s.id}><td>{s.name}</td><td className="font-mono">{S.currentToken(s.id)}</td><td>{waiting(s.id).length}</td><td><Badge tone={s.open?'green':'rose'}>{s.open?'OPEN':'CLOSED'}</Badge></td></tr>)}</Table></Card></>

 if(tab==='queues'||tab==='services'){const Q=tab==='queues'
  return <><Head t={Q?'Queue Management':'Services / Departments'}><Btn onClick={()=>edit('svc',{name:'',avg:8,cap:50})}>＋ Add {Q?'Queue':'Service'}</Btn></Head>
  <Card>{svcs.length?<Table head={Q?['Queue','Prefix','Waiting','Capacity','Avg time','Staff','Counter','Status','Actions']:['Service','Avg time','Enabled','Actions']}>{svcs.map(s=>{const st=staff.find(x=>x.serviceId===s.id),c=ctrs.find(x=>x.serviceId===s.id)
  return <tr key={s.id}><td className="font-medium">{s.name}</td>{Q?<><td>{s.prefix}</td><td>{waiting(s.id).length}</td><td>{s.cap}</td><td>{s.avg}m</td><td>{st?.name||'—'}</td><td>{c?.name||'—'}</td><td><Badge tone={s.open?'green':'rose'}>{s.open?'OPEN':'CLOSED'}</Badge></td></>:<><td>{s.avg} min</td><td><Badge tone={s.enabled?'green':'slate'}>{s.enabled?'Enabled':'Disabled'}</Badge></td></>}
  <td className="space-x-2">{Q?<Btn v="s" className="!py-1" onClick={()=>run(()=>S.saveService({id:s.id,open:!s.open}),s.open?'Queue closed':'Queue opened')}>{s.open?'Close':'Open'}</Btn>:<Btn v="s" className="!py-1" onClick={()=>run(()=>S.saveService({id:s.id,enabled:!s.enabled}),'Updated')}>{s.enabled?'Disable':'Enable'}</Btn>}
  <Btn v="s" className="!py-1" onClick={()=>edit('svc',s)}>Edit</Btn><Btn v="d" className="!py-1" onClick={()=>confirmAsk(`Delete ${s.name}?`)&&run(()=>S.deleteService(s.id),'Deleted')}>Delete</Btn></td></tr>})}</Table>:<Empty text="No services yet."/>}</Card>
  <Modal open={m==='svc'} onClose={close} title={f.id?'Edit':'Add'}><form className="space-y-3" onSubmit={submit(()=>S.saveService({id:f.id,name:f.name,avg:+f.avg,cap:+f.cap}),'Saved')}><Field label="Name" value={f.name||''} onChange={set('name')} required/><Field label="Average service time (min)" type="number" min={1} value={f.avg||''} onChange={set('avg')}/><Field label="Queue capacity" type="number" min={1} value={f.cap||''} onChange={set('cap')}/><Btn className="w-full">Save</Btn></form></Modal></>}

 if(tab==='staff')return <><Head t="Staff Management"><Btn onClick={()=>edit('st',{name:'',email:'',password:'',serviceId:svcs[0]?.id,counterId:''})}>＋ Add Staff</Btn></Head>
  <Card>{staff.length?<Table head={['Name','Email','Department','Counter','Status','Served','Actions']}>{staff.map(x=><tr key={x.id}><td className="font-medium">{x.name}</td><td>{x.email}</td><td>{sn(x.serviceId)}</td><td>{cn(x.counterId)}</td><td><Badge tone={statusTone(x.status)}>{x.status}</Badge></td><td>{ts.filter(t=>t.staffId===x.id&&t.status==='COMPLETED').length}</td>
  <td className="space-x-2"><Btn v="s" className="!py-1" onClick={()=>edit('st',x)}>Edit</Btn><Btn v="s" className="!py-1" onClick={async ()=>{const p=prompt('New password (min 8 chars)');if(p)await run(()=>S.staffReset(x.id,p),'Password reset')}}>Reset PW</Btn><Btn v="w" className="!py-1" onClick={()=>run(()=>S.staffToggle(x.id),'Updated')}>{x.status==='ACTIVE'?'Disable':'Enable'}</Btn><Btn v="d" className="!py-1" onClick={()=>confirmAsk('Delete this staff account?')&&run(()=>S.staffDelete(x.id),'Deleted')}>Delete</Btn></td></tr>)}</Table>:<Empty text="No staff yet. Staff can only be created here."/>}</Card>
  <Modal open={m==='st'} onClose={close} title={f.id?'Edit Staff':'Add Staff'}><form className="space-y-3" onSubmit={submit(()=>S.saveStaff({id:f.id,name:f.name,email:f.email,password:f.password,serviceId:f.serviceId,counterId:f.counterId}),'Staff saved')}>
  <Field label="Staff Name" value={f.name||''} onChange={set('name')} required/><Field label="Staff Email" type="email" value={f.email||''} onChange={set('email')} required/>{!f.id&&<Field label="Initial Password" type="text" value={f.password||''} onChange={set('password')} required/>}
  <Sel label="Department" value={f.serviceId||''} onChange={set('serviceId')}>{svcs.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Sel><Sel label="Counter" value={f.counterId||''} onChange={set('counterId')}><option value="">None</option>{ctrs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Sel>
  <div className="text-xs text-slate-500">Role (STAFF) and organization are assigned automatically.</div><Btn className="w-full">Save</Btn></form></Modal></>

 if(tab==='customers')return <><Head t="Customers"><div className="w-full sm:w-64"><Field placeholder="Search customers..." value={q} onChange={(e:any)=>setQ(e.target.value)}/></div></Head>
  <Card>{(()=>{const L=custIds.map(id=>db.users.find(x=>x.id===id)).filter(Boolean).filter(c=>!q||c!.name.toLowerCase().includes(q.toLowerCase())) as S.User[]
  return L.length?<Table head={['Customer','Email','In queue now','Visits','Completed','History']}>{L.map(c=>{const mine=ts.filter(t=>t.customerId===c.id).sort((a,b)=>b.createdAt-a.createdAt);return <><tr key={c.id}><td className="font-medium">{c.name}</td><td>{mask(c.email)}</td><td>{mine.some(isActive)?<Badge tone="amber">Yes</Badge>:'—'}</td><td>{mine.length}</td><td>{mine.filter(t=>t.status==='COMPLETED').length}</td><td><Btn v="s" className="!py-1" onClick={()=>setOpen(open===c.id?'':c.id)}>{open===c.id?'Hide':'View'}</Btn></td></tr>
  {open===c.id&&<tr key={c.id+'h'}><td colSpan={6} className="!whitespace-normal bg-slate-50 rounded-lg p-3"><div className="flex flex-wrap gap-2">{mine.slice(0,15).map(t=><span key={t.id} className="text-xs bg-white border rounded-lg px-2 py-1">{t.token} · {sn(t.serviceId)} · {new Date(t.createdAt).toLocaleDateString()} · {t.status}</span>)}</div></td></tr>}</>})}</Table>:<Empty text="No customers found."/>})()}</Card></>

 if(tab==='counters')return <><Head t="Counter Management"><Btn onClick={()=>edit('ct',{name:'Counter '+(ctrs.length+1),serviceId:svcs[0]?.id})}>＋ Add Counter</Btn></Head>
  <Card>{ctrs.length?<Table head={['Counter','Department','Staff','Status','Actions']}>{ctrs.map(c=><tr key={c.id}><td className="font-medium">{c.name}</td><td>{sn(c.serviceId)}</td><td>{staff.filter(x=>x.counterId===c.id).map(x=>x.name).join(', ')||'—'}</td><td><Badge tone={c.active?'green':'rose'}>{c.active?'ACTIVE':'INACTIVE'}</Badge></td>
  <td className="space-x-2"><Btn v="s" className="!py-1" onClick={()=>run(()=>S.saveCounter({id:c.id,active:!c.active}),'Updated')}>{c.active?'Deactivate':'Activate'}</Btn><Btn v="s" className="!py-1" onClick={()=>edit('ct',c)}>Edit</Btn><Btn v="d" className="!py-1" onClick={()=>confirmAsk('Delete counter?')&&run(()=>S.deleteCounter(c.id),'Deleted')}>Delete</Btn></td></tr>)}</Table>:<Empty text="No counters."/>}</Card>
  <Modal open={m==='ct'} onClose={close} title={f.id?'Edit Counter':'Add Counter'}><form className="space-y-3" onSubmit={submit(()=>{return S.saveCounter({id:f.id,name:f.name,serviceId:f.serviceId,staffId:f.staffId})},'Counter saved')}>
  <Field label="Name" value={f.name||''} onChange={set('name')} required/><Sel label="Department" value={f.serviceId||''} onChange={set('serviceId')}>{svcs.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Sel>
  {f.id&&<Sel label="Assign staff" value={f.staffId||''} onChange={set('staffId')}><option value="">—</option>{staff.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Sel>}<Btn className="w-full">Save</Btn></form></Modal></>

 if(tab==='analytics'){const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-6+i);return d})
  const perDay=days.map(d=>({day:d.toLocaleDateString(undefined,{weekday:'short'}),served:done.filter(t=>new Date(t.createdAt).toDateString()===d.toDateString()).length,
   wait:avgOf(done.filter(t=>new Date(t.createdAt).toDateString()===d.toDateString()).map(t=>(t.calledAt!-t.createdAt)/6e4))}))
  const peak=[...Array(11)].map((_,i)=>({h:`${i+8}:00`,n:ts.filter(t=>new Date(t.createdAt).getHours()===i+8).length}))
  const dept=svcs.map(s=>({name:s.name,value:done.filter(t=>t.serviceId===s.id).length})).filter(x=>x.value)
  const perf=staff.map(x=>({name:x.name.split(' ')[0],served:ts.filter(t=>t.staffId===x.id&&t.status==='COMPLETED').length}))
  const cc=[{name:'Completed',value:ts.filter(t=>t.status==='COMPLETED').length},{name:'Cancelled',value:ts.filter(t=>t.status==='CANCELLED').length},{name:'Skipped',value:ts.filter(t=>t.status==='SKIPPED').length}]
  const W=({t,h=240,children}:any)=><Card><h3 className="font-bold mb-3">{t}</h3><div style={{height:h}}><ResponsiveContainer>{children}</ResponsiveContainer></div></Card>
  return <><Head t="Analytics"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Stat label="Total served" value={done.length} icon="✅" tone="green"/><Stat label="Avg wait" value={avgWait+'m'} icon="⏳" tone="amber"/><Stat label="Avg service time" value={avgSvc+'m'} icon="⏱️"/><Stat label="Waiting now" value={ts.filter(t=>t.status==='WAITING'&&todayT(t)).length} icon="👥" tone="rose"/></div>
  <div className="grid lg:grid-cols-2 gap-5">
  <W t="Customers served per day"><LineChart data={perDay}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="day"/><YAxis allowDecimals={false}/><Tooltip/><Line type="monotone" dataKey="served" stroke={COL[0]} strokeWidth={3}/></LineChart></W>
  <W t="Average waiting time (min)"><LineChart data={perDay}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="day"/><YAxis/><Tooltip/><Line type="monotone" dataKey="wait" stroke={COL[2]} strokeWidth={3}/></LineChart></W>
  <W t="Peak hours"><BarChart data={peak}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="h"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="n" fill={COL[0]} radius={[6,6,0,0]}/></BarChart></W>
  <W t="Department-wise customers"><PieChart><Pie data={dept} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{dept.map((_,i)=><Cell key={i} fill={COL[i%6]}/>)}</Pie><Tooltip/><Legend/></PieChart></W>
  <W t="Staff performance"><BarChart data={perf}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="served" fill={COL[1]} radius={[6,6,0,0]}/></BarChart></W>
  <W t="Completed vs cancelled"><PieChart><Pie data={cc} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{cc.map((_,i)=><Cell key={i} fill={[COL[1],COL[3],COL[2]][i]}/>)}</Pie><Tooltip/><Legend/></PieChart></W></div></>}

 if(tab==='settings'){const v={name:org.name,address:org.address,city:org.city,state:org.state,pin:org.pin,...f}
  return <><Head t="Organization Settings"/><Card className="space-y-4 max-w-xl"><div className="bg-indigo-50 rounded-xl p-4 text-center"><div className="text-xs text-indigo-700">Your SmartQueue Organization Code</div><div className="text-2xl font-extrabold font-mono text-indigo-700">{org.code}</div><Btn v="s" className="mt-2" onClick={()=>{navigator.clipboard?.writeText(org.code);toast('Code copied')}}>Copy</Btn></div>
  <form className="space-y-3" onSubmit={async (e:any)=>{e.preventDefault();await run(()=>S.saveOrg(v),'Settings saved')}}>{(['name','address','city','state','pin'] as const).map(k=><Field key={k} label={k[0].toUpperCase()+k.slice(1)} value={(v as any)[k]||''} onChange={set(k)}/>)}<Btn>Save changes</Btn></form>
  <div className="flex items-center justify-between border-t pt-4"><div><b>Organization status</b><div className="text-sm text-slate-500">Closed organizations cannot accept new tokens.</div></div><Btn v={org.open?'d':'g'} onClick={()=>run(()=>S.saveOrg({open:!org.open}),org.open?'Organization closed':'Organization opened')}>{org.open?'Close':'Open'}</Btn></div>
  <div className="border-t pt-4"><Btn v="d" onClick={async ()=>{if(confirmAsk('Reset ALL demo data? You will be logged out.')){await S.resetDemo();await S.logout();window.location.href='/login'}}}>Reset demo data</Btn></div></Card></>}
 return <Navigate to="/admin/dashboard" replace/>}
