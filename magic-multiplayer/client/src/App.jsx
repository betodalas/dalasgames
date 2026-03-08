import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";

const imageCache = {};
const fetchCardImage = async (name) => {
  if (imageCache[name] !== undefined) return imageCache[name];
  imageCache[name] = null;
  try {
    // Tenta busca exata primeiro
    let res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
    if (!res.ok) {
      // Fallback: busca fuzzy (encontra cartas com nome parecido)
      res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
    }
    if (!res.ok) return null;
    const data = await res.json();
    const url = data?.image_uris?.normal || data?.card_faces?.[0]?.image_uris?.normal || null;
    imageCache[name] = url;
    return url;
  } catch { return null; }
};

const COLOR_STYLES = {
  W: { bg:"linear-gradient(135deg,#f8f3e3,#e8d5a3)", border:"#c9a84c", text:"#5a4a1a" },
  U: { bg:"linear-gradient(135deg,#1a3a6e,#2d5fa8)", border:"#4a90d9", text:"#c8e0ff" },
  B: { bg:"linear-gradient(135deg,#0d0d0d,#2a1a2e)", border:"#6a3fa0", text:"#d0b8e8" },
  R: { bg:"linear-gradient(135deg,#5c1a0a,#c0392b)", border:"#e74c3c", text:"#ffd0c8" },
  G: { bg:"linear-gradient(135deg,#0a2e0a,#1e6b2e)", border:"#27ae60", text:"#b8f0c8" },
  land: { bg:"linear-gradient(135deg,#2a2010,#4a3820)", border:"#8b6914", text:"#d4b896" },
  multi: { bg:"linear-gradient(135deg,#3d2a0a,#6b4a1a)", border:"#d4a017", text:"#ffe8a0" },
};

const getCardStyle = (card) => {
  if (!card || card.hidden) return { bg:"#1a1a2e", border:"#2a2a4e", text:"#4a4a6a" };
  if (card.type === "land") return COLOR_STYLES.land;
  if (!card.colors || card.colors.length === 0) return COLOR_STYLES.land;
  if (card.colors.length > 1) return COLOR_STYLES.multi;
  return COLOR_STYLES[card.colors[0]] || COLOR_STYLES.land;
};

const calcCMC = (cost) => {
  if (!cost) return 0;
  return Object.values(cost).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
};

const STEP_COLORS = { untap:"#74b9ff", upkeep:"#a29bfe", draw:"#55efc4", main1:"#fdcb6e", combat:"#e17055", main2:"#fdcb6e", end:"#636e72" };
const STEP_LABELS = { untap:"🔄 Desvirar", upkeep:"⬆️ Manutenção", draw:"📖 Comprar", main1:"1️⃣ Principal 1", combat:"⚔️ Combate", main2:"2️⃣ Principal 2", end:"🌙 Fim" };

const logColor = (type) => ({ error:"#ff8888", combat:"#ffd166", system:"#06d6a0", mana:"#74b9ff", destroy:"#fd79a8", draw:"#a29bfe", buff:"#55efc4", spell:"#fdcb6e", play:"#b8f0c8" }[type] || "#8a8a9a");

const btn = (color, bg, big=false) => ({
  background: bg, border:`1.5px solid ${color}`, color, padding: big?"10px 18px":"7px 14px",
  borderRadius:"5px", cursor:"pointer", fontFamily:"'Cinzel',serif", fontSize: big?"13px":"12px",
  letterSpacing:".05em", transition:"all .2s", whiteSpace:"nowrap",
});

// ── Card Image ──
function CardImage({ name, style={} }) {
  const [url, setUrl] = useState(imageCache[name] || null);
  const [loading, setLoading] = useState(!imageCache[name]);
  useEffect(() => {
    if (!url && name) {
      setLoading(true);
      fetchCardImage(name).then(u => {
        setLoading(false);
        if (u) setUrl(u);
      });
    }
  }, [name]);
  if (loading) return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"4px",...style}}>
      <div style={{fontSize:"16px",animation:"pulse 1s infinite"}}>🃏</div>
      <div style={{fontSize:"7px",color:"#4a6a8a",textAlign:"center",padding:"0 4px",lineHeight:"1.2"}}>{name}</div>
    </div>
  );
  if (!url) return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"4px",background:"rgba(0,0,0,.3)",...style}}>
      <div style={{fontSize:"20px"}}>🃏</div>
      <div style={{fontSize:"7px",color:"#6a8aaa",textAlign:"center",padding:"0 4px",lineHeight:"1.2",fontFamily:"serif"}}>{name}</div>
    </div>
  );
  return <img src={url} alt={name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",...style}} />;
}

// ── Traduções para português ──
const CARD_PT = {
  "Serra Angel":       { nome:"Serra Angel",         tipo:"Criatura — Anjo" },
  "Savannah Lions":    { nome:"Leões de Savannah",   tipo:"Criatura — Felino" },
  "Wrath of God":      { nome:"Ira de Deus",         tipo:"Feitiço" },
  "Swords to Plowshares": { nome:"Espadas em Arados", tipo:"Instantâneo" },
  "White Knight":      { nome:"Cavaleiro Branco",    tipo:"Criatura — Cavaleiro" },
  "Counterspell":      { nome:"Contrafeitiço",       tipo:"Instantâneo" },
  "Air Elemental":     { nome:"Elemental do Ar",     tipo:"Criatura — Elemental" },
  "Brainstorm":        { nome:"Tempestade Mental",   tipo:"Instantâneo" },
  "Dark Ritual":       { nome:"Ritual Negro",        tipo:"Instantâneo" },
  "Hypnotic Specter":  { nome:"Espectro Hipnótico",  tipo:"Criatura — Espectro" },
  "Terror":            { nome:"Terror",              tipo:"Instantâneo" },
  "Lord of the Pit":   { nome:"Senhor do Abismo",    tipo:"Criatura — Demônio" },
  "Lightning Bolt":    { nome:"Raio",                tipo:"Instantâneo" },
  "Shivan Dragon":     { nome:"Dragão de Shivan",    tipo:"Criatura — Dragão" },
  "Fireball":          { nome:"Bola de Fogo",        tipo:"Feitiço" },
  "Goblin Raider":     { nome:"Saqueador Goblin",    tipo:"Criatura — Goblin" },
  "Giant Growth":      { nome:"Crescimento Gigante", tipo:"Instantâneo" },
  "Craw Wurm":         { nome:"Verme Craw",          tipo:"Criatura — Verme" },
  "Llanowar Elves":    { nome:"Elfos de Llanowar",   tipo:"Criatura — Elfo Druida" },
  "Force of Nature":   { nome:"Força da Natureza",   tipo:"Criatura — Elemental" },
  "Plains":            { nome:"Planície",            tipo:"Terra Básica" },
  "Island":            { nome:"Ilha",                tipo:"Terra Básica" },
  "Swamp":             { nome:"Pântano",             tipo:"Terra Básica" },
  "Mountain":          { nome:"Montanha",            tipo:"Terra Básica" },
  "Forest":            { nome:"Floresta",            tipo:"Terra Básica" },
};

const ABILITY_PT = {
  flying:       "🦅 Voar",
  vigilance:    "👁️ Vigilância",
  first_strike: "⚡ Ataque Duplo",
  haste:        "💨 Ímpeto",
  trample:      "🐾 Atropelar",
  tap_mana:     "🌿 Produz Mana",
};

const EFFECT_PT = {
  destroy_all_creatures: "💥 Destrói todas as criaturas.",
  exile_creature:        "✨ Exila uma criatura alvo.",
  destroy_creature:      "☠️ Destrói uma criatura alvo.",
  deal_3_damage:         "⚡ Causa 3 pontos de dano a qualquer alvo.",
  deal_4_damage:         "🔥 Causa 4 pontos de dano a qualquer alvo.",
  draw_3:                "🧠 Compre 3 cartas.",
  add_3_black_mana:      "💀 Adicione 3 manas pretos à sua reserva.",
  pump_creature:         "💪 Criatura alvo recebe +3/+3 até o fim do turno.",
  counter_spell:         "🌊 Contramagica um feitiço alvo.",
};

const MANA_NOME = { W:"Branco", U:"Azul", B:"Preto", R:"Vermelho", G:"Verde" };
const RARITY_PT = { common:"◆ Comum", uncommon:"◆◆ Incomum", rare:"◆◆◆ Rara" };

const MANA_ICON = { W:"☀️", U:"💧", B:"💀", R:"🔥", G:"🌿" };

const tipoPT = (card) => {
  if (card.type==="land") return "Terra";
  if (card.type==="creature") return `Criatura${card.subtype?" — "+card.subtype:""}`;
  if (card.type==="instant") return "Instantâneo";
  if (card.type==="sorcery") return "Feitiço";
  return card.type;
};

const custoIcones = (cost) => {
  const icons = [];
  for (const [k,v] of Object.entries(cost)) {
    if (typeof v !== "number" || v === 0) continue;
    if (k === "generic") { icons.push(<span key="gen" style={{background:"rgba(100,100,100,.4)",borderRadius:"50%",width:"18px",height:"18px",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:"#aaa",fontWeight:"bold"}}>{v}</span>); }
    else { for (let i=0;i<v;i++) icons.push(<span key={k+i} style={{fontSize:"14px"}}>{MANA_ICON[k]||k}</span>); }
  }
  return icons;
};

// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("menu");
  const [socket, setSocket] = useState(null);
  const [gs, setGs] = useState(null);
  const [myIndex, setMyIndex] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem("mtg_name") || "");
  const [selColors, setSelColors] = useState(() => { try { return JSON.parse(sessionStorage.getItem("mtg_colors")) || ["R","G"]; } catch { return ["R","G"]; }});
  const [error, setError] = useState("");
  const [waitMsg, setWaitMsg] = useState("");
  const [selCard, setSelCard] = useState(null);
  const [targetMode, setTargetMode] = useState(null);
  const [hovered, setHovered] = useState(null);
  const logRef = useRef(null);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [gs?.log]);

  const showError = (msg) => { setError(msg); setTimeout(()=>setError(""), 3000); };

  const connect = useCallback(() => {
    const s = io(SERVER_URL, { transports:["websocket","polling"] });
    s.on("room_created", ({code}) => { setRoomCode(code); setWaitMsg(`Código: ${code}`); setScreen("lobby"); });
    s.on("waiting", ({msg}) => setWaitMsg(msg));
    s.on("game_state", (state) => { setMyIndex(state.myIndex); setGs(state); setScreen("game"); });
    s.on("error", ({msg}) => { if (msg !== "Sala cheia!") showError(msg); });
    s.on("rejoin_failed", () => {
      // Sala não existe mais, limpa sessão e volta pro menu
      sessionStorage.removeItem("mtg_room");
      sessionStorage.removeItem("mtg_name");
      sessionStorage.removeItem("mtg_colors");
      setScreen("menu");
      showError("Sessão expirada. Por favor, crie ou entre em uma nova sala.");
    });
    setSocket(s);
    return s;
  }, []);

  // ── Reconexão automática ao recarregar ──
  useEffect(() => {
    const savedRoom = sessionStorage.getItem("mtg_room");
    const savedName = sessionStorage.getItem("mtg_name");
    const savedColors = (() => { try { return JSON.parse(sessionStorage.getItem("mtg_colors")); } catch { return null; }})();
    if (savedRoom && savedName) {
      setWaitMsg("Reconectando...");
      setScreen("lobby");
      const s = connect();
      s.emit("rejoin_room", { code: savedRoom, name: savedName, colors: savedColors || ["R","G"] });
    }
  }, []);

  // ── Salva sessão sempre que entrar num jogo ──
  useEffect(() => {
    if (screen === "game" && myIndex !== null && gs) {
      const code = gs.players ? sessionStorage.getItem("mtg_room") : null;
      if (code) return; // já salvo
    }
  }, [screen, myIndex]);

  const saveSession = (code, name, colors) => {
    sessionStorage.setItem("mtg_room", code);
    sessionStorage.setItem("mtg_name", name);
    sessionStorage.setItem("mtg_colors", JSON.stringify(colors));
  };

  const emit = useCallback((ev, data) => { if (socket) socket.emit(ev, data); }, [socket]);

  const me = gs ? gs.players[myIndex] : null;
  const opp = gs ? gs.players[1-myIndex] : null;
  const isMy = gs && gs.turn === myIndex;
  const isDef = gs && gs.turn !== myIndex;
  const step = gs?.step;
  const cp = gs?.combatPhase;
  const atks = gs?.attackers || [];
  const blks = gs?.blockers || {};

  const affordable = (card) => {
    if (!me || card.type==="land") return true;
    const pool = {...me.manaPool};
    for (const [k,v] of Object.entries(card.cost||{})) {
      if (k==="generic"||typeof v!=="number") continue;
      if ((pool[k]||0)<v) return false;
      pool[k]-=v;
    }
    const gen = typeof (card.cost||{}).generic==="number"?(card.cost||{}).generic:0;
    return Object.values(pool).reduce((a,b)=>a+b,0)>=gen;
  };

  const clickHand = (card) => {
    if (!isMy) return;
    if (card.type==="land") { if (["main1","main2"].includes(step)) emit("play_land",{cardUid:card.uid}); return; }
    if (!["main1","main2","combat"].includes(step)) return;
    if (!affordable(card)) { showError("Mana insuficiente!"); return; }
    const needs = card.effect && ["destroy_creature","exile_creature","deal_3_damage","deal_4_damage","pump_creature"].includes(card.effect);
    if (needs) { setSelCard(card.uid); setTargetMode(card.effect==="pump_creature"?"my":"opp"); }
    else emit("cast_card",{cardUid:card.uid});
  };

  const clickCreature = (card, isOpp) => {
    // Se está no modo de selecionar alvo para feitiço
    if (selCard && targetMode) {
      if ((targetMode==="opp"&&isOpp)||(targetMode==="my"&&!isOpp)) {
        emit("cast_card",{cardUid:selCard,targetUid:card.uid});
        setSelCard(null); setTargetMode(null);
      }
      return;
    }
    // Llanowar Elves e tap_mana — só fora do combate
    if (isMy && !isOpp && card.abilities && card.abilities.includes("tap_mana") && !card.tapped && !card.summoningSick && cp !== "declare_attackers") {
      emit("tap_creature", {cardUid: card.uid});
      return;
    }
    // Selecionar atacante
    if (isMy && cp==="declare_attackers" && !isOpp) {
      if (card.tapped || card.summoningSick) {
        showError(card.summoningSick ? "💤 Doença de invocação! Espere o próximo turno." : "Criatura já está virada!");
        return;
      }
      emit("toggle_attacker",{cardUid:card.uid});
      return;
    }
    // Selecionar bloqueador
    if (isDef && cp==="declare_blockers" && !isOpp && atks.length>0) {
      const first = atks.find(a=>!blks[a]);
      if (first) emit("toggle_blocker",{blockerUid:card.uid,attackerUid:first});
    }
  };

  if (screen==="menu") return <Menu name={playerName} setName={setPlayerName} colors={selColors} setColors={setSelColors} code={joinCode} setCode={setJoinCode} error={error}
    onCreate={()=>{ if(!playerName.trim()){showError("Digite seu nome!");return;} const s=connect(); s.on("room_created",({code})=>{ saveSession(code,playerName,selColors); }); s.emit("create_room",{name:playerName,colors:selColors}); s.emit("set_player_info",{name:playerName,colors:selColors}); }}
    onJoin={()=>{ if(!playerName.trim()||!joinCode.trim()){showError("Preencha nome e código!");return;} const s=connect(); saveSession(joinCode.trim().toUpperCase(),playerName,selColors); s.emit("join_room",{code:joinCode.trim().toUpperCase(),name:playerName,colors:selColors}); }}
  />;
  if (screen==="lobby") return <Lobby code={roomCode} msg={waitMsg} />;
  if (!gs||!me||!opp) return <div style={{color:"#fff",display:"flex",height:"100vh",alignItems:"center",justifyContent:"center",fontFamily:"serif",fontSize:"18px"}}>🔮 Conectando...</div>;

  return (
    <div style={{fontFamily:"'Cinzel',serif",background:"#060809",minHeight:"100vh",color:"#e8d5a3",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital@1&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#080a0c;} ::-webkit-scrollbar-thumb{background:#2a1e0a;border-radius:2px;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes atk{0%,100%{box-shadow:0 0 14px #e1705580}50%{box-shadow:0 0 32px #e17055,0 0 8px #ff7040}}
        @keyframes tgt{0%,100%{box-shadow:0 0 10px #55efc460}50%{box-shadow:0 0 26px #55efc4}}
        @keyframes fadeIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
        .hcard{transition:transform .18s,box-shadow .18s,border-color .18s;}
        .hcard:hover{transform:translateY(-18px) scale(1.07)!important;z-index:200!important;}
        .bcard{transition:transform .15s,box-shadow .15s;}
        .bcard:hover{transform:scale(1.1);z-index:60;}
      `}</style>

      {/* ZOOM PREVIEW — painel grande com detalhes em português */}
      {hovered?.name && (
        <div style={{position:"fixed",left:"14px",bottom:"160px",zIndex:600,pointerEvents:"none",animation:"fadeIn .12s ease",display:"flex",gap:"10px",alignItems:"flex-start"}}>
          {/* Imagem grande */}
          <div style={{width:"280px",height:"392px",borderRadius:"14px",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.98),0 0 60px rgba(0,0,0,.7)",border:"2px solid #c9a84c",flexShrink:0}}>
            <CardImage name={hovered.name} />
          </div>
          {/* Painel de info em português */}
          <div style={{width:"200px",background:"linear-gradient(160deg,#0a0e18,#111820)",border:"1px solid #1e2e40",borderRadius:"12px",padding:"14px",boxShadow:"0 12px 40px rgba(0,0,0,.9)",fontSize:"12px",color:"#c8d8e8",display:"flex",flexDirection:"column",gap:"8px"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontWeight:"700",fontSize:"14px",color:"#f0d48a",borderBottom:"1px solid #1e2e40",paddingBottom:"8px",lineHeight:"1.3"}}>{CARD_PT[hovered.name]?.nome || hovered.name}</div>
            <div style={{fontSize:"10px",color:"#6a8aaa",letterSpacing:".08em"}}>{CARD_PT[hovered.name]?.tipo || tipoPT(hovered)}</div>
            {hovered.type==="creature" && <div style={{background:"rgba(0,0,0,.5)",border:"1px solid #2a3a4a",borderRadius:"6px",padding:"5px 8px",textAlign:"center",fontFamily:"'Cinzel',serif",fontSize:"18px",color:"#f0d48a",letterSpacing:".1em"}}>{hovered.power}/{hovered.toughness}</div>}
            {hovered.cost && <div style={{display:"flex",flexWrap:"wrap",gap:"3px",alignItems:"center"}}><span style={{fontSize:"10px",color:"#4a6a8a",marginRight:"3px"}}>Custo:</span>{custoIcones(hovered.cost)}</div>}
            {(hovered.abilities?.length > 0) && <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>{hovered.abilities.map(a=><span key={a} style={{background:"rgba(255,200,80,.08)",border:"1px solid #3a2a08",borderRadius:"4px",padding:"2px 6px",fontSize:"10px",color:"#d4a030"}}>{ABILITY_PT[a]||a}</span>)}</div>}
            {hovered.effect && <div style={{fontSize:"11px",color:"#90b8d0",lineHeight:"1.5",background:"rgba(0,0,0,.4)",borderRadius:"6px",padding:"6px 8px",borderLeft:"2px solid #2a5070"}}>{EFFECT_PT[hovered.effect] || hovered.effect}</div>}
            {hovered.type==="land" && hovered.produces && <div style={{fontSize:"11px",color:"#70c090"}}>✨ Produz: {hovered.produces.map(m=>MANA_NOME[m]).join(", ")}</div>}
            <div style={{fontSize:"10px",color:"#2a4a6a",textTransform:"uppercase",letterSpacing:".1em",marginTop:"2px"}}>{RARITY_PT[hovered.rarity]||""}</div>
          </div>
        </div>
      )}

      {/* ── OPPONENT ── */}
      <div style={{background:"linear-gradient(180deg,#070e1c,#0b1626)",borderBottom:"2px solid #0c1b2e",padding:"8px 16px",flexShrink:0}}>
        <PBar player={opp} active={!isMy} />
        <div style={{display:"flex",gap:"4px",marginBottom:"5px",justifyContent:"flex-end"}}>
          {opp.hand.map((_,i)=><div key={i} style={{width:"44px",height:"62px",borderRadius:"7px",background:"linear-gradient(135deg,#18284a,#0c1630)",border:"1px solid #1a3058",flexShrink:0}}/>)}
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",minHeight:"90px",alignItems:"center"}}>
          {opp.battlefield.filter(c=>c.type==="land").map(c=><BCard key={c.uid} card={c} atk={false} blk={false} tgt={false} onClick={()=>{}} onHov={setHovered}/>)}
          {opp.battlefield.filter(c=>c.type==="land").length>0&&opp.battlefield.filter(c=>c.type!=="land").length>0&&<div style={{width:"1px",height:"80px",background:"#0e1d2e",flexShrink:0}}/>}
          {opp.battlefield.filter(c=>c.type!=="land").map(c=><BCard key={c.uid} card={c} atk={atks.includes(c.uid)} blk={Object.values(blks).includes(c.uid)} tgt={targetMode==="opp"} onClick={()=>clickCreature(c,true)} onHov={setHovered}/>)}
        </div>
      </div>

      {/* ── CENTER ── */}
      <div style={{flex:1,display:"flex",gap:"10px",padding:"8px 16px",background:"radial-gradient(ellipse at center,#08130a,#030604)",borderTop:"1px solid #0c1a0e",borderBottom:"1px solid #0c1a0e",minHeight:"130px",alignItems:"stretch"}}>
        {/* My creatures */}
        <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:"8px",alignItems:"center",justifyContent:"center"}}>
          {me.battlefield.filter(c=>c.type!=="land").map(c=><BCard key={c.uid} card={c} atk={atks.includes(c.uid)} blk={Object.values(blks).includes(c.uid)} tgt={targetMode==="my"} onClick={()=>clickCreature(c,false)} onHov={setHovered}/>)}
        </div>
        {/* Panel */}
        <div style={{width:"245px",flexShrink:0,display:"flex",flexDirection:"column",gap:"7px",justifyContent:"center"}}>
          <Steps step={step} turn={gs.turn} tn={gs.turnNumber} mi={myIndex}/>
          <Mana pool={me.manaPool}/>
          {error&&<div style={{background:"#280606",border:"1px solid #a03030",borderRadius:"5px",padding:"5px 9px",fontSize:"11px",color:"#ff8888",textAlign:"center"}}>{error}</div>}
          {selCard&&targetMode&&<div style={{background:"#081a06",border:"1px solid #408030",borderRadius:"5px",padding:"5px 9px",fontSize:"11px",color:"#70c050",textAlign:"center",animation:"pulse 1s infinite"}}>🎯 Clique no alvo {targetMode==="opp"?"inimigo":"aliado"}<button onClick={()=>{setSelCard(null);setTargetMode(null);}} style={{marginLeft:"6px",background:"none",border:"none",color:"#ff8888",cursor:"pointer",fontSize:"12px"}}>✕</button></div>}
          <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
            {isMy&&!cp&&<>
              {step==="untap"&&<>
                <div style={{fontSize:"10px",color:"#4a6a8a",textAlign:"center",padding:"3px 0"}}>Suas permanentes desviram automaticamente.</div>
                <button style={btn("#74b9ff","#030c18",true)} onClick={()=>emit("advance_step")}>🔄 Confirmar Desvirar</button>
              </>}
              {step==="upkeep"&&<>
                <div style={{fontSize:"10px",color:"#4a6a8a",textAlign:"center",padding:"3px 0"}}>Efeitos do início do turno. Clique para continuar.</div>
                <button style={btn("#a29bfe","#080318",true)} onClick={()=>emit("advance_step")}>⬆️ Confirmar Manutenção</button>
              </>}
              {step==="draw"&&<>
                <div style={{fontSize:"10px",color:"#4a6a8a",textAlign:"center",padding:"3px 0"}}>Compre uma carta do seu deck.</div>
                <button style={btn("#55efc4","#031208",true)} onClick={()=>emit("draw_card")}>📖 Comprar Carta</button>
              </>}
              {step==="main1"&&<>
                <div style={{fontSize:"10px",color:"#4a6a8a",textAlign:"center",padding:"3px 0"}}>Jogue terrenos, invoque criaturas e lance feitiços.</div>
                <button style={btn("#fdcb6e","#120a01",true)} onClick={()=>emit("advance_step")}>⚔️ Ir para Combate</button>
                <button style={btn("#636e72","#080808",true)} onClick={()=>emit("skip_to_end")}>⏭️ Passar Turno (sem atacar)</button>
              </>}
              {step==="main2"&&<>
                <div style={{fontSize:"10px",color:"#4a6a8a",textAlign:"center",padding:"3px 0"}}>Fase pós-combate. Lance mais feitiços se quiser.</div>
                <button style={btn("#fdcb6e","#120a01",true)} onClick={()=>emit("advance_step")}>🌙 Ir para Fim de Turno</button>
                <button style={btn("#636e72","#080808",true)} onClick={()=>emit("skip_to_end")}>⏭️ Passar Turno</button>
              </>}
              {step==="end"&&<>
                <div style={{fontSize:"10px",color:"#4a6a8a",textAlign:"center",padding:"3px 0"}}>Fim do turno. Passa para o oponente.</div>
                <button style={btn("#636e72","#0a0b0c",true)} onClick={()=>emit("advance_step")}>→ Passar para o Oponente</button>
              </>}
            </>}
            {isMy&&cp==="declare_attackers"&&<>
              <div style={{fontSize:"10px",color:"#4a6a8a",textAlign:"center",padding:"2px 0"}}>Clique nas suas criaturas para atacar, depois confirme. Ou pule.</div>
              <div style={{fontSize:"11px",color:"#e17055",textAlign:"center",background:"rgba(80,20,0,.5)",border:"1px solid #e17055",borderRadius:"5px",padding:"4px 8px"}}>{atks.length>0?`⚔️ ${atks.length} criatura(s) pronta(s)`:"🛡️ Nenhuma selecionada"}</div>
              <button style={{...btn("#e17055","#150601",true),animation:atks.length>0?"atk 1.5s infinite":"none"}} onClick={()=>emit("declare_attackers")}>⚔️ {atks.length>0?`Atacar com ${atks.length}`:"Pular Ataque"}</button>
            </>}
            {isDef&&cp==="declare_blockers"&&<button style={{...btn("#74b9ff","#010610",true),animation:"tgt 1.5s infinite"}} onClick={()=>emit("declare_blockers")}>🛡️ Confirmar Bloqueio</button>}
            {!isMy&&!cp&&<div style={{fontSize:"11px",color:"#2a4a6a",fontStyle:"italic",textAlign:"center",animation:"pulse 2s infinite"}}>⏳ Aguardando oponente...</div>}
          </div>
        </div>
        {/* Log */}
        <div ref={logRef} style={{width:"196px",flexShrink:0,overflowY:"auto",background:"rgba(0,0,0,.8)",border:"1px solid #121a22",borderRadius:"6px",padding:"8px",fontSize:"10px",lineHeight:"1.75"}}>
          {(gs.log||[]).map((l,i)=><div key={l.id||i} style={{color:logColor(l.type),marginBottom:"1px"}}>{l.msg}</div>)}
        </div>
      </div>

      {/* ── MY LANDS ── */}
      <div style={{background:"linear-gradient(0deg,#070e1c,#0b1626)",borderTop:"2px solid #0c1b2e",padding:"6px 16px",flexShrink:0}}>
        <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
          <PBar player={me} active={isMy} compact/>
          <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginLeft:"10px"}}>
            {me.battlefield.filter(c=>c.type==="land").map(c=><BCard key={c.uid} card={c} atk={false} blk={false} tgt={false} onClick={()=>{if(isMy)emit("tap_land",{cardUid:c.uid});}} onHov={setHovered}/>)}
          </div>
          <div style={{marginLeft:"auto",fontSize:"10px",color:"#2a3a4a"}}>📚{me.deck?.length||0} 🪦{me.graveyard?.length||0} {me.hand?.length>7&&<span style={{color:"#ff8888",fontWeight:"bold"}}>✋{me.hand.length}/7!</span>}</div>
        </div>
      </div>

      {/* ── HAND ── */}
      <div style={{background:"#030405",borderTop:"1px solid #090c10",padding:"10px 16px",minHeight:"165px",flexShrink:0}} onMouseLeave={()=>setHovered(null)}>
        <div style={{display:"flex",gap:"8px",overflowX:"auto",paddingBottom:"8px",alignItems:"flex-end"}}>
          {me.hand.map(card=><HCard key={card.uid} card={card} sel={selCard===card.uid} can={affordable(card)} myTurn={isMy} step={step} onClick={()=>clickHand(card)} onHov={setHovered}/>)}
          {me.hand.length===0&&<div style={{color:"#151008",fontSize:"13px",margin:"auto",fontStyle:"italic"}}>Sem cartas na mão</div>}
        </div>
      </div>

      {/* WINNER */}
      {gs.winner!==null&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{textAlign:"center",padding:"48px",background:"linear-gradient(135deg,#0a1220,#162030)",border:"2px solid #c9a84c",borderRadius:"16px",maxWidth:"420px",animation:"fadeIn .4s ease"}}>
            <div style={{fontSize:"80px",marginBottom:"14px"}}>{gs.winner===myIndex?"🏆":"💀"}</div>
            <h1 style={{fontSize:"40px",fontWeight:"900",background:gs.winner===myIndex?"linear-gradient(180deg,#f0d48a,#c9a84c)":"linear-gradient(180deg,#ff8888,#c03030)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:"0 0 10px"}}>
              {gs.winner===myIndex?"VITÓRIA!":"DERROTA"}
            </h1>
            <div style={{display:"flex",gap:"16px",justifyContent:"center",margin:"20px 0"}}>
              {gs.players.map((p,i)=><div key={i} style={{background:"rgba(0,0,0,.5)",border:`1px solid ${i===gs.winner?"#4ade80":"#f87171"}`,borderRadius:"10px",padding:"12px 20px",textAlign:"center"}}>
                <div style={{fontSize:"11px",color:"#c9a84c",marginBottom:"5px"}}>{p.name}</div>
                <div style={{fontSize:"22px",color:p.life>0?"#4ade80":"#f87171",fontWeight:"bold"}}>❤️ {p.life}</div>
              </div>)}
            </div>
            <button onClick={()=>{ sessionStorage.removeItem("mtg_room"); window.location.reload(); }} style={{background:"linear-gradient(135deg,#160a02,#3a2005)",border:"2px solid #c9a84c",color:"#f0d48a",padding:"12px 36px",borderRadius:"7px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"15px",letterSpacing:".1em"}}>🔄 Jogar Novamente</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Player Bar ──
function PBar({player,active,compact}) {
  const lc = player.life>10?"#4ade80":player.life>5?"#facc15":"#f87171";
  return (
    <div style={{display:"flex",alignItems:"center",gap:"10px",padding:compact?"1px 0":"3px 0"}}>
      <div style={{fontFamily:"'Cinzel',serif",fontWeight:"700",fontSize:compact?"11px":"13px",color:active?"#f0d48a":"#3a2a12",minWidth:"95px",transition:"color .3s"}}>
        {active&&<span style={{color:"#4ade80",marginRight:"5px",animation:"pulse 1s infinite"}}>●</span>}{player.name}
      </div>
      <div style={{background:"rgba(0,0,0,.6)",border:`1.5px solid ${lc}`,borderRadius:"7px",padding:"2px 10px",display:"flex",alignItems:"center",gap:"4px",boxShadow:`0 0 10px ${lc}30`}}>
        <span>❤️</span><span style={{color:lc,fontWeight:"bold",fontSize:"16px",fontFamily:"'Cinzel',serif"}}>{player.life}</span>
      </div>
    </div>
  );
}

// ── Mana ──
function Mana({pool}) {
  const types=[{k:"W",e:"☀️"},{k:"U",e:"💧"},{k:"B",e:"💀"},{k:"R",e:"🔥"},{k:"G",e:"🌿"}];
  const tot=Object.values(pool||{}).reduce((a,b)=>a+b,0);
  if(!tot) return <div style={{fontSize:"10px",color:"#100a04",textAlign:"center"}}>Sem mana</div>;
  return <div style={{display:"flex",flexWrap:"wrap",gap:"3px",justifyContent:"center"}}>
    {types.map(({k,e})=>(pool[k]||0)>0&&<div key={k} style={{background:"rgba(0,0,0,.6)",border:"1px solid #1a2a3a",borderRadius:"10px",padding:"2px 6px",fontSize:"11px"}}>{Array(pool[k]).fill(0).map((_,i)=><span key={i}>{e}</span>)}</div>)}
  </div>;
}

// ── Step Tracker com tooltip ──
const STEP_DESC = {
  untap:  "Todas as suas permanentes desviram (ficam na posição normal).",
  upkeep: "Fase de manutenção. Efeitos que acontecem 'no início do turno' ocorrem aqui.",
  draw:   "Compre uma carta do topo do seu deck.",
  main1:  "Jogue terrenos, invoque criaturas e lance feitiços antes do combate.",
  combat: "Declare quais criaturas vão atacar. O oponente poderá bloquear.",
  main2:  "Fase principal após o combate. Lance mais feitiços ou invoque criaturas.",
  end:    "Fim do turno. Descarte se tiver mais de 7 cartas na mão.",
};

function Steps({step, turn, tn, mi}) {
  const [tooltip, setTooltip] = useState(null);
  const ss = ["untap","upkeep","draw","main1","combat","main2","end"];
  const ic = {untap:"🔄",upkeep:"⬆️",draw:"📖",main1:"1",combat:"⚔️",main2:"2",end:"🌙"};
  return (
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:"11px",color:turn===mi?"#f0d48a":"#3a5a7a",letterSpacing:".07em",marginBottom:"4px",fontWeight:"600"}}>
        T{tn} — {turn===mi?"SEU TURNO":"OPONENTE"}
      </div>
      <div style={{display:"flex",gap:"2px",justifyContent:"center",position:"relative"}}>
        {ss.map(s=>(
          <div key={s} onMouseEnter={()=>setTooltip(s)} onMouseLeave={()=>setTooltip(null)}
            style={{width:"22px",height:"22px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"10px",background:s===step?STEP_COLORS[s]:"rgba(0,0,0,.5)",
              border:`1px solid ${s===step?STEP_COLORS[s]:"#14202e"}`,
              boxShadow:s===step?`0 0 10px ${STEP_COLORS[s]}`:"none",transition:"all .3s",cursor:"help"}}>
            {ic[s]}
          </div>
        ))}
      </div>
      {/* Caixa de descrição da fase atual */}
      <div style={{marginTop:"6px",background:"rgba(0,0,0,.5)",border:`1px solid ${STEP_COLORS[tooltip||step]||"#1a2a3a"}`,borderRadius:"6px",padding:"6px 8px",fontSize:"9px",color:"#8ab0c8",lineHeight:"1.5",minHeight:"42px",transition:"border-color .2s",wordBreak:"break-word",overflowWrap:"break-word",textAlign:"left"}}>
        <div style={{color:STEP_COLORS[tooltip||step],fontWeight:"700",fontSize:"10px",marginBottom:"2px"}}>{STEP_LABELS[tooltip||step]}</div>
        <div>{STEP_DESC[tooltip||step]}</div>
      </div>
    </div>
  );
}

// ── Battlefield Card ──
function BCard({card,atk,blk,tgt,onClick,onHov}) {
  if(card.hidden) return null;
  const st=getCardStyle(card);
  return (
    <div className="bcard" onClick={onClick}
      onMouseEnter={()=>onHov&&onHov(card)} onMouseLeave={()=>onHov&&onHov(null)}
      style={{width:"86px",height:"120px",borderRadius:"9px",background:st.bg,border:`2px solid ${atk?"#e17055":blk?"#74b9ff":tgt?"#55efc4":st.border}`,
        boxShadow:atk?"0 0 20px #e17055":blk?"0 0 20px #74b9ff":tgt?"0 0 16px #55efc4":"0 4px 14px rgba(0,0,0,.85)",
        cursor:"pointer",transform:card.tapped?"rotate(90deg)":"none",transition:"transform .3s,box-shadow .2s,border-color .2s",
        flexShrink:0,position:"relative",filter:card.summoningSick?"brightness(.55)":"none",overflow:"hidden",
        animation:atk?"atk 1.5s infinite":tgt?"tgt 1.5s infinite":"none"}}>
      <CardImage name={card.name} style={{borderRadius:"7px"}}/>
      {card.type==="creature"&&<div style={{position:"absolute",bottom:"3px",right:"4px",background:"rgba(0,0,0,.88)",borderRadius:"4px",padding:"1px 5px",fontSize:"11px",fontWeight:"bold",color:"#f0d48a",fontFamily:"'Cinzel',serif"}}>{card.power}/{card.toughness}</div>}
      {card.tapped&&<div style={{position:"absolute",top:"2px",left:"2px",fontSize:"8px",background:"rgba(0,0,0,.75)",borderRadius:"3px",padding:"1px 3px"}}>🔄</div>}
      {card.summoningSick&&<div style={{position:"absolute",top:"2px",right:"2px",fontSize:"8px",background:"rgba(0,0,0,.75)",borderRadius:"3px",padding:"1px 3px"}}>💤</div>}
    </div>
  );
}

// ── Hand Card ──
function HCard({card,sel,can,myTurn,step,onClick,onHov}) {
  const st=getCardStyle(card);
  const cmc=calcCMC(card.cost);
  const play=myTurn&&(card.type==="land"?["main1","main2"].includes(step):["main1","main2","combat"].includes(step));
  return (
    <div className="hcard" onClick={onClick}
      onMouseEnter={()=>onHov&&onHov(card)} onMouseLeave={()=>onHov&&onHov(null)}
      style={{minWidth:"116px",maxWidth:"116px",height:"162px",borderRadius:"10px",background:st.bg,
        border:`2px solid ${sel?"#f0d48a":can&&play?st.border:"#0e0e18"}`,
        cursor:play?"pointer":"default",
        boxShadow:sel?"0 0 28px #f0d48a,0 12px 36px rgba(0,0,0,.95)":can&&play?`0 6px 22px rgba(0,0,0,.85),0 0 8px ${st.border}45`:"0 3px 10px rgba(0,0,0,.7)",
        opacity:!play?0.5:can?1:0.6,flexShrink:0,position:"relative",overflow:"hidden"}}>
      <CardImage name={card.name} style={{borderRadius:"8px"}}/>
      {sel&&<div style={{position:"absolute",inset:0,background:"rgba(240,212,138,.12)",borderRadius:"8px",pointerEvents:"none"}}/>}
      {card.type!=="land"&&<div style={{position:"absolute",top:"4px",right:"4px",background:"rgba(0,0,0,.88)",borderRadius:"50%",width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:"bold",color:"#f0d48a"}}>{cmc}</div>}
      {card.type==="creature"&&<div style={{position:"absolute",bottom:"4px",right:"4px",background:"rgba(0,0,0,.88)",borderRadius:"4px",padding:"1px 5px",fontSize:"11px",fontWeight:"bold",color:"#f0d48a",fontFamily:"'Cinzel',serif"}}>{card.power}/{card.toughness}</div>}
    </div>
  );
}

// ── Menu ──
function Menu({name,setName,colors,setColors,code,setCode,error,onCreate,onJoin}) {
  const cls=[{k:"W",e:"☀️",n:"Branco"},{k:"U",e:"💧",n:"Azul"},{k:"B",e:"💀",n:"Preto"},{k:"R",e:"🔥",n:"Vermelho"},{k:"G",e:"🌿",n:"Verde"}];
  const tog=k=>setColors(s=>s.includes(k)?s.filter(x=>x!==k):[...s,k]);
  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 40%,#0c1828,#030710)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Cinzel',Georgia,serif",color:"#e8d5a3",gap:"22px",padding:"20px"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap');`}</style>
      <div style={{fontSize:"62px",filter:"drop-shadow(0 0 40px #c9a84c)"}}>⚔️</div>
      <div style={{textAlign:"center"}}>
        <h1 style={{fontSize:"48px",fontWeight:"900",background:"linear-gradient(180deg,#f0d48a,#c9a84c)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:0,letterSpacing:".05em"}}>MAGIC</h1>
        <h2 style={{fontSize:"13px",fontWeight:"400",letterSpacing:".5em",color:"#4a3a1a",margin:"4px 0 0",textTransform:"uppercase"}}>The Gathering — Multiplayer</h2>
      </div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome de mago..."
        style={{background:"rgba(0,0,0,.6)",border:"1px solid #241808",borderRadius:"7px",padding:"11px 18px",color:"#e8d5a3",fontFamily:"'Cinzel',serif",fontSize:"14px",width:"300px",outline:"none",textAlign:"center"}}/>
      <div>
        <div style={{textAlign:"center",fontSize:"10px",color:"#4a3a18",letterSpacing:".15em",marginBottom:"10px"}}>ESCOLHA SUAS CORES (1–3)</div>
        <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
          {cls.map(c=>{const sel=colors.includes(c.k);const st=COLOR_STYLES[c.k];return(
            <div key={c.k} onClick={()=>tog(c.k)} style={{width:"62px",padding:"10px 6px",borderRadius:"8px",textAlign:"center",cursor:"pointer",background:sel?st.bg:"rgba(0,0,0,.4)",border:`2px solid ${sel?st.border:"#101014"}`,transform:sel?"scale(1.1)":"scale(1)",transition:"all .2s",boxShadow:sel?`0 0 16px ${st.border}50`:"none"}}>
              <div style={{fontSize:"26px"}}>{c.e}</div>
              <div style={{fontSize:"9px",color:sel?st.text:"#2a2a38",marginTop:"4px",fontWeight:"600"}}>{c.n}</div>
            </div>);
          })}
        </div>
      </div>
      {error&&<div style={{color:"#ff8888",fontSize:"12px",background:"rgba(50,0,0,.5)",padding:"7px 14px",borderRadius:"5px",border:"1px solid #703030"}}>{error}</div>}
      <div style={{display:"flex",gap:"12px",flexWrap:"wrap",justifyContent:"center"}}>
        <button onClick={onCreate} disabled={colors.length===0||!name.trim()} style={{background:"linear-gradient(135deg,#081804,#163c0c)",border:"2px solid #347020",color:"#68c040",padding:"13px 30px",borderRadius:"7px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"14px",letterSpacing:".08em",opacity:colors.length===0||!name.trim()?0.3:1}}>🏰 Criar Sala</button>
        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={5}
            style={{background:"rgba(0,0,0,.6)",border:"1px solid #201408",borderRadius:"7px",padding:"11px 12px",color:"#e8d5a3",fontFamily:"'Cinzel',serif",fontSize:"16px",width:"108px",outline:"none",textAlign:"center",letterSpacing:".3em"}}/>
          <button onClick={onJoin} disabled={!code.trim()||colors.length===0||!name.trim()} style={{background:"linear-gradient(135deg,#06041c,#10083a)",border:"2px solid #281898",color:"#5840d0",padding:"11px 20px",borderRadius:"7px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"14px",opacity:!code.trim()||colors.length===0||!name.trim()?0.3:1}}>⚡ Entrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Lobby ──
function Lobby({code,msg}) {
  const [cp,setCp]=useState(false);
  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at center,#0c1828,#03060f)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Cinzel',Georgia,serif",color:"#e8d5a3",gap:"24px"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <div style={{fontSize:"54px",animation:"pulse 1.5s infinite"}}>🔮</div>
      <h2 style={{fontSize:"20px",letterSpacing:".2em",color:"#c9a84c",margin:0}}>AGUARDANDO OPONENTE</h2>
      <div onClick={()=>{navigator.clipboard?.writeText(code);setCp(true);setTimeout(()=>setCp(false),2000);}}
        style={{background:"rgba(0,0,0,.7)",border:"2px solid #c9a84c",borderRadius:"10px",padding:"20px 44px",textAlign:"center",cursor:"pointer",boxShadow:"0 0 32px #c9a84c25",transition:"all .2s"}}>
        <div style={{fontSize:"11px",color:"#4a3a18",letterSpacing:".2em",marginBottom:"8px"}}>CÓDIGO DA SALA — CLIQUE PARA COPIAR</div>
        <div style={{fontSize:"42px",fontWeight:"900",letterSpacing:".4em",color:"#f0d48a"}}>{code}</div>
        {cp&&<div style={{fontSize:"11px",color:"#4ade80",marginTop:"6px"}}>✓ Copiado!</div>}
      </div>
      <p style={{color:"#2a3a4a",fontSize:"12px",fontStyle:"italic"}}>{msg}</p>
    </div>
  );
}

