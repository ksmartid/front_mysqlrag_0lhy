import React,{createContext,useContext} from 'react';

export const AppContext=createContext(null);
export const useApp=()=>useContext(AppContext);

export const ROLE_LABEL={ADMIN:'관리자',SELLER:'판매자',BUYER:'구매자'};
export const STATUS_LABEL={OPEN:'접수',IN_PROGRESS:'처리 중',RESOLVED:'처리 완료',DRAFT:'초안',APPROVED:'승인',SENT:'발송',PUBLISHED:'게시',READY:'색인됨',FAILED:'색인 실패'};
const KIND_LABEL={document:'문서',review:'후기',complaint:'불만'};

export function speak(text,onError){
  if(!('speechSynthesis' in window)){onError?.('이 브라우저는 음성 읽기를 지원하지 않는다.');return}
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';speechSynthesis.speak(u);
}

export function listen(setter,onError){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){onError?.('이 브라우저는 음성 인식을 지원하지 않는다. Chrome에서 확인한다.');return}
  const rec=new SR();rec.lang='ko-KR';
  rec.onresult=e=>setter(e.results[0][0].transcript);
  rec.onerror=e=>onError?.('음성 인식 오류: '+e.error);
  rec.start();
}

export function Stars({n}){
  return <span className="stars" aria-label={`${n}점`}>{'★'.repeat(n)}<span className="off">{'★'.repeat(5-n)}</span></span>;
}

export function Status({s}){
  if(!s)return <span className="pill muted">미색인</span>;
  return <span className={`pill s-${s.toLowerCase()}`}>{STATUS_LABEL[s]||s}</span>;
}

export function Cards({cards}){
  return <div className="cards">{cards.map(c=><div className="stat" key={c.label}><small>{c.label}</small><strong>{c.value??'-'}</strong></div>)}</div>;
}

export function Bars({rows,label,value}){
  const max=Math.max(1,...rows.map(r=>Number(r[value])||0));
  return <div className="bars">{rows.map(r=><div className="bar" key={r[label]}>
    <span>{STATUS_LABEL[r[label]]||r[label]}</span>
    <div><i style={{width:`${(Number(r[value])/max)*100}%`}}/></div>
    <b>{r[value]}</b>
  </div>)}</div>;
}

export function Sources({items}){
  if(!items?.length)return null;
  return <div className="sources"><h3>참조 근거</h3>{items.map((s,i)=><article key={`${s.kind}-${s.id}-${i}`}>
    <div className="meta">
      <span className={`pill k-${s.kind}`}>{KIND_LABEL[s.kind]||'문서'} {s.id??s.document_id}</span>
      {s.title&&<span>{s.title}</span>}
      {s.rating&&<Stars n={s.rating}/>}
      {s.status&&<Status s={s.status}/>}
      <span className="score">유사도 {s.score}</span>
    </div>
    <p>{s.excerpt}</p>
  </article>)}</div>;
}

export function AnswerCard({title='AI 답변',result,children}){
  const {notify}=useApp();
  if(!result)return null;
  return <section className="card full">
    <div className="card-head"><h2>{title}</h2><button className="secondary" onClick={()=>speak(result.answer||result.analysis||result.draft,notify)}>음성으로 듣기</button></div>
    <p className="answer">{result.answer||result.analysis}</p>
    {children}
    <Sources items={result.sources}/>
  </section>;
}

export function ProductSelect({products,value,onChange,allowEmpty}){
  return <select value={value??''} onChange={e=>onChange(e.target.value?Number(e.target.value):null)}>
    {allowEmpty&&<option value="">전체 상품</option>}
    {products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.seller_name||'판매자 미지정'} · ★{p.avg_rating??'-'} ({p.review_count})</option>)}
  </select>;
}

export const fmtDate=v=>v?String(v).replace('T',' ').slice(0,16):'';
export const won=v=>Number(v).toLocaleString('ko-KR')+'원';
