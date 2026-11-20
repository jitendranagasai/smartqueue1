import {useState} from 'react'
import {Link} from 'react-router-dom'
import {Logo,Btn} from './ui'
import {me} from '../services/store'
export default function Nav(){const [o,s]=useState(false);const u=me()
 const home=u?(u.role==='ADMIN'?'/admin/dashboard':u.role==='STAFF'?'/staff/dashboard':'/customer/dashboard'):'/login'
 const L=[['Home','/'],['Find Organization','/find'],['How It Works','/#how'],['Features','/#features'],['About','/#about']]
 return <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200"><div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between"><Logo/>
 <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">{L.map(([t,h])=><a key={t} href={h} className="hover:text-indigo-600">{t}</a>)}<Link to={home}><Btn>{u?'Dashboard':'Login'}</Btn></Link></nav>
 <button className="md:hidden text-2xl" onClick={()=>s(!o)} aria-label="menu">☰</button></div>
 {o&&<div className="md:hidden px-4 pb-4 space-y-3 text-sm font-medium">{L.map(([t,h])=><a key={t} href={h} className="block" onClick={()=>s(false)}>{t}</a>)}<Link to={home} className="block text-indigo-600">{u?'Dashboard':'Login'}</Link></div>}</header>}
