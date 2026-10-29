import React,{useEffect,useState} from 'react';
import {request} from '../api.js';
import {useApp,Cards,Bars,fmtDate} from '../ui.jsx';

export default function Dashboard({go}){
  const {user,run}=useApp();
  const [data,setData]=useState(null),[orders,setOrders]=useState([]);
  useEffect(()=>{run(async()=>{
    setData(await request('/dashboard'));
    if(user.role==='BUYER')setOrders(await request('/orders'));
  })},[user.id]);
  if(!data)return null;

  if(user.role==='BUYER')return <main className="grid">
    <section className="card full"><h2>{user.display_name}님의 쇼핑 현황</h2><Cards cards={data.cards}/></section>
    <section className="card">
      <h2>후기 작성 가능 상품</h2>
      {data.reviewable.length?data.reviewable.map(p=><article key={p.id} className="row-between"><span>{p.name}</span><button className="secondary" onClick={()=>go('reviews',{productId:p.id,write:true})}>후기 쓰기</button></article>)
        :<p className="hint">배송 완료 상품의 후기를 모두 작성했다.</p>}
    </section>
    <section className="card">
      <h2>최근 주문</h2>
      {orders.slice(0,6).map(o=><article key={o.id}>
        <div className="row-between"><strong>주문 #{o.id}</strong><small>{fmtDate(o.ordered_at)} · {o.status}</small></div>
        <p>{o.items.map(i=>i.product_name).join(', ')}</p>
      </article>)}
      <button className="secondary" onClick={()=>go('complaints')}>주문 문의·불만 접수</button>
    </section>
  </main>;

  return <main className="grid">
    <section className="card full"><h2>{user.role==='SELLER'?`${user.display_name} 운영 현황`:'쇼핑몰 운영 현황'}</h2><Cards cards={data.cards}/></section>
    <section className="card"><h2>불만 처리 상태</h2><Bars rows={data.complaint_status} label="status" value="n"/></section>
    <section className="card"><h2>불만 분류</h2><Bars rows={data.complaint_category} label="category" value="n"/></section>
    <section className="card full">
      <div className="card-head"><h2>상품별 위험 신호</h2><button className="secondary" onClick={()=>go('insights')}>AI 운영 인사이트</button></div>
      <table><thead><tr><th>상품</th><th>후기</th><th>평균 평점</th><th>부정 후기(≤2점)</th><th>미처리 불만</th><th></th></tr></thead>
        <tbody>{data.products.map(p=><tr key={p.id} className={Number(p.negative)+Number(p.open_complaints)>=2?'warn':''}>
          <td>{p.name}</td><td>{p.reviews}</td><td>{p.avg_rating??'-'}</td><td>{p.negative}</td><td>{p.open_complaints}</td>
          <td><button className="link" onClick={()=>go('reviews',{productId:p.id})}>후기 분석</button></td>
        </tr>)}</tbody>
      </table>
    </section>
  </main>;
}

export function Reports(){
  const {user,run}=useApp();
  const [rows,setRows]=useState([]),[open,setOpen]=useState(null);
  useEffect(()=>{run(async()=>setRows(await request('/ai-reports?limit=50')))},[user.id]);
  const TYPE={RAG_ASK:'통합 상담',REVIEW_SUMMARY:'후기 요약',COMPLAINT_ASSIST:'불만 처리 지원',INSIGHT:'운영 인사이트'};
  return <main className="grid"><section className="card full">
    <h2>AI 결과 이력</h2>
    <p className="hint">{user.role==='ADMIN'?'전체 사용자의 AI 결과':'내가 생성한 AI 결과'}를 ai_reports 테이블에서 조회한다. 생성 결과는 담당자 검토 후 사용한다.</p>
    {rows.map(r=><article key={r.id}>
      <div className="row-between">
        <span><span className="pill">{TYPE[r.report_type]||r.report_type}</span> {r.target_type&&`${r.target_type} #${r.target_id}`} {r.question&&`· ${r.question.slice(0,50)}`}</span>
        <small>{r.display_name} · {r.provider} · {fmtDate(r.created_at)} <button className="link" onClick={()=>setOpen(open===r.id?null:r.id)}>{open===r.id?'접기':'보기'}</button></small>
      </div>
      {open===r.id&&<p className="answer">{r.answer}</p>}
    </article>)}
    {!rows.length&&<p className="hint">아직 생성된 결과가 없다.</p>}
  </section></main>;
}
