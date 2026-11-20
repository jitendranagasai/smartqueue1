import {Link} from 'react-router-dom'
import {Card,Badge,Btn} from './ui'
import {Org,TYPES,orgStats} from '../services/store'
export default function OrgCard({o,km}:{o:Org;km?:number}){const s=orgStats(o.id),t=TYPES[o.type]
 return <Card className="hover:shadow-md transition flex flex-col gap-2"><div className="flex justify-between items-start"><h3 className="font-bold text-lg">{o.name}</h3><Badge tone={o.open?'green':'rose'}>{o.open?'Open':'Closed'}</Badge></div>
 <div className="text-sm text-slate-600">{t.icon} {t.label} · <span className="font-mono text-xs">{o.code}</span></div>
 <div className="text-sm text-slate-600">📍 {o.city}, {o.state}{km!==undefined&&<><br/>📏 {km.toFixed(1)} km away</>}</div>
 <div className="grid grid-cols-3 gap-2 text-center text-xs my-2"><div className="bg-slate-50 rounded-lg p-2"><b className="block text-base">{s.waiting}</b>Queue</div><div className="bg-slate-50 rounded-lg p-2"><b className="block text-base">{s.wait}m</b>Est. wait</div><div className="bg-slate-50 rounded-lg p-2"><b className="block text-base">{s.services}</b>Services</div></div>
 <Link to={`/organization/${o.id}`}><Btn className="w-full">View Portal</Btn></Link></Card>}
