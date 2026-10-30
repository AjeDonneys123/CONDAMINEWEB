const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const C = require('./config');
const Didakbot = require('./didakbot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
app.use(express.static('public'));
app.get('/api/config', (_, res) => res.json({ ...C, port: undefined }));

const id = () => crypto.randomBytes(12).toString('hex');
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const clamp = n => Math.max(0, Math.min(C.initialHp, n));
const playerByToken = (room, token) => room.players.find(p => p.token === token);
const allianceCost = changes => changes < C.allianceChangeCosts.length
  ? C.allianceChangeCosts[changes] : 2 ** (changes - 1);
const aliveTarget = (room, pid) => room.players.find(p => p.id === pid);
const totalTroops = p => p.soldiers + p.generalDefense + p.targetedDefense;
function takeTroops(p, amount) {
  let left=amount;
  for(const key of ['soldiers','generalDefense','targetedDefense']){const used=Math.min(left,p[key]);p[key]-=used;left-=used;}
  return left===0;
}

function makePlayer(name, socket, host = false) {
  return { id: id(), token: id(), name: String(name || 'Anonyme').trim().slice(0, 22), avatar: ['🦊','🦉','🐺','🦁','🐙','🦅','🐲','🐯'][Math.floor(Math.random()*8)], socketId: socket.id, connected: true, ready: false, host,
    hp: C.initialHp, publicHp: C.initialHp, soldiers: 0, generalDefense: C.initialSoldiers, targetedDefense: 0, defenseTarget: null,
    ally: null, allyChanges: 0, blockedAllies: [], statement: '', likesReceived: 0, likeUsed: false,
    actionUsed: false, denunciationUsed: false, reports: [] };
}
const BOT_PERSONAS = [
  { name:'Vesper', avatar:'🦊', style:'diplomat', statement:'Je récompense la loyauté, mais je remarque chaque attaque.' },
  { name:'Orion', avatar:'🦁', style:'hawk', statement:'La force est un langage. Les petits gestes aussi.' },
  { name:'Mnémosyne', avatar:'🦉', style:'analyst', statement:'Je tiens les comptes. Tout finit par former un motif.' },
  { name:'Nox', avatar:'🐺', style:'trickster', statement:'Mes ennemis d’aujourd’hui ne sont peut-être pas ceux de demain.' },
  { name:'Iris', avatar:'🦅', style:'guardian', statement:'Je soutiendrai ceux qui savent protéger sans se montrer.' },
  { name:'Midas', avatar:'🐲', style:'opportunist', statement:'Une alliance vaut ce que chacun accepte de risquer.' },
  { name:'Sélène', avatar:'🐙', style:'diplomat', statement:'Je cherche un partenaire constant, pas un partenaire bruyant.' },
  { name:'Atlas', avatar:'🐯', style:'guardian', statement:'Je juge les actes, les risques pris et les promesses tenues.' }
];
function makeBot(room) {
  const used=new Set(room.players.filter(p=>p.bot).map(p=>p.bot.style));
  const persona=BOT_PERSONAS.find(x=>!room.players.some(p=>p.name===x.name)) || BOT_PERSONAS[room.players.length%BOT_PERSONAS.length];
  const p=makePlayer(persona.name,{id:null}); p.socketId=null;p.connected=true;p.ready=true;p.avatar=persona.avatar;p.statement=persona.statement;p.bot={style:persona.style,memory:{attackedBy:{},supported:[]},didak:Didakbot.attach(persona,room.players.filter(x=>x.bot).length)};return p;
}
function publicState(room) {
  return { code: room.code, phase: room.phase, round: room.round, totalRounds: C.totalRounds, activePlayerId: room.activePlayerId,
    deadline: room.deadline, loyalty: room.loyalty ? { players: room.loyalty.players, deadline: room.loyalty.deadline } : null,
    players: room.players.map(p => ({ id:p.id,name:p.name,avatar:p.avatar,connected:p.connected,ready:p.ready,host:p.host,bot:!!p.bot,botEngine:p.bot?(p.bot.didak?'Didakbot':'local'):null,hp:p.publicHp,statement:p.statement,likes:p.likesReceived,allyChanges:p.allyChanges })),
    log: room.log.slice(-80), latestAttack:room.latestAttack||null, roundReveal:room.roundReveal||null, results: room.results || null };
}
function privateState(p) {
  return { id:p.id, token:p.token, soldiers:p.soldiers, generalDefense:p.generalDefense,targetedDefense:p.targetedDefense,defenseTarget:p.defenseTarget,
    ally:p.ally,allyChanges:p.allyChanges,nextAllianceCost:allianceCost(p.ally ? p.allyChanges + 1 : 0),blockedAllies:p.blockedAllies,
    likeUsed:p.likeUsed,actionUsed:p.actionUsed,denunciationUsed:p.denunciationUsed,reports:p.reports.slice(-20),realHp:p.hp };
}
function emit(room) {
  io.to(room.code).emit('state', publicState(room));
  room.players.forEach(p => p.socketId && io.to(p.socketId).emit('private', privateState(p)));
}
function queueBotObservation(p,update){if(!p?.bot?.didak)return;p.bot.observationQueue=(p.bot.observationQueue||Promise.resolve()).then(()=>Didakbot.observe(p.bot.didak,update)).catch(error=>{console.warn(`[ALLIANCES observation ${p.name}]`,error.message);p.bot.didak.sessionId='';p.bot.didak.participantId='';});}
function observeBots(room,publicEvent,privateByPlayer={}){room.players.filter(p=>p.bot?.didak).forEach(p=>queueBotObservation(p,{round:room.round,publicEvent,privateEvent:privateByPlayer[p.id]||null,players:room.players.map(x=>({name:x.name,hp:x.publicHp,likes:x.likesReceived,allianceChanges:x.allyChanges,statement:x.statement}))}));}
function log(room, text) { room.log.push({ round: room.round, text, at: Date.now() }); observeBots(room,text); }
function startTurn(room) {
  clearTimeout(room.timer);
  const p = room.players[room.turnIndex];
  room.activePlayerId = p.id; p.actionUsed = false;
  room.deadline = Date.now() + C.turnSeconds * 1000;
  room.timer = setTimeout(() => finishTurn(room, true), C.turnSeconds * 1000);
  emit(room);
  if (p.bot) setTimeout(() => playBot(room,p), C.botThinkMs);
}
function chooseBotAlly(room,p) {
  const candidates=room.players.filter(x=>x!==p&&!p.blockedAllies.includes(x.id));
  candidates.sort((a,b)=>{
    const ma=p.bot.memory.attackedBy; const score=x=>(x.publicHp/10)+(x.likesReceived*2)-(ma[x.id]||0)*5;
    return score(b)-score(a);
  });
  return candidates[0];
}
function botDiplomacy(room,p) {
  const ally=aliveTarget(room,p.ally) || chooseBotAlly(room,p);
  if(ally&&p.ally!==ally.id){const change=!!p.ally;if(!change||p.hp>=C.allianceChangeHpCost){if(change){p.hp=clamp(p.hp-C.allianceChangeHpCost);p.allyChanges++;log(room,`${p.name} a changé son choix d’allié.`);}p.ally=ally.id;}}
  if(!p.likeUsed&&ally){p.likeUsed=true;ally.likesReceived++;}
}
async function didakDecision(room,p) {
  if(!p.bot.didak)return null;
  if(p.bot.observationQueue)await p.bot.observationQueue;
  const visible=room.players.map(x=>({name:x.name,hp:x.publicHp,likes:x.likesReceived,allianceChanges:x.allyChanges,statement:x.statement,isBot:!!x.bot}));
  const context={personality:p.bot.style,round:room.round,totalRounds:C.totalRounds,players:visible,publicLog:room.log.slice(-18).map(x=>x.text),self:{name:p.name,realHp:p.hp,totalSoldiers:totalTroops(p),generalDefense:p.generalDefense,targetedDefense:p.targetedDefense,chosenAlly:aliveTarget(room,p.ally)?.name||null,blockedAllies:p.blockedAllies.map(x=>aliveTarget(room,x)?.name).filter(Boolean),reports:p.reports.slice(-8)}};
  try{return await Didakbot.decide(p.bot.didak,context);}catch(error){console.warn(`[ALLIANCES Didakbot ${p.name}]`,error.message);p.bot.didak.sessionId='';p.bot.didak.participantId='';return null;}
}
function namedPlayer(room,name,p){return room.players.find(x=>x!==p&&x.name.toLowerCase()===String(name||'').trim().toLowerCase());}
async function playBot(room,p) {
  if(room.phase!=='playing'||room.activePlayerId!==p.id||p.actionUsed||room.loyalty)return;
  const ai=await didakDecision(room,p);
  if(room.phase!=='playing'||room.activePlayerId!==p.id||p.actionUsed||room.loyalty)return;
  if(ai?.statement){const nextStatement=String(ai.statement).slice(0,C.statementMaxLength);if(nextStatement!==p.statement){p.statement=nextStatement;observeBots(room,`${p.name} publie : « ${p.statement} »`);}}
  const aiAlly=namedPlayer(room,ai?.ally,p);if(aiAlly&&!p.blockedAllies.includes(aiAlly.id)&&p.ally!==aiAlly.id){const change=!!p.ally;if(!change||p.hp>=C.allianceChangeHpCost){if(change){p.hp=clamp(p.hp-C.allianceChangeHpCost);p.allyChanges++;log(room,`${p.name} a changé son choix d’allié.`);}p.ally=aiAlly.id;}}else botDiplomacy(room,p);
  const aiLike=namedPlayer(room,ai?.like,p);if(aiLike&&!p.likeUsed){p.likeUsed=true;aiLike.likesReceived++;}
  const enemies=room.players.filter(x=>x!==p&&x.id!==p.ally); const ally=aliveTarget(room,p.ally);
  const weakest=[...enemies].sort((a,b)=>a.publicHp-b.publicHp)[0], aiTarget=namedPlayer(room,ai?.target,p), aiTarget2=namedPlayer(room,ai?.target2,p);let acted=false;
  const wanted=Math.max(1,Math.min(totalTroops(p),Math.floor(Number(ai?.amount)||1)));
  if(ai?.action==='general'&&totalTroops(p)){p.generalDefense=totalTroops(p);p.soldiers=0;p.targetedDefense=0;p.defenseTarget=null;acted=true;}
  else if(ai?.action==='targeted'&&aiTarget&&totalTroops(p)){takeTroops(p,wanted);p.targetedDefense+=wanted;p.defenseTarget=aiTarget.id;acted=true;}
  else if(ai?.action==='transfer'&&aiTarget&&totalTroops(p)){takeTroops(p,wanted);aiTarget.generalDefense+=wanted;aiTarget.reports.push(`Vous avez reçu ${wanted} soldats anonymement.`);observeBots(room,`${p.name} a terminé son action.`,{[aiTarget.id]:`Vous avez reçu secrètement ${wanted} soldats.`});acted=true;}
  else if(ai?.action==='denounce'&&!p.denunciationUsed&&p.hp>=C.denunciationHpCost&&aiTarget&&aiTarget2&&aiTarget!==aiTarget2){p.denunciationUsed=true;p.hp=clamp(p.hp-C.denunciationHpCost);log(room,`${p.name} tente une dénonciation contre ${aiTarget.name} et ${aiTarget2.name}.`);if(aiTarget.ally===aiTarget2.id&&aiTarget2.ally===aiTarget.id){log(room,`Dénonciation réussie : ${aiTarget.name} et ${aiTarget2.name} passent une épreuve de loyauté.`);room.loyalty={players:[aiTarget.id,aiTarget2.id],choices:{},deadline:Date.now()+C.loyaltySeconds*1000};room.loyalty.timer=setTimeout(()=>resolveLoyalty(room),C.loyaltySeconds*1000);p.actionUsed=true;scheduleBotLoyalty(room);emit(room);return;}log(room,'La dénonciation échoue.');acted=true;}
  else if(ai?.action==='pass')acted=true;
  else if(ai?.action==='attack'&&aiTarget&&p.hp>0&&totalTroops(p)){takeTroops(p,wanted);const x=combat(p,aiTarget,wanted);p.generalDefense+=x.survivors;aiTarget.generalDefense-=x.generalLoss;aiTarget.targetedDefense-=x.targetedLoss;aiTarget.hp=clamp(aiTarget.hp-x.damage);const report=`Combat ${p.name} → ${aiTarget.name}: ${wanted} engagés, défense ${x.power}, pertes ${x.attackerLoss}/${x.generalLoss+x.targetedLoss}, dégâts ${x.damage} PV.`;p.reports.push(report);aiTarget.reports.push(report);if(aiTarget.bot)aiTarget.bot.memory.attackedBy[p.id]=(aiTarget.bot.memory.attackedBy[p.id]||0)+1;room.latestAttack={attacker:p.name,target:aiTarget.name,at:Date.now()};log(room,`${p.name} attaque ${aiTarget.name}.`);observeBots(room,`${p.name} attaque ${aiTarget.name}.`,{[p.id]:report,[aiTarget.id]:report});acted=true;}
  if(!acted){
  if(p.hp<=0&&ally&&totalTroops(p)>2){const n=Math.max(1,Math.floor(totalTroops(p)/3));takeTroops(p,n);ally.generalDefense+=n;ally.reports.push(`Vous avez reçu ${n} soldats anonymement.`);}
  else if(p.bot.style==='guardian'){p.generalDefense=totalTroops(p);p.soldiers=0;p.targetedDefense=0;p.defenseTarget=null;}
  else if(p.bot.style==='analyst'&&totalTroops(p)>5){const threat=[...enemies].sort((a,b)=>(p.bot.memory.attackedBy[b.id]||0)-(p.bot.memory.attackedBy[a.id]||0))[0];const n=Math.floor(totalTroops(p)/3);takeTroops(p,n);p.targetedDefense+=n;p.defenseTarget=threat?.id||null;}
  else if(weakest&&totalTroops(p)>1){const ratio=p.bot.style==='hawk'?.55:p.bot.style==='trickster'?.12:.3;const n=Math.max(1,Math.floor(totalTroops(p)*ratio));takeTroops(p,n);const x=combat(p,weakest,n);p.generalDefense+=x.survivors;weakest.generalDefense-=x.generalLoss;weakest.targetedDefense-=x.targetedLoss;weakest.hp=clamp(weakest.hp-x.damage);const report=`Combat ${p.name} → ${weakest.name}: ${n} engagés, défense ${x.power}, pertes ${x.attackerLoss}/${x.generalLoss+x.targetedLoss}, dégâts ${x.damage} PV.`;p.reports.push(report);weakest.reports.push(report);if(weakest.bot)weakest.bot.memory.attackedBy[p.id]=(weakest.bot.memory.attackedBy[p.id]||0)+1;log(room,`${p.name} attaque ${weakest.name}.`);}
  }
  p.actionUsed=true;emit(room);finishTurn(room);
}
function finishTurn(room, timeout = false) {
  if (room.phase !== 'playing' || room.loyalty) return;
  const p = room.players[room.turnIndex];
  if (timeout && !p.actionUsed) log(room, `${p.name} laisse expirer son tour.`);
  p.actionUsed = true; room.turnIndex++;
  if (room.turnIndex >= room.players.length) return finishRound(room);
  startTurn(room);
}
function finishRound(room) {
  clearTimeout(room.timer);
  const previousHp = new Map(room.players.map(p => [p.id, p.publicHp]));
  room.players.forEach(p => {
    if (p.likesReceived >= C.likesForBonus) p.hp = clamp(p.hp + C.likeHpBonus);
    p.publicHp = p.hp;
  });
  const evolution = room.players.map(p => {
    const before=previousHp.get(p.id), delta=p.publicHp-before;
    return `${p.name} ${before}→${p.publicHp} PV${delta===0?'':` (${delta>0?'+':''}${delta})`}`;
  }).join(' · ');
  room.roundReveal={round:room.round,players:room.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,before:previousHp.get(p.id),after:p.publicHp,lost:Math.max(0,previousHp.get(p.id)-p.publicHp)}))};
  log(room, `Révélation des PV : ${evolution}.`);
  if (room.round >= C.totalRounds) return finishGame(room);
  room.round++; room.turnIndex = 0;
  room.players.forEach(p => { p.generalDefense += C.soldiersPerRound; p.likesReceived=0; p.likeUsed=false; p.denunciationUsed=false; });
  log(room, `Début du tour ${room.round} : chacun reçoit ${C.soldiersPerRound} soldats placés en défense générale.`);
  startTurn(room);
}
function finishGame(room) {
  room.phase='finished'; room.activePlayerId=null; room.deadline=null;
  const pairs=[];
  room.players.forEach(p => { const q=aliveTarget(room,p.ally); if(q && q.ally===p.id && p.id<q.id) pairs.push({members:[p.id,q.id],names:[p.name,q.name],score:p.hp+q.hp}); });
  const rankings = pairs.length ? pairs.sort((a,b)=>b.score-a.score) : room.players.map(p=>({members:[p.id],names:[p.name],score:p.hp})).sort((a,b)=>b.score-a.score);
  room.results={ pairs, rankings, choices:room.players.map(p=>({player:p.name,ally:aliveTarget(room,p.ally)?.name||'Personne'})) };
  log(room, pairs.length ? 'Les alliances finales sont révélées.' : 'Aucune alliance réciproque : classement individuel.'); emit(room);
}
function combat(attacker, defender, committed) {
  const targeted = defender.defenseTarget===attacker.id ? defender.targetedDefense : 0;
  const power = defender.generalDefense + targeted*C.targetedDefenseMultiplier;
  const total = Math.max(1, committed+power); const balance = Math.min(committed,power)/Math.max(committed,power,1);
  const attackerLoss = Math.min(committed, Math.round(committed*C.combat.balancedLossRate*balance));
  const generalLoss = Math.min(defender.generalDefense, Math.round(committed*power/total*0.55));
  const remainingLoss = Math.max(0, Math.round(committed*power/total*0.55)-generalLoss);
  const targetedLoss = Math.min(defender.targetedDefense, remainingLoss);
  const advantage = Math.max(0, committed-power);
  const pressureDamage = C.combat.damageScale * committed / Math.max(1, committed + power);
  const damage = Math.min(C.combat.maxDamage, Math.max(C.combat.minimumDamage, Math.round(pressureDamage + advantage*C.combat.breakthroughDamagePerSoldier)));
  return {power,attackerLoss,generalLoss,targetedLoss,damage,survivors:committed-attackerLoss};
}
function resolveLoyalty(room) {
  const test=room.loyalty; if(!test) return;
  clearTimeout(test.timer); const [a,b]=test.players.map(x=>aliveTarget(room,x));
  const ca=test.choices[a.id]||'faithful', cb=test.choices[b.id]||'faithful';
  if(ca==='faithful'&&cb==='faithful'){a.hp=clamp(a.hp-C.loyalty.faithfulBoth);b.hp=clamp(b.hp-C.loyalty.faithfulBoth);}
  else if(ca==='betray'&&cb==='faithful'){a.soldiers+=C.loyalty.betrayerSoldiers;b.hp=clamp(b.hp-C.loyalty.betrayedFaithful);}
  else if(cb==='betray'&&ca==='faithful'){b.soldiers+=C.loyalty.betrayerSoldiers;a.hp=clamp(a.hp-C.loyalty.betrayedFaithful);}
  else {a.hp=clamp(a.hp-C.loyalty.betrayBoth);b.hp=clamp(b.hp-C.loyalty.betrayBoth);}
  if(ca==='betray'||cb==='betray'){a.ally=null;b.ally=null;if(ca==='betray')a.blockedAllies.push(b.id);if(cb==='betray')b.blockedAllies.push(a.id);}
  a.reports.push('Épreuve résolue. Votre choix : '+(ca==='betray'?'trahir':'fidélité')+'.'); b.reports.push('Épreuve résolue. Votre choix : '+(cb==='betray'?'trahir':'fidélité')+'.');
  log(room, `L'épreuve de loyauté de ${a.name} et ${b.name} est résolue. Les choix restent secrets.`); room.loyalty=null; finishTurn(room);
}
function scheduleBotLoyalty(room) {
  if(!room.loyalty)return;room.loyalty.players.forEach(pid=>{const p=aliveTarget(room,pid);if(p?.bot&&!room.loyalty.choices[pid])setTimeout(()=>{if(!room.loyalty||room.loyalty.choices[pid])return;const partner=aliveTarget(room,room.loyalty.players.find(x=>x!==pid));const betray=p.bot.style==='opportunist'||p.hp<30||p.blockedAllies.includes(partner?.id);room.loyalty.choices[pid]=betray?'betray':'faithful';if(Object.keys(room.loyalty.choices).length===2)resolveLoyalty(room);else emit(room);},C.botThinkMs);});
}

io.on('connection', socket => {
  socket.on('create', ({name}={}, cb=()=>{}) => { let c; do c=code(); while(rooms.has(c)); const p=makePlayer(name,socket,true); const room={code:c,players:[p],phase:'lobby',round:0,turnIndex:0,activePlayerId:null,deadline:null,log:[]}; rooms.set(c,room); socket.join(c); socket.data={code:c,token:p.token}; emit(room); cb({ok:true,code:c,token:p.token}); });
  socket.on('join', ({code:raw,name,token}={}, cb=()=>{}) => { const c=String(raw||'').toUpperCase(); const room=rooms.get(c); if(!room)return cb({error:'Salon introuvable.'}); let p=token&&playerByToken(room,token); if(p){p.socketId=socket.id;p.connected=true;} else {if(room.phase!=='lobby'||room.players.length>=C.maxPlayers)return cb({error:'Salon fermé ou complet.'});p=makePlayer(name,socket);room.players.push(p);} socket.join(c);socket.data={code:c,token:p.token};emit(room);cb({ok:true,code:c,token:p.token}); });
  const withPlayer = fn => (payload={}, cb=()=>{}) => { const room=rooms.get(socket.data?.code); const p=room&&playerByToken(room,socket.data.token); if(!room||!p)return cb({error:'Session invalide.'}); try{fn(room,p,payload,cb);}catch(e){cb({error:e.message});} };
  socket.on('ready',withPlayer((r,p)=>{p.ready=!p.ready;emit(r);}));
  socket.on('addBot',withPlayer((r,p,_,cb)=>{if(!p.host)throw Error('Réservé à l’hôte.');if(r.phase!=='lobby'||r.players.length>=C.maxPlayers)throw Error('Impossible d’ajouter un bot.');r.players.push(makeBot(r));emit(r);cb({ok:true});}));
  socket.on('fillBots',withPlayer((r,p,_,cb)=>{if(!p.host)throw Error('Réservé à l’hôte.');if(r.phase!=='lobby')throw Error('La partie a déjà commencé.');while(r.players.length<C.minPlayers&&r.players.length<C.maxPlayers)r.players.push(makeBot(r));emit(r);cb({ok:true,count:r.players.length});}));
  socket.on('removeBot',withPlayer((r,p,_,cb)=>{if(!p.host)throw Error('Réservé à l’hôte.');const i=r.players.map(x=>x.bot).lastIndexOf(true);if(i<0)throw Error('Aucun bot à retirer.');r.players.splice(i,1);emit(r);cb({ok:true});}));
  socket.on('start',withPlayer((r,p,_,cb)=>{if(!p.host)throw Error('Réservé à l’hôte.');if(r.players.length<C.minPlayers)throw Error(`Il faut ${C.minPlayers} joueurs.`);if(!r.players.every(x=>x.ready||x.host))throw Error('Tous les joueurs doivent être prêts.');r.phase='playing';r.round=1;r.turnIndex=0;r.players.forEach(x=>x.generalDefense+=C.soldiersPerRound);log(r,`La partie commence. Chacun reçoit ${C.soldiersPerRound} soldats placés en défense générale.`);startTurn(r);cb({ok:true});}));
  socket.on('ally',withPlayer((r,p,{target},cb)=>{const q=aliveTarget(r,target);if(!q||q===p)throw Error('Allié invalide.');if(p.blockedAllies.includes(q.id))throw Error('Ce joueur ne peut plus être choisi.');if(p.ally===q.id)return cb({ok:true});const isChange=!!p.ally;if(isChange&&p.hp<C.allianceChangeHpCost)throw Error(`Il faut ${C.allianceChangeHpCost} PV pour changer d’allié.`);if(isChange){p.hp=clamp(p.hp-C.allianceChangeHpCost);p.allyChanges++;log(r,`${p.name} a changé son choix d’allié.`);}p.ally=q.id;emit(r);cb({ok:true});}));
  socket.on('statement',withPlayer((r,p,{text})=>{p.statement=String(text||'').trim().slice(0,C.statementMaxLength);observeBots(r,`${p.name} publie : « ${p.statement} »`);emit(r);}));
  socket.on('like',withPlayer((r,p,{target},cb)=>{const q=aliveTarget(r,target);if(!q||q===p)throw Error('Destinataire invalide.');if(p.likeUsed)throw Error('Like déjà distribué.');p.likeUsed=true;q.likesReceived++;observeBots(r,`${q.name} reçoit un soutien anonyme.`);emit(r);cb({ok:true});}));
  socket.on('action',withPlayer((r,p,a,cb)=>{if(r.phase!=='playing'||r.activePlayerId!==p.id||p.actionUsed||r.loyalty)throw Error('Ce n’est pas votre tour.');const amount=Math.floor(Number(a.amount));const q=aliveTarget(r,a.target);
    if(a.type==='allocation'){const attack=Math.floor(Number(a.attack)),general=Math.floor(Number(a.general)),special=Math.floor(Number(a.special)),available=totalTroops(p);if([attack,general,special].some(n=>!Number.isFinite(n)||n<0)||attack+general+special!==available)throw Error(`Répartissez exactement vos ${available} soldats.`);if((attack>0||special>0)&&(!q||q===p))throw Error('Choisissez un joueur cible.');if(attack>0&&p.hp<=0)throw Error('Vous ne pouvez pas attaquer avec 0 PV.');p.soldiers=0;p.generalDefense=general;p.targetedDefense=special;p.defenseTarget=special>0?q.id:null;if(attack>0){const x=combat(p,q,attack);p.generalDefense+=x.survivors;q.generalDefense-=x.generalLoss;q.targetedDefense-=x.targetedLoss;q.hp=clamp(q.hp-x.damage);const report=`Combat ${p.name} → ${q.name}: ${attack} engagés, défense ${x.power}, pertes ${x.attackerLoss}/${x.generalLoss+x.targetedLoss}, dégâts ${x.damage} PV.`;p.reports.push(report);q.reports.push(report);log(r,`${p.name} attaque ${q.name}.`);observeBots(r,`${p.name} attaque ${q.name}.`,{[p.id]:report,[q.id]:report});}
    } else if(a.type==='attack'){if(p.hp<=0)throw Error('Vous avez 0 PV.');if(!q||q===p||amount<1||amount>totalTroops(p))throw Error('Attaque invalide.');takeTroops(p,amount);const x=combat(p,q,amount);p.generalDefense+=x.survivors;q.generalDefense-=x.generalLoss;q.targetedDefense-=x.targetedLoss;q.hp=clamp(q.hp-x.damage);const report=`Combat ${p.name} → ${q.name}: ${amount} engagés, défense ${x.power}, pertes ${x.attackerLoss}/${x.generalLoss+x.targetedLoss}, dégâts ${x.damage} PV.`;p.reports.push(report);q.reports.push(report);r.latestAttack={attacker:p.name,target:q.name,at:Date.now()};log(r,`${p.name} attaque ${q.name}.`);observeBots(r,`${p.name} attaque ${q.name}.`,{[p.id]:report,[q.id]:report});
    } else if(a.type==='general'){p.generalDefense=totalTroops(p);p.soldiers=0;p.targetedDefense=0;p.defenseTarget=null;}
    else if(a.type==='targeted'){if(!q||q===p||amount<1||amount>totalTroops(p))throw Error('Défense invalide.');takeTroops(p,amount);p.targetedDefense+=amount;p.defenseTarget=q.id;}
    else if(a.type==='transfer'){if(!q||q===p||amount<1||amount>totalTroops(p))throw Error('Transfert invalide.');takeTroops(p,amount);q.generalDefense+=amount;q.reports.push(`Vous avez reçu ${amount} soldats anonymement.`);observeBots(r,`${p.name} a terminé son action.`,{[q.id]:`Vous avez reçu secrètement ${amount} soldats.`});}
    else if(a.type==='denounce'){const q2=aliveTarget(r,a.target2);if(p.denunciationUsed||p.hp<C.denunciationHpCost||!q||!q2||q===q2||q===p||q2===p)throw Error('Dénonciation invalide.');p.denunciationUsed=true;p.hp=clamp(p.hp-C.denunciationHpCost);log(r,`${p.name} tente une dénonciation contre ${q.name} et ${q2.name}.`);if(q.ally===q2.id&&q2.ally===q.id){log(r,`Dénonciation réussie : ${q.name} et ${q2.name} passent une épreuve de loyauté.`);r.loyalty={players:[q.id,q2.id],choices:{},deadline:Date.now()+C.loyaltySeconds*1000};r.loyalty.timer=setTimeout(()=>resolveLoyalty(r),C.loyaltySeconds*1000);p.actionUsed=true;scheduleBotLoyalty(r);emit(r);return cb({ok:true});}log(r,'La dénonciation échoue.');}
    else if(a.type!=='pass')throw Error('Action inconnue.');p.actionUsed=true;cb({ok:true});finishTurn(r);
  }));
  socket.on('loyalty',withPlayer((r,p,{choice},cb)=>{if(!r.loyalty||!r.loyalty.players.includes(p.id)||r.loyalty.choices[p.id])throw Error('Choix indisponible.');if(!['faithful','betray'].includes(choice))throw Error('Choix invalide.');r.loyalty.choices[p.id]=choice;cb({ok:true});if(Object.keys(r.loyalty.choices).length===2)resolveLoyalty(r);else emit(r);}));
  socket.on('disconnect',()=>{const r=rooms.get(socket.data?.code);const p=r&&playerByToken(r,socket.data.token);if(p){p.connected=false;emit(r);}});
});
server.listen(C.port,()=>console.log(`ALLIANCES sur http://localhost:${C.port}`));
