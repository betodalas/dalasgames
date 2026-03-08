import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";

// ── CHANGE THIS TO YOUR DEPLOYED SERVER URL ──────────────────
const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
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

const STEPS = ["untap","upkeep","draw","main1","combat","main2","end"];
const STEP_LABELS = { untap:"🔄 Desvirar", upkeep:"⬆️ Manutenção", draw:"📖 Comprar", main1:"1️⃣ Principal 1", combat:"⚔️ Combate", main2:"2️⃣ Principal 2", end:"🌙 Fim" };
const STEP_COLORS = { untap:"#74b9ff", upkeep:"#a29bfe", draw:"#55efc4", main1:"#fdcb6e", combat:"#e17055", main2:"#fdcb6e", end:"#636e72" };

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("menu"); // menu | lobby | game
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [myIndex, setMyIndex] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selectedColors, setSelectedColors] = useState(["R","G"]);
  const [error, setError] = useState("");
  const [waitingMsg, setWaitingMsg] = useState("");
  const [selectedCard, setSelectedCard] = useState(null); // uid of card in hand
  const [targetMode, setTargetMode] = useState(null); // "opp_creature" | "my_creature" | null
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [gameState?.log]);

  // ── CONNECT ──
  const connect = useCallback(() => {
    const s = io(SERVER_URL, { transports: ["websocket","polling"] });
    s.on("room_created", ({ code }) => {
      setRoomCode(code);
      setWaitingMsg(`Sala criada! Código: ${code} — Aguardando oponente...`);
      setScreen("lobby");
    });
    s.on("waiting", ({ msg }) => setWaitingMsg(msg));
    s.on("game_state", (state) => {
      setMyIndex(state.myIndex);
      setGameState(state);
      if (screen !== "game") setScreen("game");
    });
    s.on("error", ({ msg }) => setError(msg));
    setSocket(s);
    return s;
  }, [screen]);

  const createRoom = () => {
    if (!playerName.trim()) { setError("Digite seu nome!"); return; }
    const s = connect();
    s.emit("create_room", { name: playerName, colors: selectedColors });
    s.emit("set_player_info", { name: playerName, colors: selectedColors });
  };

  const joinRoom = () => {
    if (!playerName.trim()) { setError("Digite seu nome!"); return; }
    if (!joinCode.trim()) { setError("Digite o código da sala!"); return; }
    const s = connect();
    s.emit("join_room", { code: joinCode.trim().toUpperCase(), name: playerName, colors: selectedColors });
  };

  // ── GAME ACTIONS ──
  const emit = useCallback((event, data) => {
    if (socket) socket.emit(event, data);
  }, [socket]);

  const gs = gameState;
  const me = gs ? gs.players[myIndex] : null;
  const opp = gs ? gs.players[1 - myIndex] : null;
  const isMyTurn = gs && gs.turn === myIndex;
  const step = gs?.step;
  const combatPhase = gs?.combatPhase;
  const attackers = gs?.attackers || [];
  const blockers = gs?.blockers || {};
  const isDefender = gs && gs.turn !== myIndex;

  const canAffordCard = (card) => {
    if (!me || card.type === "land") return true;
    const pool = { ...me.manaPool };
    const cost = card.cost || {};
    for (const [k, v] of Object.entries(cost)) {
      if (k === "generic" || typeof v !== "number") continue;
      if ((pool[k] || 0) < v) return false;
      pool[k] -= v;
    }
    const generic = typeof cost.generic === "number" ? cost.generic : 0;
    return Object.values(pool).reduce((a, b) => a + b, 0) >= generic;
  };

  const handleHandCardClick = (card) => {
    if (!isMyTurn) return;
    if (card.type === "land") {
      if (!["main1","main2"].includes(step)) return;
      emit("play_land", { cardUid: card.uid });
      return;
    }
    if (!["main1","main2","combat"].includes(step)) return;
    if (!canAffordCard(card)) { setError("Mana insuficiente!"); setTimeout(()=>setError(""),2000); return; }

    const needsTarget = card.effect && ["destroy_creature","exile_creature","deal_3_damage","deal_4_damage","pump_creature"].includes(card.effect);
    if (needsTarget) {
      setSelectedCard(card.uid);
      setTargetMode(card.effect === "pump_creature" ? "my_creature" : "opp_creature");
    } else {
      emit("cast_card", { cardUid: card.uid });
    }
  };

  const handleCreatureClick = (card, isOpponent) => {
    if (selectedCard && targetMode) {
      if ((targetMode === "opp_creature" && isOpponent) || (targetMode === "my_creature" && !isOpponent)) {
        emit("cast_card", { cardUid: selectedCard, targetUid: card.uid });
        setSelectedCard(null); setTargetMode(null);
      }
      return;
    }
    if (isMyTurn && combatPhase === "declare_attackers" && !isOpponent) {
      emit("toggle_attacker", { cardUid: card.uid });
    }
    if (isDefender && combatPhase === "declare_blockers" && !isOpponent && attackers.length > 0) {
      // pick which attacker to block — show selection
      const firstUnblocked = attackers.find(a => !blockers[a]);
      if (firstUnblocked) emit("toggle_blocker", { blockerUid: card.uid, attackerUid: firstUnblocked });
    }
  };

  // ─── RENDER SCREENS ───────────────────────────────────────
  if (screen === "menu") return (
    <MenuScreen
      playerName={playerName} setPlayerName={setPlayerName}
      selectedColors={selectedColors} setSelectedColors={setSelectedColors}
      joinCode={joinCode} setJoinCode={setJoinCode}
      error={error} onCreate={createRoom} onJoin={joinRoom}
    />
  );

  if (screen === "lobby") return (
    <LobbyScreen code={roomCode} msg={waitingMsg} />
  );

  if (!gs || !me || !opp) return <div style={{color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"serif",fontSize:"20px"}}>🔮 Conectando...</div>;

  return (
    <div style={{ fontFamily:"'Cinzel','Georgia',serif", background:"#070a0d", minHeight:"100vh", color:"#e8d5a3", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Text:ital,wght@0,400;1,400&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#111;} ::-webkit-scrollbar-thumb{background:#3a2a15;}
        .chover { transition: transform .18s, box-shadow .18s; }
        .chover:hover { transform: translateY(-10px) scale(1.04); z-index: 100; }
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px #e1705580}50%{box-shadow:0 0 24px #e17055,0 0 4px #fff3}}
        @keyframes attackGlow{0%,100%{box-shadow:0 0 8px #e1705580}50%{box-shadow:0 0 28px #ff6b35,0 0 8px #fff}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .fade-in { animation: fadeIn .3s ease; }
      `}</style>

      {/* ── OPPONENT ── */}
      <div style={{ background:"linear-gradient(180deg,#0a1428,#0f1e35)", borderBottom:"1px solid #1a2d45", padding:"6px 14px", flexShrink:0 }}>
        <PlayerBar player={opp} isActive={!isMyTurn} />
        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", minHeight:"55px", alignItems:"center", padding:"4px 0" }}>
          {/* Opponent lands */}
          {opp.battlefield.filter(c=>c.type==="land").map(c => (
            <BFCard key={c.uid} card={c} isAttacker={false} isBlocker={false}
              onClick={()=>{}} />
          ))}
          {opp.battlefield.filter(c=>c.type==="land").length > 0 && <div style={{width:"1px",height:"50px",background:"#1e2d40"}}/>}
          {/* Opponent creatures */}
          {opp.battlefield.filter(c=>c.type!=="land").map(c => (
            <BFCard key={c.uid} card={c}
              isAttacker={attackers.includes(c.uid)}
              isBlocker={Object.values(blockers).includes(c.uid)}
              isTargetable={targetMode === "opp_creature"}
              onClick={()=>handleCreatureClick(c, true)}
            />
          ))}
          {/* Hidden hand */}
          <div style={{marginLeft:"auto",display:"flex",gap:"3px"}}>
            {opp.hand.map((_,i) => (
              <div key={i} style={{width:"38px",height:"52px",borderRadius:"5px",background:"linear-gradient(135deg,#1a2a4a,#0d1520)",border:"1px solid #1e3a5a"}} />
            ))}
          </div>
        </div>
      </div>

      {/* ── CENTER ── */}
      <div style={{ flex:1, display:"flex", gap:"10px", padding:"6px 14px", background:"radial-gradient(ellipse at center,#0a1a0a,#050805)", borderTop:"1px solid #152015", borderBottom:"1px solid #152015", minHeight:"100px", alignItems:"stretch" }}>
        {/* My creatures on battlefield */}
        <div style={{ flex:1, display:"flex", flexWrap:"wrap", gap:"5px", alignItems:"center", justifyContent:"center" }}>
          {me.battlefield.filter(c=>c.type!=="land").map(c => (
            <BFCard key={c.uid} card={c}
              isAttacker={attackers.includes(c.uid)}
              isBlocker={Object.values(blockers).includes(c.uid)}
              isTargetable={targetMode === "my_creature"}
              onClick={()=>handleCreatureClick(c, false)}
            />
          ))}
        </div>

        {/* Center info panel */}
        <div style={{ width:"200px", flexShrink:0, display:"flex", flexDirection:"column", gap:"6px", justifyContent:"center" }}>
          <StepTracker step={step} turn={gs.turn} turnNumber={gs.turnNumber} myIndex={myIndex} />
          <ManaPool pool={me.manaPool} />
          {error && <div style={{background:"#3d0a0a",border:"1px solid #c94c4c",borderRadius:"4px",padding:"4px 8px",fontSize:"11px",color:"#ff8888",textAlign:"center"}}>{error}</div>}
          {selectedCard && targetMode && (
            <div style={{background:"#1a2d0a",border:"1px solid #5a8c2a",borderRadius:"4px",padding:"4px 8px",fontSize:"11px",color:"#a0d060",textAlign:"center",animation:"pulse 1s infinite"}}>
              🎯 Clique no alvo {targetMode==="opp_creature"?"inimigo":"aliado"}
              <button onClick={()=>{setSelectedCard(null);setTargetMode(null);}} style={{marginLeft:"6px",background:"none",border:"none",color:"#ff8888",cursor:"pointer",fontSize:"11px"}}>✕</button>
            </div>
          )}
          {/* Combat buttons */}
          {isMyTurn && combatPhase === "declare_attackers" && (
            <button onClick={()=>emit("declare_attackers")} style={btnStyle("#e17055","#3d1505","#c05040",true)}>
              ⚔️ Confirmar Ataque ({attackers.length})
            </button>
          )}
          {isDefender && combatPhase === "declare_blockers" && (
            <button onClick={()=>emit("declare_blockers")} style={btnStyle("#74b9ff","#051530","#3a7fbf",true)}>
              🛡️ Confirmar Bloqueio
            </button>
          )}
        </div>

        {/* Log */}
        <div ref={logRef} style={{ width:"190px", flexShrink:0, overflowY:"auto", background:"rgba(0,0,0,.7)", border:"1px solid #1a2d40", borderRadius:"4px", padding:"6px", fontSize:"10px", lineHeight:"1.6" }}>
          {(gs.log||[]).map((l,i) => (
            <div key={l.id||i} style={{ color: logColor(l.type), marginBottom:"1px" }}>{l.msg}</div>
          ))}
        </div>
      </div>

      {/* ── MY LANDS + CONTROLS ── */}
      <div style={{ background:"linear-gradient(0deg,#0a1428,#0f1e35)", borderTop:"1px solid #1a2d45", padding:"5px 14px", flexShrink:0 }}>
        <div style={{ display:"flex", gap:"5px", alignItems:"center", flexWrap:"wrap" }}>
          <PlayerBar player={me} isActive={isMyTurn} compact />
          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", marginLeft:"8px" }}>
            {me.battlefield.filter(c=>c.type==="land").map(c => (
              <BFCard key={c.uid} card={c} isAttacker={false} isBlocker={false}
                onClick={()=>{ if(isMyTurn) emit("tap_land",{cardUid:c.uid}); }}
              />
            ))}
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:"6px", alignItems:"center" }}>
            {isMyTurn && !combatPhase && (
              <>
                {step==="untap" && <button style={btnStyle("#74b9ff","#051a30","#3a6a9f")} onClick={()=>emit("advance_step")}>🔄 Desvirar</button>}
                {step==="upkeep" && <button style={btnStyle("#a29bfe","#1a0530","#7a6abf")} onClick={()=>emit("advance_step")}>⬆️ Manutenção</button>}
                {step==="draw" && <button style={btnStyle("#55efc4","#052a1a","#2a9f7a")} onClick={()=>emit("draw_card")}>📖 Comprar Carta</button>}
                {step==="main1" && <button style={btnStyle("#fdcb6e","#2a1a05","#bf9a3a")} onClick={()=>emit("advance_step")}>→ Combate</button>}
                {step==="main2" && <button style={btnStyle("#fdcb6e","#2a1a05","#bf9a3a")} onClick={()=>emit("advance_step")}>🌙 Fim de Turno</button>}
                {step==="end" && <button style={btnStyle("#636e72","#101518","#4a5558")} onClick={()=>emit("advance_step")}>→ Próximo</button>}
              </>
            )}
            {!isMyTurn && !combatPhase && (
              <div style={{fontSize:"12px",color:"#4a6a8a",fontStyle:"italic",animation:"pulse 2s infinite"}}>⏳ Turno do oponente...</div>
            )}
          </div>
        </div>
      </div>

      {/* ── MY HAND ── */}
      <div style={{ background:"#030507", borderTop:"1px solid #0d1520", padding:"8px 14px", minHeight:"130px", flexShrink:0 }}>
        <div style={{ display:"flex", gap:"6px", overflowX:"auto", paddingBottom:"4px", alignItems:"flex-end" }}>
          {me.hand.map(card => (
            <HandCard key={card.uid} card={card}
              isSelected={selectedCard === card.uid}
              canAfford={canAffordCard(card)}
              isMyTurn={isMyTurn}
              step={step}
              onClick={()=>handleHandCardClick(card)}
            />
          ))}
          {me.hand.length === 0 && <div style={{color:"#2a1a0a",fontSize:"12px",margin:"auto",fontStyle:"italic"}}>Sem cartas na mão</div>}
        </div>
      </div>

      {/* ── WINNER OVERLAY ── */}
      {gs.winner !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div className="fade-in" style={{ textAlign:"center", padding:"40px", background:"linear-gradient(135deg,#0d1520,#1a2d40)", border:"2px solid #c9a84c", borderRadius:"12px", maxWidth:"400px" }}>
            <div style={{fontSize:"72px",marginBottom:"16px"}}>{gs.winner===myIndex?"🏆":"💀"}</div>
            <h1 style={{fontSize:"36px",fontWeight:"900",background:gs.winner===myIndex?"linear-gradient(180deg,#f0d48a,#c9a84c)":"linear-gradient(180deg,#ff8888,#c03030)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:"0 0 8px"}}>
              {gs.winner===myIndex?"VITÓRIA!":"DERROTA"}
            </h1>
            <div style={{fontSize:"13px",color:"#6a5a3a",marginBottom:"20px",fontFamily:"'Crimson Text',serif",fontStyle:"italic"}}>
              {gs.winner===myIndex?"Você dominou o campo de batalha!":"Que a próxima batalha seja sua!"}
            </div>
            <div style={{display:"flex",gap:"12px",justifyContent:"center",marginBottom:"20px"}}>
              {gs.players.map((p,i)=>(
                <div key={i} style={{background:"rgba(0,0,0,.5)",border:`1px solid ${i===gs.winner?"#4ade80":"#f87171"}`,borderRadius:"8px",padding:"10px 16px",textAlign:"center"}}>
                  <div style={{fontSize:"11px",color:"#c9a84c",marginBottom:"4px"}}>{p.name}</div>
                  <div style={{fontSize:"18px",color:p.life>0?"#4ade80":"#f87171",fontWeight:"bold"}}>❤️ {p.life}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>window.location.reload()} style={btnStyle("#c9a84c","#1a0d05","#8b6914")}>
              🔄 Jogar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────────
const logColor = (type) => ({
  error:"#ff8888", combat:"#ffd166", system:"#06d6a0", mana:"#74b9ff",
  destroy:"#fd79a8", draw:"#a29bfe", buff:"#55efc4", spell:"#fdcb6e", play:"#b8f0c8"
}[type] || "#8a8a9a");

const btnStyle = (border, bg, hoverBorder, prominent=false) => ({
  background:`linear-gradient(135deg,${bg},${bg}dd)`,
  border:`1.5px solid ${border}`,
  color:border,
  padding: prominent ? "8px 16px" : "6px 14px",
  borderRadius:"4px",
  cursor:"pointer",
  fontFamily:"'Cinzel',serif",
  fontSize: prominent ? "13px" : "12px",
  letterSpacing:".05em",
  transition:"all .2s",
  animation: prominent ? "glow 2s infinite" : "none",
});

// ─── SUB COMPONENTS ────────────────────────────────────────

function PlayerBar({ player, isActive, compact }) {
  const lc = player.life > 10 ? "#4ade80" : player.life > 5 ? "#facc15" : "#f87171";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
      <div style={{ fontFamily:"'Cinzel',serif", fontWeight:"700", fontSize:compact?"12px":"13px", color:isActive?"#f0d48a":"#5a4a2a", minWidth:"110px" }}>
        {isActive && <span style={{color:"#4ade80",marginRight:"5px",animation:"pulse 1s infinite"}}>●</span>}
        {player.name}
      </div>
      <div style={{ background:"rgba(0,0,0,.5)", border:`1px solid ${lc}`, borderRadius:"6px", padding:"2px 10px", display:"flex", alignItems:"center", gap:"4px" }}>
        <span>❤️</span><span style={{ color:lc, fontWeight:"bold", fontSize:"15px", fontFamily:"'Cinzel',serif" }}>{player.life}</span>
      </div>
      <div style={{ fontSize:"10px", color:"#3a5a7a", display:"flex", gap:"6px" }}>
        <span>📚{player.deck?.length||0}</span>
        <span>🪦{player.graveyard?.length||0}</span>
      </div>
    </div>
  );
}

function ManaPool({ pool }) {
  const types = [{k:"W",e:"☀️"},{k:"U",e:"💧"},{k:"B",e:"💀"},{k:"R",e:"🔥"},{k:"G",e:"🌿"}];
  const total = Object.values(pool||{}).reduce((a,b)=>a+b,0);
  if (!total) return <div style={{fontSize:"10px",color:"#2a1a0a",textAlign:"center"}}>Sem mana</div>;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"3px", justifyContent:"center" }}>
      {types.map(({k,e})=>(pool[k]||0)>0&&(
        <div key={k} style={{ background:"rgba(0,0,0,.5)", border:"1px solid #2a3a4a", borderRadius:"10px", padding:"2px 5px", fontSize:"10px" }}>
          {Array(pool[k]).fill(0).map((_,i)=><span key={i}>{e}</span>)}
        </div>
      ))}
    </div>
  );
}

function StepTracker({ step, turn, turnNumber, myIndex }) {
  const steps = ["untap","upkeep","draw","main1","combat","main2","end"];
  const icons = { untap:"🔄",upkeep:"⬆️",draw:"📖",main1:"1",combat:"⚔️",main2:"2",end:"🌙" };
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:"10px", color:"#4a5a6a", letterSpacing:".1em", marginBottom:"4px" }}>
        T{turnNumber} — {turn===myIndex?"SEU TURNO":"OPONENTE"}
      </div>
      <div style={{ display:"flex", gap:"2px", justifyContent:"center" }}>
        {steps.map(s=>(
          <div key={s} title={STEP_LABELS[s]} style={{
            width:"20px",height:"20px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"9px",
            background:s===step?STEP_COLORS[s]:"rgba(0,0,0,.4)",
            border:`1px solid ${s===step?STEP_COLORS[s]:"#1e2d40"}`,
            boxShadow:s===step?`0 0 8px ${STEP_COLORS[s]}`:"none",
            cursor:"default",
          }}>{icons[s]}</div>
        ))}
      </div>
    </div>
  );
}

function BFCard({ card, isAttacker, isBlocker, isTargetable, onClick }) {
  if (card.hidden) return null;
  const style = getCardStyle(card);
  return (
    <div onClick={onClick} style={{
      width:"60px", height:"85px", borderRadius:"5px",
      background:style.bg,
      border:`2px solid ${isAttacker?"#e17055":isBlocker?"#74b9ff":isTargetable?"#55efc4":style.border}`,
      boxShadow:isAttacker?"0 0 14px #e17055":isBlocker?"0 0 14px #74b9ff":isTargetable?"0 0 10px #55efc4":"0 2px 8px rgba(0,0,0,.7)",
      display:"flex", flexDirection:"column", padding:"3px", gap:"1px",
      cursor:"pointer",
      transform:card.tapped?"rotate(90deg)":"none",
      transition:"transform .3s, box-shadow .2s, border-color .2s",
      flexShrink:0, position:"relative",
      filter:card.summoningSick?"brightness(.65)":"none",
      animation:isAttacker?"attackGlow 1.5s infinite":isTargetable?"glow 1.5s infinite":"none",
    }}>
      <div style={{ fontSize:"7px", color:style.text, fontWeight:"600", fontFamily:"'Cinzel',serif", lineHeight:"1.1", textAlign:"center" }}>{card.name}</div>
      <div style={{ fontSize:"20px", textAlign:"center", flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>{card.art}</div>
      {card.type==="creature" && <div style={{fontSize:"9px",fontWeight:"bold",color:"#f0d48a",textAlign:"center",fontFamily:"'Cinzel',serif"}}>{card.power}/{card.toughness}</div>}
      {card.type==="land" && <div style={{fontSize:"7px",color:style.text,textAlign:"center",opacity:.8}}>Terra</div>}
      {card.tapped && <div style={{position:"absolute",top:"1px",left:"1px",fontSize:"7px",opacity:.7}}>🔄</div>}
      {card.summoningSick && <div style={{position:"absolute",top:"1px",right:"1px",fontSize:"7px",opacity:.7}}>💤</div>}
    </div>
  );
}

function HandCard({ card, isSelected, canAfford, isMyTurn, step, onClick }) {
  const style = getCardStyle(card);
  const cmc = calcCMC(card.cost);
  const playable = isMyTurn && (card.type==="land" ? ["main1","main2"].includes(step) : ["main1","main2","combat"].includes(step));
  return (
    <div className="chover" onClick={onClick} style={{
      minWidth:"88px", maxWidth:"88px", height:"124px", borderRadius:"8px",
      background:style.bg,
      border:`2px solid ${isSelected?"#f0d48a":canAfford&&playable?style.border:"#1a1a2a"}`,
      cursor:playable?"pointer":"default",
      boxShadow:isSelected?"0 0 18px #f0d48a,0 8px 20px rgba(0,0,0,.8)":canAfford&&playable?`0 4px 14px rgba(0,0,0,.7),0 0 5px ${style.border}40`:"0 2px 8px rgba(0,0,0,.6)",
      display:"flex", flexDirection:"column", padding:"5px", gap:"2px",
      opacity:canAfford||card.type==="land"?1:.5,
      flexShrink:0, position:"relative",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ fontSize:"8px", color:style.text, fontWeight:"600", lineHeight:"1.1", flex:1, fontFamily:"'Cinzel',serif" }}>{card.name}</div>
        {card.type!=="land" && <div style={{ fontSize:"8px", background:"rgba(0,0,0,.5)", borderRadius:"8px", padding:"1px 3px", color:"#f0d48a", marginLeft:"2px" }}>{cmc}</div>}
      </div>
      <div style={{ fontSize:"26px", textAlign:"center", flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>{card.art}</div>
      <div style={{ fontSize:"7px", color:style.text, opacity:.8, textAlign:"center", fontStyle:"italic" }}>{card.subtype||card.type}</div>
      {card.type==="creature" && <div style={{ fontSize:"10px", fontWeight:"bold", color:"#f0d48a", textAlign:"center", fontFamily:"'Cinzel',serif", background:"rgba(0,0,0,.4)", borderRadius:"3px" }}>{card.power}/{card.toughness}</div>}
    </div>
  );
}

// ─── MENU ──────────────────────────────────────────────────
function MenuScreen({ playerName, setPlayerName, selectedColors, setSelectedColors, joinCode, setJoinCode, error, onCreate, onJoin }) {
  const colors = [
    {k:"W",e:"☀️",n:"Branco"},{k:"U",e:"💧",n:"Azul"},
    {k:"B",e:"💀",n:"Preto"},{k:"R",e:"🔥",n:"Vermelho"},{k:"G",e:"🌿",n:"Verde"}
  ];
  const toggle = k => setSelectedColors(s => s.includes(k) ? s.filter(x=>x!==k) : [...s,k]);

  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at center,#0d1a2e 0%,#050810 100%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',Georgia,serif", color:"#e8d5a3", gap:"20px", padding:"20px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Text:ital@0;1&display=swap');`}</style>
      <div style={{fontSize:"60px",filter:"drop-shadow(0 0 30px #c9a84c)"  }}>⚔️</div>
      <h1 style={{ fontSize:"42px", fontWeight:"900", background:"linear-gradient(180deg,#f0d48a,#c9a84c)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", margin:0, letterSpacing:".05em" }}>MAGIC</h1>
      <h2 style={{ fontSize:"16px", fontWeight:"400", letterSpacing:".4em", color:"#6a5a3a", margin:"-16px 0 0", textTransform:"uppercase" }}>The Gathering — Multiplayer</h2>

      {/* Name */}
      <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Seu nome de mago..."
        style={{ background:"rgba(0,0,0,.5)", border:"1px solid #3a2a1a", borderRadius:"6px", padding:"10px 16px", color:"#e8d5a3", fontFamily:"'Cinzel',serif", fontSize:"14px", width:"280px", outline:"none", textAlign:"center" }} />

      {/* Colors */}
      <div>
        <div style={{ textAlign:"center", fontSize:"11px", color:"#6a5a3a", letterSpacing:".1em", marginBottom:"8px" }}>ESCOLHA SUAS CORES (1–3)</div>
        <div style={{ display:"flex", gap:"8px", justifyContent:"center" }}>
          {colors.map(c=>{
            const sel = selectedColors.includes(c.k);
            const st = COLOR_STYLES[c.k];
            return (
              <div key={c.k} onClick={()=>toggle(c.k)} style={{
                width:"56px", padding:"8px 4px", borderRadius:"6px", textAlign:"center", cursor:"pointer",
                background:sel?st.bg:"rgba(0,0,0,.3)", border:`2px solid ${sel?st.border:"#1a1a2a"}`,
                transform:sel?"scale(1.08)":"scale(1)", transition:"all .2s",
              }}>
                <div style={{fontSize:"22px"}}>{c.e}</div>
                <div style={{fontSize:"8px",color:sel?st.text:"#3a3a4a",marginTop:"3px",fontWeight:"600"}}>{c.n}</div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div style={{color:"#ff8888",fontSize:"12px",background:"rgba(80,0,0,.4)",padding:"6px 12px",borderRadius:"4px"}}>{error}</div>}

      {/* Buttons */}
      <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", justifyContent:"center" }}>
        <button onClick={onCreate} disabled={selectedColors.length===0||!playerName.trim()} style={{
          background:"linear-gradient(135deg,#1a3a0a,#2a6a15)", border:"2px solid #4a9a25", color:"#a0e060",
          padding:"12px 28px", borderRadius:"6px", cursor:"pointer", fontFamily:"'Cinzel',serif", fontSize:"14px", letterSpacing:".08em",
          opacity:selectedColors.length===0||!playerName.trim()?0.4:1,
        }}>
          🏰 Criar Sala
        </button>
        <div style={{display:"flex",gap:"6px"}}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={5}
            style={{ background:"rgba(0,0,0,.5)", border:"1px solid #3a2a1a", borderRadius:"6px", padding:"10px 12px", color:"#e8d5a3", fontFamily:"'Cinzel',serif", fontSize:"14px", width:"100px", outline:"none", textAlign:"center", letterSpacing:".2em" }} />
          <button onClick={onJoin} disabled={!joinCode.trim()||selectedColors.length===0||!playerName.trim()} style={{
            background:"linear-gradient(135deg,#1a0a3a,#2a1568)", border:"2px solid #4a25a0", color:"#9060e0",
            padding:"10px 20px", borderRadius:"6px", cursor:"pointer", fontFamily:"'Cinzel',serif", fontSize:"14px",
            opacity:!joinCode.trim()||selectedColors.length===0||!playerName.trim()?0.4:1,
          }}>
            ⚡ Entrar
          </button>
        </div>
      </div>
      <p style={{fontFamily:"'Crimson Text',serif",fontStyle:"italic",color:"#3a2a1a",fontSize:"13px",textAlign:"center",maxWidth:"320px"}}>
        Crie uma sala e compartilhe o código com seu oponente, ou entre em uma sala existente.
      </p>
    </div>
  );
}

function LobbyScreen({ code, msg }) {
  const copy = () => navigator.clipboard?.writeText(code);
  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at center,#0d1a2e,#050810)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',Georgia,serif", color:"#e8d5a3", gap:"20px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');`}</style>
      <div style={{fontSize:"48px",animation:"pulse 1.5s infinite"}}>🔮</div>
      <h2 style={{fontSize:"20px",letterSpacing:".2em",color:"#c9a84c",margin:0}}>AGUARDANDO OPONENTE</h2>
      <div style={{background:"rgba(0,0,0,.6)",border:"2px solid #c9a84c",borderRadius:"8px",padding:"16px 32px",textAlign:"center",cursor:"pointer"}} onClick={copy}>
        <div style={{fontSize:"11px",color:"#6a5a3a",letterSpacing:".2em",marginBottom:"6px"}}>CÓDIGO DA SALA</div>
        <div style={{fontSize:"32px",fontWeight:"900",letterSpacing:".3em",color:"#f0d48a"}}>{code}</div>
        <div style={{fontSize:"10px",color:"#4a3a1a",marginTop:"6px"}}>Clique para copiar</div>
      </div>
      <p style={{color:"#4a5a6a",fontSize:"13px",fontFamily:"serif",fontStyle:"italic"}}>{msg}</p>
    </div>
  );
}
