import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {request,setUserId} from './api.js';
import {AppContext,ROLE_LABEL} from './ui.jsx';
import Dashboard,{Reports} from './pages/Dashboard.jsx';
import {ComplaintDesk,BuyerComplaints} from './pages/Complaints.jsx';
import Reviews from './pages/Reviews.jsx';
import {RagAsk,Insights,RagAdmin,Documents,Recommend} from './pages/Rag.jsx';

const MENUS={
  ADMIN:[['dashboard','운영 대시보드',Dashboard],['complaints','불만 처리 센터',ComplaintDesk],['reviews','후기 분석',Reviews],['ask','통합 RAG 상담',RagAsk],['insights','운영 인사이트',Insights],['rag','RAG 색인 관리',RagAdmin],['documents','문서·매뉴얼',Documents],['reports','AI 이력',Reports]],
  SELLER:[['dashboard','판매 대시보드',Dashboard],['complaints','불만 처리',ComplaintDesk],['reviews','후기 관리',Reviews],['ask','RAG 상담',RagAsk],['insights','운영 인사이트',Insights],['reports','AI 이력',Reports]],
  BUYER:[['dashboard','내 쇼핑',Dashboard],['ask','AI 쇼핑 상담',RagAsk],['reviews','상품 후기',Reviews],['complaints','문의·불만',BuyerComplaints],['recommend','맞춤 추천',Recommend]],
};
const store={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};

function App(){
  const [users,setUsers]=useState([]),[user,setUser]=useState(null),[provider,setProvider]=useState(store.get('provider')||'local');
  const [tab,setTab]=useState('dashboard'),[params,setParams]=useState(null);
  const [loading,setLoading]=useState(false),[message,setMessage]=useState('');

  async function run(fn){setLoading(true);setMessage('');try{await fn()}catch(e){setMessage(e.message)}finally{setLoading(false)}}
  function selectUser(u){setUserId(u?.id);setUser(u);setTab('dashboard');setParams(null);setMessage('');if(u)store.set('userId',String(u.id))}
  function go(next,p=null){setTab(next);setParams(p);setMessage('')}

  useEffect(()=>{run(async()=>{
    const list=await request('/users');setUsers(list);
    selectUser(list.find(u=>String(u.id)===store.get('userId'))||list[0]);
  })},[]);
  useEffect(()=>store.set('provider',provider),[provider]);

  const ctx=useMemo(()=>({user,provider,run,loading,notify:setMessage}),[user,provider,loading]);
  const menu=user?MENUS[user.role]:[];
  const Page=menu.find(m=>m[0]===tab)?.[2];

  return <AppContext.Provider value={ctx}><div className="shell">
    <header>
      <div><small>MYSQL · POSTGRESQL RAG · OLLAMA / GEMINI</small><h1>쇼핑몰 AI 서비스</h1><p>후기·불만·정책 문서를 근거로 관리자, 판매자, 구매자에게 역할별 AI 기능을 제공한다.</p></div>
      <div className="who">
        <label>사용자<select value={user?.id??''} onChange={e=>selectUser(users.find(u=>u.id===Number(e.target.value)))}>
          {['ADMIN','SELLER','BUYER'].map(r=><optgroup key={r} label={ROLE_LABEL[r]}>{users.filter(u=>u.role===r).map(u=><option key={u.id} value={u.id}>{u.display_name} ({u.username})</option>)}</optgroup>)}
        </select></label>
        <label>답변 모델<select value={provider} onChange={e=>setProvider(e.target.value)}><option value="local">로컬 Ollama</option><option value="gemini">Gemini API</option></select></label>
        {user&&<span className={`badge r-${user.role.toLowerCase()}`}>{ROLE_LABEL[user.role]} 모드</span>}
      </div>
    </header>
    <nav>{menu.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>go(id)}>{label}</button>)}</nav>
    {loading&&<div className="progress" aria-hidden="true"/>}
    {message&&<div className="alert" role="status">{message}<button className="link" onClick={()=>setMessage('')}>닫기</button></div>}
    {user&&Page&&<Page key={`${user.id}-${tab}-${JSON.stringify(params)}`} go={go} params={params}/>}
    <footer>교육용 데모 · 사용자 전환은 X-User-Id 헤더 방식이며 운영 시 JWT/세션 인증으로 교체한다. 문서 임베딩은 로컬 Ollama를 사용하고, 생성 답변은 담당자 검토 후 사용한다.</footer>
  </div></AppContext.Provider>;
}

createRoot(document.getElementById('root')).render(<App/>);
