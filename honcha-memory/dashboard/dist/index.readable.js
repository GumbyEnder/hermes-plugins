/* Honcha Memory Plugin — Hermes Dashboard (SDK)
   See dist/index.js for production bundle */
/* Honcha Memory Plugin - SDK style */
(function(){"use strict";

const SDK=window.__HERMES_PLUGIN_SDK__;

const{React}=SDK;

const{Card,CardHeader,CardTitle,CardContent}=SDK.components;

const{useState,useEffect,useCallback}=SDK.hooks;

const{cn}=SDK.utils;

function StatCard({label,value,sub}){return React.createElement("div",{className:"stat-card"},React.createElement("div",{className:"stat-label"},label),React.createElement("div",{className:"stat-value"},typeof value==="number"?value.toLocaleString():value),sub?React.createElement("div",{className:"stat-sub"},sub):null)}
function PeerRow({peer,count}){return React.createElement("tr",null,React.createElement("td",{className:"peer-name"},peer),React.createElement("td",{className:"peer-count"},count.toLocaleString()))}
function SearchResultCard({result}){return React.createElement("div",{className:"result-card"},React.createElement("div",{className:"result-meta"},React.createElement("span",{className:"result-id"},result.id),result.observer&&React.createElement("span",{className:"result-observer"},result.observer),result.score!==undefined&&React.createElement("span",{className:"result-score"},(result.score*100).toFixed(1)+"%")),React.createElement("div",{className:"result-content"},result.content))}
function HonchaMemory(){const[e,s]=React.useState(null),[l,o]=React.useState(!0),[i,a]=React.useState(null),[u,d]=React.useState(""),[c,f]=React.useState([]),[m,p]=React.useState(!1),[r,g]=React.useState(null);
const v=useCallback(async()=>{try{const e=await fetch("/api/plugins/honcha-memory/stats");
if(!e.ok)throw new Error("HTTP "+e.status);
const t=await e.json();
s(t),a(null)}catch(e){a(e.message)}finally{o(!1)}},[ ]);
const h=async(e)=>{e.preventDefault();
if(!u.trim())return;
p(!0),g(null),f([]);
try{const e=await fetch("/api/plugins/honcha-memory/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:u,limit:10})});
if(!e.ok)throw new Error("HTTP "+e.status);
const t=await e.json();
f(t.results||[])}catch(e){g(e.message)}finally{p(!1)}};
useEffect(()=>{v();
const e=setInterval(v,3e4);
return()=>clearInterval(e)},[v]);
if(l)return React.createElement("div",{className:"loading"},"Loading...");
if(i)return React.createElement("div",{className:"error"},"Error: "+i);
if(!e)return React.createElement("div",null,"No data");
const n=e.peers?Object.entries(e.peers).map(([e,t])=>React.createElement(PeerRow,{key:e,peer:e,count:t})):null,b=c.map(e=>React.createElement(SearchResultCard,{key:e.id,result:e}));
return React.createElement("div",{className:"honcha-memory-plugin"},React.createElement("header",{className:"plugin-header"},React.createElement("h1",null,"Honcha Memory"),React.createElement("div",{className:cn("health-badge",e.healthy?"healthy":"unhealthy")},e.healthy?"Healthy":"Offline")),React.createElement("div",{className:"stats-grid"},React.createElement(StatCard,{label:"Documents",value:e.documents,sub:"+"+e.documents_24h+" in 24h"}),React.createElement(StatCard,{label:"Messages",value:e.messages}),React.createElement(StatCard,{label:"Embeddings",value:e.embeddings}),React.createElement(StatCard,{label:"Queue",value:e.queue_pending,sub:"pending"})),n&&React.createElement("section",{className:"section"},React.createElement("h2",null,"Per-Agent Documents"),React.createElement("table",{className:"peers-table"},React.createElement("thead",null,React.createElement("tr",null,React.createElement("th",null,"Agent"),React.createElement("th",{style:{textAlign:"right"}},"Count"))),React.createElement("tbody",null,n))),React.createElement("section",{className:"section"},React.createElement("h2",null,"Semantic Search"),React.createElement("form",{className:"search-form",onSubmit:h},React.createElement("input",{type:"text",value:u,onChange:e=>d(e.target.value),placeholder:"Search memories...",className:"search-input"}),React.createElement("button",{type:"submit",disabled:m,className:"search-btn"},m?"Searching":"Search")),r&&React.createElement("div",{className:"error"},r),c.length>0&&React.createElement("div",{className:"search-results"},b),c.length===0&&!m&&!r&&u&&React.createElement("div",{className:"no-results"},"No results found."))),React.createElement("footer",{className:"plugin-footer"},React.createElement("small",null,"Updated: "+ (e.timestamp?new Date(e.timestamp).toLocaleTimeString():"unknown"),e.cached!==undefined&&" · Cached: "+(e.cached?"yes":"no"),e.cache_age!==undefined&&" · Age: "+e.cache_age+"s")))}window.__HERMES_PLUGINS__.register("honcha-memory",HonchaMemory);
})();

