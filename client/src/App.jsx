import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,Archive,ArrowDownToLine,ArrowUpRight,BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, FileText, Gauge, Image, LayoutDashboard, LogOut, Megaphone, Menu, Newspaper, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, Users, X, Eye, MousePointerClick, TrendingUp, Upload, Pencil, Filter, Phone, Mail, CheckCircle2, AlertCircle} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis,BarChart,Bar} from 'recharts';
import api from './api';

const nav=[
 {id:'dashboard',label:'Overview',icon:LayoutDashboard},
 {id:'articles',label:'Articles',icon:FileText},
 {id:'editions',label:'E-paper editions',icon:Newspaper},
 {id:'ads',label:'Ad campaigns',icon:Megaphone},
 {id:'leads',label:'Enquiries & leads',icon:Users},
 {id:'users',label:'Team & access',icon:ShieldCheck,admin:true},
 {id:'audit',label:'Activity log',icon:Activity,admin:true},
 {id:'reports',label:'Reports',icon:BarChart3}
];
const fmtDate=v=>v?new Date(v).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}):'—';
const fmtNum=v=>Number(v||0).toLocaleString('en-IN');
const initialForm={};
function App(){
 const [token,setToken]=useState(localStorage.getItem('vk_token')||'');
 const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('vk_user')||'null')}catch{return null}});
 const [page,setPage]=useState('dashboard');
 const [mobileNav,setMobileNav]=useState(false);
 const [data,setData]=useState([]);
 const [dashboard,setDashboard]=useState(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('all');
 const [modal,setModal]=useState(null);
 const [form,setForm]=useState(initialForm);
 const [saving,setSaving]=useState(false);
 const [selectedFile,setSelectedFile]=useState(null);
 const role=user?.role||'editor';
 const canAdmin=role==='admin';
 const canEdit=['admin','editor'].includes(role);
 const canAds=['admin','editor','ad_manager'].includes(role);
 const title=nav.find(n=>n.id===page)?.label||'Overview';

 const logout=useCallback(()=>{localStorage.removeItem('vk_token');localStorage.removeItem('vk_user');setToken('');setUser(null);},[]);
 const load=useCallback(async()=>{
   if(!token)return;
   setLoading(true);setError('');
   try{
    if(page==='dashboard'){const r=await api.get('/dashboard');setDashboard(r.data);setData([]);}
    else if(page==='reports'){const [a,l]=await Promise.all([api.get('/ads'),api.get('/leads')]);setData([{kind:'summary',ads:a.data.data,leads:l.data.data}]);}
    else {const endpoint={articles:'/articles',editions:'/editions',ads:'/ads',leads:'/leads',users:'/users',audit:'/audit'}[page];if(endpoint){const r=await api.get(endpoint);setData(r.data.data||[]);}else setData([]);}
   }catch(e){setError(e.response?.data?.error||'Could not load data. Check API and database.');}
   finally{setLoading(false);}
 },[token,page]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(t);},[notice]);
 const openCreate=()=>{
   const defaults={
    articles:{title:'',summary:'',body:'',category:'Local News',language:'Kannada',status:'draft',featured_image_url:''},
    editions:{title:'Vachana Kranti Daily Edition',edition_date:new Date().toISOString().slice(0,10),edition_type:'Daily',status:'draft',notes:''},
    ads:{advertiser_name:'',title:'',category:'Local Business',placement:'Homepage banner',image_url:'',target_url:'',contact_name:'',contact_phone:'',starts_at:'',ends_at:'',status:'draft'},
    users:{name:'',email:'',password:'',role:'editor'},
   };
   setForm(defaults[page]||{});setSelectedFile(null);setModal({mode:'create',page});
 };
 const openEdit=(row)=>{
   const f={...row};
   if(page==='editions'&&f.edition_date)f.edition_date=String(f.edition_date).slice(0,10);
   if(page==='ads'){for(const k of ['starts_at','ends_at'])if(f[k])f[k]=new Date(f[k]).toISOString().slice(0,16);}
   setForm(f);setSelectedFile(null);setModal({mode:'edit',page,row});
 };
 const field=(key,label,type='text',options=null,wide=false)=>(
   <label className={`field ${wide?'wide':''}`} key={key}><span>{label}</span>
    {options?<select value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
    :type==='textarea'?<textarea rows="4" value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={label}/>
    :<input type={type} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={label}/>}
   </label>
 );
 const save=async e=>{
  e.preventDefault();setSaving(true);setError('');
  try{
   let result;
   const id=modal?.row?.id;
   if(modal.page==='articles')result=modal.mode==='create'?await api.post('/articles',form):await api.put(`/articles/${id}`,form);
   if(modal.page==='editions'){
    result=modal.mode==='create'?await api.post('/editions',form):await api.put(`/editions/${id}`,form);
    const editionId=result.data.data.id;
    if(selectedFile){const fd=new FormData();fd.append('pdf',selectedFile);await api.post(`/editions/${editionId}/pdf`,fd,{headers:{'Content-Type':'multipart/form-data'}});}
   }
   if(modal.page==='ads')result=modal.mode==='create'?await api.post('/ads',form):await api.put(`/ads/${id}`,form);
   if(modal.page==='users')result=await api.post('/users',form);
   setModal(null);setNotice('Saved successfully');await load();
  }catch(e){setError(e.response?.data?.error||'Save failed');}
  finally{setSaving(false);}
 };
 const remove=async row=>{
  if(!confirm(`Delete "${row.title||row.name||row.email||'this record'}"? This cannot be undone.`))return;
  try{await api.delete(`/${page}/${row.id}`);setNotice('Deleted');await load();}catch(e){setError(e.response?.data?.error||'Delete failed');}
 };
 const setStatus=async(row,status,endpoint=page)=>{
  try{
   const payload=typeof status==='object'&&status!==null?status:{...row,status};
   await api.put(`/${endpoint}/${row.id}`,payload);
   setNotice('Status updated');await load();
  }catch(e){setError(e.response?.data?.error||'Update failed');}
 };
 const visible=useMemo(()=>data.filter(r=>{
  if(!r||r.kind==='summary')return true;
  const text=Object.values(r).filter(v=>typeof v==='string'||typeof v==='number').join(' ').toLowerCase();
  const matches=text.includes(search.toLowerCase());
  const matchesFilter=filter==='all'||r.status===filter;
  return matches&&matchesFilter;
 }),[data,search,filter]);
 const exportCsv=async kind=>{
  try{const res=await api.get(`/reports/${kind}.csv`,{responseType:'blob'});const url=URL.createObjectURL(res.data);const a=document.createElement('a');a.href=url;a.download=`vachana-${kind}.csv`;a.click();URL.revokeObjectURL(url);}catch(e){setError('Export failed');}
 };
 if(!token||!user)return <Login onLogin={(t,u)=>{localStorage.setItem('vk_token',t);localStorage.setItem('vk_user',JSON.stringify(u));setToken(t);setUser(u);}}/>;
 const isVisible=n=>!n.admin||canAdmin;
 return <div className="app-shell">
  <aside className={`sidebar ${mobileNav?'open':''}`}>
   <div className="brand"><div className="brand-mark"><Newspaper size={23}/></div><div><b>Vachana<span>Kranti</span></b><small>Publisher Studio</small></div><button className="icon-btn close-nav" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
   <div className="workspace"><div className="workspace-logo">VK</div><div><b>Vachana Kranti</b><small>Digital newsroom</small></div><ChevronDown size={15}/></div>
   <div className="nav-label">WORKSPACE</div>
   <nav>{nav.filter(isVisible).map(n=><button key={n.id} className={`nav-item ${page===n.id?'active':''}`} onClick={()=>{setPage(n.id);setSearch('');setFilter('all');setMobileNav(false);}}><n.icon size={18}/><span>{n.label}</span>{n.id==='leads'&&dashboard?.leads?.new>0&&<em>{dashboard.leads.new}</em>}</button>)}</nav>
   <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><b>Need a hand?</b><p>Manage your newsroom with confidence.</p><span>Publisher support</span></div><div className="profile"><div className="avatar">{user.name?.slice(0,1).toUpperCase()}</div><div className="profile-info"><b>{user.name}</b><small>{user.role.replace('_',' ')}</small></div><button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={17}/></button></div></div>
  </aside>
  {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)}></div>}
  <main className="main">
   <header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="crumb">Workspace <span>/</span> <b>{title}</b></div></div><div className="top-actions"><div className="live-pill"><i></i> Publishing workspace</div><button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={17}/></button><button className="icon-btn notification" title="Notifications"><Bell size={18}/><i></i></button><div className="top-avatar">{user.name?.slice(0,1).toUpperCase()}</div></div></header>
   <div className="content">
    <div className="page-heading"><div><div className="eyebrow">{page==='dashboard'?'MONDAY–SUNDAY OVERVIEW':'VACHANA KRANTI / CONTENT OPERATIONS'}</div><h1>{page==='dashboard'?'Good morning, '+(user.name?.split(' ')[0]||'Editor')+' 👋':title}</h1><p>{page==='dashboard'?'Here’s what is happening across your digital newsroom.':({articles:'Write, review and publish stories across your newspaper.',editions:'Manage daily e-paper editions and publication archives.',ads:'Manage local advertising campaigns and grow digital revenue.',leads:'Track enquiries and help advertisers follow up with customers.',users:'Manage team access and publishing permissions.',audit:'Review important changes across the platform.',reports:'Understand campaign performance and reader engagement.'})[page]}</p></div><div className="heading-actions"><button className="btn btn-light" onClick={load}><RefreshCw size={16}/> Refresh</button>{['articles','editions','ads','users'].includes(page)&&((page==='articles'&&['admin','editor','reporter'].includes(role))||(page==='editions'&&canEdit)||(page==='ads'&&canAds)||(page==='users'&&canAdmin))&&<button className="btn btn-primary" onClick={openCreate}><Plus size={17}/> {page==='articles'?'New article':page==='editions'?'New edition':page==='ads'?'Create campaign':'Add user'}</button>}</div></div>
    {error&&<div className="alert alert-error"><AlertCircle size={18}/><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}
    {notice&&<div className="alert alert-success"><CheckCircle2 size={18}/>{notice}<button onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {loading&&<div className="loading-line"><span/></div>}
    {page==='dashboard'&&<Dashboard data={dashboard} onNavigate={setPage} onRefresh={load}/>}
    {page==='articles'&&<Articles rows={visible} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onEdit={openEdit} onDelete={remove} canEdit={['admin','editor','reporter'].includes(role)} canDelete={['admin','editor'].includes(role)} onStatus={setStatus}/>}
    {page==='editions'&&<Editions rows={visible} search={search} setSearch={setSearch} onEdit={openEdit} onDelete={remove} canEdit={canEdit} canDelete={canAdmin} />}
    {page==='ads'&&<Ads rows={visible} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onEdit={openEdit} onDelete={remove} canEdit={canAds} canDelete={canEdit}/>}
    {page==='leads'&&<Leads rows={visible} search={search} setSearch={setSearch} onStatus={setStatus} onExport={()=>exportCsv('leads')}/>}
    {page==='users'&&<UsersPage rows={visible} onEdit={openEdit} onStatus={setStatus} onRefresh={load}/>}
    {page==='audit'&&<Audit rows={visible} search={search} setSearch={setSearch}/>}
    {page==='reports'&&<Reports data={data[0]?.kind==='summary'?data[0]:null} onExportAds={()=>exportCsv('ads')} onExportLeads={()=>exportCsv('leads')}/>}
   </div>
  </main>
  {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}><form className="modal" onSubmit={save}><div className="modal-head"><div><div className="eyebrow">{modal.mode==='create'?'CREATE NEW':'UPDATE RECORD'}</div><h2>{modal.mode==='create'?'Create ':'Edit '}{modal.page==='articles'?'article':modal.page==='editions'?'e-paper edition':modal.page==='ads'?'advertising campaign':'team user'}</h2></div><button type="button" className="icon-btn" onClick={()=>setModal(null)}><X size={20}/></button></div><div className="modal-body"><div className="form-grid">
   {modal.page==='articles'&&<>{field('title','Headline *')}{field('category','Category', 'text')}{field('language','Language','text')}{field('status','Workflow status','text',[{value:'draft',label:'Draft'},{value:'in_review',label:'In review'},{value:'approved',label:'Approved'},{value:'published',label:'Published'},{value:'rejected',label:'Rejected'}])}{field('featured_image_url','Featured image URL','text',null,true)}{field('summary','Summary','textarea',null,true)}{field('body','Article content','textarea',null,true)}</>}
   {modal.page==='editions'&&<>{field('title','Edition title *')}{field('edition_date','Edition date','date')}{field('edition_type','Edition type','text')}{field('status','Status','text',[{value:'draft',label:'Draft'},{value:'ready',label:'Ready'},{value:'published',label:'Published'},{value:'archived',label:'Archived'}])}{field('notes','Notes','textarea',null,true)}<label className="field wide"><span>Newspaper PDF</span><div className="upload-box"><Upload size={22}/><b>{selectedFile?.name||'Choose a PDF file'}</b><small>PDF format · Maximum upload size is configured by the server</small><input type="file" accept="application/pdf,.pdf" onChange={e=>setSelectedFile(e.target.files?.[0]||null)}/></div></label>{form.pdf_path&&<div className="field wide"><span>Current PDF</span><a target="_blank" rel="noreferrer" href={`${(import.meta.env.VITE_API_URL||'http://localhost:4000/api').replace(/\/api$/,'')}${form.pdf_path}`}>Open uploaded PDF</a></div>}</>}
   {modal.page==='ads'&&<>{field('advertiser_name','Advertiser / business *')}{field('title','Campaign title *')}{field('category','Business category','text',[{value:'Local Business',label:'Local Business'},{value:'Education',label:'Education'},{value:'Healthcare',label:'Healthcare'},{value:'Retail',label:'Retail & showroom'},{value:'Events',label:'Events'},{value:'Real Estate',label:'Real estate'},{value:'Offers',label:'Offers & discounts'}])}{field('placement','Ad placement','text',[{value:'Homepage banner',label:'Homepage banner'},{value:'Sidebar',label:'Sidebar'},{value:'Article inline',label:'Article inline'},{value:'E-paper listing',label:'E-paper listing'},{value:'Local offers',label:'Local offers'}])}{field('status','Campaign status','text',[{value:'draft',label:'Draft'},{value:'scheduled',label:'Scheduled'},{value:'active',label:'Active'},{value:'paused',label:'Paused'},{value:'completed',label:'Completed'}])}{field('starts_at','Start date & time','datetime-local')}{field('ends_at','End date & time','datetime-local')}{field('image_url','Banner image URL','text',null,true)}{field('target_url','Target URL','url',null,true)}{field('contact_name','Contact person')}{field('contact_phone','Contact phone')}</>}
   {modal.page==='users'&&<>{field('name','Full name *')}{field('email','Email *','email')}{field('password','Temporary password (10+ chars) *','password')}{field('role','Role','text',[{value:'editor',label:'Editor'},{value:'reporter',label:'Reporter'},{value:'ad_manager',label:'Advertisement manager'},{value:'admin',label:'Administrator'}])}</>}
  </div></div><div className="modal-foot"><button type="button" className="btn btn-light" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':<><Check size={16}/> Save changes</>}</button></div></form></div>}
 </div>;
}

function Login({onLogin}){
 const [email,setEmail]=useState('admin@vachanakranti.local');const [password,setPassword]=useState('ChangeMe@123');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await api.post('/auth/login',{email,password});onLogin(r.data.token,r.data.user);}catch(e){setError(e.response?.data?.error||'Cannot sign in. Check backend connection.');}finally{setBusy(false);}};
 return <div className="login-shell"><div className="login-art"><div className="login-brand"><div className="brand-mark"><Newspaper size={26}/></div><b>Vachana<span>Kranti</span></b></div><div className="login-copy"><div className="login-kicker">THE DIGITAL NEWSROOM</div><h1>Every story.<br/><span>One powerful</span><br/>workspace.</h1><p>Publish with confidence. Reach your readers. Grow your local advertising business.</p><div className="login-stats"><div><Newspaper/><b>Publishing</b><small>Daily editions</small></div><div><Megaphone/><b>Advertising</b><small>Campaign control</small></div><div><TrendingUp/><b>Insights</b><small>Performance</small></div></div></div><div className="login-footer">A smarter way to run your digital newspaper.</div></div><div className="login-form-wrap"><form className="login-form" onSubmit={submit}><div className="eyebrow">WELCOME BACK</div><h2>Sign in to Studio</h2><p>Access your editorial and advertising workspace.</p>{error&&<div className="alert alert-error">{error}</div>}<label className="field"><span>Email address</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="btn btn-primary login-submit" disabled={busy}>{busy?'Signing in…':'Sign in securely'} <ArrowUpRight size={17}/></button><div className="login-security"><ShieldCheck size={16}/> Protected publisher access</div><div className="login-demo">First-run demo credentials are documented in README. Change them before production.</div></form></div></div>;
}
function StatCard({label,value,delta,icon:Icon,tone,foot}){return <div className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={19}/></div></div><div className="stat-value">{fmtNum(value)}</div><div className="stat-foot">{delta&&<span className="stat-delta"><TrendingUp size={13}/>{delta}</span>}<span>{foot}</span></div></div>}
function Dashboard({data,onNavigate}){
 if(!data)return <div className="empty-state"><div className="empty-icon"><Gauge/></div><h3>Preparing your newsroom</h3><p>Dashboard metrics will appear when the API is connected.</p></div>;
 const perf=(data.adPerformance||[]).map(a=>({name:a.title.length>13?a.title.slice(0,13)+'…':a.title,impressions:Number(a.impressions),clicks:Number(a.clicks)}));
 return <><div className="welcome-banner"><div className="welcome-text"><span className="banner-label"><span></span> YOUR NEWSROOM AT A GLANCE</span><h2>Good stories deserve<br/>a bigger audience.</h2><p>Manage your editions, connect with readers and grow local advertising from one place.</p><button className="btn btn-white" onClick={()=>onNavigate('articles')}>Manage articles <ArrowUpRight size={16}/></button></div><div className="banner-illustration"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="paper-card"><Newspaper size={47}/><span>VK</span><div className="paper-lines"></div><div className="paper-lines short"></div><div className="paper-photo"></div></div><div className="floating-bubble bubble-one"><Megaphone size={19}/></div><div className="floating-bubble bubble-two"><BarChart3 size={19}/></div><div className="floating-bubble bubble-three"><FileText size={18}/></div></div></div>
 <div className="section-heading"><div><h2>Publishing overview</h2><p>Key numbers across your workspace</p></div><span className="period-tag"><CalendarDays size={14}/> All time</span></div>
 <div className="stats-grid"><StatCard label="Total articles" value={data.articles?.total} delta={`${data.articles?.published||0} published`} foot={`${data.articles?.review||0} awaiting review`} icon={FileText} tone="blue"/><StatCard label="E-paper editions" value={data.editions?.total} delta={`${data.editions?.published||0} published`} foot={`${data.editions?.today||0} dated today`} icon={Newspaper} tone="violet"/><StatCard label="Ad impressions" value={data.ads?.impressions} delta={`${data.ads?.active||0} active campaigns`} foot={`${fmtNum(data.ads?.clicks)} clicks`} icon={Eye} tone="orange"/><StatCard label="New enquiries" value={data.leads?.new} delta={`${data.leads?.total||0} total leads`} foot="Needs follow-up" icon={Users} tone="green"/></div>
 <div className="dashboard-grid"><div className="panel performance-panel"><div className="panel-head"><div><h3>Campaign performance</h3><p>Impressions and clicks by recent campaign</p></div><button className="text-btn" onClick={()=>onNavigate('ads')}>View campaigns <ArrowUpRight size={14}/></button></div>{perf.length?<div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={perf} margin={{top:10,right:8,left:-22,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#818ba0'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#818ba0'}}/><Tooltip/><Bar dataKey="impressions" fill="#6477ee" radius={[5,5,0,0]}/><Bar dataKey="clicks" fill="#1fb89a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>:<div className="chart-empty"><div><BarChart3 size={26}/></div><b>Your campaign insights will appear here</b><span>Create an ad campaign to start tracking results.</span><button className="btn btn-light btn-sm" onClick={()=>onNavigate('ads')}>Create campaign</button></div>}</div>
 <div className="panel quick-panel"><div className="panel-head"><div><h3>Quick actions</h3><p>Get things moving</p></div></div><div className="quick-list"><button onClick={()=>onNavigate('articles')}><div className="quick-icon qi-blue"><Pencil/></div><span><b>Write an article</b><small>Create a new story or update a draft</small></span><ArrowUpRight size={16}/></button><button onClick={()=>onNavigate('editions')}><div className="quick-icon qi-violet"><Newspaper/></div><span><b>Manage e-paper</b><small>Upload or publish today's edition</small></span><ArrowUpRight size={16}/></button><button onClick={()=>onNavigate('ads')}><div className="quick-icon qi-orange"><Megaphone/></div><span><b>Launch an ad campaign</b><small>Promote a local business</small></span><ArrowUpRight size={16}/></button><button onClick={()=>onNavigate('leads')}><div className="quick-icon qi-green"><Users/></div><span><b>Follow up on leads</b><small>Review customer enquiries</small></span><ArrowUpRight size={16}/></button></div></div></div>
 <div className="bottom-grid"><div className="panel"><div className="panel-head"><div><h3>Editorial pulse</h3><p>Keep the newsroom moving</p></div><button className="text-btn" onClick={()=>onNavigate('articles')}>Open articles <ArrowUpRight size={14}/></button></div><div className="pulse-list"><div><span className="pulse-dot dot-green"></span><span>Published articles</span><b>{data.articles?.published||0}</b></div><div><span className="pulse-dot dot-orange"></span><span>Stories in review</span><b>{data.articles?.review||0}</b></div><div><span className="pulse-dot dot-violet"></span><span>Today's editions</span><b>{data.editions?.today||0}</b></div></div></div><div className="insight-card"><div className="insight-icon"><TrendingUp/></div><div><span>GROW YOUR REACH</span><h3>Turn local attention into business value.</h3><p>Use campaign insights to help local advertisers understand their results.</p><button className="text-btn" onClick={()=>onNavigate('reports')}>Explore reports <ArrowUpRight size={14}/></button></div></div></div></>;
}
function Toolbar({search,setSearch,filter,setFilter,filters,children}){return <div className="toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records…"/></div>{filters&&<div className="filter-box"><Filter size={15}/><select value={filter} onChange={e=>setFilter(e.target.value)}>{filters.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select></div>}<div className="toolbar-end">{children}</div></div>}
function Status({value}){const s=String(value||'unknown').toLowerCase().replaceAll(' ','_');return <span className={`status status-${s}`}>{String(value||'Unknown').replaceAll('_',' ')}</span>}
function TableShell({children,empty='No records found'}){return <div className="table-scroll"><table>{children}</table></div>}
function Articles({rows,search,setSearch,filter,setFilter,onEdit,onDelete,canEdit,canDelete,onStatus}){
 return <div className="panel table-panel"><Toolbar search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} filters={[{value:'all',label:'All statuses'},{value:'draft',label:'Draft'},{value:'in_review',label:'In review'},{value:'approved',label:'Approved'},{value:'published',label:'Published'},{value:'rejected',label:'Rejected'}]}><span className="result-count">{rows.length} stories</span></Toolbar><TableShell><thead><tr><th>STORY</th><th>CATEGORY</th><th>AUTHOR</th><th>UPDATED</th><th>STATUS</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="story-cell"><div className="story-thumb"><FileText size={18}/></div><div><b>{r.title}</b><small>{r.summary||r.slug}</small></div></div></td><td><span className="category-chip">{r.category}</span></td><td>{r.author_name||'—'}</td><td>{fmtDate(r.updated_at)}</td><td><Status value={r.status}/></td><td><div className="row-actions">{canEdit&&<button className="icon-btn" title="Edit" onClick={()=>onEdit(r)}><Pencil size={15}/></button>}{canEdit&&r.status==='in_review'&&<button className="icon-btn approve-btn" title="Approve" onClick={()=>onStatus(r,'approved')}><Check size={15}/></button>}{canEdit&&r.status==='approved'&&<button className="icon-btn approve-btn" title="Publish" onClick={()=>onStatus(r,'published')}><ArrowUpRight size={15}/></button>}{canDelete&&<button className="icon-btn danger-hover" title="Delete" onClick={()=>onDelete(r)}><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></TableShell>{!rows.length&&<Empty title="No stories yet" text="Create your first article to get the newsroom moving."/>}</div>;
}
function Editions({rows,search,setSearch,onEdit,onDelete,canEdit,canDelete}){
 const base=(import.meta.env.VITE_API_URL||'http://localhost:4000/api').replace(/\/api$/,'');
 return <div className="panel table-panel"><Toolbar search={search} setSearch={setSearch}><span className="result-count">{rows.length} editions</span></Toolbar><TableShell><thead><tr><th>EDITION</th><th>DATE</th><th>TYPE</th><th>PDF FILE</th><th>STATUS</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="story-cell"><div className="edition-thumb"><Newspaper size={19}/></div><div><b>{r.title}</b><small>{r.notes||'Digital edition'}</small></div></div></td><td>{fmtDate(r.edition_date)}</td><td>{r.edition_type}</td><td>{r.pdf_path?<a className="file-link" href={`${base}${r.pdf_path}`} target="_blank" rel="noreferrer"><FileText size={15}/> View PDF <ArrowUpRight size={13}/></a>:<span className="muted">No PDF uploaded</span>}</td><td><Status value={r.status}/></td><td><div className="row-actions">{canEdit&&<button className="icon-btn" title="Edit / upload PDF" onClick={()=>onEdit(r)}><Pencil size={15}/></button>}{canDelete&&<button className="icon-btn danger-hover" onClick={()=>onDelete(r)}><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></TableShell>{!rows.length&&<Empty title="No editions yet" text="Create an edition and upload the day's PDF."/>}</div>;
}
function Ads({rows,search,setSearch,filter,setFilter,onEdit,onDelete,canEdit,canDelete}){
 return <><div className="ad-summary"><div><div className="summary-icon orange"><Megaphone/></div><span>Campaigns</span><b>{rows.length}</b></div><div><div className="summary-icon blue"><Eye/></div><span>Total impressions</span><b>{fmtNum(rows.reduce((a,r)=>a+Number(r.impressions||0),0))}</b></div><div><div className="summary-icon green"><MousePointerClick/></div><span>Total clicks</span><b>{fmtNum(rows.reduce((a,r)=>a+Number(r.clicks||0),0))}</b></div><div><div className="summary-icon violet"><TrendingUp/></div><span>Avg. click rate</span><b>{rows.reduce((a,r)=>a+Number(r.impressions||0),0)?(rows.reduce((a,r)=>a+Number(r.clicks||0),0)/rows.reduce((a,r)=>a+Number(r.impressions||0),0)*100).toFixed(1)+'%':'0.0%'}</b></div></div><div className="panel table-panel"><Toolbar search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} filters={[{value:'all',label:'All campaigns'},{value:'active',label:'Active'},{value:'scheduled',label:'Scheduled'},{value:'paused',label:'Paused'},{value:'draft',label:'Draft'},{value:'completed',label:'Completed'}]}><span className="result-count">{rows.length} campaigns</span></Toolbar><TableShell><thead><tr><th>CAMPAIGN</th><th>PLACEMENT</th><th>PERFORMANCE</th><th>SCHEDULE</th><th>STATUS</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="story-cell"><div className="ad-thumb"><Megaphone size={18}/></div><div><b>{r.title}</b><small>{r.advertiser_name} · {r.category}</small></div></div></td><td>{r.placement}</td><td><div className="performance-cell"><span><Eye size={13}/>{fmtNum(r.impressions)}</span><span><MousePointerClick size={13}/>{fmtNum(r.clicks)}</span></div></td><td><div className="schedule-cell">{fmtDate(r.starts_at)}<small>to {fmtDate(r.ends_at)}</small></div></td><td><Status value={r.status}/></td><td><div className="row-actions">{canEdit&&<button className="icon-btn" title="Edit campaign" onClick={()=>onEdit(r)}><Pencil size={15}/></button>}{canDelete&&<button className="icon-btn danger-hover" onClick={()=>onDelete(r)}><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></TableShell>{!rows.length&&<Empty title="No campaigns yet" text="Create an advertisement campaign to start promoting local businesses."/>}</div></>;
}
function Leads({rows,search,setSearch,onStatus,onExport}){return <div className="panel table-panel"><Toolbar search={search} setSearch={setSearch}><button className="btn btn-light btn-sm" onClick={onExport}><ArrowDownToLine size={15}/> Export CSV</button></Toolbar><TableShell><thead><tr><th>CONTACT</th><th>ENQUIRY</th><th>CAMPAIGN</th><th>CONSENT</th><th>RECEIVED</th><th>STATUS</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="contact-cell"><div className="avatar avatar-soft">{r.name?.slice(0,1).toUpperCase()}</div><div><b>{r.name}</b><small><Phone size={12}/>{r.phone||'—'}</small>{r.email&&<small><Mail size={12}/>{r.email}</small>}</div></div></td><td className="message-cell">{r.message||'—'}</td><td>{r.ad_title||'General enquiry'}<small className="subline">{r.advertiser_name||r.source}</small></td><td>{r.consent?<span className="consent"><CheckCircle2 size={14}/> Given</span>:<span className="muted">No</span>}</td><td>{fmtDate(r.created_at)}</td><td><select className="status-select" value={r.status} onChange={e=>onStatus(r,e.target.value,'leads')}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="closed">Closed</option><option value="spam">Spam</option></select></td></tr>)}</tbody></TableShell>{!rows.length&&<Empty title="No enquiries yet" text="Enquiries submitted through your forms will appear here."/>}</div>;}
function UsersPage({rows,onStatus,onRefresh}){return <div className="panel table-panel"><div className="toolbar"><div className="toolbar-note"><ShieldCheck size={17}/> Access is controlled by assigned roles</div><span className="result-count">{rows.length} team members</span></div><TableShell><thead><tr><th>TEAM MEMBER</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>JOINED</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="contact-cell"><div className="avatar">{r.name?.slice(0,1).toUpperCase()}</div><b>{r.name}</b></div></td><td>{r.email}</td><td><span className="category-chip">{r.role.replace('_',' ')}</span></td><td><Status value={r.active?'active':'paused'}/></td><td>{fmtDate(r.created_at)}</td><td><select className="status-select" value={r.active?'true':'false'} onChange={e=>onStatus(r,{active:e.target.value==='true'},'users')}><option value="true">Active</option><option value="false">Deactivate</option></select></td></tr>)}</tbody></TableShell>{!rows.length&&<Empty title="No team members" text="Add an editor or reporter to share the workload."/>}</div>;}
function Audit({rows,search,setSearch}){return <div className="panel table-panel"><Toolbar search={search} setSearch={setSearch}><span className="result-count">Recent activity</span></Toolbar><TableShell><thead><tr><th>ACTIVITY</th><th>USER</th><th>RECORD</th><th>DETAILS</th><th>DATE & TIME</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><span className="audit-action"><Activity size={15}/>{r.action.replaceAll('_',' ')}</span></td><td>{r.user_name||'System'}</td><td>{r.entity_type} #{r.entity_id}</td><td className="message-cell">{JSON.stringify(r.details||{})}</td><td>{new Date(r.created_at).toLocaleString()}</td></tr>)}</tbody></TableShell>{!rows.length&&<Empty title="No activity yet" text="Changes made in the platform will appear here."/>}</div>;}
function Reports({data,onExportAds,onExportLeads}){const ads=data?.ads||[],leads=data?.leads||[];const impressions=ads.reduce((s,a)=>s+Number(a.impressions||0),0),clicks=ads.reduce((s,a)=>s+Number(a.clicks||0),0);return <><div className="report-hero"><div><span className="banner-label"><span></span> PERFORMANCE CENTER</span><h2>Make every campaign count.</h2><p>Review ad engagement and enquiry activity to help advertisers understand their reach.</p></div><div className="report-hero-icon"><BarChart3 size={72}/></div></div><div className="stats-grid report-stats"><StatCard label="Ad impressions" value={impressions} icon={Eye} tone="blue" foot="Recorded events"/><StatCard label="Ad clicks" value={clicks} icon={MousePointerClick} tone="green" foot="Recorded events"/><StatCard label="Click-through rate" value={impressions?(clicks/impressions*100).toFixed(2)+'%':'0%'} icon={TrendingUp} tone="violet" foot="Clicks ÷ impressions"/><StatCard label="Total leads" value={leads.length} icon={Users} tone="orange" foot="Captured enquiries"/></div><div className="report-actions"><div className="panel"><div className="panel-head"><div><h3>Export campaign data</h3><p>Share performance summaries with advertisers.</p></div><div className="summary-icon orange"><Megaphone/></div></div><button className="btn btn-primary" onClick={onExportAds}><ArrowDownToLine size={16}/> Download ads CSV</button></div><div className="panel"><div className="panel-head"><div><h3>Export lead data</h3><p>Review consented enquiries and follow-up status.</p></div><div className="summary-icon green"><Users/></div></div><button className="btn btn-primary" onClick={onExportLeads}><ArrowDownToLine size={16}/> Download leads CSV</button></div></div><div className="note-banner"><ShieldCheck size={18}/><div><b>Privacy reminder</b><p>Share lead contact details only with authorized staff and the relevant advertiser, where the person has consented.</p></div></div></>;}
function Empty({title,text}){return <div className="empty-state"><div className="empty-icon"><Archive size={23}/></div><h3>{title}</h3><p>{text}</p></div>;}
export default App;
