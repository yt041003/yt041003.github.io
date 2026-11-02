import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.0";
(()=>{'use strict';
const KEY='my-personal-ledger-v1';
const EXP=['餐飲','交通','居家','日常購物','健身','訂閱','分期付款','保險','醫療','娛樂','教育','其他支出','飲食','居住'];
const INC=['薪金','兼職／副業','獎金','投資收入','其他收入'];
const TRA=['信用卡還款','戶口轉賬','其他轉賬'];
const icons={'餐飲':'🍽','居家':'🏠','飲食':'🍽','交通':'🚌','日常購物':'🛍','居住':'🏠','健身':'🏋','訂閱':'◈','分期付款':'▤','保險':'☂','醫療':'✚','娛樂':'♫','教育':'✎','其他支出':'•','薪金':'↙','兼職／副業':'↙','獎金':'✦','其他收入':'↙','投資收入':'↙','信用卡還款':'⇄','戶口轉賬':'⇄','其他轉賬':'⇄'};
const NOV_SCREENSHOT_TRANSACTIONS=[];
const makeSeed=()=>({version:1,settings:{budget:null,novScreenshotImported:false},transactions:[],recurring:[]});
function sanitize(d){if(!d||typeof d!=='object'||!Array.isArray(d.transactions)||!Array.isArray(d.recurring))throw Error('備份格式不正確');const cleanAmount=a=>{const n=Number(a);return Number.isFinite(n)&&n>0&&n<1e10?Math.round(n*100)/100:null};const tx=d.transactions.map(t=>({...t,id:String(t.id||uid()),amount:cleanAmount(t.amount),date:String(t.date||''),type:String(t.type||''),name:String(t.name||'').slice(0,100),category:String(t.category||''),account:String(t.account||''),note:String(t.note||'').slice(0,300),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t.time||''))?String(t.time):'',recurringId:String(t.recurringId||'')})).filter(t=>t.amount!==null&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&['expense','income','transfer'].includes(t.type));const rec=d.recurring.map(r=>({...r,id:String(r.id||uid()),name:String(r.name||'').slice(0,80),amount:cleanAmount(r.amount),kind:['subscription','installment','bill','other'].includes(r.kind)?r.kind:'other',start:String(r.start||''),end:String(r.end||''),day:Math.min(31,Math.max(1,Number(r.day)||1)),account:String(r.account||'其他'),category:String(r.category||'其他支出'),active:r.active!==false,confirmed:r.confirmed===true})).filter(r=>r.amount!==null&&/^\d{4}-\d{2}$/.test(r.start)&&(!r.end||/^\d{4}-\d{2}$/.test(r.end)));let b=d.settings?.budget;return {version:1,transactions:tx,recurring:rec,settings:{budget:b===null||b===''||!Number.isFinite(Number(b))?null:Math.max(0,Number(b)),novScreenshotImported:d.settings?.novScreenshotImported===true}};}
function mergeScreenshotTransactions(){let added=0;for(const t of NOV_SCREENSHOT_TRANSACTIONS){const match=db.transactions.some(x=>x.id===t.id||(x.date===t.date&&x.type===t.type&&x.name===t.name&&x.amount===t.amount&&(!x.time||x.time===t.time)));if(!match){db.transactions.push({...t});added++}}return added;}
let db=makeSeed();let storageAvailable=false;
let month=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'2-digit'}).slice(0,7);if(!/^\d{4}-\d{2}$/.test(month))month=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
let activePage='dashboard';let search='';let filter='all';
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'HK$'+Number(n||0).toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2});
const monthAdd=(m,n)=>{const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')};
const inMonth=(item,m)=>item.date?.slice(0,7)===m;
const applies=(r,m)=>r.active&&r.start<=m&&(!r.end||r.end>=m);
const getTx=()=>db.transactions.filter(t=>inMonth(t,month));const getRec=()=>db.recurring.filter(r=>applies(r,month));
const sum=(array)=>array.reduce((a,x)=>a+Number(x.amount||0),0);const totals=(m)=>{const list=db.transactions.filter(t=>inMonth(t,m));return {income:sum(list.filter(t=>t.type==='income')),expense:sum(list.filter(t=>t.type==='expense'))}};
const formatDate=d=>{const parts=d.split('-');return parts.length===3?`${Number(parts[1])}月${Number(parts[2])}日`:d};
const sortByDateTime=(a,b)=>(b.date+' '+(b.time||'00:00')).localeCompare(a.date+' '+(a.time||'00:00'));
const kindLabel={subscription:'訂閱',installment:'分期',bill:'帳單',other:'其他'};
const save=()=>queueCloudSave();
let toastTimer;function toast(t){const n=$('#notify');n.textContent=t;n.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),3500)}
function setPage(p){if(!$('#'+p))return;activePage=p;$$('.page').forEach(n=>n.classList.toggle('active',n.id===p));$$('.nav-item').forEach(n=>n.setAttribute('aria-current',n.dataset.page===p?'page':'false'));const labels={dashboard:['主頁','清楚掌握每一筆收入、支出與每月固定承擔。'],transactions:['本月','逐筆記錄，按月份整理。'],recurring:['固定付款','訂閱、月費與分期付款集中管理。'],settings:['設定','設定預算，保護與匯出你的記帳資料。']};$('#page-title').textContent=labels[p][0];$('#page-sub').textContent=labels[p][1];render();window.scrollTo({top:0,behavior:'instant'});}
function monthDate(day){const [y,m]=month.split('-').map(Number);const last=new Date(y,m,0).getDate();return `${month}-${String(Math.min(day,last)).padStart(2,'0')}`;}
function render(){ $('#month').value=month;const now=new Date(),currentMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');$('#month-label').textContent=month===currentMonth?'本月':(Number(month.slice(5))+'月 '+month.slice(0,4));const t=totals(month),rr=getRec(),ok=sum(rr.filter(r=>r.confirmed)),pending=sum(rr.filter(r=>!r.confirmed));$('#sum-income').textContent=money(t.income);$('#sum-expense').textContent=money(t.expense);$('#sum-net').textContent=money(t.income-t.expense);$('#sum-net').classList.toggle('negative',t.income-t.expense<0);$('#sum-recurring').textContent=money(ok);$('#sum-recurring-note').textContent=pending?`另有待確認 ${money(pending)}，不包括在此`:'已確認計劃金額；未自動入帳';renderTrend();renderCategory();renderRecent();renderPreview();renderTransactions();renderRecurring();$('#budget').value=db.settings.budget??'';$('#storage-status').textContent=storageAvailable?'已連接私人雲端資料庫。不同裝置登入同一帳戶可同步；請定期匯出 JSON 備份。':'雲端暫未連線或資料尚未同步，請檢查網絡並按重試同步。'}
function renderTrend(){const ms=Array.from({length:6},(_,i)=>monthAdd(month,i-5));const nums=ms.map(totals);const max=Math.max(1,...nums.flatMap(t=>[t.income,t.expense]));const W=600,H=178,L=13,R=13,T=14,B=19;const coord=(i,val)=>[L+(W-L-R)*i/5,T+(H-T-B)*(1-val/max)];const points=k=>nums.map((n,i)=>coord(i,n[k]));const path=points=>points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');const lines=[.25,.5,.75,1].map(x=>`<line x1="${L}" y1="${T+(H-T-B)*(1-x)}" x2="${W-R}" y2="${T+(H-T-B)*(1-x)}" stroke="#eef2f5" stroke-dasharray="3,5"/>`).join('');let svg=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="最近六個月收入與支出趨勢"><g>${lines}</g>`;['income','expense'].forEach((k,j)=>{const c=j?'#d9797f':'#39a899';const pts=points(k);svg+=`<path d="${path(pts)}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;svg+=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#fff" stroke="${c}" stroke-width="2.4"/>`).join('')});svg+='</svg>';$('#trend-chart').innerHTML=svg+`<div class="chartlabels">${ms.map(s=>`<span>${Number(s.slice(5))}月</span>`).join('')}</div>`;}
function renderCategory(){const list=getTx().filter(t=>t.type==='expense');const by={};for(const t of list)by[t.category]=(by[t.category]||0)+t.amount;const entries=Object.entries(by).sort((a,b)=>b[1]-a[1]);$('#category-count').textContent=entries.length+' 個類別';$('#category-chart').innerHTML=entries.length?entries.slice(0,6).map(([name,val])=>`<div class="cat-line"><strong>${escapeHtml(name)}</strong><span class="amount">${money(val)}</span><div class="track"><div class="fill" style="width:${Math.min(100,val/sum(list)*100)}%"></div></div></div>`).join(''):'<div class="empty">本月尚未記錄支出。<br>新增第一筆消費後會顯示分類統計。</div>';const budget=db.settings.budget;const cost=sum(list);$('#budget-progress').innerHTML=budget&&budget>0?`<div class="month-progress"><div style="display:flex;justify-content:space-between;gap:8px;font-size:12px"><b>本月預算</b><b>${money(budget)}</b></div><div class="meter"><span class="${cost>budget?'over':''}" style="width:${Math.min(100,cost/budget*100)}%"></span></div><div class="mini">${cost>budget?`已超出預算 ${money(cost-budget)}`:`已使用 ${Math.round(cost/budget*100)}%，剩餘 ${money(budget-cost)}`}</div></div>`:'';}
function txItem(t){return `<div class="list-row"><div class="category-icon">${icons[t.category]||'•'}</div><div class="list-info"><div class="list-name">${escapeHtml(t.name)}</div><div class="list-meta">${formatDate(t.date)}${t.time?' '+escapeHtml(t.time):''} · ${escapeHtml(t.category)}</div></div><div class="list-value ${t.type}">${t.type==='income'?'+':t.type==='expense'?'−':'⇄ '}${money(t.amount)}</div></div>`;}
function renderRecent(){const list=getTx().sort(sortByDateTime).slice(0,5);$('#recent-list').innerHTML=list.length?list.map(txItem).join(''):'<div class="no-data">這個月還未有紀錄。<br>按「新增收支」開始記帳。</div>'}
function renderPreview(){const rec=getRec().sort((a,b)=>a.confirmed===b.confirmed?b.amount-a.amount:a.confirmed?-1:1);$('#recurring-preview').innerHTML=rec.length?rec.map(r=>`<div class="list-row"><div class="category-icon">${icons[r.category]||'◷'}</div><div class="list-info"><div class="list-name">${escapeHtml(r.name)}</div><div class="list-meta">${escapeHtml(kindLabel[r.kind])} · ${r.confirmed?'已確認':'待確認'}</div></div><div class="list-value">${money(r.amount)}</div></div>`).join(''):'<div class="no-data">本月沒有預期固定付款。</div>'}

function weekdayZh(dateStr){const names=['週日','週一','週二','週三','週四','週五','週六'];return names[new Date(dateStr+'T00:00:00').getDay()]}
function formatGroupDate(dateStr){const d=new Date(dateStr+'T00:00:00');return `${String(d.getMonth()+1).padStart(2,'0')}月 ${String(d.getDate()).padStart(2,'0')}日 ${weekdayZh(dateStr)}`}
function renderTxCalendar(list){const grid=$('#tx-calendar');if(!grid)return;const [y,m]=month.split('-').map(Number);const first=new Date(y,m-1,1);const startOffset=(first.getDay()+6)%7;const daysInMonth=new Date(y,m,0).getDate();const prevDays=new Date(y,m-1,0).getDate();const total=42;const dayStats={};for(const t of list){const d=t.date.slice(0,10);dayStats[d]??={income:0,expense:0,count:0};if(t.type==='income')dayStats[d].income+=t.amount;else if(t.type==='expense')dayStats[d].expense+=t.amount;dayStats[d].count++;}
 const today=new Date();const todayKey=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');const latest=list.slice().sort(sortByDateTime)[0]?.date||'';const activeKey=(todayKey.slice(0,7)===month&&todayKey)||latest||`${month}-01`;
 let html='';
 for(let i=0;i<total;i++){
   let dayNum, cellMonth=month, muted=false;
   if(i<startOffset){dayNum=prevDays-startOffset+i+1; cellMonth=monthAdd(month,-1); muted=true;}
   else if(i>=startOffset+daysInMonth){dayNum=i-(startOffset+daysInMonth)+1; cellMonth=monthAdd(month,1); muted=true;}
   else {dayNum=i-startOffset+1;}
   const dateKey=`${cellMonth}-${String(dayNum).padStart(2,'0')}`; const s=dayStats[dateKey]; const active=dateKey===activeKey; const cls=['day']; if(muted)cls.push('muted'); if(active)cls.push('active');
   html+=`<div class="${cls.join(' ')}"><div class="dnum">${dayNum}</div>${s?.count?'<span class="dot"></span>':''}${s?.income?`<div class="mini-income">${money(s.income).replace('HK$','HK$')}</div>`:''}${s?.expense?`<div class="mini-expense">${money(s.expense).replace('HK$','HK$')}</div>`:''}</div>`;
 }
 grid.innerHTML=html;
 const t=totals(month); $('#calendar-income').textContent=money(t.income); $('#calendar-expense').textContent=money(t.expense); $('#calendar-net').textContent=money(t.income-t.expense); $('#calendar-net').className='v'+(t.income-t.expense<0?' expense':'');
}
function renderTxGroups(list){const wrap=$('#tx-groups'); if(!wrap)return; if(!list.length){wrap.innerHTML='<div class="no-data">這個月還未有紀錄。<br>按「新增紀錄」開始記帳。</div>'; return;} const groups={}; for(const t of list){(groups[t.date]??=[]).push(t)} const dates=Object.keys(groups).sort((a,b)=>b.localeCompare(a)); wrap.innerHTML=dates.map(date=>{const items=groups[date].sort((a,b)=>(b.time||'').localeCompare(a.time||'')); const income=sum(items.filter(t=>t.type==='income')), expense=sum(items.filter(t=>t.type==='expense')); return `<section class="day-group"><div class="day-group-head"><div class="date">${formatGroupDate(date)}</div><div class="sum">${income?`<span class="income">收 ${money(income).replace('.00','')}</span>`:''}${expense?`<span class="expense">支 ${money(expense).replace('.00','')}</span>`:''}</div></div>${items.map(t=>`<div class="day-item"><div class="day-icon ${t.type}" data-category="${escapeHtml(t.category)}">${icons[t.category]||'•'}</div><div class="day-main"><div class="cat">${escapeHtml(t.category)}</div><div class="name">${escapeHtml(t.name)}</div><div class="meta">${escapeHtml(t.account||'未指定')}${t.note?` · ${escapeHtml(t.note)}`:''}</div></div><div class="day-amount"><div class="value ${t.type}">${t.type==='income'?'+':t.type==='expense'?'-':'⇄'}${money(t.amount).replace('.00','')}</div><div class="time">${escapeHtml(t.time||'')}</div><div class="mini-actions"><button class="iconbtn" data-edit-tx="${escapeHtml(t.id)}" title="編輯">✎</button><button class="iconbtn" data-delete-tx="${escapeHtml(t.id)}" title="刪除">×</button></div></div></div>`).join('')}</section>`}).join('');}
function renderTransactions(){const monthList=getTx().slice().sort(sortByDateTime);const list=monthList.filter(t=>filter==='all'||t.type===filter).filter(t=>[t.name,t.category,t.account,t.note].join(' ').toLowerCase().includes(search.toLowerCase())).sort(sortByDateTime);$('#tx-summary').textContent=`本月共 ${getTx().length} 筆紀錄 · 目前顯示 ${list.length} 筆`;renderTxCalendar(monthList);renderTxGroups(list);$('#tx-table').innerHTML=list.length?`<table class="table"><thead><tr><th>日期／時間</th><th>商戶／項目</th><th>類別</th><th>帳戶</th><th style="text-align:right">金額</th><th class="actions-col">操作</th></tr></thead><tbody>${list.map(t=>`<tr><td>${escapeHtml(t.date)}${t.time?`<br><span class="mini">${escapeHtml(t.time)}</span>`:''}</td><td><strong>${escapeHtml(t.name)}</strong>${t.note?`<br><span class="mini">${escapeHtml(t.note)}</span>`:''}</td><td>${escapeHtml(t.category)}</td><td>${escapeHtml(t.account)}</td><td class="money ${t.type}">${t.type==='income'?'+':t.type==='expense'?'−':'⇄ '}${money(t.amount)}</td><td class="actions-col"><button class="iconbtn" data-edit-tx="${escapeHtml(t.id)}" title="編輯">✎</button><button class="iconbtn" data-delete-tx="${escapeHtml(t.id)}" title="刪除">×</button></td></tr>`).join('')}</tbody></table>`:'<div class="no-data">找不到交易記錄。<br>可以新增一筆收入或支出。</div>'}
function renderRecurring(){const rec=getRec().slice().sort((a,b)=>a.confirmed===b.confirmed?b.amount-a.amount:a.confirmed?-1:1);const allCount=db.recurring.length;const confirmed=sum(rec.filter(r=>r.confirmed)),pending=sum(rec.filter(r=>!r.confirmed));$('#rec-summary').textContent=`本月已確認 ${money(confirmed)} · 待確認 ${money(pending)} · 所有計劃 ${allCount} 項`;const show=db.recurring.slice().sort((a,b)=>Number(applies(b,month))-Number(applies(a,month))||b.amount-a.amount);$('#recurring-list').innerHTML=show.length?show.map(r=>{const due=applies(r,month),recorded=db.transactions.some(t=>t.recurringId===r.id&&inMonth(t,month));return `<div class="rec-card"><div class="rec-top"><span class="pill ${r.confirmed?'':'pending'}">${r.confirmed?'✓ 已確認':'? 待確認'}</span><span class="pill ${due?'blue':'gray'}">${due?'本月適用':'本月不適用'}</span></div><div class="rec-title">${escapeHtml(r.name)}</div><div class="rec-money">${money(r.amount)}<span class="mini"> / 月</span></div><div class="mini" style="margin-top:6px">${escapeHtml(kindLabel[r.kind])} · ${escapeHtml(r.account)}</div><div class="rec-bottom"><div class="rec-dates">${escapeHtml(r.start)} → ${escapeHtml(r.end||'持續')}<br>每月約 ${r.day} 日</div><div class="rec-actions"><button class="btn sm" data-book-rec="${escapeHtml(r.id)}" ${!due||recorded?'disabled':''}>${recorded?'✓ 已入帳':'＋ 記入本月'}</button><button class="iconbtn" data-edit-rec="${escapeHtml(r.id)}" title="編輯">✎</button><button class="iconbtn" data-delete-rec="${escapeHtml(r.id)}" title="刪除">×</button></div></div></div>`}).join(''):'<div class="no-data">尚未設定固定付款。</div>'}
function categoryOptions(type,val){const arr=type==='income'?INC:type==='transfer'?TRA:EXP;$('#tx-category').innerHTML=arr.map(c=>`<option value="${escapeHtml(c)}" ${val===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}
function openTx(t){const f=$('#tx-form');f.reset();$('#tx-modal-title').textContent=t?'編輯收支紀錄':'新增收支紀錄';f.elements.id.value=t?.id||'';f.elements.recurringId.value=t?.recurringId||'';f.elements.date.value=t?.date||monthDate(new Date().getDate());f.elements.time.value=t?.time||'';f.elements.type.value=t?.type||'expense';f.elements.amount.value=t?.amount||'';f.elements.name.value=t?.name||'';f.elements.account.value=t?.account||'HSBC EveryMile';f.elements.note.value=t?.note||'';categoryOptions(f.elements.type.value,t?.category);$('#tx-modal').showModal();}
function openRec(r){const f=$('#rec-form');f.reset();$('#rec-modal-title').textContent=r?'編輯固定付款':'新增固定付款';f.elements.id.value=r?.id||'';f.elements.name.value=r?.name||'';f.elements.amount.value=r?.amount||'';f.elements.kind.value=r?.kind||'subscription';f.elements.start.value=r?.start||month;f.elements.end.value=r?.end||'';f.elements.day.value=r?.day||1;f.elements.account.value=r?.account||'HSBC EveryMile';f.elements.confirmed.checked=r?.confirmed??true;f.elements.active.checked=r?.active??true;$('#rec-category').innerHTML=EXP.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');f.elements.category.value=r?.category||'訂閱';$('#rec-modal').showModal();}
function download(data,name,mime){const b=new Blob([data],{type:mime});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function csvRow(arr){return arr.map(s=>'"'+String(s??'').replaceAll('"','""')+'"').join(',')}
function exportCsv(){const head=['日期','時間','類型','項目名稱','類別','金額(HKD)','帳戶','備註'];const ty={income:'收入',expense:'支出',transfer:'轉賬'};const rows=getTx().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[t.date,t.time||'',ty[t.type],t.name,t.category,t.amount.toFixed(2),t.account,t.note]);download('\ufeff'+[head,...rows].map(csvRow).join('\r\n'),`個人收支_${month}.csv`,'text/csv;charset=utf-8');toast('已匯出 '+month+' 的交易 CSV')}
// nav and actions
$$('.nav-item').forEach(n=>n.addEventListener('click',()=>setPage(n.dataset.page)));
$$('[data-goto]').forEach(n=>n.addEventListener('click',()=>setPage(n.dataset.goto)));
$('#month').addEventListener('change',e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){month=e.target.value;render()}});
$('#month-prev').addEventListener('click',()=>{month=monthAdd(month,-1);render()});$('#month-next').addEventListener('click',()=>{month=monthAdd(month,1);render()});
$('#quick-add').addEventListener('click',()=>openTx());$('#add-transaction').addEventListener('click',()=>openTx());$('#add-recurring').addEventListener('click',()=>openRec());
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).close()));
$('#tx-type').addEventListener('change',e=>categoryOptions(e.target.value));
$('#tx-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const t={id:f.elements.id.value||uid(),recurringId:f.elements.recurringId.value,date:f.elements.date.value,time:f.elements.time.value,type:f.elements.type.value,amount:Math.round(Number(f.elements.amount.value)*100)/100,category:f.elements.category.value,name:f.elements.name.value.trim(),account:f.elements.account.value,note:f.elements.note.value.trim()};if(!Number.isFinite(t.amount)||t.amount<=0||!t.name){toast('請輸入有效項目和金額');return}const idx=db.transactions.findIndex(x=>x.id===t.id);if(idx>=0)db.transactions[idx]=t;else db.transactions.push(t);save();$('#tx-modal').close();render();toast(idx>=0?'已更新收支紀錄':'已加入收支紀錄')});
$('#rec-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;const r={id:f.elements.id.value||uid(),name:f.elements.name.value.trim(),amount:Math.round(Number(f.elements.amount.value)*100)/100,kind:f.elements.kind.value,start:f.elements.start.value,end:f.elements.end.value,day:Number(f.elements.day.value),category:f.elements.category.value,account:f.elements.account.value,confirmed:f.elements.confirmed.checked,active:f.elements.active.checked};if(r.end&&r.end<r.start){toast('結束月份不可早於開始月份');return}if(!r.name||!r.amount||r.day<1||r.day>31){toast('請輸入有效的付款資料');return}const idx=db.recurring.findIndex(x=>x.id===r.id);if(idx>=0)db.recurring[idx]=r;else db.recurring.push(r);save();$('#rec-modal').close();render();toast(idx>=0?'已更新固定付款':'已新增固定付款')});
$('#tx-search').addEventListener('input',e=>{search=e.target.value;renderTransactions()});$('#tx-filter').addEventListener('change',e=>{filter=e.target.value;renderTransactions()});
document.body.addEventListener('click',e=>{const b=e.target.closest('[data-edit-tx],[data-delete-tx],[data-edit-rec],[data-delete-rec],[data-book-rec]');if(!b)return;
if(b.dataset.editTx){const t=db.transactions.find(x=>x.id===b.dataset.editTx);if(t)openTx(t)}
if(b.dataset.deleteTx){const t=db.transactions.find(x=>x.id===b.dataset.deleteTx);if(t&&confirm(`確定刪除「${t.name}」${money(t.amount)}？`)){db.transactions=db.transactions.filter(x=>x.id!==t.id);save();render();toast('交易已刪除')}}
if(b.dataset.editRec){const r=db.recurring.find(x=>x.id===b.dataset.editRec);if(r)openRec(r)}
if(b.dataset.deleteRec){const r=db.recurring.find(x=>x.id===b.dataset.deleteRec);if(r&&confirm(`確定刪除固定付款「${r.name}」？已記帳的歷史收支不會被刪除。`)){db.recurring=db.recurring.filter(x=>x.id!==r.id);save();render();toast('固定付款已刪除')}}
if(b.dataset.bookRec){const r=db.recurring.find(x=>x.id===b.dataset.bookRec);if(!r||!applies(r,month)||db.transactions.some(t=>t.recurringId===r.id&&inMonth(t,month)))return;const similar=db.transactions.find(t=>t.type==='expense'&&inMonth(t,month)&&t.name===r.name&&Math.abs(t.amount-r.amount)<.005);if(similar&&!confirm('本月已有同名同金額的支出，仍要新增嗎？'))return;db.transactions.push({id:uid(),recurringId:r.id,name:r.name,type:'expense',amount:r.amount,category:r.category,account:r.account,note:'由固定付款清單建立，請核對實際扣款',date:monthDate(r.day)});save();render();toast('已記入 '+month+' 的支出')}});
$('#save-budget').addEventListener('click',()=>{const v=$('#budget').value;db.settings.budget=v===''?null:Number(v);if(db.settings.budget!==null&&(!Number.isFinite(db.settings.budget)||db.settings.budget<0)){toast('預算必須是非負數');return}save();render();toast('每月預算已儲存')});
$('#merge-screenshot').addEventListener('click',()=>{toast('請使用下方「從備份還原」選取私人初始資料 JSON');$('#import-input').click();});
$('#export-json').addEventListener('click',()=>{download(JSON.stringify({...db,exportedAt:new Date().toISOString()},null,2),`個人記帳完整備份_${new Date().toISOString().slice(0,10)}.json`,'application/json');toast('已匯出完整備份')});
$('#export-csv').addEventListener('click',exportCsv);$('#import-json').addEventListener('click',()=>$('#import-input').click());
$('#import-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const imported=sanitize(JSON.parse(await file.text()));if(!confirm(`匯入備份會覆蓋目前所有資料。備份包含 ${imported.transactions.length} 筆交易和 ${imported.recurring.length} 項固定付款。確定繼續？`))return;db=imported;save();render();toast('已提出雲端匯入，請留意同步狀態')}catch(err){toast('無法匯入：'+err.message)}finally{e.target.value=''}});
$('#reset-data').addEventListener('click',()=>{if(!confirm('此操作將永久刪除雲端帳戶內的交易、固定付款及預算！請先匯出 JSON 備份。要繼續嗎？'))return;if(!confirm('最後確認：清除所有雲端資料（包括交易及固定付款）？'))return;db=makeSeed();save();render();toast('已要求刪除雲端記錄；請核對同步狀態')});
// All user's financial data lives in RLS-protected rows, not in the deployed page.
const config=window.LEDGER_CONFIG||{};
let client=null,authUser=null,baseline=makeSeed(),pendingSaves=0,failedSync=false,saveSequence=Promise.resolve(),refreshInProgress=false;
const deepCopy=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function syncLabel(label,error=false){const el=$('#sync-indicator');el.textContent=label;el.classList.toggle('sync-error',error);$('#sync-retry').hidden=!error;storageAvailable=!error;}
function authMessage(t,kind=''){const a=$('#auth-message');a.textContent=t;a.className='auth-message '+kind;}
function setAuthenticated(user){authUser=user;$('#auth-screen').hidden=!!user;$('#ledger-shell').style.display=user?'':'none';if(user){$('#page-sub').textContent='跨裝置雲端同步 · '+user.email;syncLabel('已登入');}}
async function readCloud(){
  const [tx,re,st]=await Promise.all([
    client.from('ledger_transactions').select('id,data').eq('user_id',authUser.id),
    client.from('ledger_recurring').select('id,data').eq('user_id',authUser.id),
    client.from('ledger_settings').select('data').eq('user_id',authUser.id).maybeSingle()
  ]);
  for(const r of [tx,re,st])if(r.error)throw r.error;
  return sanitize({version:1,transactions:(tx.data||[]).map(x=>({...x.data,id:x.id})),recurring:(re.data||[]).map(x=>({...x.data,id:x.id})),settings:st.data?.data||{budget:null,novScreenshotImported:false}});
}
async function refreshCloud(force=false){
  if(!authUser||pendingSaves||failedSync||refreshInProgress)return;
  refreshInProgress=true;
  try{const fresh=await readCloud();if(pendingSaves||failedSync)return;if(force||!same(fresh,baseline)){db=deepCopy(fresh);baseline=deepCopy(fresh);render()}syncLabel('✓ 已同步');}
  catch(e){syncLabel('讀取失敗',true);console.error('Cloud fetch error',e)}
  finally{refreshInProgress=false}
}
function diffRows(before,after){const prior=new Map(before.map(x=>[x.id,x]));const next=new Map(after.map(x=>[x.id,x]));const upserts=after.filter(x=>!prior.has(x.id)||!same(prior.get(x.id),x));const deleted=before.filter(x=>!next.has(x.id)).map(x=>x.id);return {upserts,deleted};}
async function pushRows(table,before,after){
  const delta=diffRows(before,after);
  if(delta.upserts.length){const rows=delta.upserts.map(item=>({user_id:authUser.id,id:item.id,data:item}));const {error}=await client.from(table).upsert(rows,{onConflict:'user_id,id'});if(error)throw error;}
  if(delta.deleted.length){const {error}=await client.from(table).delete().eq('user_id',authUser.id).in('id',delta.deleted);if(error)throw error;}
}
async function commitSnapshot(snapshot){
  if(!authUser)throw Error('登入已過期');
  await pushRows('ledger_transactions',baseline.transactions,snapshot.transactions);
  await pushRows('ledger_recurring',baseline.recurring,snapshot.recurring);
  if(!same(baseline.settings,snapshot.settings)){
    const {error}=await client.from('ledger_settings').upsert({user_id:authUser.id,data:snapshot.settings},{onConflict:'user_id'});
    if(error)throw error;
  }
  baseline=deepCopy(snapshot);
}
function queueCloudSave(){
  if(!authUser){syncLabel('請先登入',true);return false;}
  const snapshot=deepCopy(db);
  pendingSaves++;syncLabel('同步中…');
  saveSequence=saveSequence.catch(()=>{}).then(()=>commitSnapshot(snapshot)).then(()=>{pendingSaves--;failedSync=false;if(!pendingSaves){syncLabel('✓ 已同步');refreshCloud();}}).catch(e=>{pendingSaves--;failedSync=true;syncLabel('同步失敗，按重試',true);console.error('Cloud save error',e);toast('雲端尚未儲存！請按「重試同步」，並先匯出 JSON 備份。');});
  return true;
}
async function onLogin(){
  authMessage('正在載入私人記帳資料…');
  try{baseline=await readCloud();db=deepCopy(baseline);failedSync=false;render();setAuthenticated(authUser);syncLabel('✓ 已同步');authMessage('');}
  catch(e){setAuthenticated(null);authMessage('讀取雲端資料失敗：'+e.message,'error');}
}
async function bootCloud(){
  if(!config.url||!config.publishableKey||config.url.includes('YOUR_')){authMessage('雲端資料庫尚未設定。需要完成免費 Supabase 專案建立及設定後才能使用登入／同步。','error');return;}
  try{
    client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await client.auth.getUser();
    if(error&&error.status!==401)console.warn('Auth status',error.message);
    if(data?.user){authUser=data.user;await onLogin();}else authMessage('使用電子郵件登入，或建立新帳戶。');
    client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){authUser=null;db=makeSeed();baseline=makeSeed();setAuthenticated(null);authMessage('已登出。');}else if(event==='SIGNED_IN'&&session?.user&&authUser?.id!==session.user.id){authUser=session.user;setTimeout(()=>onLogin(),0);}});
    setInterval(()=>{if(document.visibilityState==='visible')refreshCloud()},12000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshCloud()});
    window.addEventListener('focus',()=>refreshCloud());
    window.addEventListener('beforeunload',e=>{if(pendingSaves||failedSync){e.preventDefault();e.returnValue='';}});
  }catch(e){authMessage('雲端初始化失敗：'+e.message,'error')}
}
$('#auth-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!client)return;
 const email=$('#login-email').value.trim(),password=$('#login-password').value;
 $('#login-button').disabled=true;authMessage('正在登入…');
 const {data,error}=await client.auth.signInWithPassword({email,password});
 $('#login-button').disabled=false;
 if(error){authMessage('登入失敗：'+error.message,'error');return;}
 authUser=data.user;await onLogin();
});
$('#signup-button').addEventListener('click',async()=>{
 if(!client)return;
 const email=$('#login-email').value.trim(),password=$('#login-password').value;
 if(!email||password.length<8){authMessage('先輸入有效電郵和最少 8 位密碼。','error');return;}
 authMessage('正在建立帳戶…');
 const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:new URL('./',location.href).href}});
 if(error){authMessage('建立帳戶失敗：'+error.message,'error');return;}
 if(data.session){authUser=data.user;await onLogin();}else authMessage('已提交註冊。請查看確認電郵，再返回這個網址登入。','success');
});
$('#reset-password-button').addEventListener('click',async()=>{
 if(!client)return;const email=$('#login-email').value.trim();if(!email){authMessage('請先輸入電郵地址。','error');return;}
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('./',location.href).href});
 authMessage(error?'無法發送重設信：'+error.message:'如帳戶存在，將收到密碼重設電郵。',error?'error':'success');
});
$('#signout-button').addEventListener('click',async()=>{if(pendingSaves||failedSync){toast('有資料未同步，請先重試或匯出備份。');return;}if(client)await client.auth.signOut();});
$('#sync-retry').addEventListener('click',()=>{failedSync=false;queueCloudSave();});

render();
bootCloud();
})();