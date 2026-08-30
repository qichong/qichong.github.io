import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const data=[
{id:'sun',name:'太阳',latin:'SUN',tag:'太阳系的中心恒星',color:0xffb22e,size:2.55,distance:0,orbit:0,rot:.08,desc:'太阳是一颗G型主序星，质量约占太阳系总质量的99.86%。核心持续进行氢核聚变，为整个太阳系提供光和热。',facts:[['类型','G型主序星'],['直径','1,392,700 km'],['温度','约 5,500°C']]},
{id:'mercury',name:'水星',latin:'MERCURY',tag:'最靠近太阳的行星',color:0x9b978d,size:.34,distance:4.2,orbit:1.60,rot:.025,desc:'水星是太阳系最小的行星，也是公转速度最快的行星。',facts:[['类型','类地行星'],['直径','4,879 km'],['公转','87.97 天']]},
{id:'venus',name:'金星',latin:'VENUS',tag:'炽热的姐妹行星',color:0xd6a26c,size:.56,distance:6.2,orbit:1.18,rot:-.018,desc:'金星拥有太阳系最浓厚的行星大气层，强烈的温室效应使其表面温度极高。',facts:[['类型','类地行星'],['直径','12,104 km'],['公转','224.7 天']]},
{id:'earth',name:'地球',latin:'EARTH',tag:'我们的蓝色家园 · GLB',color:0x397bc1,size:.59,distance:8.5,orbit:1,rot:.65,tilt:.41,model:'earth',desc:'地球是目前已知唯一存在生命的行星。这里使用真实 GLB 地球模型，并放在与整个太阳系相同的世界坐标系中。',facts:[['类型','类地行星'],['直径','12,742 km'],['公转','365.25 天']]},
{id:'mars',name:'火星',latin:'MARS',tag:'红色星球',color:0xb95035,size:.44,distance:11,orbit:.80,rot:.62,desc:'火星因表面的氧化铁而呈红色，拥有太阳系最高的奥林匹斯山。',facts:[['类型','类地行星'],['直径','6,779 km'],['公转','687 天']]},
{id:'jupiter',name:'木星',latin:'JUPITER',tag:'太阳系最大的行星',color:0xc58c62,size:1.38,distance:15,orbit:.43,rot:1.35,desc:'木星是一颗气态巨行星，大红斑是一个持续数百年的巨大风暴。',facts:[['类型','气态巨行星'],['直径','139,820 km'],['公转','11.86 年']]},
{id:'saturn',name:'土星',latin:'SATURN',tag:'拥有壮丽光环的行星',color:0xd7b57a,size:1.15,distance:20,orbit:.32,rot:1.12,desc:'土星的光环主要由冰、岩石和尘埃组成。',facts:[['类型','气态巨行星'],['直径','116,460 km'],['公转','29.45 年']]},
{id:'uranus',name:'天王星',latin:'URANUS',tag:'横躺着自转的冰巨星',color:0x79cbd1,size:.78,distance:24.5,orbit:.23,rot:-.72,tilt:1.71,desc:'天王星的自转轴倾角约98°，几乎是“躺着”绕太阳转动。',facts:[['类型','冰巨行星'],['直径','50,724 km'],['公转','84 年']]},
{id:'neptune',name:'海王星',latin:'NEPTUNE',tag:'遥远而湛蓝的冰巨星',color:0x3569d0,size:.76,distance:29,orbit:.18,rot:.88,desc:'海王星是太阳系最外侧的八大行星，拥有太阳系最快的行星风速。',facts:[['类型','冰巨行星'],['直径','49,244 km'],['公转','164.8 年']]},
{id:'pluto',name:'冥王星',latin:'PLUTO',tag:'柯伊伯带矮行星',color:0xa99b91,size:.25,distance:34,orbit:.12,rot:.35,desc:'冥王星位于遥远的柯伊伯带，是太阳系著名的矮行星。',facts:[['类型','矮行星'],['直径','2,377 km'],['公转','248 年']]}
];

const scene=new THREE.Scene();scene.background=new THREE.Color(0x01030a);scene.fog=new THREE.FogExp2(0x01030a,.0038);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.05,800);camera.position.set(34,20,42);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#stage'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.045;controls.minDistance=.35;controls.maxDistance=140;controls.target.set(8,0,0);
scene.add(new THREE.AmbientLight(0x516080,.25));const sunLight=new THREE.PointLight(0xffd18a,520,180,1.35);scene.add(sunLight);

function stars(){const g=new THREE.BufferGeometry(),p=[];for(let i=0;i<9000;i++){const r=120+Math.random()*300,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);p.push(r*Math.sin(b)*Math.cos(a),r*Math.cos(b),r*Math.sin(b)*Math.sin(a));}g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:.13,sizeAttenuation:true,transparent:true,opacity:.72})));}stars();
const root=new THREE.Group();scene.add(root);const objects=[];const loader=new GLTFLoader();
function orbit(r){const g=new THREE.RingGeometry(r-.008,r+.008,256);g.rotateX(-Math.PI/2);root.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x60708d,transparent:true,opacity:.24,side:THREE.DoubleSide})));}
function texture(d){const c=document.createElement('canvas');c.width=768;c.height=384;const x=c.getContext('2d');const base='#'+d.color.toString(16).padStart(6,'0');x.fillStyle=base;x.fillRect(0,0,768,384);for(let i=0;i<300;i++){const v=30+Math.random()*130;x.fillStyle=`rgba(${v|0},${(v*.82)|0},${(v*.55)|0},${.05+Math.random()*.2})`;x.beginPath();x.ellipse(Math.random()*768,Math.random()*384,4+Math.random()*45,2+Math.random()*18,Math.random()*6.28,0,6.28);x.fill();}if(d.id==='earth'){for(let i=0;i<80;i++){x.fillStyle='rgba(55,125,70,.72)';x.beginPath();x.ellipse(Math.random()*768,50+Math.random()*280,5+Math.random()*35,3+Math.random()*18,Math.random()*6.28,0,6.28);x.fill();}}if(d.id==='jupiter'){x.strokeStyle='rgba(100,55,35,.28)';x.lineWidth=13;for(let y=30;y<360;y+=34){x.beginPath();x.moveTo(0,y);x.lineTo(768,y+Math.random()*18-9);x.stroke();}x.fillStyle='rgba(150,65,40,.55)';x.beginPath();x.ellipse(545,205,60,25,0,0,6.28);x.fill();}return new THREE.CanvasTexture(c);}
function procedural(d){const mesh=new THREE.Mesh(new THREE.SphereGeometry(d.size,56,36),new THREE.MeshStandardMaterial({map:texture(d),roughness:.9}));mesh.rotation.z=d.tilt||0;mesh.userData.id=d.id;return mesh;}
function createPlanet(d){if(d.distance)orbit(d.distance);const pivot=new THREE.Group();pivot.rotation.y=Math.random()*6.28;root.add(pivot);const mesh=procedural(d);pivot.add(mesh);if(d.id==='sun'){mesh.material=new THREE.MeshBasicMaterial({map:mesh.material.map});mesh.add(new THREE.Mesh(new THREE.SphereGeometry(d.size*1.16,32,24),new THREE.MeshBasicMaterial({color:0xff9d28,transparent:true,opacity:.16,side:THREE.BackSide})));}if(d.id==='earth'){const cloud=new THREE.Mesh(new THREE.SphereGeometry(d.size*1.025,48,32),new THREE.MeshPhongMaterial({color:0xeaf5ff,transparent:true,opacity:.12,depthWrite:false}));mesh.add(cloud);}if(d.id==='saturn'){const ring=new THREE.Mesh(new THREE.RingGeometry(d.size*1.35,d.size*2.3,128),new THREE.MeshStandardMaterial({color:0xcdb991,transparent:true,opacity:.78,side:THREE.DoubleSide,roughness:1}));ring.rotation.x=Math.PI/2.45;mesh.add(ring);}const o={...d,pivot,mesh,realModel:false};objects.push(o);return o;}
data.forEach(createPlanet);

// 真实 GLB：NASA/开源项目中的地球模型。其余行星保留程序化高质量材质，保证 GitHub Pages 首屏稳定。
const REAL_EARTH='https://cdn.glitch.global/2c206d0e-23e0-42f9-8872-0a80e04b89a8/earth.glb?v=1746797938701';
function loadRealEarth(){const target=objects.find(o=>o.id==='earth');loader.load(REAL_EARTH,g=>{const model=g.scene;const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z)||1;model.scale.setScalar(target.size*2/max);model.rotation.z=target.tilt||0;model.position.set(0,0,0);model.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=false;}});target.mesh.visible=false;target.pivot.add(model);target.realModel=true;target.modelRoot=model;document.getElementById('status').textContent='GLB ONLINE · EARTH MODEL LOADED';},undefined,()=>{document.getElementById('status').textContent='3D FALLBACK · EARTH GLB UNAVAILABLE';});}
loadRealEarth();

// NASA 3D spacecraft：作为太阳系中的真实飞行器模型，全部挂入同一个世界坐标系并独立公转/自转。
const craft=[
{name:'Parker Solar Probe',url:'https://raw.githubusercontent.com/mutasim-rehman/Solar-System/main/models/Parker%20Solar%20Probe.glb',radius:5.1,speed:1.9,scale:.012},
{name:'New Horizons',url:'https://raw.githubusercontent.com/mutasim-rehman/Solar-System/main/models/New_Horizons.glb',radius:26,speed:.18,scale:.015},
{name:'Voyager',url:'https://raw.githubusercontent.com/mutasim-rehman/Solar-System/main/models/Voyager%20Probe%20(A).glb',radius:31,speed:.11,scale:.012}
];
const craftGroup=new THREE.Group();root.add(craftGroup);
craft.forEach((c,i)=>{const pivot=new THREE.Group();pivot.rotation.y=i*2.1;craftGroup.add(pivot);const holder=new THREE.Group();holder.position.x=c.radius;pivot.add(holder);loader.load(c.url,g=>{const m=g.scene;const b=new THREE.Box3().setFromObject(m),s=b.getSize(new THREE.Vector3()),max=Math.max(s.x,s.y,s.z)||1;m.scale.setScalar(c.scale/max);m.userData.id='craft-'+i;holder.add(m);c.model=m;c.holder=holder;},undefined,()=>{});c.pivot=pivot;});

// 小行星带：同样位于统一世界坐标系。
const ag=new THREE.BufferGeometry(),ap=[];for(let i=0;i<1800;i++){const r=12.2+Math.random()*1.9,a=Math.random()*Math.PI*2;ap.push(Math.cos(a)*r,(Math.random()-.5)*.65,Math.sin(a)*r);}ag.setAttribute('position',new THREE.Float32BufferAttribute(ap,3));root.add(new THREE.Points(ag,new THREE.PointsMaterial({color:0xb4a68d,size:.045,transparent:true,opacity:.7})));

// 地月系统：月球真正绕地球模型的本地坐标轴运行。
const earth=objects.find(o=>o.id==='earth');const moonOrbit=new THREE.Group();earth.pivot.add(moonOrbit);const moon=new THREE.Mesh(new THREE.SphereGeometry(.16,36,24),new THREE.MeshStandardMaterial({color:0xaaa9a2,roughness:1}));moon.position.x=1.55;moon.userData.id='moon';moonOrbit.add(moon);objects.push({id:'moon',name:'月球',latin:'MOON',tag:'地球唯一的天然卫星',size:.16,orbit:1.8,rot:.08,desc:'月球是地球唯一的天然卫星，也是人类唯一亲自踏足过的地外天体。',facts:[['类型','天然卫星'],['直径','3,474 km'],['公转','27.3 天']],pivot:moonOrbit,mesh:moon,isMoon:true});

let selected=objects.find(o=>o.id==='earth'),paused=false,speed=1;const $=id=>document.getElementById(id),ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
function show(d){selected=d;$('planetNo').textContent=String(Math.max(0,data.findIndex(x=>x.id===d.id)+1)).padStart(2,'0');$('latin').textContent=d.latin;$('name').textContent=d.name;$('tagline').textContent=d.tag;$('desc').textContent=d.desc;$('facts').innerHTML=d.facts.map(f=>`<div class="fact"><b>${f[1]}</b><span>${f[0]}</span></div>`).join('');document.querySelectorAll('.planet-list button').forEach(b=>b.classList.toggle('active',b.dataset.id===d.id));}
const list=$('planetList');data.forEach((d,i)=>{const b=document.createElement('button');b.dataset.id=d.id;b.innerHTML=`<em>${String(i+1).padStart(2,'0')}</em>${d.name}`;b.onclick=()=>select(d);list.appendChild(b)});show(selected);
function select(d){show(d);const p=(d.modelRoot||d.mesh).getWorldPosition(new THREE.Vector3());controls.target.copy(p);camera.position.copy(p.clone().add(new THREE.Vector3(Math.max(d.size*5,4),Math.max(d.size*2,2),Math.max(d.size*5,5))));}
$('pauseBtn').onclick=()=>{paused=!paused;$('pauseBtn').textContent=paused?'▶ 继续':'Ⅱ 暂停'};$('focusBtn').onclick=()=>select(selected);$('speed').oninput=e=>{speed=+e.target.value;$('speedValue').textContent=speed.toFixed(1)+'×';paused=speed===0};document.querySelectorAll('.quick button').forEach(b=>b.onclick=()=>{$('speed').value=b.dataset.speed;$('speed').dispatchEvent(new Event('input'))});
renderer.domElement.addEventListener('pointerdown',e=>{mouse.x=e.clientX/innerWidth*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;ray.setFromCamera(mouse,camera);const targets=objects.flatMap(o=>[o.mesh,o.modelRoot].filter(Boolean));const hit=ray.intersectObjects(targets,true)[0];if(hit){let n=hit.object;while(n&&!n.userData.id)n=n.parent;const d=objects.find(o=>o.id===n?.userData.id);if(d)select(d);}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!paused){objects.forEach(o=>{if(o.isMoon){o.mesh.rotation.y+=o.rot*dt*speed;o.pivot.rotation.y+=o.orbit*dt*speed;return;}o.mesh.rotation.y+=o.rot*dt*speed;o.pivot.rotation.y+=o.orbit*dt*.35*speed;if(o.modelRoot)o.modelRoot.rotation.y+=o.rot*dt*speed;});craft.forEach(c=>{if(c.pivot)c.pivot.rotation.y+=c.speed*dt*.35*speed;if(c.model)c.model.rotation.y+=dt*speed*1.4});root.rotation.y+=dt*.0025*speed;}controls.update();renderer.render(scene,camera);$('status').textContent=paused?'SIMULATION PAUSED':'IMMERSIVE · 3D WORLD · GLB + ORBIT + ROTATION';}animate();
