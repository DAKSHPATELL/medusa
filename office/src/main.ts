// =====================================================================
// ClearBorder — Demo Mode (pixel-agents canvas rebuild, English)
// Same 7-scene / 11-beat story + SAME real backend integration
// (REST http://localhost:3001, WS ws://localhost:3001/ws), rendered as
// actual pixel-art on a 320x176 nearest-neighbor buffer using the real
// Pixel Agents assets. Visual language matches scenes 0-2.
// =====================================================================
import DEMO_SCRIPT from "./demo/demo-script";
import type { Beat } from "./demo/types";

const API = "http://localhost:3001";
const WS_URL = "ws://localhost:3001/ws";
const BUF_W = 320, BUF_H = 176, TILE = 16;

// ---- assets -----------------------------------------------------------
const A = "/assets/";
const FILES: Record<string,string> = {
  joan:"characters/char_1.png", guy:"characters/char_0.png",
  tr:"characters/char_2.png", cf:"characters/char_0.png", pt:"characters/char_3.png",
  retail:"characters/char_4.png",
  floor:"floors/floor_6.png", floorGrey:"floors/floor_2.png", wall:"walls/wall_0.png",
  desk:"furniture/DESK/DESK_FRONT.png",
  pc_off:"furniture/PC/PC_FRONT_OFF.png", pc1:"furniture/PC/PC_FRONT_ON_1.png",
  pc2:"furniture/PC/PC_FRONT_ON_2.png", pc3:"furniture/PC/PC_FRONT_ON_3.png",
  plant:"furniture/PLANT/PLANT.png", lplant:"furniture/LARGE_PLANT/LARGE_PLANT.png",
  sofa:"furniture/SOFA/SOFA_FRONT.png", shelf:"furniture/BOOKSHELF/BOOKSHELF.png",
  dshelf:"furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png",
  board:"furniture/WHITEBOARD/WHITEBOARD.png", clock:"furniture/CLOCK/CLOCK.png",
  chairb:"furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png",
  cactus:"furniture/CACTUS/CACTUS.png", pot:"furniture/POT/POT.png",
  paint:"furniture/LARGE_PAINTING/LARGE_PAINTING.png", spaint:"furniture/SMALL_PAINTING/SMALL_PAINTING.png",
  coffee:"furniture/COFFEE/COFFEE.png",
};
const IMG: Record<string,HTMLImageElement|null> = {};
function loadAssets(){
  return Promise.all(Object.entries(FILES).map(([k,src])=>new Promise<void>((res)=>{
    const im=new Image(); im.onload=()=>{IMG[k]=im;res();}; im.onerror=()=>{IMG[k]=null;res();};
    im.src=A+src;
  })));
}

// ---- palette (pixel-agents dark UI + purple accent) -------------------
const C = {
  bg:"#0a0e1a", bgDark:"#080b14", panel:"#161c30", panelHi:"#1e2642", border:"#2a3555",
  ink:"#05070f", text:"#e5e7eb", muted:"#9aa4bd", faint:"#6b7280",
  accent:"#6030ff", accentHi:"#8a6bff", blue:"#3794ff", green:"#10b981",
  amber:"#f59e0b", red:"#ef4444", parch:"#f2e6c8", wood:"#b57b45", wallT:"#33395c",
  fr1:"#2f5e97", fr2:"#ffffff", fr3:"#d64b4b",
};
const AGENT = {
  translator:{name:"TRANSLATOR", role:"Live Translate", col:C.amber, sheet:"tr"},
  casefile:  {name:"CASE-FILE",  role:"Persistence",    col:C.blue,  sheet:"cf"},
  portal:    {name:"PORTAL",     role:"Computer Use",   col:C.green, sheet:"pt"},
} as const;

// ---- canvas -----------------------------------------------------------
const screen = document.getElementById("screen") as HTMLCanvasElement;
const sctx = screen.getContext("2d")!;
const buf = document.createElement("canvas"); buf.width=BUF_W; buf.height=BUF_H;
const b = buf.getContext("2d")!;
let SCALE=4, OX=0, OY=0, VW=0, VH=0;
function resize(){
  VW=window.innerWidth; VH=window.innerHeight; screen.width=VW; screen.height=VH;
  SCALE=Math.max(2, Math.floor(Math.min(VW/BUF_W, VH/BUF_H)));
  OX=Math.floor((VW-BUF_W*SCALE)/2); OY=Math.floor((VH-BUF_H*SCALE)/2);
  sctx.imageSmoothingEnabled=false;
}
window.addEventListener("resize", resize);
const S=(v:number)=>v*SCALE;
const wx=(x:number)=>OX+x*SCALE, wy=(y:number)=>OY+y*SCALE;

function tinted(img:HTMLImageElement, tint:string, w:number, h:number){
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  const x=c.getContext("2d")!; x.imageSmoothingEnabled=false;
  x.drawImage(img,0,0); x.globalCompositeOperation="multiply"; x.fillStyle=tint; x.fillRect(0,0,w,h);
  x.globalCompositeOperation="destination-in"; x.drawImage(img,0,0); return c;
}
let FLOOR:HTMLCanvasElement, FLOORG:HTMLCanvasElement, WALL:HTMLCanvasElement;

// ---- text (FS Pixel Sans, crisp) --------------------------------------
const EMOJI=/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{20E3}]/gu;
const clean=(s:string)=>s.replace(EMOJI,"").replace(/[ \t]+/g," ").trim();  // keep newlines (wrap)
function font(px:number){ sctx.font=px+'px "FS Pixel Sans", monospace'; }
function measure(s:string,px:number){ font(px); return sctx.measureText(clean(s)).width; }
function text(str:string,x:number,y:number,color:string,px:number,o:{align?:CanvasTextAlign,shadow?:boolean}={}){
  const s=clean(str); font(px); sctx.textBaseline="top"; sctx.textAlign=o.align||"left";
  if(o.shadow!==false){ sctx.fillStyle=C.ink; sctx.fillText(s,x+Math.max(1,SCALE/3),y+Math.max(1,SCALE/3)); }
  sctx.fillStyle=color; sctx.fillText(s,x,y);
}
function wrap(str:string,px:number,maxW:number){
  const words=clean(str).split(" "); const out:string[]=[]; let cur="";
  for(const w of words){ const t=cur?cur+" "+w:w; if(measure(t,px)>maxW&&cur){out.push(cur);cur=w;} else cur=t; }
  if(cur) out.push(cur); return out;
}
const typed=(full:string,t:number,cps:number)=>clean(full).slice(0,Math.floor(Math.max(0,t)*cps));
const typing=(full:string,t:number,cps:number)=>Math.floor(Math.max(0,t)*cps)<clean(full).length;

// ---- UI kit -----------------------------------------------------------
function panel(x:number,y:number,w:number,h:number,fill=C.panel,border=C.border){
  sctx.fillStyle=C.ink; sctx.fillRect(x+SCALE*1.5,y+SCALE*1.5,w,h);
  sctx.fillStyle=border; sctx.fillRect(x,y,w,h);
  sctx.fillStyle=fill; sctx.fillRect(x+SCALE,y+SCALE,w-2*SCALE,h-2*SCALE);
}
function pill(x:number,y:number,w:number,h:number,fill:string,border?:string){
  sctx.fillStyle=border||fill; sctx.fillRect(x,y,w,h);
  if(border){ sctx.fillStyle=fill; sctx.fillRect(x+SCALE,y+SCALE,w-2*SCALE,h-2*SCALE); }
}
function tri(x:number,y:number,s:number,color:string){ sctx.fillStyle=color; for(let i=0;i<s;i++) sctx.fillRect(x+i,y+i,1,s*2-1-2*i); }
function check(x:number,y:number,s:number,color:string){ sctx.fillStyle=color;
  sctx.fillRect(x,y+s*2,s,s); sctx.fillRect(x+s,y+s*3,s,s); sctx.fillRect(x+s*2,y+s*2,s,s); sctx.fillRect(x+s*3,y+s,s,s); sctx.fillRect(x+s*4,y,s,s); }
function dot(x:number,y:number,r:number,color:string){ sctx.fillStyle=color; sctx.beginPath(); sctx.arc(x,y,r,0,7); sctx.fill(); }
type Rect={x:number,y:number,w:number,h:number};
function button(label:string,x:number,y:number,w:number,h:number,fill:string,fg=C.text,arrow=false):Rect{
  pill(x,y,w,h,fill,C.accentHi===fill?C.accentHi:fill);
  const tw=measure(label,S(9));
  text(label, x+w/2-(arrow?S(4):0)-tw/2 + (arrow?-S(2):0), y+h/2-S(5), fg, S(9), {shadow:false});
  if(arrow) tri(x+w-S(12), y+h/2-S(3), S(2), fg);
  return {x,y,w,h};
}
const hit=(r:Rect,mx:number,my:number)=>mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h;

// ===================================================================
//  ROOMS (world, drawn to 320x176 buffer)
// ===================================================================
const JOAN_ROOM = [
  {img:"dshelf",col:1,row:0},{img:"board",col:5,row:0},{img:"paint",col:8,row:0},
  {img:"shelf",col:12,row:0},{img:"clock",col:15,row:0},{img:"spaint",col:17,row:0},
  {img:"plant",col:0,row:2},{img:"sofa",col:1,row:8},{img:"lplant",col:17,row:6},
  {img:"cactus",col:18,row:9},{img:"pot",col:2,row:2},
  {img:"desk",col:11,row:8},{img:"pc_off",col:12,row:7,surface:true,key:"pc"},{img:"coffee",col:13,row:7,surface:true},
];
function backWall(){
  for(let c=0;c<20;c++){ const mask=(c<19?2:0)|(c>0?8:0); b.drawImage(WALL,(mask%4)*16,Math.floor(mask/4)*32,16,32,c*TILE,-16,16,32); }
}
function floorFill(tile:HTMLCanvasElement){ for(let r=0;r<12;r++) for(let c=0;c<20;c++) b.drawImage(tile,c*TILE,r*TILE); }

function drawJoanRoom(dim:number, extra:(items:any[])=>void = ()=>{}){
  floorFill(FLOOR); backWall();
  const items:any[]=[];
  for(const f of JOAN_ROOM){ const im=IMG[f.img]; if(!im) continue;
    const x=f.col*TILE,y=f.row*TILE,w=im.width,h=im.height; let z=y+h; if((f as any).surface) z+=100;
    if((f as any).key==="pc"){ items.push({z,draw:()=>drawPC(x,y)}); continue; }
    items.push({z,draw:()=>b.drawImage(im,x,y)});
  }
  extra(items);
  items.sort((p,q)=>p.z-q.z); for(const it of items) it.draw();
  if(dim){ b.fillStyle=`rgba(6,9,18,${dim})`; b.fillRect(0,0,BUF_W,BUF_H); }
}
function drawPC(x:number,y:number,on=pcOn){
  let im=IMG.pc_off; if(on){ im=[IMG.pc1,IMG.pc2,IMG.pc3][Math.floor(clock*6)%3]||IMG.pc_off; }
  if(im) b.drawImage(im,x,y);
}

// office with 3 agent desks
const DESKS = [
  {agent:"translator", col:1},
  {agent:"casefile",  col:6},
  {agent:"portal",    col:10},
] as const;   // packed left of the CaseFile-Memory sidebar
function drawOffice(dim:number){
  floorFill(FLOORG); backWall();
  // back wall decor
  const decor=[["dshelf",2,0],["board",6,0],["clock",10,0],["paint",13,0],["spaint",17,0]];
  const items:any[]=[];
  for(const [img,c,r] of decor as any){ const im=IMG[img]; if(im) items.push({z:(r as number)*16+im.height, draw:()=>b.drawImage(im,(c as number)*16,(r as number)*16)}); }
  items.push({z:9999-1, draw:()=>{ const im=IMG.lplant; if(im) b.drawImage(im,18*16,6*16);} });
  items.push({z:9999-2, draw:()=>{ const im=IMG.plant; if(im) b.drawImage(im,0,6*16);} });
  // desks + agents
  for(const d of DESKS){
    const col=d.col; const ag=agents[d.agent];
    const deskIm=IMG.desk!; const chairIm=IMG.chairb;
    const active = ag.state==="typing"||ag.state==="reading"||ag.state==="waiting";
    void chairIm;
    items.push({z:(4*16)+deskIm.height, draw:()=>b.drawImage(deskIm,col*16,4*16)});       // desk rows 4-5
    items.push({z:(3*16)+32+100, draw:()=>drawPCat((col+1)*16,3*16, active)});             // PC on desk
    // agent char sitting at row 6 facing up (toward desk)
    const cx=(col+1)*16+8, cy=6*16+8;
    items.push({z:cy+8.5, draw:()=>drawAgentChar(d.agent, cx, cy)});
  }
  items.sort((p,q)=>p.z-q.z); for(const it of items) it.draw();
  if(dim){ b.fillStyle=`rgba(6,9,18,${dim})`; b.fillRect(0,0,BUF_W,BUF_H); }
}
function drawPCat(x:number,y:number,on:boolean){
  let im=IMG.pc_off; if(on){ im=[IMG.pc1,IMG.pc2,IMG.pc3][Math.floor(clock*6)%3]||IMG.pc_off; }
  if(im) b.drawImage(im,x,y);
}

// ---- characters -------------------------------------------------------
const DIR={down:0,up:1,right:2,left:3};
function drawSheet(sheet:string, col:number, dir:number, dx:number, dy:number, sit=0){
  const im=IMG[sheet]; if(!im) return;
  const row = dir===DIR.left?DIR.right:dir; const sx=col*16, sy=row*32;
  const X=Math.round(dx-8), Y=Math.round(dy-32+sit);
  if(dir===DIR.left){ b.save(); b.translate(X+16,Y); b.scale(-1,1); b.drawImage(im,sx,sy,16,32,0,0,16,32); b.restore(); }
  else b.drawImage(im,sx,sy,16,32,X,Y,16,32);
}
function walkCol(t:number){ return [0,1,2,1][Math.floor(t/0.15)%4]; }
function typeCol(t:number){ return [3,4][Math.floor(t/0.30)%2]; }
// Joan / retailer standing idle
function drawStand(sheet:string, tileCol:number, tileRow:number, dir=DIR.down){
  const bob=Math.round(Math.sin(clock*3)); drawSheet(sheet, 1, dir, tileCol*16+8, tileRow*16+8+bob);
}
function drawAgentChar(id:"translator"|"casefile"|"portal", cx:number, cy:number){
  const ag=agents[id]; const sheet=AGENT[id].sheet;
  let col=1, sit=6;
  if(ag.state==="typing") col=typeCol(clock);
  else if(ag.state==="reading") col=[5,6][Math.floor(clock/0.4)%2];
  else if(ag.state==="waiting") col=1;
  else { col=1; sit=6; }
  drawSheet(sheet, col, DIR.up, cx, cy, sit);
}

// ===================================================================
//  STATE + CONTROLLER (keeps the real backend)
// ===================================================================
type AgentSt={state:"idle"|"typing"|"reading"|"waiting", label:string, until:number};
const agents:Record<string,AgentSt> = {
  translator:{state:"idle",label:"Idle",until:0},
  casefile:{state:"idle",label:"Idle",until:0},
  portal:{state:"idle",label:"Idle",until:0},
};
const app = {
  beats: DEMO_SCRIPT as Beat[],
  idx: -1,
  state: "idle" as "idle"|"playing"|"paused"|"waitingApproval"|"complete",
  beatT: 0,
  caseId: null as string|null,
  discId: null as string|null,
  facts: [] as string[],
  ws: null as WebSocket|null,
  wsUp: false,
  offline: false,
};
let clock=0;
let timer:number|undefined;

// ---- live Computer Use view (streamed browser screenshots) ----
let cuImg:HTMLImageElement|null=null; let cuCap=""; let cuUrl="";

function beat(){ return app.idx>=0 && app.idx<app.beats.length ? app.beats[app.idx] : null; }
function pushFact(f:string){ if(!app.facts.includes(f)) app.facts.push(f); }
function setAgent(id:string, state:AgentSt["state"], label:string, ms=0){
  agents[id].state=state; agents[id].label=label; agents[id].until = ms? clock+ms/1000 : 0;
}
function tickAgents(){ for(const k in agents){ const a=agents[k]; if(a.until && clock>a.until){ a.state="idle"; a.label="Idle"; a.until=0; } } }

// ---- WebSocket (real events) -----------------------------------------
function connectWS(){
  try{
    const ws=new WebSocket(WS_URL); app.ws=ws;
    ws.onopen=()=>{ app.wsUp=true; app.offline=false; };
    ws.onclose=()=>{ app.wsUp=false; setTimeout(connectWS, 2000); };
    ws.onerror=()=>{ app.wsUp=false; };
    ws.onmessage=(e)=>{ try{ const m=JSON.parse(e.data); onEvent(m.event, m.data); }catch(_){} };
  }catch(_){ app.wsUp=false; }
}
function onEvent(ev:string, data:any){
  switch(ev){
    case "case_created": setAgent("casefile","typing","New case created",2000); break;
    case "fact_captured":
      setAgent("translator","typing","Capturing…",1500);
      setAgent("casefile","reading",`Captured: ${data.docKind}`,2500);
      pushFact(`${data.docKind}: ${data.value}`); break;
    case "discrepancy_detected":
      setAgent("casefile","reading","Discrepancy found!",4000);
      pushFact("MISMATCH: invoice != packing list");
      pushFact("MISSING: HS code");
      if(Array.isArray(data.discrepancies)){ const m=data.discrepancies.find((d:any)=>/mismatch/i.test(d.kind))||data.discrepancies[0]; if(m) app.discId=m.id; }
      break;
    case "computer_use_step": setAgent("portal","typing", data?.step?.description || "Amending…", 2500); break;
    case "computer_use_frame":
      if(data?.image){ const im=new Image(); im.onload=()=>{ cuImg=im; }; im.src=data.image;
        cuCap=data.caption||cuCap; cuUrl=data.url||cuUrl; }
      break;
    case "needs_confirmation":
      setAgent("portal","waiting","Awaiting approval");
      // auto-advance beat 8 -> 9 on the REAL gate event
      if(beat()?.type==="pipeline" && (beat() as any).payload?.action==="computerUse") advance(app.idx);
      break;
    case "correction_submitted": setAgent("portal","typing","Submitted!",3000); pushFact("Correction submitted (human)"); break;
    case "correction_rejected": setAgent("portal","idle","Idle"); break;
    case "case_updated": setAgent("casefile","reading","Updating…",1500); break;
  }
}

// ---- REST pipeline (real endpoints; graceful offline sim) -------------
async function api(path:string, body?:any){
  const r=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):"{}"});
  if(!r.ok) throw new Error(path+" "+r.status); return r.json();
}
async function runPipeline(bt:Beat){
  const action=(bt as any).payload.action;
  try{
    if(action==="translate"){
      if(!app.caseId){ const cf=await api("/api/cases",{}); app.caseId=cf.caseId; }
      const facts=[{docKind:"invoice",value:"€47,250.00"},{docKind:"packing_list",value:"€45,000.00"},{docKind:"hs_code",value:"8541.40.90"}];
      for(const f of facts){ await api(`/api/cases/${app.caseId}/capture`,f); await sleep(800); }
    } else if(action==="detect"){
      const res=await api(`/api/cases/${app.caseId}/discrepancies`);
      const list=res.discrepancies||[]; const m=list.find((d:any)=>/mismatch/i.test(d.kind))||list[0]; if(m) app.discId=m.id;
    } else if(action==="computerUse"){
      // FIX vs original: use the REAL discrepancy id so we get real steps + needs_confirmation
      const id=app.discId||"0";
      await api(`/api/cases/${app.caseId}/correct`,{discrepancyId:id});
    }
  }catch(_){ app.offline=true; simulate(action); }
}
// offline fallback so the demo runs with no server (self-contained video)
async function simulate(action:string){
  if(action==="translate"){
    setAgent("casefile","typing","New case created",1500); await sleep(600);
    for(const f of [["invoice","€47,250.00"],["packing_list","€45,000.00"],["hs_code","8541.40.90"]]){
      setAgent("translator","typing","Capturing…",1200);
      setAgent("casefile","reading",`Captured: ${f[0]}`,2000); pushFact(`${f[0]}: ${f[1]}`); await sleep(900);
    }
  } else if(action==="detect"){
    setAgent("casefile","reading","Discrepancy found!",4000);
    pushFact("MISMATCH: invoice != packing list"); pushFact("MISSING: HS code"); app.discId="sim";
  } else if(action==="computerUse"){
    const steps=["Opening EU Customs Portal — Single Window","Locating field: Invoice Value",
      'Clearing current value: "€45,000.00"','Typing corrected value: "€47,250.00"',
      "Scrolling to Submit Declaration button","HALTING before Submit — awaiting human confirmation"];
    for(const s of steps){ setAgent("portal","typing",s,1000); await sleep(850); }
    setAgent("portal","waiting","Awaiting approval");
    if(beat()?.type==="pipeline" && (beat() as any).payload?.action==="computerUse") advance(app.idx);
  }
}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

// ---- beat engine ------------------------------------------------------
function dispatch(i:number){
  app.idx=i; app.beatT=0;
  const bt=app.beats[i]; if(!bt) return;
  if(bt.type==="waitForApproval"){ app.state="waitingApproval"; return; }
  if(bt.type==="pipeline"){ runPipeline(bt); }
  if(bt.autoAdvanceMs && app.state==="playing"){
    clearTimeout(timer); timer=window.setTimeout(()=>{ if(app.state==="playing") advance(i); }, bt.autoAdvanceMs);
  }
}
function advance(from:number){
  clearTimeout(timer);
  const n=from+1;
  if(n>=app.beats.length){ app.idx=app.beats.length-1; app.state="complete"; return; }
  dispatch(n);
}
const ctrl = {
  play(){ if(app.state==="waitingApproval") return;
    if(app.state==="idle"||app.idx<0){ app.state="playing"; dispatch(0); }
    else if(app.state==="paused"){ app.state="playing"; const bt=beat(); if(bt?.autoAdvanceMs){ clearTimeout(timer); timer=window.setTimeout(()=>{ if(app.state==="playing") advance(app.idx); }, Math.max(500,bt.autoAdvanceMs-app.beatT*1000)); } }
    else if(app.state==="complete"){ ctrl.reset(); ctrl.play(); }
  },
  pause(){ if(app.state==="playing"){ clearTimeout(timer); app.state="paused"; } },
  next(){ if(app.state==="waitingApproval"||app.state==="complete") return;
    if(app.idx<0){ app.state="playing"; dispatch(0); } else { clearTimeout(timer); advance(app.idx); } },
  reset(){ clearTimeout(timer); app.idx=-1; app.state="idle"; app.beatT=0; app.caseId=null; app.discId=null; app.facts=[];
    cuImg=null; cuCap=""; cuUrl="";
    for(const k in agents){ agents[k]={state:"idle",label:"Idle",until:0}; } },
  async approve(){ if(app.state!=="waitingApproval") return; try{ await api(`/api/cases/${app.caseId}/confirm`); }catch(_){ onEvent("correction_submitted",{}); } app.state="playing"; advance(app.idx); },
  async reject(){ if(app.state!=="waitingApproval") return; try{ await api(`/api/cases/${app.caseId}/reject`); }catch(_){} onEvent("correction_rejected",{}); },
};

// ===================================================================
//  SCENES (render from current beat)
// ===================================================================
function blit(dimVignette=true){
  sctx.imageSmoothingEnabled=false; sctx.fillStyle=C.bgDark; sctx.fillRect(0,0,VW,VH);
  sctx.drawImage(buf,0,0,BUF_W,BUF_H,OX,OY,BUF_W*SCALE,BUF_H*SCALE);
  if(dimVignette){ const g=sctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*0.35,VW/2,VH/2,Math.max(VW,VH)*0.62);
    g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,0.5)"); sctx.fillStyle=g; sctx.fillRect(0,0,VW,VH); }
}
// speech bubble anchored above a world tile
function bubble(worldX:number,worldY:number,lines:string[],t:number,cps=32,tail=true){
  const px=S(9), pad=S(4), lh=px*1.25, maxW=Math.min(VW*0.5,S(150));
  const all:string[]=[]; for(const l of lines){ for(const w of wrap(l,px,maxW)) all.push(w); }
  const full=all.join("\n"); const shown=typed(full,t,cps).split("\n");
  let w=0; for(const l of all) w=Math.max(w,measure(l,px)); w+=pad*2; const h=all.length*lh+pad*2;
  let x=wx(worldX)-w/2, y=wy(worldY)-h-S(14); x=Math.max(S(4),Math.min(VW-w-S(4),x)); y=Math.max(S(30),y);
  panel(x,y,w,h);
  for(let i=0;i<shown.length;i++) text(shown[i],x+pad,y+pad+i*lh,C.text,px);
  if(tail){ const tx=Math.max(x+pad,Math.min(x+w-pad-S(3),wx(worldX)-S(2))); sctx.fillStyle=C.border; sctx.fillRect(tx,y+h,S(6),S(2)); sctx.fillStyle=C.panel; sctx.fillRect(tx+SCALE,y+h,S(3),S(2)); }
  if(typing(full,t,cps)&&Math.floor(clock*2)%2===0){ const last=shown[shown.length-1]||""; text("_",x+pad+measure(last,px),y+pad+(shown.length-1)*lh,C.accentHi,px,{shadow:false}); }
}

let clickTargets: {r:Rect, fn:()=>void}[] = [];
function reg(r:Rect, fn:()=>void){ clickTargets.push({r,fn}); return r; }

function sceneIntro(bt:any,t:number){
  drawOffice(0.66); blit();
  const w=S(224),h=S(132),x=(VW-w)/2,y=(VH-h)/2-S(6);
  const pop=Math.min(1,t/0.4); panel((VW-w*pop)/2,(VH-h*pop)/2-S(6),w*pop,h*pop);
  if(pop<1) return;
  // logo
  const lx=x+S(16),ly=y+S(14);
  sctx.fillStyle=C.amber; sctx.fillRect(lx,ly,S(16),S(16)); sctx.fillStyle=C.ink; sctx.fillRect(lx+S(7),ly,S(2),S(16)); sctx.fillRect(lx,ly+S(7),S(16),S(2));
  sctx.fillStyle=C.accent; sctx.fillRect(lx+S(9),ly+S(8),S(11),S(11)); check(lx+S(11),ly+S(10),S(2),C.text);
  text(bt.payload.title, lx+S(24), ly, C.text, S(20));
  const fx=lx+S(24),fy=ly+S(20); sctx.fillStyle=C.fr1;sctx.fillRect(fx,fy,S(14),S(3)); sctx.fillStyle=C.fr2;sctx.fillRect(fx+S(14),fy,S(14),S(3)); sctx.fillStyle=C.fr3;sctx.fillRect(fx+S(28),fy,S(14),S(3));
  // body wrapped + typed
  const lines=wrap(bt.payload.body, S(9), w-S(32)); let yy=y+S(40);
  const shown=typed(lines.join("\n"),t-0.5,55).split("\n");
  for(let i=0;i<lines.length;i++){ if(i<shown.length) text(shown[i], x+S(16), yy, C.muted, S(9)); yy+=S(11); }
  // start button
  const bw=S(110),bh=S(22),bx=(VW-bw)/2,by=y+h-S(30);
  const glow=0.5+0.5*Math.sin(clock*3); sctx.globalAlpha=0.3+0.3*glow; pill(bx-S(2),by-S(2),bw+S(4),bh+S(4),C.accent); sctx.globalAlpha=1;
  reg(button(bt.payload.buttonLabel,bx,by,bw,bh,C.accent,C.text,true), ()=>ctrl.next());
  if(Math.floor(clock*2)%2===0) text("Space / click to begin", VW/2, y+h+S(8), C.blue, S(9), {align:"center"});
}
function sceneJoan(bt:any,t:number){
  const happy = bt.payload.emotion==="happy";
  drawJoanRoom(0,(items)=>{ items.push({z: 6*16+8+8.5, draw:()=>drawStand("joan",9,6,DIR.down)}); });
  blit(); kicker(happy?"SCENE 6":"SCENE 1", bt.step);
  if(happy){ // celebration: flag + ball near Joan
    const jx=wx(9*16+8), jy=wy(6*16+8);
    sctx.fillStyle=C.fr1;sctx.fillRect(jx+S(10),jy-S(30),S(5),S(9)); sctx.fillStyle=C.fr2;sctx.fillRect(jx+S(15),jy-S(30),S(5),S(9)); sctx.fillStyle=C.fr3;sctx.fillRect(jx+S(20),jy-S(30),S(5),S(9));
    dot(jx-S(14),jy-S(16),S(3),C.text);
  }
  bubble(9*16+8, 6*16-2, [bt.payload.text], t, 30);
}
function sceneEmail(bt:any,t:number){
  // Joan walks to desk & types (t<1.8), then mail window
  drawJoanRoom(0,(items)=>{
    let jx=9*16+8, jy=6*16+8, dir=DIR.down, col=1, sit=0;
    if(t<1.8){ const p=Math.min(1,t/1.8); const pts=[[9*16+8,6*16+8],[9*16+8,10*16+8],[12*16+8,10*16+8]];
      const seg=(pts.length-1)*p, si=Math.min(pts.length-2,Math.floor(seg)), f=seg-si;
      jx=pts[si][0]+(pts[si+1][0]-pts[si][0])*f; jy=pts[si][1]+(pts[si+1][1]-pts[si][1])*f;
      const dx=pts[si+1][0]-pts[si][0],dy=pts[si+1][1]-pts[si][1]; dir=Math.abs(dx)>Math.abs(dy)?(dx<0?DIR.left:DIR.right):(dy<0?DIR.up:DIR.down); col=walkCol(t);
    } else { jx=12*16+8; jy=10*16+8; dir=DIR.up; col=typeCol(t-1.8); sit=6; pcOn=true; }
    items.push({z:jy+8.5, draw:()=>drawSheet("joan",col,dir,jx,jy,sit)});
  });
  blit(); kicker("SCENE 2", bt.step);
  if(t>2.0) mailWindow(bt.payload, t-2.0);
}
function mailWindow(p:any,t:number){
  const w=S(200),h=S(112),x=(VW-w)/2,y=OY+S(18); const pop=Math.min(1,t/0.25);
  panel((VW-w*pop)/2,y+(h-h*pop)/2,w*pop,h*pop); if(pop<1) return;
  sctx.fillStyle=C.accent; sctx.fillRect(x+SCALE,y+SCALE,w-2*SCALE,S(14)); text("New message",x+S(8),y+S(3),C.text,S(9));
  const dc=[C.red,C.amber,C.green]; for(let i=0;i<3;i++){ sctx.fillStyle=dc[i]; sctx.fillRect(x+w-S(8)-i*S(6),y+S(5),S(4),S(4)); }
  let yy=y+S(20);
  text(`To:  ${p.to}`,x+S(8),yy,C.muted,S(9)); yy+=S(11);
  text(typed(`Subject:  ${p.subject}`,t-0.3,45),x+S(8),yy,C.text,S(9)); yy+=S(13);
  sctx.fillStyle=C.border; sctx.fillRect(x+S(6),yy-S(3),w-S(12),S(1));
  const bodyLines=wrap(p.body,S(9),w-S(16)); const bt2=t-0.9; const shown=typed(bodyLines.join("\n"),bt2,42).split("\n");
  let by=yy+S(2); for(let i=0;i<bodyLines.length && i<4;i++){ if(i<shown.length) text(shown[i],x+S(8),by,C.text,S(9)); by+=S(11); }
  const bw=S(70),bh=S(18),bx=x+w-bw-S(8),byb=y+h-bh-S(8);
  const bodyDone=!typing(bodyLines.slice(0,4).join("\n"),bt2,42);
  const sent=bt2>3.2;
  if(sent){ pill(bx,byb,bw,bh,C.green,C.green); text("Sent",bx+S(12),byb+S(4),C.text,S(10)); check(bx+bw-S(16),byb+S(5),S(2),C.text);
    const et=bt2-3.2; if(et<1){ const ex=bx+bw/2+et*S(120),ey=byb-et*S(60); sctx.fillStyle=C.parch; sctx.fillRect(ex,ey,S(12),S(9)); sctx.fillStyle=C.fr3; sctx.beginPath(); sctx.moveTo(ex,ey); sctx.lineTo(ex+S(6),ey+S(5)); sctx.lineTo(ex+S(12),ey); sctx.fill(); }
  } else { pill(bx,byb,bw,bh,bodyDone?C.accent:C.panelHi,bodyDone?C.accentHi:C.border); text("Send",bx+S(12),byb+S(4),C.text,S(10)); tri(bx+bw-S(13),byb+S(5),S(2),C.text); }
}
function sceneStatus(bt:any,t:number){
  const held = bt.payload.status==="held";
  drawJoanRoom(0.35,(items)=>{ items.push({z:6*16+8+8.5, draw:()=>drawStand("retail",9,6,DIR.down)}); });
  blit(); kicker(held?"SCENE 3":"SCENE 5", bt.step);
  // status card
  const w=S(220),h=S(64),x=(VW-w)/2,y=OY+S(30); const flip=Math.min(1,t/0.35);
  sctx.save(); sctx.translate(x+w/2,y+h/2); sctx.scale(1, flip); sctx.translate(-(x+w/2),-(y+h/2));
  panel(x,y,w,h, C.panel, held?C.red:C.green);
  dot(x+S(16),y+S(16),S(4),held?C.red:C.green);
  text(clean(bt.payload.label), x+S(28), y+S(11), held?C.red:C.green, S(11));
  if(held) text("Invoice / packing-list value mismatch + missing HS code.", x+S(12), y+S(30), C.muted, S(9));
  else text("Goods released — on their way to delivery.", x+S(12), y+S(30), C.muted, S(9));
  sctx.restore();
  if(held && bt.payload.retailerSpeech && t>0.6) bubble(9*16+8,6*16-2,[bt.payload.retailerSpeech],t-0.6,34);
}
function sceneOffice(bt:any,t:number){
  drawOffice(0); blit(false);
  kicker("SCENE 4", "ClearBorder takes over");
  // nametags under each desk
  for(const d of DESKS){ const a=AGENT[d.agent]; const st=agents[d.agent];
    const cx=wx((d.col+1)*16+8), ny=wy(7*16+2);
    const w=Math.max(measure(a.name,S(9)),measure(a.role,S(8)))+S(14);
    panel(cx-w/2, ny, w, S(26), C.panel, a.col);
    text(a.name, cx, ny+S(3), a.col, S(9), {align:"center",shadow:false});
    text(a.role, cx, ny+S(13), C.muted, S(8), {align:"center",shadow:false});
    dot(cx+w/2-S(6), ny+S(6), S(2.5), st.state==="idle"?C.faint : st.state==="waiting"?C.amber : a.col);
    // speaking caption when active (above the agent)
    if(st.state!=="idle" && st.label){ const cap=st.label; const cw=Math.min(S(150),measure(cap,S(8))+S(10));
      let bx=Math.max(S(6),Math.min(VW-cw-S(112),cx-cw/2)); const by=wy(4*16);
      panel(bx, by, cw, S(15), C.panelHi, a.col); text(cap, bx+cw/2, by+S(3), C.text, S(8), {align:"center",shadow:false});
    }
    // waiting "?" bubble on portal
    if(st.state==="waiting"){ const by=wy(4*16-16); panel(cx-S(8),by,S(16),S(16),C.panel,C.amber); text("?",cx,by+S(2),C.amber,S(11),{align:"center",shadow:false}); }
  }
  memoryPanel();
  liveView();
}
// Live monitor: the actual Computer Use browser, streamed frame-by-frame.
function liveView(){
  if(!cuImg || !cuImg.naturalWidth) return;
  const ar = cuImg.naturalWidth/cuImg.naturalHeight || 1.6;
  let w = Math.min(S(340), VW*0.5), h = w/ar;
  const maxH = VH*0.52; if(h>maxH){ h=maxH; w=h*ar; }
  const x = Math.round((VW - w)/2) - S(24); // shift left of the memory panel
  const y = OY + S(30);
  // bezel + title bar
  panel(x-S(3), y-S(13), w+S(6), h+S(28), C.panel, C.accent);
  sctx.fillStyle=C.accent; sctx.fillRect(x-S(1), y-S(11), w+S(2), S(11));
  const on=Math.floor(clock*2)%2===0; dot(x+S(6), y-S(5), S(2.5), on?C.red:"#8a2f2f");
  text("LIVE · Computer Use", x+S(12), y-S(10), C.text, S(8), {shadow:false});
  // the streamed browser screenshot (smoothed, unlike the pixel office)
  sctx.imageSmoothingEnabled=true;
  sctx.drawImage(cuImg, x, y, w, h);
  sctx.imageSmoothingEnabled=false;
  // caption overlay + url strip
  if(cuCap){ sctx.fillStyle="rgba(5,7,15,0.72)"; sctx.fillRect(x, y+h-S(13), w, S(13));
    text(cuCap, x+S(4), y+h-S(11), C.text, S(8), {shadow:false}); }
  sctx.fillStyle=C.ink; sctx.fillRect(x, y+h, w, S(12));
  text(cuUrl||"", x+S(4), y+h+S(2), C.faint, S(7), {shadow:false});
}
function memoryPanel(){
  const w=S(96), x=VW-w-S(10), y=OY+S(30), h=BUF_H*SCALE-S(60);
  panel(x,y,w,h, C.panel, C.accent);
  // header folder
  sctx.fillStyle=C.amber; sctx.fillRect(x+S(8),y+S(8),S(12),S(9)); sctx.fillRect(x+S(8),y+S(6),S(6),S(3));
  text("CASEFILE MEMORY", x+S(24), y+S(8), C.text, S(9), {shadow:false});
  text("What ClearBorder remembers:", x+S(8), y+S(22), C.faint, S(8), {shadow:false});
  let fy=y+S(34);
  if(app.facts.length===0) text("Waiting for facts…", x+S(8), fy, C.faint, S(8), {shadow:false});
  for(const f of app.facts){
    const warn=/MISMATCH|MISSING/.test(f), ok=/submitted/i.test(f);
    const col= warn?C.red : ok?C.green : C.text;
    pill(x+S(8), fy, w-S(16), S(12), C.panelHi, warn?C.red:ok?C.green:C.border);
    if(warn){ sctx.fillStyle=C.red; sctx.fillRect(x+S(11),fy+S(3),S(2),S(4)); sctx.fillRect(x+S(11),fy+S(8),S(2),S(2)); }
    else if(ok){ check(x+S(11),fy+S(3),S(1.5),C.green); }
    text(wrap(f, S(8), w-S(28))[0]||f, x+S(16), fy+S(2), col, S(8), {shadow:false});
    fy+=S(14);
  }
  // approval gate — opaque strip pinned to the bottom so it never collides with facts
  if(app.state==="waitingApproval"){
    const gh=S(58), gy=y+h-gh;
    sctx.fillStyle=C.panel; sctx.fillRect(x+S(2), gy, w-S(4), gh-S(2));
    sctx.fillStyle=C.amber; sctx.fillRect(x+S(2), gy, w-S(4), S(1));
    text("HUMAN APPROVAL", x+S(8), gy+S(4), C.amber, S(8), {shadow:false});
    reg(button("Approve", x+S(8), gy+S(16), w-S(16), S(16), C.green, C.text), ()=>ctrl.approve());
    reg(button("Reject", x+S(8), gy+S(35), w-S(16), S(15), C.panelHi, C.red), ()=>ctrl.reject());
  }
}

// scene chrome
function kicker(tag:string, sub:string){
  const px=S(9); const tw=measure(tag,px), sw=measure(sub,px);
  const pillW=tw+S(12), w=pillW+S(10)+sw+S(12), x=S(8), y=S(24);
  panel(x,y,w,S(19)); pill(x+S(4),y+S(3),pillW,S(13),C.accent,C.accentHi);
  text(tag,x+S(10),y+S(5),C.text,px,{shadow:false}); text(sub,x+S(6)+pillW+S(6),y+S(5),C.muted,px);
}

// timeline bar (7 steps) — persistent top HUD
const STEPS=["Order stuck","Email sent","Customs hold","Live Translate","Discrepancy","Portal fix","Cleared"];
function timeline(){
  const bt=beat(); const prog = bt? (bt.id/11) : 0;
  const h=S(18); panel(S(6),S(4),VW-S(12),h);
  const x0=S(14), x1=VW-S(120), rail=x1-x0;
  sctx.fillStyle=C.border; sctx.fillRect(x0,S(13),rail,S(2));
  sctx.fillStyle=C.accent; sctx.fillRect(x0,S(13),rail*prog,S(2));
  for(let i=0;i<STEPS.length;i++){ const px=x0+rail*(i/(STEPS.length-1));
    const stepProg = (i+1)/STEPS.length; const done = prog>=stepProg-0.001; const curr = prog>=(i/STEPS.length) && prog<stepProg;
    dot(px,S(13), curr?S(3.2):S(2.4), done?C.green:curr?C.blue:C.panelHi);
  }
  // current step label + WS dot
  text(bt?`Beat ${bt.id}/11 · ${bt.step}`:"Ready", VW-S(112), S(9), C.muted, S(8), {align:"left",shadow:false});
  dot(VW-S(14), S(12), S(3), app.wsUp?C.green:(app.offline?C.amber:C.red));
}
// bottom controls
function controls(){
  const h=S(18), y=VH-OY - S(0); const by=VH-S(22);
  const badge = app.state.toUpperCase();
  panel(S(6), by, VW-S(12), S(18));
  text(badge, S(14), by+S(4), app.state==="waitingApproval"?C.amber:app.state==="complete"?C.green:C.muted, S(8), {shadow:false});
  const bw=S(48),g=S(4); let bx=VW/2 - (bw*4+g*3)/2;
  const mk=(l:string,fn:()=>void,fill=C.panelHi)=>{ reg(button(l,bx,by+S(2),bw,S(14),fill,C.text), fn); bx+=bw+g; };
  mk(app.state==="playing"?"Pause":"Play", ()=> app.state==="playing"?ctrl.pause():ctrl.play(), C.accent);
  mk("Next", ()=>ctrl.next());
  mk("Reset", ()=>ctrl.reset());
  mk("Replay", ()=>{ctrl.reset();ctrl.play();});
}

// ---- idle / start screen ---------------------------------------------
function startScreen(){
  drawOffice(0.6); blit();
  const w=S(200),h=S(70),x=(VW-w)/2,y=(VH-h)/2;
  panel(x,y,w,h);
  text("ClearBorder", VW/2, y+S(12), C.text, S(18), {align:"center"});
  text("AI customs clearance — Demo Mode", VW/2, y+S(34), C.muted, S(9), {align:"center"});
  reg(button("Start Demo", VW/2-S(48), y+h-S(24), S(96), S(18), C.accent, C.text, true), ()=>ctrl.play());
}

// ===================================================================
//  MAIN LOOP
// ===================================================================
let last=0;
function frame(ts:number){
  if(!last) last=ts; let dt=(ts-last)/1000; last=ts; if(dt>0.1)dt=0.1;
  clock+=dt; if(app.state==="playing") app.beatT+=dt;
  tickAgents();
  clickTargets=[];
  const bt=beat();
  if(!bt){ startScreen(); }
  else {
    const t=app.beatT;
    switch(bt.scene){
      case 0: sceneIntro(bt,t); break;
      case 1: sceneJoan(bt,t); break;
      case 2: sceneEmail(bt,t); break;
      case 3: sceneStatus(bt,t); break;
      case 4: sceneOffice(bt,t); break;
      case 5: sceneStatus(bt,t); break;
      case 6: sceneJoan(bt,t); break;
    }
    timeline();
  }
  controls();
  requestAnimationFrame(frame);
}

// ---- input ------------------------------------------------------------
window.addEventListener("keydown",(e)=>{
  if(e.key===" "){ e.preventDefault(); app.state==="playing"?ctrl.pause():ctrl.play(); }
  else if(e.key==="ArrowRight"){ ctrl.next(); }
  else if(e.key.toLowerCase()==="r"){ ctrl.reset(); }
});
screen.addEventListener("mousedown",(e)=>{
  const mx=e.clientX,my=e.clientY;
  for(const t of clickTargets){ if(hit(t.r,mx,my)){ t.fn(); return; } }
  // click anywhere else advances (like scenes 0-2), except during approval
  if(app.state!=="waitingApproval") ctrl.next();
});

let pcOn=false;
// debug hook (screenshots / manual seeking)
(window as any).__cb = { app, agents, ctrl,
  seek(i:number, t=1.6){ clearTimeout(timer); app.idx=i; app.beatT=t; const bt=app.beats[i]; app.state = bt&&bt.type==="waitForApproval"?"waitingApproval":"paused"; },
};
(async function start(){
  resize();
  await loadAssets();
  try{ await (document as any).fonts.load('16px "FS Pixel Sans"'); await (document as any).fonts.ready; }catch(_){}
  FLOOR=tinted(IMG.floor!, C.wood, 16,16);
  FLOORG=tinted(IMG.floorGrey!, "#8a90b0", 16,16);
  WALL=tinted(IMG.wall!, C.wallT, 64,128);
  connectWS();
  requestAnimationFrame(frame);
})();
