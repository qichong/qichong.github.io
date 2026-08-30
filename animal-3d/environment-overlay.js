const canvas = document.createElement('canvas');
canvas.id = 'environmentOverlay';
canvas.setAttribute('aria-hidden', 'true');
document.getElementById('app').insertBefore(canvas, document.getElementById('stage'));
const ctx = canvas.getContext('2d');
let active = 'lion';
let w = 0, h = 0, dpr = 1, t = 0;

const cfg = {
  lion: { sky:'#f3b56c', horizon:'#d38c4f', grass:'#8c8b3c', tree:'#3f4a2c', sun:'#ffd16a' },
  lioness: { sky:'#f3b56c', horizon:'#d38c4f', grass:'#8c8b3c', tree:'#3f4a2c', sun:'#ffd16a' },
  deer: { sky:'#a9c8db', horizon:'#91aab7', grass:'#52654f', tree:'#284234', snow:'#eef5f5' },
  rabbit: { sky:'#a9d9f1', horizon:'#d9eec9', grass:'#67a35a', flower:'#f4c6d7' }
};

function resize(){
  w=innerWidth; h=innerHeight; dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=w*dpr; canvas.height=h*dpr; canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function clear(){ ctx.clearRect(0,0,w,h); }
function ellipse(x,y,rx,ry,color){ ctx.fillStyle=color; ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.fill(); }
function poly(points,color){ ctx.fillStyle=color; ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath(); ctx.fill(); }

function tree(x,base,s,color){
  ctx.fillStyle=color;
  ctx.fillRect(x-s*.06,base-s*.75,s*.12,s*.75);
  ellipse(x,base-s*.98,s*.38,s*.27,color);
  ellipse(x-s*.25,base-s*.82,s*.27,s*.2,color);
  ellipse(x+s*.24,base-s*.83,s*.28,s*.21,color);
}

function acacia(x,base,s,color){
  ctx.strokeStyle=color; ctx.lineWidth=Math.max(1,s*.045); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x,base); ctx.quadraticCurveTo(x+s*.02,base-s*.5,x+s*.16,base-s*.9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+s*.08,base-s*.47); ctx.lineTo(x-s*.18,base-s*.68); ctx.moveTo(x+s*.08,base-s*.48); ctx.lineTo(x+s*.31,base-s*.66); ctx.stroke();
  ellipse(x+s*.02,base-s*.96,s*.48,s*.18,color); ellipse(x-s*.27,base-s*.79,s*.26,s*.12,color); ellipse(x+s*.33,base-s*.78,s*.28,s*.12,color);
}

function fir(x,base,s,color){
  ctx.fillStyle=color;
  ctx.fillRect(x-s*.045,base-s*.72,s*.09,s*.72);
  poly([[x,base-s*1.7],[x-s*.55,base-s*.7],[x+s*.55,base-s*.7]],color);
  poly([[x,base-s*1.25],[x-s*.42,base-s*.45],[x+s*.42,base-s*.45]],color);
}

function mountains(color,snow){
  const y=h*.53;
  poly([[0,y+35],[w*.2,y-105],[w*.37,y+8],[w*.53,y-145],[w*.72,y-34],[w*.88,y-115],[w,y+18],[w,h*.72],[0,h*.72]],color);
  if(snow){
    poly([[w*.2,y-105],[w*.16,y-65],[w*.2,y-81],[w*.24,y-57],[w*.29,y-86],[w*.35,y+8]],snow);
    poly([[w*.53,y-145],[w*.47,y-78],[w*.51,y-101],[w*.56,y-72],[w*.62,y-112],[w*.68,y-46]],snow);
    poly([[w*.88,y-115],[w*.83,y-70],[w*.87,y-83],[w*.91,y-62],[w*.95,y-84],[w,y+18]],snow);
  }
}

function grass(color,count=80,y0=h*.64){
  ctx.strokeStyle=color; ctx.lineWidth=1.2; ctx.lineCap='round';
  for(let i=0;i<count;i++){
    const x=(i/(count-1))*w;
    const len=12+(i%7)*2;
    const sway=Math.sin(t*.0018+i*.63)*5;
    ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x+sway,y0-len); ctx.stroke();
  }
}

function flower(x,y,s,color){
  ctx.strokeStyle='#4e7d43'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,y);ctx.lineTo(x,y-s*8);ctx.stroke();
  ellipse(x,y-s*9,s*4,s*3,color); ellipse(x-s*3,y-s*9,s*3,s*4,color); ellipse(x+s*3,y-s*9,s*3,s*4,color); ellipse(x,y-s*9,s*2,s*2,'#f7d86a');
}

function drawLion(c){
  const grad=ctx.createLinearGradient(0,0,0,h); grad.addColorStop(0,c.sky); grad.addColorStop(.55,c.horizon); grad.addColorStop(1,'#b77b42'); ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  ellipse(w*.78,h*.30,58,58,c.sun);
  ctx.globalAlpha=.23; ellipse(w*.78,h*.30,95,95,c.sun);ctx.globalAlpha=1;
  acacia(w*.14,h*.63,150,c.tree); acacia(w*.83,h*.62,105,c.tree); acacia(w*.94,h*.68,75,c.tree);
  for(let i=0;i<9;i++) acacia(w*(.25+i*.06),h*(.55+(i%3)*.015),45+(i%3)*10,c.tree);
  grass(c.grass,110,h*.78);
}

function drawDeer(c){
  const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,c.sky);grad.addColorStop(.62,c.horizon);grad.addColorStop(1,'#718a72');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  mountains('#5f6f76',c.snow);
  for(let i=0;i<17;i++){
    const x=(i/16)*w; const base=h*.66+(i%4)*10; fir(x,base,42+(i%4)*9,c.tree);
  }
  grass(c.grass,70,h*.79);
}

function drawRabbit(c){
  const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,c.sky);grad.addColorStop(.58,c.horizon);grad.addColorStop(1,'#8dbc69');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  ellipse(w*.8,h*.22,42,42,'#fff4b1');
  for(let i=0;i<24;i++){
    const x=(i*83)%w; const y=h*.65+((i*37)%Math.max(20,h*.3)); flower(x,y,0.7+(i%3)*.18,i%3===0?'#f3a9c3':i%3===1?'#fff0a6':'#cbb5f2');
  }
  for(let i=0;i<42;i++){
    const x=(i*47)%w; const y=h*.78+((i*19)%Math.max(10,h*.18)); flower(x,y,.45+(i%2)*.18,i%2?'#f5f1dc':'#f0aec8');
  }
  grass(c.grass,100,h*.80);
}

function draw(){
  clear();
  const c=cfg[active]||cfg.rabbit;
  if(active==='deer')drawDeer(c); else if(active==='rabbit')drawRabbit(c); else drawLion(c);
  requestAnimationFrame(draw);
  t+=16;
}

function setAnimal(id){ active=id; }
function bind(){
  document.addEventListener('click',e=>{const b=e.target.closest('.animal');if(b)setAnimal(b.dataset.animal)});
  addEventListener('resize',resize);
  resize(); draw();
}

const css=document.createElement('style');
css.textContent='#environmentOverlay{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}#stage{z-index:0}';
document.head.appendChild(css);

bind();
