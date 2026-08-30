import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const data=[
 {id:'sun',name:'太阳',latin:'SOL',tag:'太阳系的中心恒星',color:0xffb13b,size:2.55,distance:0,orbit:0,rot:.08,desc:'太阳是一颗G型主序星，质量约占整个太阳系的99.86%。它通过核聚变释放能量，是地球生命几乎所有能量的最终来源。',facts:[['类型','G型恒星'],['直径','1,392,700 km'],['表面温度','约 5,500°C']]},
 {id:'mercury',name:'水星',latin:'MERCURY',tag:'最靠近太阳的行星',color:0x9d9a91,size:.34,distance:4.2,orbit:1.60,rot:.025,desc:'水星是太阳系最小的行星，也是公转速度最快的行星。由于几乎没有大气保温，它昼夜温差极大。',facts:[['类型','类地行星'],['直径','4,879 km'],['公转周期','87.97 天']]},
 {id:'venus',name:'金星',latin:'VENUS',tag:'炽热的姐妹行星',color:0xd7a36a,size:.56,distance:6.2,orbit:1.18,rot:-.018,desc:'金星拥有太阳系最浓厚的行星大气层，失控温室效应使其表面温度高达约465°C，是太阳系最热的行星表面。',facts:[['类型','类地行星'],['直径','12,104 km'],['公转周期','224.7 天']]},
 {id:'earth',name:'地球',latin:'EARTH',tag:'我们的蓝色家园',color:0x3f7fc4,size:.59,distance:8.5,orbit:1.0,rot:.65,desc:'地球是目前已知唯一存在生命的行星。海洋覆盖约71%的表面，并拥有适合液态水长期存在的大气与温度环境。',facts:[['类型','类地行星'],['直径','12,742 km'],['公转周期','365.25 天']]},
 {id:'mars',name:'火星',latin:'MARS',tag:'红色星球',color:0xb84f32,size:.44,distance:11.0,orbit:.80,rot:.62,desc:'火星因表面的氧化铁而呈红色。它拥有太阳系最高的火山奥林匹斯山和巨大的水手峡谷。',facts:[['类型','类地行星'],['直径','6,779 km'],['公转周期','687 天']]},
 {id:'jupiter',name:'木星',latin:'JUPITER',tag:'太阳系最大的行星',color:0xc58d62,size:1.38,distance:15.0,orbit:.43,rot:1.35,desc:'木星是一颗气态巨行星，质量超过其他所有行星质量总和的2倍。著名的大红斑是一场持续数百年的巨大风暴。',facts:[['类型','气态巨行星'],['直径','139,820 km'],['公转周期','11.86 年']]},
 {id:'saturn',name:'土星',latin:'SATURN',tag:'拥有壮丽光环的行星',color:0xd8b77d,size:1.15,distance:20.0,orbit:.32,rot:1.12,desc:'土星以由冰、岩石和尘埃组成的壮丽光环闻名。它的平均密度小于水，是太阳系密度最低的行星。',facts:[['类型','气态巨行星'],['直径','116,460 km'],['公转周期','29.45 年']]},
 {id:'uranus',name:'天王星',latin:'URANUS',tag:'横躺着自转的冰巨星',color:0x7bc9d0,size:.78,distance:24.5,orbit:.23,rot:-.72,tilt:1.71,desc:'天王星是一颗冰巨行星，自转轴倾角约98°，看起来几乎是“躺着”绕太阳公转，因此拥有极端的季节变化。',facts:[['类型','冰巨行星'],['直径','50,724 km'],['公转周期','84 年']]},
 {id:'neptune',name:'海王星',latin:'NEPTUNE',tag:'遥远而湛蓝的冰巨星',color:0x356ad1,size:.76,distance:29.0,orbit:.18,rot:.88,desc:'海王星是太阳系最外侧的八大行星。它拥有太阳系最快的行星风速，深蓝色来自大气中的甲烷吸收红光。',facts:[['类型','冰巨行星'],['直径','49,244 km'],['公转周期','164.8 年']]}
];

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x02040b);
scene.fog=new THREE.FogExp2(0x02040b,.006);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,500);
camera.position.set(34,25,42);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#stage'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=5;controls.maxDistance=80;controls.target.set(8,0,0);
scene.add(new THREE.AmbientLight(0x526080,.38));
const sunLight=new THREE.PointLight(0xffd18a,300,120,1.5);scene.add(sunLight);

function makeStars(){const geo=new THREE.BufferGeometry(),p=[];for(let i=0;i<5500;i++){const r=90+Math.random()*150,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);p.push(r*Math.sin(b)*Math.cos(a),r*Math.cos(b),r*Math.sin(b)*Math.sin(a));}geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));const m=new THREE.PointsMaterial({color:0xffffff,size:.17,sizeAttenuation:true,transparent:true,opacity:.72});scene.add(new THREE.Points(geo,m));}
makeStars();

const root=new THREE.Group();scene.add(root);const objects=[];
function orbitLine(r){const g=new THREE.RingGeometry(r-.006,r+.006,192);g.rotateX(-Math.PI/2);const m=new THREE.MeshBasicMaterial({color:0x52617d,transparent:true,opacity:.32,side:THREE.DoubleSide});root.add(new THREE.Mesh(g,m));}
function planetTexture(d){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.fillStyle='#'+d.color.toString(16).padStart(6,'0');x.fillRect(0,0,c.width,c.height);for(let i=0;i<180;i++){x.fillStyle=`rgba(${Math.random()*255|0},${Math.random()*180|0},${Math.random()*120|0},${.05+Math.random()*.18})`;x.beginPath();x.ellipse(Math.random()*512,Math.random()*256,5+Math.random()*35,3+Math.random()*15,Math.random()*6.28,0,6.28);x.fill();}return new THREE.CanvasTexture(c);}
function createPlanet(d){if(d.distance)orbitLine(d.distance);const pivot=new THREE.Group();pivot.rotation.y=Math.random()*Math.PI*2;root.add(pivot);const mat=new THREE.MeshStandardMaterial({map:planetTexture(d),roughness:.86,metalness:0});const mesh=new THREE.Mesh(new THREE.SphereGeometry(d.size,48,32),mat);mesh.rotation.z=d.tilt||0;mesh.userData.id=d.id;pivot.add(mesh);if(d.id==='sun'){const glow=new THREE.Mesh(new THREE.SphereGeometry(d.size*1.12,32,24),new THREE.MeshBasicMaterial({color:0xff9b28,transparent:true,opacity:.13,side:THREE.BackSide}));mesh.add(glow);}
if(d.id==='earth'){const cloud=new THREE.Mesh(new THREE.SphereGeometry(d.size*1.015,40,28),new THREE.MeshPhongMaterial({color:0xdbeeff,transparent:true,opacity:.12,depthWrite:false}));mesh.add(cloud);}
if(d.id==='saturn'){const ring=new THREE.Mesh(new THREE.RingGeometry(d.size*1.35,d.size*2.25,96),new THREE.MeshStandardMaterial({color:0xc9b38a,transparent:true,opacity:.72,side:THREE.DoubleSide,roughness:1}));ring.rotation.x=Math.PI/2.45;mesh.add(ring);}
const obj={...d,pivot,mesh,angle:pivot.rotation.y};objects.push(obj);return obj;}
data.forEach(createPlanet);

const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let selected=objects[0],paused=false,speed=1;
const $=id=>document.getElementById(id);
function show(d){selected=d;$('planetNo').textContent=String(data.indexOf(d)).padStart(2,'0');$('latin').textContent=d.latin;$('name').textContent=d.name;$('tagline').textContent=d.tag;$('desc').textContent=d.desc;$('facts').innerHTML=d.facts.map(f=>`<div class="fact"><b>${f[1]}</b><span>${f[0]}</span></div>`).join('');document.querySelectorAll('.planet-list button').forEach(b=>b.classList.toggle('active',b.dataset.id===d.id));}
const list=$('planetList');data.forEach((d,i)=>{const b=document.createElement('button');b.dataset.id=d.id;b.innerHTML=`<em>${String(i).padStart(2,'0')}</em>${d.name}`;b.onclick=()=>select(d);list.appendChild(b)});show(selected);
function select(d){show(d);const p=d.mesh.getWorldPosition(new THREE.Vector3());controls.target.lerp(p,.18);camera.position.lerp(p.clone().add(new THREE.Vector3(d.size*4+6,d.size*2+4,d.size*4+7)),.18);}
$('pauseBtn').onclick=()=>{paused=!paused;$('pauseBtn').textContent=paused?'▶ 继续运动':'Ⅱ 暂停运动'};
$('focusBtn').onclick=()=>select(selected);
$('speed').oninput=e=>{speed=+e.target.value;$('speedValue').textContent=speed.toFixed(1)+'×'};
renderer.domElement.addEventListener('pointerdown',e=>{mouse.x=e.clientX/innerWidth*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;ray.setFromCamera(mouse,camera);const hit=ray.intersectObjects(objects.map(o=>o.mesh),true)[0];if(hit){let o=hit.object;while(o&&!o.userData.id)o=o.parent;const d=objects.find(v=>v.id===o.userData.id);if(d)select(d)}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!paused){objects.forEach(o=>{o.mesh.rotation.y+=o.rot*dt*speed;o.pivot.rotation.y+=o.orbit*dt*.35*speed});root.rotation.y+=dt*.006*speed}controls.update();renderer.render(scene,camera);$('status').textContent=paused?'SIMULATION PAUSED':'LIVE · 8 PLANETS + SUN · 3D ORBIT';}
animate();
