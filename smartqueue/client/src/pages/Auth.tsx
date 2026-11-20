import {useState} from 'react'
import {Link,useLocation,useNavigate} from 'react-router-dom'
import {Btn,Card,Field,Sel,Logo,Modal,run,toast} from '../components/ui'
import {login,registerCustomer,registerOrg,TYPES,me} from '../services/store'
import {authService} from '../services/auth.service'

const home=(r:string)=>r==='ADMIN'?'/admin/dashboard':r==='STAFF'?'/staff/dashboard':'/customer/dashboard'
const Shell=({title,sub,children}:any)=><div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 to-violet-50 p-4"><div className="w-full max-w-md space-y-4"><div className="flex justify-center"><Logo/></div><Card className="!p-7"><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-slate-500 mb-5">{sub}</p>{children}</Card></div></div>
const PW=({label,value,onChange}:any)=>{const [s,set]=useState(false);return <div className="relative"><Field label={label} type={s?'text':'password'} value={value} onChange={onChange} required/><button type="button" onClick={()=>set(!s)} className="absolute right-3 top-8 text-xs text-indigo-600">{s?'Hide':'Show'}</button></div>}

export function Login(){const nav=useNavigate(),loc:any=useLocation();const [e,setE]=useState(''),[p,setP]=useState(''),[r,setR]=useState(true),[er,setEr]=useState(''),[fp,setFp]=useState(false),[fe,setFe]=useState(''),[loading,setLoading]=useState(false)
 const u=me();if(u)setTimeout(()=>nav(home(u.role),{replace:true}))
 const go=async (ev:any)=>{ev.preventDefault();setLoading(true);setEr('');try{const x=await login(e,p,r);toast('Welcome back!');nav(x.role==='CUSTOMER'&&loc.state?.from?loc.state.from:home(x.role))}catch(x:any){setEr(x.message)}finally{setLoading(false)}}
 return <Shell title="Welcome back" sub="Log in with your email and password."><form onSubmit={go} className="space-y-4"><Field label="Email" type="email" value={e} onChange={(x:any)=>setE(x.target.value)} required/><PW label="Password" value={p} onChange={(x:any)=>setP(x.target.value)}/>
 {er&&<div className="text-sm text-rose-600 bg-rose-50 rounded-lg p-2">{er}</div>}
 <div className="flex justify-between text-sm"><label className="flex gap-2 items-center"><input type="checkbox" checked={r} onChange={x=>setR(x.target.checked)}/>Remember me</label><button type="button" className="text-indigo-600" onClick={()=>setFp(true)}>Forgot password?</button></div>
 <Btn className="w-full" disabled={loading}>{loading?'Logging in...':'Login'}</Btn></form>
 <div className="text-sm text-center mt-4 text-slate-600">New customer? <Link to="/register" className="text-indigo-600 font-semibold">Register</Link> · <Link to="/register-organization" className="text-indigo-600 font-semibold">Register Organization</Link></div>
 <div className="mt-4 text-xs bg-slate-50 rounded-lg p-3 text-slate-600">Demo (password <b>Demo@1234</b>):<br/>admin@smartqueue.com · staff@smartqueue.com · customer@smartqueue.com</div>
 <Modal open={fp} onClose={()=>setFp(false)} title="Reset password"><div className="space-y-3"><Field label="Email" type="email" value={fe} onChange={(x:any)=>setFe(x.target.value)}/><Btn className="w-full" onClick={async ()=>{if(!/\S+@\S+\.\S+/.test(fe))return toast('Enter a valid email','err');try{await authService.forgotPassword(fe);toast('Password reset instructions generated.');setFp(false)}catch(err:any){toast(err.message,'err')}}}>Send reset link</Btn></div></Modal></Shell>}

export function Register(){const nav=useNavigate();const [e,setE]=useState(''),[p,setP]=useState(''),[c,setC]=useState(''),[loading,setLoading]=useState(false)
 return <Shell title="Create your account" sub="One SmartQueue account works with every organization."><form className="space-y-4" onSubmit={async (ev:any)=>{ev.preventDefault();setLoading(true);try{const ok=await run(()=>registerCustomer(e,p,c),'Account created!');if(ok){await login(e,p,true);nav('/customer/dashboard')}}finally{setLoading(false)}}}>
 <Field label="Email" type="email" value={e} onChange={(x:any)=>setE(x.target.value)} required/><PW label="Password" value={p} onChange={(x:any)=>setP(x.target.value)}/><PW label="Confirm Password" value={c} onChange={(x:any)=>setC(x.target.value)}/><Btn className="w-full" disabled={loading}>{loading?'Creating account...':'Register'}</Btn></form>
 <div className="text-sm text-center mt-4">Already registered? <Link to="/login" className="text-indigo-600 font-semibold">Login</Link></div></Shell>}

export function RegisterOrg(){const [f,setF]=useState<any>({name:'',type:'HOSPITAL',address:'',city:'',state:'',pin:'',email:'',services:TYPES.HOSPITAL.services.join(', '),counters:3,adminEmail:'',adminPassword:''}),[done,setDone]=useState<any>(null),[loading,setLoading]=useState(false)
 const s=(k:string)=>(e:any)=>setF({...f,[k]:e.target.value})
 if(done)return <Shell title="Organization registered 🎉" sub="Share this code with your customers."><div className="text-center"><div className="text-xs text-slate-500">Your SmartQueue Organization Code</div><div className="text-3xl font-extrabold font-mono text-indigo-700 my-3">{done.code}</div><Btn v="s" onClick={()=>{navigator.clipboard?.writeText(done.code);toast('Code copied')}}>Copy code</Btn><Link to="/login"><Btn className="w-full mt-4">Go to Admin Login</Btn></Link></div></Shell>
 return <Shell title="Register Your Organization" sub="Create your organization and admin account."><form className="space-y-3" onSubmit={async (ev:any)=>{ev.preventDefault();setLoading(true);try{const r=await run(()=>registerOrg({...f,counters:+f.counters,services:f.services.split(',').map((x:string)=>x.trim()).filter(Boolean)}));if(r)setDone(r)}finally{setLoading(false)}}}>
 <Field label="Organization Name" value={f.name} onChange={s('name')} required/>
 <Sel label="Organization Type" value={f.type} onChange={(e:any)=>setF({...f,type:e.target.value,services:TYPES[e.target.value].services.join(', ')})}>{Object.entries(TYPES).map(([k,t])=><option key={k} value={k}>{t.icon} {t.label}</option>)}</Sel>
 <Field label="Address" value={f.address} onChange={s('address')} required/><div className="grid grid-cols-2 gap-3"><Field label="City" value={f.city} onChange={s('city')} required/><Field label="State" value={f.state} onChange={s('state')}/></div>
 <div className="grid grid-cols-2 gap-3"><Field label="PIN Code" value={f.pin} onChange={s('pin')}/><Field label="Number of Counters" type="number" min={1} max={20} value={f.counters} onChange={s('counters')}/></div>
 <Field label="Organization Email" type="email" value={f.email} onChange={s('email')} required/><Field label="Services / Departments (comma separated)" value={f.services} onChange={s('services')}/>
 <Field label="Admin Email" type="email" value={f.adminEmail} onChange={s('adminEmail')} required/><PW label="Admin Password" value={f.adminPassword} onChange={s('adminPassword')}/><Btn className="w-full" disabled={loading}>{loading?'Registering...':'Register Organization'}</Btn></form>
 <div className="text-sm text-center mt-4"><Link to="/login" className="text-indigo-600">Back to login</Link></div></Shell>}
