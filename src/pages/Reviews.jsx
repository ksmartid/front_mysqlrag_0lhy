import React,{useEffect,useState} from 'react';
import {request} from '../api.js';
import {useApp,AnswerCard,ProductSelect,Stars,Status,listen,fmtDate,won} from '../ui.jsx';

// 후기 RAG: 상품별 AI 요약(장점·단점·개선 액션) + 후기 목록 + 판매자 답글 초안 + 구매자 후기 작성
export default function Reviews({params}){
  const {user,provider,run,loading,notify}=useApp();
  const [products,setProducts]=useState([]),[productId,setProductId]=useState(params?.productId??null);
  const [reviews,setReviews]=useState([]),[negativeOnly,setNegativeOnly]=useState(false),[summary,setSummary]=useState(null);
  const [drafts,setDrafts]=useState({}),[reviewable,setReviewable]=useState([]);
  const [rating,setRating]=useState(5),[content,setContent]=useState(''),[writeFor,setWriteFor]=useState(params?.write?params.productId:null);
  const product=products.find(p=>p.id===productId);
  const manage=user.role!=='BUYER';

  useEffect(()=>{run(async()=>{
    const ps=await request('/products');setProducts(ps);
    if(!productId&&ps.length)setProductId(ps[0].id);
    if(user.role==='BUYER')setReviewable((await request('/dashboard')).reviewable);
  })},[user.id]);
  async function loadReviews(){if(productId)setReviews(await request(`/reviews?product_id=${productId}${negativeOnly?'&max_rating=3':''}`))}
  useEffect(()=>{setSummary(null);run(loadReviews)},[productId,negativeOnly]);

  const summarize=()=>run(async()=>setSummary(await request('/rag/reviews/summary','POST',{product_id:productId,provider})));
  const draftReply=id=>run(async()=>{const r=await request(`/rag/reviews/${id}/draft-reply`,'POST',{provider});setDrafts({...drafts,[id]:r.draft})});
  const saveReply=(id,status)=>run(async()=>{
    await request('/review-replies','POST',{review_id:id,content:drafts[id],status});
    const next={...drafts};delete next[id];setDrafts(next);await loadReviews();
    notify(status==='PUBLISHED'?'답글을 게시했다.':'답글 초안을 저장했다.');
  });
  const submitReview=e=>{e.preventDefault();run(async()=>{
    const r=await request('/reviews','POST',{product_id:Number(writeFor),rating,content});
    setContent('');setWriteFor(null);setReviewable(reviewable.filter(p=>p.id!==Number(writeFor)));
    setProductId(Number(writeFor));await loadReviews();
    notify(`후기가 등록되었다. 후기 RAG 색인: ${r.rag_status}`);
  })};

  return <main className="grid">
    <section className="card full">
      <div className="toolbar">
        <label>상품<ProductSelect products={products} value={productId} onChange={setProductId}/></label>
        <label className="check"><input type="checkbox" checked={negativeOnly} onChange={e=>setNegativeOnly(e.target.checked)}/>3점 이하만</label>
        <button onClick={summarize} disabled={loading||!productId}>{manage?'AI 후기 분석·개선점':'AI 후기 요약'}</button>
      </div>
      {product&&<p className="hint">{product.category} · {won(product.price)} · 평균 ★{product.avg_rating??'-'} · 후기 {product.review_count}건 · 부정 {product.low_reviews??0}건</p>}
    </section>

    <AnswerCard title={`${product?.name||''} 후기 ${manage?'분석':'요약'}`} result={summary}>
      {summary?.stats&&<p className="hint">긍정 {summary.stats.positive} · 보통 {summary.stats.neutral} · 부정 {summary.stats.negative} (전체 {summary.stats.reviews}건, 평균 {summary.stats.avg_rating})</p>}
    </AnswerCard>

    {user.role==='BUYER'&&<section className="card full">
      <h2>후기 작성</h2>
      {reviewable.length?<form onSubmit={submitReview}>
        <div className="toolbar">
          <label>구매 상품<select value={writeFor??''} onChange={e=>setWriteFor(e.target.value||null)} required>
            <option value="">선택</option>{reviewable.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
          <label>평점<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)} {n}점</option>)}</select></label>
        </div>
        <textarea rows={3} value={content} onChange={e=>setContent(e.target.value)} minLength={5} required placeholder="사용해 보신 경험을 알려 주세요."/>
        <div className="row"><button disabled={loading}>후기 등록</button><button type="button" className="secondary" onClick={()=>listen(setContent,notify)}>음성 입력</button></div>
      </form>:<p className="hint">배송 완료된 구매 상품 중 후기를 작성하지 않은 상품이 없다.</p>}
    </section>}

    <section className="card full">
      <h2>후기 {reviews.length}건</h2>
      {reviews.map(r=><article key={r.id}>
        <div className="row-between">
          <span><Stars n={r.rating}/> <strong>{r.customer_name}</strong> {r.mine&&<span className="pill">내 후기</span>}</span>
          <small>#{r.id} · {fmtDate(r.created_at)} {manage&&<>· RAG <Status s={r.rag_status}/></>}</small>
        </div>
        <p>{r.content}</p>
        {r.replies.map(rp=><p key={rp.id} className="reply"><b>판매자 답글</b> {manage&&<Status s={rp.status}/>} {rp.content}</p>)}
        {manage&&(drafts[r.id]!==undefined?<div>
          <textarea rows={4} value={drafts[r.id]} onChange={e=>setDrafts({...drafts,[r.id]:e.target.value})}/>
          <div className="row">
            <button onClick={()=>saveReply(r.id,'PUBLISHED')} disabled={loading}>검토 후 게시</button>
            <button className="secondary" onClick={()=>saveReply(r.id,'DRAFT')} disabled={loading}>초안 저장</button>
          </div>
        </div>:<button className="link" onClick={()=>draftReply(r.id)} disabled={loading}>AI 답글 초안</button>)}
      </article>)}
      {!reviews.length&&<p className="hint">후기가 없다.</p>}
    </section>
  </main>;
}
