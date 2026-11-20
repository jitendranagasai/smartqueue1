import {Navigate,Route,Routes} from 'react-router-dom'
import {me,useDB,Role} from './services/store'
import {Toaster} from './components/ui'
import Dash from './layouts/Dash'
import Landing from './pages/Landing'
import Find from './pages/Find'
import OrgPortal from './pages/OrgPortal'
import {Login,Register,RegisterOrg} from './pages/Auth'
import Customer from './pages/Customer'
import Staff from './pages/Staff'
import Admin from './pages/Admin'
const home=(r:Role)=>r==='ADMIN'?'/admin/dashboard':r==='STAFF'?'/staff/dashboard':'/customer/dashboard'
function Guard({role,children}:{role:Role;children:any}){useDB();const u=me();if(!u)return <Navigate to="/login" replace/>;if(u.role!==role)return <Navigate to={home(u.role)} replace/>;return <Dash>{children}</Dash>}
export default function App(){return <><Toaster/><Routes>
 <Route path="/" element={<Landing/>}/><Route path="/find" element={<Find/>}/><Route path="/organization/:id" element={<OrgPortal/>}/>
 <Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/register-organization" element={<RegisterOrg/>}/>
 <Route path="/customer/dashboard" element={<Guard role="CUSTOMER"><Customer/></Guard>}/><Route path="/customer/queue" element={<Guard role="CUSTOMER"><Customer history/></Guard>}/>
 <Route path="/staff/dashboard" element={<Guard role="STAFF"><Staff/></Guard>}/>
 <Route path="/admin/:tab" element={<Guard role="ADMIN"><Admin/></Guard>}/>
 <Route path="*" element={<Navigate to="/"/>}/></Routes></>}
