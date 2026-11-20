import {useEffect,useRef,useState} from 'react'
import {NavLink,useNavigate,Link} from 'react-router-dom'
import {Logo,Btn,toast,cx,ago} from '../components/ui'
import {me,logout,useDB,clearNotifs} from '../services/store'
import {triggerCustomerAlert,requestBrowserNotificationPermission,hasNotificationPermission,playChime} from '../utils/alerts'

const NAV:any={
 CUSTOMER:[['🏠','Dashboard','/customer/dashboard'],['🎟️','My Queue','/customer/queue'],['🔎','Find Organization','/find']],
 STAFF:[['🏠','Dashboard','/staff/dashboard']],
 ADMIN:[['📊','Dashboard','/admin/dashboard'],['📋','Queues','/admin/queues'],['👥','Staff','/admin/staff'],['🧑‍🤝‍🧑','Customers','/admin/customers'],['🪟','Counters','/admin/counters'],['🧩','Services','/admin/services'],['📈','Analytics','/admin/analytics'],['⚙️','Settings','/admin/settings']]}

export default function Dash({children}:any){const db=useDB(),u=me()!,nav=useNavigate();const [open,setOpen]=useState(false),[bell,setBell]=useState(false)
 const [hasPerm,setHasPerm]=useState(hasNotificationPermission())
 const mine=db.notifs.filter(n=>n.userId===u?.id).sort((a,b)=>b.ts-a.ts);const last=useRef(mine.length)

 useEffect(()=>{
  if(mine.length>last.current){
   const latest=mine[0].msg
   toast(latest,'info')
   triggerCustomerAlert(latest)
  }
  last.current=mine.length
 },[mine.length])

 const enableAlerts=async ()=>{
  playChime()
  const granted=await requestBrowserNotificationPermission()
  setHasPerm(granted)
  if(granted)toast('Desktop & audio alerts enabled!','ok')
  else toast('Audio chime enabled!','ok')
 }

 const org=db.orgs.find(o=>o.id===u?.orgId)
 if(!u)return null
 return <div className="min-h-screen md:flex">
 {open&&<div className="fixed inset-0 bg-slate-900/40 z-30 md:hidden" onClick={()=>setOpen(false)}/>}
 <aside className={cx('fixed md:sticky top-0 z-40 h-screen w-64 bg-white border-r border-slate-200 p-4 flex flex-col transition-transform',open?'translate-x-0':'-translate-x-full md:translate-x-0')}>
 <Logo/><div className="text-xs text-slate-500 mt-1 mb-6">{org?org.name:'Customer portal'}</div>
 <nav className="space-y-1 flex-1">{NAV[u.role]?.map(([i,t,h]:string[])=><NavLink key={h} to={h} onClick={()=>setOpen(false)} className={({isActive}:any)=>cx('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',isActive?'bg-indigo-50 text-indigo-700':'text-slate-600 hover:bg-slate-50')}><span>{i}</span>{t}</NavLink>)}</nav>
 <Btn v="s" onClick={async ()=>{await logout();nav('/login')}}>🚪 Logout</Btn></aside>
 <div className="flex-1 min-w-0"><header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 h-16 px-4 flex items-center justify-between">
 <button className="md:hidden text-2xl" onClick={()=>setOpen(true)} aria-label="menu">☰</button><div className="hidden md:block text-sm text-slate-500">{u.role} · {u.email}</div>
 <div className="flex items-center gap-3 relative">
 {!hasPerm&&<button onClick={enableAlerts} className="hidden sm:flex text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold px-2.5 py-1 rounded-full items-center gap-1 transition">🔔 Enable Sound & Desktop Alerts</button>}
 <button onClick={()=>setBell(!bell)} className="relative text-xl" aria-label="notifications">🔔{mine.length>0&&<span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[10px] rounded-full px-1.5">{mine.length}</span>}</button>
 <div className="w-9 h-9 rounded-full bg-indigo-600 text-white grid place-items-center font-bold">{u.name[0]?.toUpperCase() || 'U'}</div>
 {bell&&<div className="absolute right-0 top-12 w-80 max-w-[85vw] bg-white border rounded-xl shadow-xl p-3 anim z-30"><div className="flex justify-between mb-2"><b className="text-sm">Notifications</b><div className="space-x-2"><button className="text-xs text-indigo-600 font-semibold" onClick={()=>playChime()}>Test sound</button><button className="text-xs text-slate-400 hover:text-slate-600" onClick={async ()=>{await clearNotifs()}}>Clear all</button></div></div>
 <div className="max-h-72 overflow-auto space-y-2">{mine.length?mine.slice(0,15).map(n=><div key={n.id} className="text-sm bg-slate-50 rounded-lg p-2">{n.msg}<div className="text-[11px] text-slate-400">{ago(n.ts)} ago</div></div>):<div className="text-sm text-slate-500 py-4 text-center">No notifications</div>}</div></div>}</div></header>
 <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">{children}</main></div></div>}
