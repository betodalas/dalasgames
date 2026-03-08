# ⚔️ Magic: The Gathering — Multiplayer Online

Jogo de Magic: The Gathering multiplayer em tempo real usando React + Node.js + Socket.io.

---

## 📁 Estrutura

```
magic-multiplayer/
├── server/          ← Backend (Node.js + Socket.io)
│   ├── server.js
│   └── package.json
└── client/          ← Frontend (React)
    ├── src/
    │   └── App.jsx
    └── package.json
```

---

## 🚀 Como publicar (passo a passo)

### 1. BACKEND — Deploy no Render (grátis)

1. Crie conta em **https://render.com**
2. Clique em **"New" → "Web Service"**
3. Conecte seu GitHub (faça upload da pasta `server/`)
4. Configure:
   - **Name:** `magic-server`
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Clique em **"Create Web Service"**
6. Copie a URL gerada (ex: `https://magic-server-xxxx.onrender.com`)

> ⚠️ No plano grátis, o servidor "dorme" após 15min inativo. O primeiro jogador pode esperar ~30s.

---

### 2. FRONTEND — Deploy no Vercel (grátis)

1. Crie conta em **https://vercel.com**
2. No arquivo `client/src/App.jsx`, linha 8, troque:
   ```js
   const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:3001";
   ```
   Pelo URL do seu servidor Render.

3. Crie um arquivo `client/.env.production`:
   ```
   REACT_APP_SERVER_URL=https://magic-server-xxxx.onrender.com
   ```

4. Faça upload da pasta `client/` no GitHub
5. No Vercel: **"New Project"** → importe o repositório
6. Configure:
   - **Root Directory:** `client`
   - **Framework:** Create React App
7. Clique em **Deploy**

Você receberá um link tipo `magic-game-xxxx.vercel.app` para compartilhar! 🎉

---

## 🖥️ Rodar Localmente

### Backend:
```bash
cd server
npm install
node server.js
# Roda em http://localhost:3001
```

### Frontend:
```bash
cd client
npm install
npm start
# Abre em http://localhost:3000
```

---

## 🎮 Como Jogar

1. **Jogador 1:** Entra no site → digita nome → escolhe cores → clica **"Criar Sala"**
2. **Jogador 1:** Compartilha o código de 5 letras com o amigo
3. **Jogador 2:** Entra no site → digita nome → escolhe cores → digita o código → clica **"Entrar"**
4. O jogo começa automaticamente!

### Fases do Turno:
- 🔄 **Desvirar** — suas permanentes desvirtam
- ⬆️ **Manutenção** — efeitos de upkeep
- 📖 **Comprar** — compre 1 carta
- 1️⃣ **Principal 1** — jogue terrenos, criaturas, feitiços
- ⚔️ **Combate** — declare atacantes / bloqueadores
- 2️⃣ **Principal 2** — mais feitiços/criaturas
- 🌙 **Fim** — descarte se tiver >7 cartas

### Dicas:
- Clique nos **terrenos** para gerar mana (vira a terra)
- Clique nas **criaturas** durante Combate para atacar
- Cartas instants podem ser lançadas durante o combate
- 💤 = Doença de Invocação (não pode atacar no primeiro turno)

---

## 🃏 Cartas Disponíveis

| Carta | Tipo | Custo | Efeito |
|-------|------|-------|--------|
| Serra Angel | Criatura | 4W | 4/4 Voar, Vigilância |
| Shivan Dragon | Criatura | 4RR | 5/5 Voar |
| Force of Nature | Criatura | 4GG | 8/8 Atropelar |
| Lord of the Pit | Criatura | 4BBB | 7/7 Voar |
| Lightning Bolt | Instantâneo | R | 3 dano |
| Terror | Instantâneo | 1B | Destruir criatura |
| Wrath of God | Feitiço | 2WW | Destruir tudo |
| Counterspell | Instantâneo | UU | Contramagiar |
| Brainstorm | Instantâneo | U | Comprar 3 |
| Giant Growth | Instantâneo | G | +3/+3 |
| Dark Ritual | Instantâneo | B | +3 mana preto |
| ... e mais! | | | |
