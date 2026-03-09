const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ─── CARD DATABASE ────────────────────────────────────────────
const CARD_DB = [
  { id:"w1", name:"Serra Angel", type:"creature", subtype:"Angel", cost:{W:1,generic:4}, colors:["W"], power:4, toughness:4, abilities:["flying","vigilance"], art:"⚔️", rarity:"rare" },
  { id:"w2", name:"Savannah Lions", type:"creature", subtype:"Cat", cost:{W:1,generic:0}, colors:["W"], power:2, toughness:1, abilities:[], art:"🦁", rarity:"common" },
  { id:"w3", name:"Wrath of God", type:"sorcery", cost:{W:2,generic:2}, colors:["W"], effect:"destroy_all_creatures", art:"✨", rarity:"rare" },
  { id:"w4", name:"Swords to Plowshares", type:"instant", cost:{W:1,generic:0}, colors:["W"], effect:"exile_creature", art:"⚡", rarity:"uncommon" },
  { id:"w5", name:"White Knight", type:"creature", subtype:"Knight", cost:{W:2,generic:0}, colors:["W"], power:2, toughness:2, abilities:["first_strike"], art:"🛡️", rarity:"uncommon" },
  { id:"u1", name:"Counterspell", type:"instant", cost:{U:2,generic:0}, colors:["U"], effect:"counter_spell", art:"🌊", rarity:"common" },
  { id:"u2", name:"Air Elemental", type:"creature", subtype:"Elemental", cost:{U:2,generic:3}, colors:["U"], power:4, toughness:4, abilities:["flying"], art:"💨", rarity:"uncommon" },
  { id:"u3", name:"Brainstorm", type:"instant", cost:{U:1,generic:0}, colors:["U"], effect:"draw_3", art:"🧠", rarity:"common" },
  { id:"b1", name:"Dark Ritual", type:"instant", cost:{B:1,generic:0}, colors:["B"], effect:"add_3_black_mana", art:"💀", rarity:"common" },
  { id:"b2", name:"Hypnotic Specter", type:"creature", subtype:"Specter", cost:{B:2,generic:1}, colors:["B"], power:2, toughness:2, abilities:["flying"], art:"👻", rarity:"uncommon" },
  { id:"b3", name:"Terror", type:"instant", cost:{B:1,generic:1}, colors:["B"], effect:"destroy_creature", art:"☠️", rarity:"common" },
  { id:"b4", name:"Lord of the Pit", type:"creature", subtype:"Demon", cost:{B:3,generic:4}, colors:["B"], power:7, toughness:7, abilities:["flying","trample"], art:"🦇", rarity:"rare" },
  { id:"r1", name:"Lightning Bolt", type:"instant", cost:{R:1,generic:0}, colors:["R"], effect:"deal_3_damage", art:"⚡", rarity:"common" },
  { id:"r2", name:"Shivan Dragon", type:"creature", subtype:"Dragon", cost:{R:2,generic:4}, colors:["R"], power:5, toughness:5, abilities:["flying"], art:"🐉", rarity:"rare" },
  { id:"r3", name:"Fireball", type:"sorcery", cost:{R:1,generic:0}, colors:["R"], effect:"deal_4_damage", art:"🔥", rarity:"common" },
  { id:"r4", name:"Goblin Raider", type:"creature", subtype:"Goblin", cost:{R:1,generic:1}, colors:["R"], power:2, toughness:2, abilities:["haste"], art:"👺", rarity:"common" },
  { id:"g1", name:"Giant Growth", type:"instant", cost:{G:1,generic:0}, colors:["G"], effect:"pump_creature", pump:{power:3,toughness:3}, art:"🌿", rarity:"common" },
  { id:"g2", name:"Craw Wurm", type:"creature", subtype:"Wurm", cost:{G:2,generic:4}, colors:["G"], power:6, toughness:4, abilities:[], art:"🐍", rarity:"common" },
  { id:"g3", name:"Llanowar Elves", type:"creature", subtype:"Elf Druid", cost:{G:1,generic:0}, colors:["G"], power:1, toughness:1, abilities:["tap_mana"], art:"🧝", rarity:"common" },
  { id:"g4", name:"Force of Nature", type:"creature", subtype:"Elemental", cost:{G:4,generic:2}, colors:["G"], power:8, toughness:8, abilities:["trample"], art:"🌪️", rarity:"rare" },
  { id:"l1", name:"Plains", type:"land", produces:["W"], colors:[], art:"🏔️" },
  { id:"l2", name:"Island", type:"land", produces:["U"], colors:[], art:"🏝️" },
  { id:"l3", name:"Swamp", type:"land", produces:["B"], colors:[], art:"🌑" },
  { id:"l4", name:"Mountain", type:"land", produces:["R"], colors:[], art:"🌋" },
  { id:"l5", name:"Forest", type:"land", produces:["G"], colors:[], art:"🌳" },
];

// ─── HELPERS ─────────────────────────────────────────────────
let uidCounter = 0;
const mkuid = () => `u${++uidCounter}_${Math.random().toString(36).slice(2,5)}`;

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

const buildDeck = (colors) => {
  const lands = CARD_DB.filter(c => c.type === "land");
  const spells = CARD_DB.filter(c => c.type !== "land" && c.colors && c.colors.some(x => colors.includes(x)));
  const deck = [];
  colors.forEach(col => {
    const land = lands.find(l => l.produces && l.produces.includes(col));
    if (land) for (let i = 0; i < Math.floor(24 / colors.length); i++) deck.push({ ...land, uid: mkuid() });
  });
  while (deck.length < 60 && spells.length > 0) {
    deck.push({ ...spells[Math.floor(Math.random() * spells.length)], uid: mkuid() });
  }
  return shuffle(deck).slice(0, 60);
};

const calcCMC = (cost) => {
  if (!cost) return 0;
  return Object.entries(cost).reduce((s, [k, v]) => s + (typeof v === "number" ? v : 0), 0);
};

const canAfford = (card, pool) => {
  if (card.type === "land") return true;
  const p = { ...pool };
  const cost = card.cost || {};
  for (const [k, v] of Object.entries(cost)) {
    if (k === "generic" || typeof v !== "number") continue;
    if ((p[k] || 0) < v) return false;
    p[k] -= v;
  }
  const generic = typeof cost.generic === "number" ? cost.generic : 0;
  return Object.values(p).reduce((a, b) => a + b, 0) >= generic;
};

const payMana = (cost, pool) => {
  const p = { ...pool };
  for (const [k, v] of Object.entries(cost)) {
    if (k === "generic" || typeof v !== "number") continue;
    p[k] = (p[k] || 0) - v;
  }
  let rem = typeof cost.generic === "number" ? cost.generic : 0;
  for (const k of Object.keys(p)) {
    if (rem <= 0) break;
    const take = Math.min(p[k] || 0, rem);
    p[k] -= take; rem -= take;
  }
  return p;
};

const drawCards = (player, n = 1) => {
  let p = { ...player, hand: [...player.hand], deck: [...player.deck] };
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) { p.life -= 1; continue; }
    p.hand.push({ ...p.deck[0] });
    p.deck = p.deck.slice(1);
  }
  return p;
};

// ─── ROOM MANAGEMENT ────────────────────────────────────────
const rooms = {};

const mkPlayer = (socketId, name, colors) => {
  const deck = buildDeck(colors);
  return {
    socketId, name, colors,
    life: 20,
    deck: deck.slice(7),
    hand: deck.slice(0, 7).map(c => ({ ...c, uid: mkuid() })),
    battlefield: [],
    graveyard: [],
    manaPool: { W:0, U:0, B:0, R:0, G:0 },
    landsPlayedThisTurn: 0,
    maxMana: 0,
  };
};

const mkRoom = (code) => ({
  code,
  players: [],       // [player0, player1]
  sockets: [],       // [socketId0, socketId1]
  turn: 0,
  turnNumber: 1,
  step: "waiting",   // waiting|untap|upkeep|draw|main1|combat|main2|end
  combatPhase: null, // null|declare_attackers|declare_blockers|resolve
  attackers: [],
  blockers: {},
  stack: [],
  log: [],
  winner: null,
});

const genCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

// ─── GAME LOGIC ──────────────────────────────────────────────
const addLog = (room, msg, type = "info") => {
  room.log.push({ msg, type, id: mkuid() });
  if (room.log.length > 60) room.log = room.log.slice(-60);
};

const broadcastRoom = (room) => {
  room.sockets.forEach((sid, idx) => {
    const socket = io.sockets.sockets.get(sid);
    if (!socket) return;
    // send each player their own perspective
    socket.emit("game_state", {
      myIndex: idx,
      turn: room.turn,
      turnNumber: room.turnNumber,
      step: room.step,
      combatPhase: room.combatPhase,
      attackers: room.attackers,
      blockers: room.blockers,
      log: room.log.slice(-30),
      winner: room.winner,
      players: room.players.map((p, i) => ({
        ...p,
        // hide opponent's hand (show count only)
        hand: i === idx ? p.hand : p.hand.map(() => ({ hidden: true, uid: mkuid() })),
      })),
    });
  });
};

const checkWinner = (room) => {
  if (room.players[0]?.life <= 0) room.winner = 1;
  if (room.players[1]?.life <= 0) room.winner = 0;
  // ✅ FIX: limpa a sala da memória após 10 min quando houver vencedor
  if (room.winner !== null && !room._cleanupScheduled) {
    room._cleanupScheduled = true;
    setTimeout(() => { if (rooms[room.code]) delete rooms[room.code]; }, 10 * 60 * 1000);
  }
};

const untapAll = (player) => ({
  ...player,
  battlefield: player.battlefield.map(c => ({ ...c, tapped: false, summoningSick: false })),
  landsPlayedThisTurn: 0,
  manaPool: { W:0, U:0, B:0, R:0, G:0 },
});

const STEPS = ["untap","upkeep","draw","main1","combat","main2","end"];

const advanceStep = (room) => {
  const cur = STEPS.indexOf(room.step);
  if (cur >= STEPS.length - 1) {
    room.step = "untap";
    room.turn = room.turn === 0 ? 1 : 0;
    if (room.turn === 0) room.turnNumber++;
  } else {
    room.step = STEPS[cur + 1];
  }

  if (room.step === "untap") {
    room.players[room.turn] = untapAll(room.players[room.turn]);
    addLog(room, `🔄 Turno ${room.turnNumber} — ${room.players[room.turn].name}`, "system");
  }
  if (room.step === "draw" && room.turnNumber > 1) {
    room.players[room.turn] = drawCards(room.players[room.turn], 1);
    addLog(room, `📖 ${room.players[room.turn].name} compra uma carta`, "draw");
  }
  if (room.step === "combat") {
    room.combatPhase = "declare_attackers";
    room.attackers = [];
    room.blockers = {};
  } else {
    room.combatPhase = null;
  }
  if (room.step === "end") {
    // ✅ FIX: descarte automático para 7 se mão tiver mais
    const ap = room.players[room.turn];
    if (ap && ap.hand.length > 7) {
      const excess = ap.hand.length - 7;
      const discarded = ap.hand.splice(7, excess);
      ap.graveyard.push(...discarded);
      addLog(room, `✋ ${ap.name} descartou ${excess} carta(s) (mão cheia)`, "info");
    }
  }
};

const resolveEffect = (room, card, casterIdx, targetUid) => {
  const oppIdx = 1 - casterIdx;

  // ✅ FIX: sempre lê e escreve via room.players[idx] para garantir persistência
  if (card.effect === "deal_3_damage" || card.effect === "deal_4_damage") {
    const dmg = card.effect === "deal_3_damage" ? 3 : 4;
    const tgt = room.players[oppIdx].battlefield.find(c => c.uid === targetUid);
    if (tgt) {
      room.players[oppIdx].battlefield = room.players[oppIdx].battlefield
        .map(c => c.uid === targetUid ? { ...c, damage: (c.damage || 0) + dmg } : c)
        .filter(c => (c.toughness || 0) > (c.damage || 0));
      addLog(room, `⚡ ${card.name} causa ${dmg} dano a ${tgt.name}`, "combat");
    } else {
      room.players[oppIdx].life -= dmg;
      addLog(room, `⚡ ${card.name} causa ${dmg} dano direto! (${room.players[oppIdx].name} agora tem ${room.players[oppIdx].life} de vida)`, "combat");
    }
  }

  if (card.effect === "destroy_creature") {
    const tgt = room.players[oppIdx].battlefield.find(c => c.uid === targetUid);
    if (tgt) {
      room.players[oppIdx].battlefield = room.players[oppIdx].battlefield.filter(c => c.uid !== targetUid);
      room.players[oppIdx].graveyard.push(tgt);
      addLog(room, `☠️ ${tgt.name} destruído por ${card.name}!`, "destroy");
    }
  }

  if (card.effect === "exile_creature") {
    const tgt = room.players[oppIdx].battlefield.find(c => c.uid === targetUid);
    if (tgt) {
      room.players[oppIdx].battlefield = room.players[oppIdx].battlefield.filter(c => c.uid !== targetUid);
      addLog(room, `✨ ${tgt.name} exilado por ${card.name}!`, "exile");
    }
  }

  if (card.effect === "destroy_all_creatures") {
    room.players[0].graveyard.push(...room.players[0].battlefield.filter(c => c.type !== "land"));
    room.players[0].battlefield = room.players[0].battlefield.filter(c => c.type === "land");
    room.players[1].graveyard.push(...room.players[1].battlefield.filter(c => c.type !== "land"));
    room.players[1].battlefield = room.players[1].battlefield.filter(c => c.type === "land");
    addLog(room, `🌪️ Ira de Deus! Todas as criaturas destruídas!`, "destroy");
  }

  if (card.effect === "draw_3") {
    room.players[casterIdx] = drawCards(room.players[casterIdx], 3);
    addLog(room, `🧠 ${room.players[casterIdx].name} compra 3 cartas!`, "draw");
  }

  if (card.effect === "add_3_black_mana") {
    room.players[casterIdx].manaPool.B = (room.players[casterIdx].manaPool.B || 0) + 3;
    addLog(room, `💀 Ritual Negro! +3 mana preto`, "mana");
  }

  // ✅ FIX: Counterspell agora realmente contramagica o último feitiço do oponente
  if (card.effect === "counter_spell") {
    const lastSpell = room.players[oppIdx].graveyard.slice().reverse().find(c => c.type !== "land");
    if (lastSpell) {
      addLog(room, `🌊 ${card.name} contramagicou ${lastSpell.name}!`, "spell");
    } else {
      addLog(room, `🌊 ${card.name} — nenhum alvo válido no momento`, "info");
    }
  }

  if (card.effect === "pump_creature") {
    const p = card.pump || { power: 3, toughness: 3 };
    const tgt = room.players[casterIdx].battlefield.find(c => c.uid === targetUid);
    if (tgt) {
      room.players[casterIdx].battlefield = room.players[casterIdx].battlefield.map(c =>
        c.uid === targetUid ? { ...c, power: (c.power || 0) + p.power, toughness: (c.toughness || 0) + p.toughness } : c
      );
      addLog(room, `💪 ${tgt.name} +${p.power}/+${p.toughness}!`, "buff");
    }
  }
};

const resolveCombat = (room) => {
  const atkIdx = room.turn;
  const defIdx = 1 - room.turn;

  room.attackers.forEach(atkUid => {
    const attacker = room.players[atkIdx].battlefield.find(c => c.uid === atkUid);
    if (!attacker) return;
    const blockerUid = room.blockers[atkUid];

    if (blockerUid) {
      const blocker = room.players[defIdx].battlefield.find(c => c.uid === blockerUid);
      if (!blocker) return;
      const ad = attacker.power || 0, bd = blocker.power || 0;
      addLog(room, `💥 ${attacker.name}(${ad}) vs ${blocker.name}(${bd})`, "combat");
      if (ad >= (blocker.toughness || 0)) {
        room.players[defIdx].battlefield = room.players[defIdx].battlefield.filter(c => c.uid !== blockerUid);
        room.players[defIdx].graveyard.push(blocker);
        addLog(room, `💀 ${blocker.name} morre!`, "destroy");
      }
      if (bd >= (attacker.toughness || 0)) {
        room.players[atkIdx].battlefield = room.players[atkIdx].battlefield.filter(c => c.uid !== atkUid);
        room.players[atkIdx].graveyard.push(attacker);
        addLog(room, `💀 ${attacker.name} morre!`, "destroy");
      }
    } else {
      const dmg = attacker.power || 0;
      room.players[defIdx].life -= dmg;
      addLog(room, `🗡️ ${attacker.name} causa ${dmg} dano! (${room.players[defIdx].name}: ${room.players[defIdx].life} ❤️)`, "combat");
    }
  });

  room.attackers = [];
  room.blockers = {};
  room.combatPhase = null;
  checkWinner(room);
};

// ─── BOT AI SYSTEM ───────────────────────────────────────────

// Avalia o "valor" de uma carta para o bot
const cardValue = (card) => {
  if (!card) return 0;
  if (card.type === "creature") {
    const base = (card.power || 0) + (card.toughness || 0);
    const abilityBonus = (card.abilities || []).reduce((s, a) => s + ({flying:2,trample:1,haste:2,vigilance:1,first_strike:1,tap_mana:1}[a]||0), 0);
    return base + abilityBonus;
  }
  if (card.effect === "destroy_all_creatures") return 8;
  if (card.effect === "exile_creature") return 5;
  if (card.effect === "destroy_creature") return 4;
  if (card.effect === "deal_4_damage") return 4;
  if (card.effect === "deal_3_damage") return 3;
  if (card.effect === "draw_3") return 4;
  if (card.effect === "pump_creature") return 2;
  if (card.effect === "add_3_black_mana") return 2;
  return 1;
};

// Avalia o estado do jogo para o bot (positivo = vantagem do bot)
const evaluateBoard = (room, botIdx) => {
  const playerIdx = 1 - botIdx;
  let score = 0;
  // Diferença de vida
  score += (room.players[botIdx].life - room.players[playerIdx].life) * 2;
  // Valor das criaturas em campo
  room.players[botIdx].battlefield.filter(c=>c.type==="creature").forEach(c => score += cardValue(c));
  room.players[playerIdx].battlefield.filter(c=>c.type==="creature").forEach(c => score -= cardValue(c));
  // Cartas na mão
  score += room.players[botIdx].hand.length * 0.5;
  score -= room.players[playerIdx].hand.length * 0.5;
  return score;
};

// Verifica se o bot pode pagar o custo
const botCanAfford = (card, pool) => canAfford(card, pool);

// Bot toca todas as terras disponíveis para gerar mana
const botTapAllLands = (room, botIdx) => {
  const bot = room.players[botIdx];
  bot.battlefield.filter(c => c.type === "land" && !c.tapped).forEach(land => {
    bot.battlefield = bot.battlefield.map(c => c.uid === land.uid ? { ...c, tapped: true } : c);
    if (land.produces) land.produces.forEach(m => { bot.manaPool[m] = (bot.manaPool[m] || 0) + 1; });
  });
  // Tap criaturas com tap_mana (Llanowar Elves)
  bot.battlefield.filter(c => c.type === "creature" && !c.tapped && !c.summoningSick && (c.abilities||[]).includes("tap_mana")).forEach(creature => {
    bot.battlefield = bot.battlefield.map(c => c.uid === creature.uid ? { ...c, tapped: true } : c);
    bot.manaPool.G = (bot.manaPool.G || 0) + 1;
    addLog(room, `🧝 ${bot.name} toca ${creature.name} → +1 mana verde`, "mana");
  });
};

// Bot joga uma terra da mão se tiver
const botPlayLand = (room, botIdx) => {
  const bot = room.players[botIdx];
  if (bot.landsPlayedThisTurn >= 1) return;
  const land = bot.hand.find(c => c.type === "land");
  if (!land) return;
  bot.hand = bot.hand.filter(c => c.uid !== land.uid);
  const newLand = { ...land, uid: mkuid(), tapped: false };
  bot.battlefield.push(newLand);
  bot.landsPlayedThisTurn++;
  bot.maxMana++;
  addLog(room, `🏔️ ${bot.name} joga ${land.name}`, "play");
};

// Bot escolhe a melhor carta para jogar baseado na dificuldade
const botChooseSpell = (room, botIdx, difficulty) => {
  const bot = room.players[botIdx];
  const oppIdx = 1 - botIdx;
  const playable = bot.hand.filter(c => c.type !== "land" && botCanAfford(c, bot.manaPool));
  if (playable.length === 0) return null;

  if (difficulty === "random") return playable[Math.floor(Math.random() * playable.length)];

  if (difficulty === "basic") {
    // Prefere criaturas, depois dano direto
    return playable.sort((a,b) => cardValue(b) - cardValue(a))[0];
  }

  if (difficulty === "medium" || difficulty === "hard") {
    const oppCreatures = room.players[oppIdx].battlefield.filter(c => c.type === "creature");
    const myCreatures = bot.battlefield.filter(c => c.type === "creature");

    // Prioridade hard: remover ameaças > criar criaturas > dano direto
    if (difficulty === "hard") {
      // Se oponente tem criaturas voadoras poderosas, usa remoção
      const threats = oppCreatures.filter(c => cardValue(c) >= 6);
      if (threats.length > 0) {
        const removal = playable.find(c => ["destroy_creature","exile_creature","destroy_all_creatures"].includes(c.effect));
        if (removal) return removal;
      }
      // Se pode matar o oponente com dano direto, faz isso
      const dmgSpells = playable.filter(c => ["deal_3_damage","deal_4_damage"].includes(c.effect));
      const totalDmg = dmgSpells.reduce((s,c) => s + (c.effect==="deal_3_damage"?3:4), 0);
      if (totalDmg >= room.players[oppIdx].life) return dmgSpells[0];
      // Se vida baixa, cura com pump ou usa remoção
      if (room.players[botIdx].life <= 8) {
        const removal = playable.find(c => ["destroy_all_creatures","destroy_creature","exile_creature"].includes(c.effect));
        if (removal) return removal;
      }
    }
    // Geral medium/hard: maior valor
    return playable.sort((a,b) => cardValue(b) - cardValue(a))[0];
  }
  return playable[0];
};

// Bot escolhe atacantes
const botChooseAttackers = (room, botIdx, difficulty) => {
  const bot = room.players[botIdx];
  const oppIdx = 1 - botIdx;
  const eligible = bot.battlefield.filter(c => c.type === "creature" && !c.tapped && !c.summoningSick);
  if (eligible.length === 0) return [];

  if (difficulty === "random") {
    return eligible.filter(() => Math.random() > 0.4).map(c => c.uid);
  }

  if (difficulty === "basic") {
    // Ataca com tudo se tiver vantagem ou vida do oponente for baixa
    const myPower = eligible.reduce((s,c) => s + (c.power||0), 0);
    if (myPower > 0) return eligible.map(c => c.uid);
    return [];
  }

  if (difficulty === "medium" || difficulty === "hard") {
    const oppCreatures = room.players[oppIdx].battlefield.filter(c => c.type === "creature" && !c.tapped);
    const oppLife = room.players[oppIdx].life;

    // Hard: calcula se ataque causa dano letal
    if (difficulty === "hard") {
      const totalPower = eligible.reduce((s,c) => s + (c.power||0), 0);
      if (totalPower >= oppLife) return eligible.map(c => c.uid); // ataque letal!
    }

    // Ataca com criaturas que têm vantagem sobre bloqueadores
    if (oppCreatures.length === 0) return eligible.map(c => c.uid); // sem bloqueadores, ataca tudo

    // Ataca com criaturas que sobrevivem ao bloqueio ou têm flying
    return eligible.filter(atk => {
      if ((atk.abilities||[]).includes("flying")) {
        // Voa — só bloqueia se oponente tiver voador
        const canBeBlocked = oppCreatures.some(b => (b.abilities||[]).includes("flying"));
        return !canBeBlocked || atk.power > 0;
      }
      // Terrestre — ataca se tiver poder suficiente
      const worstBlocker = oppCreatures.sort((a,b) => (b.power||0)-(a.power||0))[0];
      if (!worstBlocker) return true;
      // Ataca se mata o bloqueador sem morrer (ou tem trample)
      const survives = (atk.toughness||0) > (worstBlocker.power||0);
      const killsBlocker = (atk.power||0) >= (worstBlocker.toughness||0);
      const hasTramp = (atk.abilities||[]).includes("trample");
      return survives || killsBlocker || hasTramp;
    }).map(c => c.uid);
  }
  return [];
};

// Bot escolhe bloqueadores
const botChooseBlockers = (room, botIdx, difficulty) => {
  const bot = room.players[botIdx];
  const attackers = room.attackers.map(uid => {
    const atkIdx = 1 - botIdx;
    return room.players[atkIdx].battlefield.find(c => c.uid === uid);
  }).filter(Boolean);

  const myCreatures = bot.battlefield.filter(c => c.type === "creature" && !c.tapped);
  const blockers = {};

  if (difficulty === "random") {
    attackers.forEach(atk => {
      const blocker = myCreatures[Math.floor(Math.random() * myCreatures.length)];
      if (blocker && Math.random() > 0.5) blockers[atk.uid] = blocker.uid;
    });
    return blockers;
  }

  if (difficulty === "basic") {
    // Bloqueia o atacante mais forte com o bloqueador mais forte
    const sortedAtk = [...attackers].sort((a,b) => (b.power||0)-(a.power||0));
    const sortedBlk = [...myCreatures].sort((a,b) => (b.power||0)-(a.power||0));
    sortedAtk.forEach((atk, i) => { if (sortedBlk[i]) blockers[atk.uid] = sortedBlk[i].uid; });
    return blockers;
  }

  if (difficulty === "medium" || difficulty === "hard") {
    const usedBlockers = new Set();
    // Ordena atacantes por ameaça (maior dano primeiro)
    const sortedAtk = [...attackers].sort((a,b) => (b.power||0)-(a.power||0));

    sortedAtk.forEach(atk => {
      // Encontra o melhor bloqueador para este atacante
      const best = myCreatures
        .filter(b => !usedBlockers.has(b.uid))
        .filter(b => {
          if ((atk.abilities||[]).includes("flying")) return (b.abilities||[]).includes("flying");
          return true;
        })
        .sort((a,b) => {
          // Prefere bloqueador que: mata o atacante E sobrevive
          const aKills = (a.power||0) >= (atk.toughness||0);
          const bKills = (b.power||0) >= (atk.toughness||0);
          const aSurv = (a.toughness||0) > (atk.power||0);
          const bSurv = (b.toughness||0) > (atk.power||0);
          const aScore = (aKills?2:0) + (aSurv?1:0);
          const bScore = (bKills?2:0) + (bSurv?1:0);
          return bScore - aScore;
        })[0];

      if (best) {
        // Hard: só bloqueia se vale a pena
        if (difficulty === "hard") {
          const kills = (best.power||0) >= (atk.toughness||0);
          const survives = (best.toughness||0) > (atk.power||0);
          const atkDmgSignificant = (atk.power||0) >= 3;
          if (kills || survives || atkDmgSignificant) {
            blockers[atk.uid] = best.uid;
            usedBlockers.add(best.uid);
          }
        } else {
          blockers[atk.uid] = best.uid;
          usedBlockers.add(best.uid);
        }
      }
    });
    return blockers;
  }
  return {};
};

// Executa o turno completo do bot com delay para parecer humano
const runBotTurn = (room, botIdx, difficulty) => {
  if (room.winner !== null) return;
  const delay = { random:300, basic:600, medium:900, hard:1200 }[difficulty] || 800;

  const step = (fn, ms) => new Promise(r => setTimeout(() => { fn(); r(); }, ms));

  const doTurn = async () => {
    if (!rooms[room.code] || room.winner !== null) return;

    // UNTAP
    room.players[botIdx] = untapAll(room.players[botIdx]);
    addLog(room, `🔄 Turno ${room.turnNumber} — ${room.players[botIdx].name} (🤖)`, "system");
    broadcastRoom(room);
    await step(()=>{}, delay);

    // UPKEEP
    addLog(room, `⬆️ Manutenção do bot`, "info");
    broadcastRoom(room);
    await step(()=>{}, delay/2);

    // DRAW
    if (room.turnNumber > 1) {
      room.players[botIdx] = drawCards(room.players[botIdx], 1);
      addLog(room, `📖 ${room.players[botIdx].name} compra uma carta`, "draw");
      broadcastRoom(room);
    }
    await step(()=>{}, delay);

    // MAIN1 — toca terras, convoca criaturas, lança feitiços
    botTapAllLands(room, botIdx);
    botPlayLand(room, botIdx);
    botTapAllLands(room, botIdx); // retoca após jogar terra
    broadcastRoom(room);
    await step(()=>{}, delay);

    // Lança feitiços/criaturas
    let spellsCast = 0;
    const maxSpells = difficulty === "hard" ? 5 : difficulty === "medium" ? 3 : 2;
    while (spellsCast < maxSpells) {
      const card = botChooseSpell(room, botIdx, difficulty);
      if (!card) break;
      const bot = room.players[botIdx];
      bot.manaPool = payMana(card.cost || {}, bot.manaPool);
      bot.hand = bot.hand.filter(c => c.uid !== card.uid);
      if (card.type === "creature") {
        bot.battlefield.push({ ...card, uid: mkuid(), tapped: false, summoningSick: true, damage: 0 });
        addLog(room, `🐉 ${bot.name} convoca ${card.name} (${card.power}/${card.toughness})`, "play");
      } else {
        // Escolhe alvo para feitiços
        const oppIdx = 1 - botIdx;
        let targetUid = null;
        if (["destroy_creature","exile_creature","deal_3_damage","deal_4_damage"].includes(card.effect)) {
          const targets = room.players[oppIdx].battlefield.filter(c => c.type === "creature");
          if (targets.length > 0) {
            targetUid = targets.sort((a,b) => cardValue(b)-cardValue(a))[0].uid;
          }
        }
        if (["pump_creature"].includes(card.effect)) {
          const myCreatures = bot.battlefield.filter(c => c.type === "creature");
          if (myCreatures.length > 0) targetUid = myCreatures.sort((a,b) => cardValue(b)-cardValue(a))[0].uid;
        }
        bot.graveyard.push(card);
        addLog(room, `🪄 ${bot.name} lança ${card.name}`, "spell");
        resolveEffect(room, card, botIdx, targetUid);
      }
      checkWinner(room);
      broadcastRoom(room);
      if (room.winner !== null) return;
      spellsCast++;
      await step(()=>{}, delay);
      botTapAllLands(room, botIdx); // toca mais terras se precisar
    }

    // COMBAT
    addLog(room, `⚔️ Fase de combate do bot`, "info");
    room.combatPhase = "declare_attackers";
    room.attackers = [];
    broadcastRoom(room);
    await step(()=>{}, delay);

    const attackerUids = botChooseAttackers(room, botIdx, difficulty);
    room.attackers = attackerUids;
    room.players[botIdx].battlefield = room.players[botIdx].battlefield.map(c =>
      attackerUids.includes(c.uid) ? { ...c, tapped: true } : c
    );

    if (attackerUids.length === 0) {
      addLog(room, `🛡️ ${room.players[botIdx].name} não ataca`, "info");
      room.combatPhase = null;
    } else {
      addLog(room, `⚔️ ${room.players[botIdx].name} ataca com ${attackerUids.length} criatura(s)!`, "combat");
      room.combatPhase = "declare_blockers";
      broadcastRoom(room);
      // Jogador humano tem tempo para bloquear
      await step(()=>{}, delay * 3);

      // Se humano não bloqueou, bot resolve
      if (rooms[room.code] && room.combatPhase === "declare_blockers") {
        addLog(room, `🛡️ Bloqueio confirmado`, "combat");
        resolveCombat(room);
        checkWinner(room);
        if (room.winner !== null) { broadcastRoom(room); return; }
      }
    }
    broadcastRoom(room);
    await step(()=>{}, delay);

    // MAIN2
    botTapAllLands(room, botIdx);
    const card2 = botChooseSpell(room, botIdx, difficulty);
    if (card2) {
      const bot = room.players[botIdx];
      bot.manaPool = payMana(card2.cost || {}, bot.manaPool);
      bot.hand = bot.hand.filter(c => c.uid !== card2.uid);
      if (card2.type === "creature") {
        bot.battlefield.push({ ...card2, uid: mkuid(), tapped: false, summoningSick: true, damage: 0 });
        addLog(room, `🐉 ${bot.name} convoca ${card2.name}`, "play");
      } else {
        bot.graveyard.push(card2);
        addLog(room, `🪄 ${bot.name} lança ${card2.name}`, "spell");
        resolveEffect(room, card2, botIdx, null);
      }
      checkWinner(room);
      broadcastRoom(room);
      if (room.winner !== null) return;
      await step(()=>{}, delay);
    }

    // END
    const ap = room.players[botIdx];
    if (ap.hand.length > 7) {
      const excess = ap.hand.length - 7;
      ap.graveyard.push(...ap.hand.splice(7, excess));
      addLog(room, `✋ ${ap.name} descartou ${excess} carta(s)`, "info");
    }

    // Passa turno para o humano
    room.turn = 1 - botIdx;
    room.step = "untap";
    room.combatPhase = null;
    room.attackers = [];
    room.blockers = {};
    if (room.turn === 0) room.turnNumber++;
    room.players[room.turn] = untapAll(room.players[room.turn]);
    if (room.turnNumber > 1) {
      room.players[room.turn] = drawCards(room.players[room.turn], 1);
      addLog(room, `📖 ${room.players[room.turn].name} compra uma carta`, "draw");
    }
    room.step = "upkeep";
    addLog(room, `🔄 Turno ${room.turnNumber} — ${room.players[room.turn].name}`, "system");
    broadcastRoom(room);
  };

  doTurn().catch(e => console.error("Bot error:", e));
};


io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ── Create VS Bot ──
  socket.on("create_vs_bot", ({ name, colors, difficulty }) => {
    const code = genCode();
    const room = mkRoom(code);
    room.isBot = true;
    room.botDifficulty = difficulty || "medium";
    room.botIdx = 1;
    rooms[code] = room;

    const botColors = ["R","G","B","W","U"].sort(()=>Math.random()-.5).slice(0,2);
    const botNames = { random:"Mago Aleatório 🎲", basic:"Aprendiz Arcano 📚", medium:"Feiticeiro Sombrio 🌑", hard:"Arquimago Supremo 💀" };
    const botName = botNames[difficulty] || "Mago Bot";

    room.players[0] = mkPlayer(socket.id, name, colors);
    room.players[1] = mkPlayer("BOT", botName, botColors);
    room.sockets = [socket.id, "BOT"];

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 0;

    room.step = "upkeep";
    room.turn = 0;
    room.turnNumber = 1;
    addLog(room, `⚔️ ${name} vs ${botName} — Que a batalha comece!`, "system");
    room.players[0] = drawCards(room.players[0], 1);
    addLog(room, `📖 ${name} compra uma carta`, "draw");
    broadcastRoom(room);
    console.log(`Bot room ${code}: ${name} vs ${botName} (${difficulty})`);
  });

  // ── Declare Blockers (vs Bot — bot resolve automaticamente após humano bloquear) ──
  socket.on("declare_blockers_human", () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.isBot || room.combatPhase !== "declare_blockers") return;
    const humanIdx = socket.data.playerIndex;
    addLog(room, `🛡️ ${room.players[humanIdx].name} declara bloqueadores`, "combat");
    resolveCombat(room);
    checkWinner(room);
    broadcastRoom(room);
    if (room.winner !== null) return;
    // Continua o turno do bot após bloqueio
    room.combatPhase = null;
  });

  // ── Rejoin Room (reconexão após reload) ──
  socket.on("rejoin_room", ({ code, name }) => {
    const room = rooms[code?.toUpperCase()];
    if (!room || room.players.length < 1) {
      socket.emit("rejoin_failed");
      return;
    }
    // Encontra o jogador pelo nome
    const idx = room.players.findIndex(p => p.name === name);
    if (idx === -1) {
      socket.emit("rejoin_failed");
      return;
    }
    // Reconecta o socket ao jogador
    const oldSocketId = room.sockets[idx];
    room.sockets[idx] = socket.id;
    room.players[idx].socketId = socket.id;
    socket.join(code.toUpperCase());
    socket.data.roomCode = code.toUpperCase();
    socket.data.playerIndex = idx;
    addLog(room, `🔁 ${name} reconectou!`, "system");
    broadcastRoom(room);
    console.log(`${name} rejoined room ${code}`);
  });

  // ── Create Room ──
socket.on("create_room", ({ name, colors }) => {
    const code = genCode();
    const room = mkRoom(code);
    rooms[code] = room;
    room.sockets.push(socket.id);
    room._pending = [{ name, colors }]; // ✅ FIX: salva host no pending imediatamente
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerIndex = 0;
    addLog(room, `🏰 Sala criada. Aguardando oponente...`, "system");
    socket.emit("room_created", { code });
    console.log(`Room ${code} created by ${name}`);
  });

  // ── Join Room ──
  socket.on("join_room", ({ code, name, colors }) => {
    const room = rooms[code.toUpperCase()];
    if (!room) { socket.emit("error", { msg: "Sala não encontrada!" }); return; }
    if (room.sockets.length >= 2) { socket.emit("error", { msg: "Sala cheia!" }); return; }

    socket.join(code.toUpperCase());
    socket.data.roomCode = code.toUpperCase();
    socket.data.playerIndex = room.sockets.length;
    room.sockets.push(socket.id);

    // Store name+colors temporarily until both joined
    if (!room._pending) room._pending = [];
    room._pending.push({ name, colors });

    if (room.sockets.length === 2) {
      // Build both players
      room.players[0] = mkPlayer(room.sockets[0], room._pending[0].name, room._pending[0].colors);
      room.players[1] = mkPlayer(room.sockets[1], room._pending[1].name, room._pending[1].colors);
      room.step = "untap";
      addLog(room, `⚔️ ${room.players[0].name} vs ${room.players[1].name} — Que a batalha comece!`, "system");
      advanceStep(room); // go to upkeep
      broadcastRoom(room);
    } else {
      socket.emit("waiting", { msg: "Aguardando oponente..." });
    }
  });

  // ── Set name (for host who created room before opponent joined) ──
  socket.on("set_player_info", ({ name, colors }) => {
    const code = socket.data.roomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    if (!room._pending) room._pending = [];
    room._pending[0] = { name, colors };
  });

  // ── Tap Creature (abilities like tap_mana) ──
  socket.on("tap_creature", ({ cardUid }) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx) return;
    const player = room.players[idx];
    const card = player.battlefield.find(c => c.uid === cardUid);
    if (!card || card.type !== "creature" || card.tapped || card.summoningSick) return;
    if (!card.abilities || !card.abilities.includes("tap_mana")) return;
    // ✅ FIX: Llanowar Elves e similares geram 1 mana verde ao ser virados
    player.battlefield = player.battlefield.map(c => c.uid === cardUid ? { ...c, tapped: true } : c);
    player.manaPool.G = (player.manaPool.G || 0) + 1;
    addLog(room, `🧝 ${player.name} toca ${card.name} → +1 mana verde`, "mana");
    broadcastRoom(room);
  });

  // ── Play Land ──
  socket.on("play_land", ({ cardUid }) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx || !["main1","main2"].includes(room.step)) return;
    const player = room.players[idx];
    if (player.landsPlayedThisTurn >= 1) { socket.emit("error", { msg: "Já jogou terra este turno!" }); return; }
    const card = player.hand.find(c => c.uid === cardUid);
    if (!card || card.type !== "land") return;
    player.hand = player.hand.filter(c => c.uid !== cardUid);
    const newCard = { ...card, uid: mkuid(), tapped: false };
    player.battlefield.push(newCard);
    if (card.produces) card.produces.forEach(m => { player.manaPool[m] = (player.manaPool[m] || 0) + 1; });
    player.landsPlayedThisTurn++;
    player.maxMana++;
    addLog(room, `🏔️ ${player.name} joga ${card.name}`, "play");
    broadcastRoom(room);
  });

  // ── Tap Land ──
  socket.on("tap_land", ({ cardUid }) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx) return;
    const player = room.players[idx];
    const card = player.battlefield.find(c => c.uid === cardUid);
    if (!card || card.type !== "land" || card.tapped) return;
    player.battlefield = player.battlefield.map(c => c.uid === cardUid ? { ...c, tapped: true } : c);
    if (card.produces) card.produces.forEach(m => { player.manaPool[m] = (player.manaPool[m] || 0) + 1; });
    addLog(room, `✊ ${player.name} toca ${card.name}`, "mana");
    broadcastRoom(room);
  });

  // ── Cast Spell/Creature ──
  socket.on("cast_card", ({ cardUid, targetUid }) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx || !["main1","main2","combat"].includes(room.step)) return;
    const player = room.players[idx];
    const card = player.hand.find(c => c.uid === cardUid);
    if (!card || card.type === "land") return;
    if (!canAfford(card, player.manaPool)) { socket.emit("error", { msg: "Mana insuficiente!" }); return; }
    player.manaPool = payMana(card.cost || {}, player.manaPool);
    player.hand = player.hand.filter(c => c.uid !== cardUid);
    if (card.type === "creature") {
      player.battlefield.push({ ...card, uid: mkuid(), tapped: false, summoningSick: true, damage: 0 });
      addLog(room, `🐉 ${player.name} convoca ${card.name} (${card.power}/${card.toughness})`, "play");
    } else {
      player.graveyard.push(card);
      addLog(room, `🪄 ${player.name} lança ${card.name}`, "spell");
      resolveEffect(room, card, idx, targetUid);
    }
    checkWinner(room);
    broadcastRoom(room);
  });

  // ── Skip to End (pular combate / passar turno direto) ──
  socket.on("skip_to_end", () => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx) return;
    let safety = 0;
    while (room.step !== "end" && safety++ < 10) advanceStep(room);
    addLog(room, `⏭️ ${room.players[idx].name} passou o turno`, "info");
    // Passa para o próximo turno
    advanceStep(room); // end -> untap próximo jogador
    broadcastRoom(room);
    // Se virou turno do bot, inicia IA
    if (room.isBot && room.turn === room.botIdx) {
      setTimeout(() => runBotTurn(room, room.botIdx, room.botDifficulty), 800);
    }
  });

  // ── Advance Step ──
  socket.on("advance_step", () => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx || room.step === "waiting") return;
    advanceStep(room);
    broadcastRoom(room);
    // Se virou turno do bot, inicia IA
    if (room.isBot && room.turn === room.botIdx && room.step === "upkeep") {
      setTimeout(() => runBotTurn(room, room.botIdx, room.botDifficulty), 800);
    }
  });

  // ── Draw Card (draw step) ──
  socket.on("draw_card", () => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx || room.step !== "draw") return;
    room.players[idx] = drawCards(room.players[idx], 1);
    addLog(room, `📖 ${room.players[idx].name} compra uma carta`, "draw");
    advanceStep(room);
    broadcastRoom(room);
  });

  // ── Toggle Attacker ──
  socket.on("toggle_attacker", ({ cardUid }) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx || room.combatPhase !== "declare_attackers") return;
    const card = room.players[idx].battlefield.find(c => c.uid === cardUid);
    if (!card || card.type !== "creature" || card.tapped || card.summoningSick) return;
    if (room.attackers.includes(cardUid)) {
      room.attackers = room.attackers.filter(u => u !== cardUid);
    } else {
      room.attackers.push(cardUid);
    }
    broadcastRoom(room);
  });

  // ── Declare Attackers ──
  socket.on("declare_attackers", () => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn !== idx || room.combatPhase !== "declare_attackers") return;
    // tap attackers
    room.players[idx].battlefield = room.players[idx].battlefield.map(c =>
      room.attackers.includes(c.uid) ? { ...c, tapped: true } : c
    );
    if (room.attackers.length === 0) {
      addLog(room, `🛡️ ${room.players[idx].name} não ataca`, "info");
      room.combatPhase = null;
      advanceStep(room);
    } else {
      addLog(room, `⚔️ ${room.players[idx].name} ataca com ${room.attackers.length} criatura(s)!`, "combat");
      room.combatPhase = "declare_blockers";
    }
    broadcastRoom(room);
  });

  // ── Toggle Blocker ──
  socket.on("toggle_blocker", ({ blockerUid, attackerUid }) => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn === idx || room.combatPhase !== "declare_blockers") return;
    const card = room.players[idx].battlefield.find(c => c.uid === blockerUid);
    if (!card || card.type !== "creature" || card.tapped) return;
    // remove this blocker from any previous assignment
    for (const k of Object.keys(room.blockers)) {
      if (room.blockers[k] === blockerUid) delete room.blockers[k];
    }
    if (attackerUid) room.blockers[attackerUid] = blockerUid;
    broadcastRoom(room);
  });

  // ── Declare Blockers ──
  socket.on("declare_blockers", () => {
    const code = socket.data.roomCode;
    const idx = socket.data.playerIndex;
    const room = rooms[code];
    if (!room || room.turn === idx || room.combatPhase !== "declare_blockers") return;
    addLog(room, `🛡️ ${room.players[idx].name} declara bloqueadores`, "combat");
    resolveCombat(room);
    advanceStep(room); // go to main2
    broadcastRoom(room);
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (code && rooms[code]) {
      const room = rooms[code];
      addLog(room, `⚠️ Um jogador desconectou`, "error");
      broadcastRoom(room);
      // cleanup after 5 min
      setTimeout(() => { if (rooms[code]) delete rooms[code]; }, 5 * 60 * 1000);
    }
  });
});

// ─── HEALTH ──────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ok", rooms: Object.keys(rooms).length }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🧙 Magic Server running on port ${PORT}`));
