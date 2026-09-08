const dataPath='./data/2026/09/08.json';
const icons=['◈','⌘','⚡','◉','✦'];
const box=document.querySelector('#brief-cards');
fetch(dataPath).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(data=>{
 box.innerHTML=data.items.map((item,i)=>`<article class="card" id="${item.anchor||''}">
 <div class="visual"><div class="grid"></div><div class="visual-mark">${icons[i%icons.length]}</div><div class="visual-label">${item.category}</div></div>
 <div class="content"><div class="number">0${i+1} / ${item.category}</div><h3>${item.title}</h3>
 <div class="block"><h4>核心事实</h4><p class="facts">${item.fact}</p></div>
 <div class="block"><h4>为什么值得关注</h4><p>${item.why}</p></div>
 <div class="block"><h4>背景 / 技术解读</h4><p>${item.analysis}</p></div>
 <div class="source"><b>信息来源（${item.sourceName}）</b><a class="source-url" href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a></div>
 </div></article>`).join('');
}).catch(err=>{box.innerHTML=`<div class="empty">今日简报加载失败：${err.message}</div>`});