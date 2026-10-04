"""The 3D viewer: turns a scene the agent describes as JSON (unit shapes,
scaled, rotated, coloured) into a self-contained hub with a WebGL viewer
(drag to spin, pinch or scroll to zoom) that exports GLB and OBJ files.

Scene: {"title", "background": "#hex", "parts": [{"shape": "box" | "sphere" |
"cylinder" | "cone" | "pyramid" | "torus", "scale": [x, y, z],
"position": [x, y, z], "rotation": [x, y, z] (degrees), "color": "#hex"}]}
Y is up. Every shape is 1 unit across before scaling.
"""

import html
import json
import re

SHAPES = ("box", "sphere", "cylinder", "cone", "pyramid", "torus")
MAX_PARTS = 400


def _num(v, d):
    try:
        f = float(v)
        return f if abs(f) < 1e4 else d
    except (TypeError, ValueError):
        return d


def _vec(v, d):
    v = v if isinstance(v, (list, tuple)) else []
    return [_num(v[i] if i < len(v) else None, d[i]) for i in range(3)]


def _color(c, d="#cccccc"):
    return c if isinstance(c, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", c) else d


def clean(scene):
    """A scene with only known shapes and sane numbers; raises ValueError
    when nothing usable is left."""
    if not isinstance(scene, dict):
        raise ValueError("The scene is not an object.")
    parts = []
    for p in (scene.get("parts") or [])[:MAX_PARTS]:
        if not isinstance(p, dict) or p.get("shape") not in SHAPES:
            continue
        parts.append({"shape": p["shape"], "scale": _vec(p.get("scale"), [1, 1, 1]),
                      "position": _vec(p.get("position"), [0, 0, 0]), "rotation": _vec(p.get("rotation"), [0, 0, 0]),
                      "color": _color(p.get("color"))})
    if not parts:
        raise ValueError("The scene has no parts.")
    title = str(scene.get("title") or "3D model")[:60]
    return {"title": title, "background": _color(scene.get("background"), "#101418"), "parts": parts}


def scene_of(page):
    """The scene inside a viewer page made by page(), or None."""
    m = re.search(r'<script type="application/json" id="model">([\s\S]*?)</script>', page or "")
    if not m:
        return None
    try:
        return json.loads(m.group(1).replace("<\\/", "</"))
    except ValueError:
        return None


def page(scene, footer):
    data = json.dumps(scene, separators=(",", ":")).replace("</", "<\\/")
    t = html.escape(scene["title"])
    return ("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + t + "</title><style>" + CSS +
            "</style></head><body><canvas id=\"c\" aria-label=\"3D model: " + t + "\" role=\"img\"></canvas>"
            "<header><h1>" + t + "</h1><p>Drag to spin · pinch or scroll to zoom</p></header>"
            "<nav><button id=\"spin\" aria-pressed=\"true\">Auto-rotate</button><button id=\"glb\">Download GLB</button>"
            "<button id=\"obj\">Download OBJ</button></nav><footer>" + html.escape(footer) + "</footer>"
            "<script type=\"application/json\" id=\"model\">" + data + "</script><script>" + JS + "</script></body></html>")


CSS = (
    "html,body{margin:0;height:100%;overflow:hidden;background:#101418;color:#e8e8e8;font:14px system-ui,sans-serif}"
    "canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}"
    "header{position:fixed;top:12px;left:14px;right:14px;pointer-events:none}h1{margin:0;font-size:18px}"
    "header p{margin:2px 0 0;color:#a6adb5;font-size:12px}"
    "nav{position:fixed;left:0;right:0;bottom:30px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}"
    "button{font:inherit;background:#1d232a;color:#e8e8e8;border:1px solid #39424c;border-radius:10px;padding:8px 12px}"
    "button:focus-visible{outline:2px solid #7cc4ff;outline-offset:2px}"
    "footer{position:fixed;bottom:8px;left:0;right:0;text-align:center;color:#7d8590;font-size:11px}"
)

JS = r"""
(function(){
var S=JSON.parse(document.getElementById('model').textContent);
document.body.style.background=S.background;
function hex(c){return [1,3,5].map(function(i){return parseInt(c.substr(i,2),16)/255})}
// ---- unit shapes: {p: positions, n: normals, i: indices}
function box(){var p=[],n=[],i=[],F=[[0,1,2,1],[0,2,1,-1],[1,2,0,1],[1,0,2,-1],[2,0,1,1],[2,1,0,-1]];
F.forEach(function(f){var a=f[0],b=f[1],c=f[2],s=f[3],o=p.length/3;[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(q){var v=[0,0,0],m=[0,0,0];v[a]=0.5*s;v[b]=0.5*q[0]*s;v[c]=0.5*q[1];m[a]=s;p.push(v[0],v[1],v[2]);n.push(m[0],m[1],m[2])});i.push(o,o+1,o+2,o,o+2,o+3)});return{p:p,n:n,i:i}}
function sphere(){var p=[],n=[],i=[],W=28,H=18;for(var y=0;y<=H;y++)for(var x=0;x<=W;x++){var u=x/W*Math.PI*2,v=y/H*Math.PI,nx=Math.sin(v)*Math.cos(u),ny=Math.cos(v),nz=Math.sin(v)*Math.sin(u);p.push(nx/2,ny/2,nz/2);n.push(nx,ny,nz)}
for(y=0;y<H;y++)for(x=0;x<W;x++){var a=y*(W+1)+x,b=a+W+1;i.push(a,a+1,b,b,a+1,b+1)}return{p:p,n:n,i:i}}
function lathe(segs,top,cone){var p=[],n=[],i=[],k,o;var slope=cone?0.5:0;
for(k=0;k<=segs;k++){var u=k/segs*Math.PI*2,c=Math.cos(u),s=Math.sin(u),l=Math.sqrt(1+slope*slope);p.push(c/2,-0.5,s/2,top*c/2,0.5,top*s/2);n.push(c/l,slope/l,s/l,c/l,slope/l,s/l)}
for(k=0;k<segs;k++){o=k*2;i.push(o,o+1,o+2,o+2,o+1,o+3)}
[[-0.5,-1,1]].concat(top?[[0.5,1,top]]:[]).forEach(function(cap){o=p.length/3;p.push(0,cap[0],0);n.push(0,cap[1],0);for(k=0;k<=segs;k++){var u=k/segs*Math.PI*2;p.push(cap[2]*Math.cos(u)/2,cap[0],cap[2]*Math.sin(u)/2);n.push(0,cap[1],0)}
for(k=0;k<segs;k++)cap[1]<0?i.push(o,o+k+1,o+k+2):i.push(o,o+k+2,o+k+1)});return{p:p,n:n,i:i}}
function torus(){var p=[],n=[],i=[],R=0.375,r=0.125,W=36,H=16;for(var a=0;a<=W;a++)for(var b=0;b<=H;b++){var u=a/W*Math.PI*2,v=b/H*Math.PI*2,cx=Math.cos(u),sx=Math.sin(u),cv=Math.cos(v);
p.push((R+r*cv)*cx,r*Math.sin(v),(R+r*cv)*sx);n.push(cv*cx,Math.sin(v),cv*sx)}for(a=0;a<W;a++)for(b=0;b<H;b++){var q=a*(H+1)+b,w=q+H+1;i.push(q,w,q+1,q+1,w,w+1)}return{p:p,n:n,i:i}}
var UNIT={box:box(),sphere:sphere(),cylinder:lathe(36,1,false),cone:lathe(36,0,true),pyramid:lathe(4,0,true),torus:torus()};
function rot(r){var x=r[0]*Math.PI/180,y=r[1]*Math.PI/180,z=r[2]*Math.PI/180,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
// R = Rz * Ry * Rx (row-major 3x3)
return[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx,sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx,-sy,cy*sx,cy*cx]}
function mul(m,v){return[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]}
// ---- world-space meshes, one per part
var parts=S.parts.map(function(pt){var u=UNIT[pt.shape],R=rot(pt.rotation),sc=pt.scale,P=[],N=[];
for(var k=0;k<u.p.length;k+=3){var v=mul(R,[u.p[k]*sc[0],u.p[k+1]*sc[1],u.p[k+2]*sc[2]]);P.push(v[0]+pt.position[0],v[1]+pt.position[1],v[2]+pt.position[2]);
var m=mul(R,[u.n[k]/(sc[0]||1e-6),u.n[k+1]/(sc[1]||1e-6),u.n[k+2]/(sc[2]||1e-6)]),l=Math.hypot(m[0],m[1],m[2])||1;N.push(m[0]/l,m[1]/l,m[2]/l)}
return{p:P,n:N,i:u.i,color:pt.color}});
var lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];parts.forEach(function(m){for(var k=0;k<m.p.length;k++){lo[k%3]=Math.min(lo[k%3],m.p[k]);hi[k%3]=Math.max(hi[k%3],m.p[k])}});
var C=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2],SIZE=Math.max(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])||1;
// ---- WebGL
var cv=document.getElementById('c'),gl=cv.getContext('webgl',{antialias:true});
if(!gl){document.querySelector('header p').textContent='This device cannot show 3D (WebGL is off). You can still download the model.'}
else{
var vs='attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 M;varying vec3 vn;varying vec3 vc;void main(){vn=n;vc=c;gl_Position=M*vec4(p,1.0);}';
var fs='precision mediump float;varying vec3 vn;varying vec3 vc;void main(){vec3 l=normalize(vec3(0.4,0.9,0.6));float d=max(dot(normalize(vn),l),0.0);float h=0.5+0.5*normalize(vn).y;gl_FragColor=vec4(vc*(0.35+0.25*h+0.6*d),1.0);}';
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o}
var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,vs));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);gl.useProgram(pr);
var P=[],N=[],Cc=[],I=[],base=0;parts.forEach(function(m){var col=hex(m.color);for(var k=0;k<m.p.length;k+=3){P.push(m.p[k],m.p[k+1],m.p[k+2]);N.push(m.n[k],m.n[k+1],m.n[k+2]);Cc.push(col[0],col[1],col[2])}m.i.forEach(function(x){I.push(x+base)});base+=m.p.length/3});
var ext=gl.getExtension('OES_element_index_uint'),big=base>65535;
function buf(a,name){var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);var loc=gl.getAttribLocation(pr,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0)}
buf(P,'p');buf(N,'n');buf(Cc,'c');var ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,big&&ext?new Uint32Array(I):new Uint16Array(I),gl.STATIC_DRAW);
var uM=gl.getUniformLocation(pr,'M'),bg=hex(S.background);gl.enable(gl.DEPTH_TEST);
var yaw=0.6,pitch=0.35,dist=SIZE*2.2,auto=true,last=performance.now();
function mat(){var w=cv.width,h=cv.height,f=1/Math.tan(0.45),a=w/h,nr=dist/100,fr=dist*10;
var ex=C[0]+dist*Math.cos(pitch)*Math.sin(yaw),ey=C[1]+dist*Math.sin(pitch),ez=C[2]+dist*Math.cos(pitch)*Math.cos(yaw);
var z=[ex-C[0],ey-C[1],ez-C[2]],zl=Math.hypot(z[0],z[1],z[2]);z=z.map(function(v){return v/zl});var x=[z[2],0,-z[0]],xl=Math.hypot(x[0],x[2])||1;x=[x[0]/xl,0,x[2]/xl];var y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
var V=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*ex+x[1]*ey+x[2]*ez),-(y[0]*ex+y[1]*ey+y[2]*ez),-(z[0]*ex+z[1]*ey+z[2]*ez),1];
var Pm=[f/a,0,0,0,0,f,0,0,0,0,(fr+nr)/(nr-fr),-1,0,0,2*fr*nr/(nr-fr),0],O=new Float32Array(16);
for(var i=0;i<4;i++)for(var j=0;j<4;j++){var s=0;for(var k=0;k<4;k++)s+=Pm[k*4+j]*V[i*4+k];O[i*4+j]=s}return O}
function draw(t){var dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
if(auto)yaw+=(t-last)/1000*0.5;last=t;gl.viewport(0,0,w,h);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
gl.uniformMatrix4fv(uM,false,mat());gl.drawElements(gl.TRIANGLES,I.length,big&&ext?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0);requestAnimationFrame(draw)}
requestAnimationFrame(draw);
var ptrs={},pinch=0;function stop(){auto=false;spin.setAttribute('aria-pressed','false')}
cv.addEventListener('pointerdown',function(e){cv.setPointerCapture(e.pointerId);ptrs[e.pointerId]=[e.clientX,e.clientY];stop()});
cv.addEventListener('pointermove',function(e){if(!ptrs[e.pointerId])return;var ids=Object.keys(ptrs),q=ptrs[e.pointerId];
if(ids.length===1){yaw-=(e.clientX-q[0])*0.01;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-q[1])*0.01))}ptrs[e.pointerId]=[e.clientX,e.clientY];
if(ids.length===2){var a=ptrs[ids[0]],b=ptrs[ids[1]],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)dist=Math.max(SIZE*0.4,Math.min(SIZE*8,dist*pinch/d));pinch=d}});
['pointerup','pointercancel'].forEach(function(n){cv.addEventListener(n,function(e){delete ptrs[e.pointerId];pinch=0})});
cv.addEventListener('wheel',function(e){e.preventDefault();dist=Math.max(SIZE*0.4,Math.min(SIZE*8,dist*Math.exp(e.deltaY*0.001)))},{passive:false});
var spin=document.getElementById('spin');spin.onclick=function(){auto=!auto;spin.setAttribute('aria-pressed',String(auto))};
}
// ---- export: GLB (one mesh, a primitive and material per part) and OBJ
function slug(){return (S.title||'model').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'model'}
function save(name,mime,bytes){var s='';for(var i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
var b64=btoa(s);if(window.parent!==window){window.parent.postMessage({type:'hub-file',name:name,mime:mime,data:b64},'*');return}
var a=document.createElement('a');a.href='data:'+mime+';base64,'+b64;a.download=name;document.body.appendChild(a);a.click();a.remove()}
document.getElementById('glb').onclick=function(){var bin=[],views=[],acc=[],prims=[],mats=[],off=0;
function add(arr,type,comp,target,minmax){var ta=comp===5126?new Float32Array(arr):new Uint32Array(arr),b=new Uint8Array(ta.buffer);var pad=(4-b.length%4)%4;bin.push(b,new Uint8Array(pad));
views.push({buffer:0,byteOffset:off,byteLength:b.length,target:target});off+=b.length+pad;var a={bufferView:views.length-1,componentType:comp,count:arr.length/(type==='VEC3'?3:1),type:type};
if(minmax){var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(var k=0;k<arr.length;k++){mn[k%3]=Math.min(mn[k%3],arr[k]);mx[k%3]=Math.max(mx[k%3],arr[k])}a.min=mn;a.max=mx}acc.push(a);return acc.length-1}
parts.forEach(function(m,k){var c=hex(m.color);mats.push({doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[c[0],c[1],c[2],1],metallicFactor:0,roughnessFactor:0.8}});
prims.push({attributes:{POSITION:add(m.p,'VEC3',5126,34962,true),NORMAL:add(m.n,'VEC3',5126,34962)},indices:add(m.i,'SCALAR',5125,34963),material:k})});
var json=JSON.stringify({asset:{version:'2.0',generator:'Hub AI'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:S.title}],meshes:[{primitives:prims}],materials:mats,accessors:acc,bufferViews:views,buffers:[{byteLength:off}]});
var jb=new TextEncoder().encode(json),jp=(4-jb.length%4)%4,total=12+8+jb.length+jp+8+off,out=new Uint8Array(total),dv=new DataView(out.buffer),o=0;
dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,jb.length+jp,true);dv.setUint32(16,0x4E4F534A,true);out.set(jb,20);for(var q=0;q<jp;q++)out[20+jb.length+q]=32;
o=20+jb.length+jp;dv.setUint32(o,off,true);dv.setUint32(o+4,0x004E4942,true);o+=8;bin.forEach(function(b){out.set(b,o);o+=b.length});save(slug()+'.glb','model/gltf-binary',out)};
document.getElementById('obj').onclick=function(){var L=['# '+S.title+' - made with Hub AI'],base=1;parts.forEach(function(m,k){var c=hex(m.color);L.push('o part'+(k+1));
for(var i=0;i<m.p.length;i+=3)L.push('v '+m.p[i].toFixed(4)+' '+m.p[i+1].toFixed(4)+' '+m.p[i+2].toFixed(4)+' '+c.map(function(x){return x.toFixed(3)}).join(' '));
for(i=0;i<m.n.length;i+=3)L.push('vn '+m.n[i].toFixed(4)+' '+m.n[i+1].toFixed(4)+' '+m.n[i+2].toFixed(4));
for(i=0;i<m.i.length;i+=3){var a=m.i[i]+base,b=m.i[i+1]+base,d=m.i[i+2]+base;L.push('f '+a+'//'+a+' '+b+'//'+b+' '+d+'//'+d)}base+=m.p.length/3});
save(slug()+'.obj','text/plain',new TextEncoder().encode(L.join('\n')+'\n'))};
})();
"""
