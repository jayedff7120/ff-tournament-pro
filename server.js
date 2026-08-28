const express=require("express");
const fs=require("fs");
const path=require("path");
const app=express();
const PORT=process.env.PORT||3000;
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"NSCJ@yed";
const DB=path.join(__dirname,"data.json");

const DEFAULT={
  tournament:{name:"FF ELITE BATTLE",description:"Free Fire Squad Tournament",date:"30 August 2026",time:"8:00 PM",timezone:"Bangladesh Time (GMT+6)",entryFee:"৳ 50",prizePool:"৳ 5,000",maxTeams:12,deadline:"30 August 2026, 6:00 PM",status:"REGISTRATION OPEN"},
  room:{id:"",password:"",published:false},
  payment:{bkash:"01XXXXXXXXX",nagad:"01XXXXXXXXX",bkashEnabled:true,nagadEnabled:true},
  rules:["প্রত্যেক দলে ৫ জন Player থাকতে হবে।","নির্ধারিত Match Time-এর আগে Room-এ Join করতে হবে।","Hack, Script বা unfair software ব্যবহার করলে Team disqualified হবে।","অন্য Team-এর সঙ্গে teaming করা যাবে না।","Player change শুধুমাত্র Admin-এর অনুমতিতে করা যাবে।","Result ও dispute-এর ক্ষেত্রে Admin-এর সিদ্ধান্ত final।"],
  teams:[],topups:[],results:[]
};

function load(){
  if(!fs.existsSync(DB)) fs.writeFileSync(DB,JSON.stringify(DEFAULT,null,2));
  try{return JSON.parse(fs.readFileSync(DB,"utf8"))}
  catch(e){fs.writeFileSync(DB,JSON.stringify(DEFAULT,null,2));return JSON.parse(JSON.stringify(DEFAULT))}
}
function save(d){fs.writeFileSync(DB,JSON.stringify(d,null,2))}
load();

app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

function isAdmin(req){return req.headers["x-admin-password"]===ADMIN_PASSWORD}

app.get("/api/public",(req,res)=>{
  const d=load();
  res.json({tournament:d.tournament,room:d.room,payment:d.payment,rules:d.rules,
    teamCount:d.teams.length,
    teams:d.teams.map(t=>({team_name:t.team_name,status:t.status})),
    results:d.results});
});

app.post("/api/register",(req,res)=>{
  const b=req.body||{}, d=load();
  const required=["teamName","captain","phone","p1","p2","p3","p4","p5"];
  if(required.some(k=>!String(b[k]||"").trim())) return res.status(400).json({error:"সব তথ্য পূরণ করুন।"});
  if(d.teams.length>=Number(d.tournament.maxTeams||0)) return res.status(400).json({error:"সব registration slot পূর্ণ।"});
  d.teams.unshift({id:Date.now(),team_name:b.teamName.trim(),captain_name:b.captain.trim(),phone:b.phone.trim(),
    player1:b.p1.trim(),player2:b.p2.trim(),player3:b.p3.trim(),player4:b.p4.trim(),player5:b.p5.trim(),
    status:"Pending",createdAt:new Date().toISOString()});
  save(d);res.json({ok:true});
});

app.post("/api/topup",(req,res)=>{
  const b=req.body||{},d=load(), amount=Number(b.amount);
  if(!String(b.player||"").trim()||!String(b.method||"").trim()||!amount||!String(b.txid||"").trim())
    return res.status(400).json({error:"Player, method, amount এবং Transaction ID দিন।"});
  d.topups.unshift({id:Date.now(),player:b.player.trim(),method:b.method,amount,txid:b.txid.trim(),status:"Pending",createdAt:new Date().toISOString()});
  save(d);res.json({ok:true});
});

app.get("/api/admin/all",(req,res)=>{
  if(!isAdmin(req)) return res.status(401).json({error:"Wrong password"});
  const d=load();res.json(d);
});

app.post("/api/admin/save",(req,res)=>{
  if(!isAdmin(req)) return res.status(401).json({error:"Wrong password"});
  const b=req.body||{},d=load();
  d.tournament={name:String(b.name||""),description:String(b.description||""),date:String(b.date||""),
    time:String(b.time||""),timezone:String(b.timezone||""),entryFee:String(b.entryFee||""),
    prizePool:String(b.prizePool||""),maxTeams:Number(b.maxTeams)||0,deadline:String(b.deadline||""),status:String(b.status||"")};
  d.room={id:String(b.roomId||""),password:String(b.roomPassword||""),published:!!b.roomPublished};
  d.payment={bkash:String(b.bkash||""),nagad:String(b.nagad||""),bkashEnabled:!!b.bkashEnabled,nagadEnabled:!!b.nagadEnabled};
  d.rules=String(b.rules||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  save(d);res.json({ok:true});
});

app.post("/api/admin/teams/:id/status",(req,res)=>{
  if(!isAdmin(req)) return res.status(401).json({error:"Wrong password"});
  const d=load(),t=d.teams.find(x=>String(x.id)===String(req.params.id));
  if(!t)return res.status(404).json({error:"Not found"});
  t.status=req.body.status==="Approved"?"Approved":"Pending";save(d);res.json({ok:true});
});

app.delete("/api/admin/teams/:id",(req,res)=>{
  if(!isAdmin(req))return res.status(401).json({error:"Wrong password"});
  const d=load();d.teams=d.teams.filter(x=>String(x.id)!==String(req.params.id));save(d);res.json({ok:true});
});

app.post("/api/admin/topups/:id/status",(req,res)=>{
  if(!isAdmin(req))return res.status(401).json({error:"Wrong password"});
  const d=load(),x=d.topups.find(x=>String(x.id)===String(req.params.id));
  if(!x)return res.status(404).json({error:"Not found"});
  x.status=req.body.status==="Approved"?"Approved":"Rejected";save(d);res.json({ok:true});
});

app.post("/api/admin/results",(req,res)=>{
  if(!isAdmin(req))return res.status(401).json({error:"Wrong password"});
  const b=req.body||{},d=load();
  if(!String(b.team||"").trim())return res.status(400).json({error:"Team name required"});
  d.results.push({id:Date.now(),team:String(b.team).trim(),position:String(b.position||""),kills:String(b.kills||"0"),points:String(b.points||"0")});
  save(d);res.json({ok:true});
});

app.delete("/api/admin/results/:id",(req,res)=>{
  if(!isAdmin(req))return res.status(401).json({error:"Wrong password"});
  const d=load();d.results=d.results.filter(x=>String(x.id)!==String(req.params.id));save(d);res.json({ok:true});
});

app.get("/control",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("FF Tournament running at http://localhost:"+PORT));