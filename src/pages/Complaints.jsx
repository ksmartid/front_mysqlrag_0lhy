import React,{useEffect,useState} from 'react';
import {request} from '../api.js';
import {useApp,Status,Sources,speak,listen,fmtDate} from '../ui.jsx';

const CATEGORIES=['배송','배송파손','품질','교환','환불','문의'];

// 관리자·판매자: 불만 목록 → 유사 처리 사례 RAG로 처리 지원 → 답변 초안 저장·승인 → 처리 결과 기록(재색인)
export function ComplaintDesk(){
  const {user,provider,run,loading,notify}=useApp();
  const [filter,setFilter]=useState(''),[rows,setRows]=useState([]),[sel,setSel]=useState(null);
  const [assist,setAssist]=useState(null),[draft,setDraft]=useState(''),[replies,setReplies]=useState([]);
  const [status,setStatus]=useState('IN_PROGRESS'),[resolution,setResolution]=useState('');

  async function load(){setRows(await request('/complaints'+(filter?`?status=${filter}`:'')))}
  async function loadReplies(id){setReplies(await request(`/complaints/${id}/replies`))}
  useEffect(()=>{run(load)},[filter,user.id]);

  function choose(c){setSel(c);setAssist(null);setDraft('');setStatus(c.status==='OPEN'?'IN_PROGRESS':c.status);setResolution(c.resolution||'');run(()=>loadReplies(c.id))}
  const aiAssist=()=>run(async()=>{const r=await request(`/rag/complaints/${sel.id}/assist`,'POST',{provider});setAssist(r);setDraft(r.draft)});
  const saveDraft=()=>run(async()=>{await request('/replies','POST',{complaint_id:sel.id,content:draft});await loadReplies(sel.id);notify('답변 초안을 DRAFT로 저장했다. 검토 후 승인·발송 상태로 변경한다.')});
  const setReply=(id,s)=>run(async()=>{await request(`/replies/${id}`,'PATCH',{status:s});await loadReplies(sel.id)});
  const saveStatus=()=>run(async()=>{
    const r=await request(`/complaints/${sel.id}`,'PATCH',{status,resolution});
    await load();setSel({...sel,status,resolution,rag_status:r.rag_status});
    notify(`처리 상태 저장 · 불만 RAG 재색인 ${r.rag_status}`);
  });

  return <main className="grid">
    <section className="card">
      <div className="card-head"><h2>{user.role==='SELLER'?'내 상품 불만':'불만 처리 센터'}</h2>
        <select className="compact" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="">전체</option><option value="OPEN">접수</option><option value="IN_PROGRESS">처리 중</option><option value="RESOLVED">처리 완료</option>
        </select>
      </div>
      <div className="list">{rows.map(c=><article key={c.id} className={sel?.id===c.id?'selected':''} onClick={()=>choose(c)}>
        <div className="row-between"><strong>#{c.id} {c.category} · {c.product_name||'상품 미지정'}</strong><Status s={c.status}/></div>
        <p>{c.content}</p>
        <small>{c.customer_name} · {fmtDate(c.created_at)} · RAG <Status s={c.rag_status}/></small>
      </article>)}</div>
      {!rows.length&&<p className="hint">해당 불만이 없다.</p>}
    </section>

    <section className="card">
      {!sel?<p className="hint">왼쪽에서 불만을 선택하면 유사 처리 사례·같은 상품 후기·매뉴얼 문서를 근거로 처리 방안과 응대 초안을 만든다.</p>:<>
        <h2>불만 #{sel.id} 처리</h2>
        <p className="quote">{sel.content}</p>
        <small>주문 #{sel.order_id||'-'} · 상품 {sel.product_name||'-'} · {fmtDate(sel.created_at)}</small>
        <div className="row"><button onClick={aiAssist} disabled={loading}>AI 처리 지원 (유사 사례 RAG)</button></div>

        <h3>답변</h3>
        <textarea rows={7} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="AI 초안을 생성하거나 직접 작성한다."/>
        <div className="row">
          <button onClick={saveDraft} disabled={loading||draft.trim().length<3}>답변 초안 저장</button>
          <button className="secondary" onClick={()=>speak(draft,notify)} disabled={!draft}>음성으로 듣기</button>
        </div>
        {replies.map(r=><article key={r.id} className="reply">
          <div className="row-between"><Status s={r.status}/><small>{fmtDate(r.created_at)}</small></div>
          <p>{r.content}</p>
          <div className="row">
            {r.status==='DRAFT'&&<button className="secondary" onClick={()=>setReply(r.id,'APPROVED')}>승인</button>}
            {r.status==='APPROVED'&&<button className="secondary" onClick={()=>setReply(r.id,'SENT')}>발송 완료 처리</button>}
          </div>
        </article>)}

        <h3>처리 상태</h3>
        <label>상태<select value={status} onChange={e=>setStatus(e.target.value)}><option value="OPEN">접수</option><option value="IN_PROGRESS">처리 중</option><option value="RESOLVED">처리 완료</option></select></label>
        <label>처리 결과 {status==='RESOLVED'&&<em>(필수 · 이후 유사 사례 검색의 근거로 색인)</em>}
          <textarea rows={3} value={resolution} onChange={e=>setResolution(e.target.value)} placeholder="예: 파손 사진 확인 후 동일 상품 재발송, 포장 기준 변경"/></label>
        <button onClick={saveStatus} disabled={loading}>상태 저장</button>
      </>}
    </section>

    {assist&&<section className="card full">
      <div className="card-head"><h2>AI 처리 지원 결과</h2><button className="secondary" onClick={()=>speak(assist.analysis,notify)}>음성으로 듣기</button></div>
      <p className="answer">{assist.analysis}</p>
      <Sources items={assist.sources}/>
    </section>}
  </main>;
}

// 구매자: 주문 기반 불만 접수 + 내 접수 내역·처리 결과·발송된 답변
export function BuyerComplaints(){
  const {user,run,loading,notify}=useApp();
  const [orders,setOrders]=useState([]),[rows,setRows]=useState([]),[replies,setReplies]=useState({});
  const [orderId,setOrderId]=useState(''),[productId,setProductId]=useState(''),[category,setCategory]=useState('배송'),[content,setContent]=useState('');

  async function load(){const [o,c]=await Promise.all([request('/orders'),request('/complaints')]);setOrders(o);setRows(c)}
  useEffect(()=>{run(load)},[user.id]);
  const order=orders.find(o=>String(o.id)===String(orderId));

  const submit=e=>{e.preventDefault();run(async()=>{
    const r=await request('/complaints','POST',{order_id:orderId?Number(orderId):null,product_id:productId?Number(productId):null,category,content});
    setContent('');await load();notify(`문의 #${r.id}가 접수되었다. 담당자가 확인 후 답변한다.`);
  })};
  const showReplies=id=>run(async()=>setReplies({...replies,[id]:await request(`/complaints/${id}/replies`)}));

  return <main className="grid">
    <section className="card"><h2>문의·불만 접수</h2>
      <form onSubmit={submit}>
        <label>주문<select value={orderId} onChange={e=>{setOrderId(e.target.value);setProductId('')}}>
          <option value="">주문과 무관한 문의</option>
          {orders.map(o=><option key={o.id} value={o.id}>#{o.id} · {fmtDate(o.ordered_at).slice(0,10)} · {o.items.map(i=>i.product_name).join(', ')} ({o.status})</option>)}
        </select></label>
        {order&&order.items.length>1&&<label>상품<select value={productId} onChange={e=>setProductId(e.target.value)}>
          <option value="">선택</option>{order.items.map(i=><option key={i.product_id} value={i.product_id}>{i.product_name}</option>)}
        </select></label>}
        <label>분류<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>내용<textarea rows={5} value={content} onChange={e=>setContent(e.target.value)} minLength={5} required placeholder="불편 사항을 구체적으로 적어 주세요."/></label>
        <div className="row"><button disabled={loading}>접수하기</button><button type="button" className="secondary" onClick={()=>listen(setContent,notify)}>음성 입력</button></div>
      </form>
    </section>
    <section className="card"><h2>내 문의 내역</h2>
      {rows.map(c=><article key={c.id}>
        <div className="row-between"><strong>#{c.id} {c.category} · {c.product_name||'일반 문의'}</strong><Status s={c.status}/></div>
        <p>{c.content}</p>
        {c.resolution&&<p className="resolution">처리 결과: {c.resolution}</p>}
        <small>{fmtDate(c.created_at)} <button className="link" onClick={()=>showReplies(c.id)}>답변 보기</button></small>
        {replies[c.id]&&(replies[c.id].length?replies[c.id].map(r=><p key={r.id} className="reply">{r.content}</p>):<p className="hint">아직 발송된 답변이 없다.</p>)}
      </article>)}
      {!rows.length&&<p className="hint">접수한 문의가 없다.</p>}
    </section>
  </main>;
}
