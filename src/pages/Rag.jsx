import React,{useEffect,useState} from 'react';
import {request,download} from '../api.js';
import {useApp,AnswerCard,ProductSelect,Stars,listen,fmtDate} from '../ui.jsx';

const SOURCE_LABEL={
  BUYER:{document:'쇼핑몰 정책·안내',review:'구매자 후기',complaint:'내 문의 내역'},
  SELLER:{document:'정책·매뉴얼',review:'내 상품 후기',complaint:'내 상품 불만'},
  ADMIN:{document:'정책·매뉴얼 문서',review:'전체 후기',complaint:'전체 불만·처리 사례'},
};
const EXAMPLES={
  BUYER:['휴대용 충전기 발열 문제 있나요? 사도 될까요?','유리 용기 배송 중 파손되면 어떻게 하나요?','노이즈캔슬링 헤드폰 배터리는 얼마나 가요?'],
  SELLER:['내 상품 중 충전 관련 불만이 반복되는 원인은?','파손 배송 불만을 줄이려면 포장을 어떻게 바꿔야 할까?'],
  ADMIN:['배송 미수령 불만에는 어떻게 응답해야 하나요?','환불 지연 불만의 과거 처리 방식은?','발열 등 안전 관련 불만의 처리 기준은?'],
};

export function RagAsk(){
  const {user,provider,run,loading,notify}=useApp();
  const [question,setQuestion]=useState(''),[sources,setSources]=useState(['document','review','complaint']);
  const [products,setProducts]=useState([]),[productId,setProductId]=useState(null),[result,setResult]=useState(null);
  useEffect(()=>{run(async()=>setProducts(await request('/products')))},[user.id]);
  const toggle=s=>setSources(sources.includes(s)?sources.filter(x=>x!==s):[...sources,s]);
  const ask=()=>run(async()=>setResult(await request('/rag/ask','POST',{question,sources,product_id:productId,provider})));

  return <main className="grid">
    <section className="card full">
      <h2>{user.role==='BUYER'?'AI 쇼핑 상담':'통합 RAG 상담'}</h2>
      <p className="hint">질문을 임베딩하여 PostgreSQL의 문서(rag_chunks)·후기(rag_review_chunks)·불만(rag_complaint_chunks)을 권한 범위 안에서 검색하고, 근거만으로 답한다.</p>
      <div className="toolbar">
        {Object.entries(SOURCE_LABEL[user.role]).map(([k,v])=><label key={k} className="check"><input type="checkbox" checked={sources.includes(k)} onChange={()=>toggle(k)}/>{v}</label>)}
        <label>상품 범위<ProductSelect products={products} value={productId} onChange={setProductId} allowEmpty/></label>
      </div>
      <textarea rows={4} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={EXAMPLES[user.role][0]}/>
      <div className="chips">{EXAMPLES[user.role].map(q=><button key={q} className="chip" onClick={()=>setQuestion(q)}>{q}</button>)}</div>
      <div className="row">
        <button onClick={ask} disabled={loading||question.trim().length<2||!sources.length}>근거 검색·답변</button>
        <button className="secondary" onClick={()=>listen(setQuestion,notify)}>음성 질문</button>
      </div>
    </section>
    <AnswerCard result={result}/>
  </main>;
}

export function Insights(){
  const {user,provider,run,loading}=useApp();
  const [days,setDays]=useState(90),[result,setResult]=useState(null);
  const generate=()=>run(async()=>setResult(await request('/rag/insights','POST',{provider,days})));
  return <main className="grid">
    <section className="card full">
      <h2>AI 운영 인사이트</h2>
      <p className="hint">{user.role==='SELLER'?'내 상품':'전체 쇼핑몰'}의 불만·후기 통계(MySQL)와 부정 후기·불만 벡터 검색 결과(PostgreSQL)를 결합하여 핵심 이슈, 즉시 조치, 정책 개선안을 만든다.</p>
      <div className="toolbar">
        <label>분석 기간<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,180,365].map(d=><option key={d} value={d}>최근 {d}일</option>)}</select></label>
        <button onClick={generate} disabled={loading}>리포트 생성</button>
      </div>
    </section>
    <AnswerCard title="운영 리포트" result={result}>
      {result?.stats?.reviews?.length>0&&<table><thead><tr><th>상품</th><th>후기</th><th>평균</th><th>부정</th></tr></thead>
        <tbody>{result.stats.reviews.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.reviews}</td><td>{r.avg_rating}</td><td>{r.negative}</td></tr>)}</tbody></table>}
    </AnswerCard>
  </main>;
}

export function RagAdmin(){
  const {run,loading,notify}=useApp();
  const [status,setStatus]=useState(null),[last,setLast]=useState(null);
  const load=async()=>setStatus(await request('/rag/status'));
  useEffect(()=>{run(load)},[]);
  const sync=(targets,force)=>run(async()=>{const r=await request('/rag/sync','POST',{targets,force});setLast(r.results);await load();notify('동기화 완료')});
  const LABEL={review:'후기 (reviews → rag_review_chunks)',complaint:'불만 (complaints → rag_complaint_chunks)'};
  return <main className="grid">
    <section className="card full">
      <div className="card-head"><h2>RAG 색인 관리</h2><small>임베딩 모델 {status?.embedding_model}</small></div>
      <p className="hint">원문 + 임베딩 모델의 해시를 rag_sync_state에 저장해 변경된 행만 다시 임베딩한다. 후기 작성·불만 접수·처리 결과 저장 시 자동 색인되며, 실패 건은 아래 증분 동기화로 재시도한다.</p>
      <table><thead><tr><th>대상</th><th>원본 행</th><th>색인됨</th><th>변경 대기</th><th>실패</th><th>벡터 청크</th><th>다른 모델 청크</th></tr></thead>
        <tbody>{status?.sources.map(s=><tr key={s.kind}><td>{LABEL[s.kind]}</td><td>{s.source_rows}</td><td>{s.ready}</td><td className={s.pending?'warn-text':''}>{s.pending}</td><td className={s.failed?'warn-text':''}>{s.failed}</td><td>{s.vector_chunks}</td><td>{s.vector_chunks_other_model}</td></tr>)}
          {status&&<tr><td>업로드 문서 (source_documents → rag_chunks)</td><td colSpan={6}>{Object.entries(status.documents).map(([k,v])=>`${k} ${v}`).join(' · ')||'없음'}</td></tr>}
        </tbody></table>
      <div className="row">
        <button onClick={()=>sync(['review','complaint'],false)} disabled={loading}>증분 동기화</button>
        <button className="secondary" onClick={()=>sync(['review'],false)} disabled={loading}>후기만</button>
        <button className="secondary" onClick={()=>sync(['complaint'],false)} disabled={loading}>불만만</button>
        <button className="secondary" onClick={()=>{if(confirm('전체 행을 다시 임베딩한다. 계속할까?'))sync(['review','complaint'],true)}} disabled={loading}>전체 재색인</button>
      </div>
      {last&&<p className="hint">{last.map(r=>`${r.kind}: 색인 ${r.indexed} · 건너뜀 ${r.skipped} · 실패 ${r.failed} · 정리 ${r.removed}`).join(' / ')}</p>}
      {status?.recent_failures?.length>0&&<><h3>최근 실패</h3>{status.recent_failures.map(f=><p key={f.source_type+f.source_id} className="warn-text">{f.source_type} #{f.source_id} · {fmtDate(f.indexed_at)} · {f.error_message}</p>)}</>}
    </section>
  </main>;
}

export function Documents(){
  const {run,loading,notify}=useApp();
  const [file,setFile]=useState(null);
  const upload=kind=>{if(!file){notify('파일을 선택한다.');return}run(async()=>{
    const fd=new FormData();fd.append('file',file);
    const r=await request('/documents/'+kind,'POST',fd);
    notify(`${r.document_id?`문서 ${r.document_id} / 청크 ${r.chunks}`:`${r.imported}건`} 적재 완료`);setFile(null);
  })};
  return <main className="grid">
    <section className="card"><h2>고객 불만 대응 매뉴얼</h2>
      <p>불만 전체를 분류별로 정리하고, 처리 완료 건은 처리 사례를 포함한 PDF 초안을 만든다. 실제 정책과 교환·환불 조건은 담당자가 검토한다.</p>
      <button onClick={()=>run(()=>download('/manual.pdf','complaint_manual.pdf'))} disabled={loading}>PDF 다운로드</button>
      <p className="hint">다운로드한 PDF를 오른쪽에서 다시 업로드하면 문서 RAG(rag_chunks)에 등록된다.</p>
    </section>
    <section className="card"><h2>정책·안내 문서 적재</h2>
      <input type="file" accept=".pdf,.json,.png,.jpg,.jpeg,.webp,application/pdf,application/json,image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/>
      <div className="row">
        <button onClick={()=>upload('pdf')} disabled={loading}>PDF 추출·색인</button>
        <button className="secondary" onClick={()=>upload('json')} disabled={loading}>JSON 입력·색인</button>
        <button className="secondary" onClick={()=>upload('image')} disabled={loading}>이미지 분석·색인</button>
      </div>
      <p className="hint">JSON 형식: items 배열의 각 요소에 id, title, content가 필요하다. 스캔 PDF는 OCR 후 적재한다.</p>
    </section>
  </main>;
}

export function Recommend(){
  const {provider,run,loading}=useApp();
  const [result,setResult]=useState(null);
  return <main className="grid">
    <section className="card full"><h2>맞춤 상품 추천</h2>
      <p className="hint">최근 3개월 구매·내 후기와, 내 취향과 비슷한 다른 구매자의 긍정 후기(후기 RAG)를 근거로 추천한다. 낮은 평점을 준 상품은 제외한다.</p>
      <button onClick={()=>run(async()=>setResult(await request('/recommendations','POST',{provider})))} disabled={loading}>추천 받기</button>
    </section>
    <AnswerCard title="추천 결과" result={result&&{...result,sources:result.peer_reviews}}>
      {result?.purchases?.length>0&&<><h3>구매 근거</h3>{result.purchases.map((x,i)=><p key={i}>{x.category}: {x.quantity}개</p>)}</>}
      {result?.reviews?.length>0&&<><h3>내 후기 근거</h3>{result.reviews.map((x,i)=><p key={i}><Stars n={x.rating}/> {x.category}: {x.content}</p>)}</>}
    </AnswerCard>
  </main>;
}
