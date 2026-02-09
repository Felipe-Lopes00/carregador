const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// WebSocket sem servidor próprio (Cloud Run friendly)
const wss = new WebSocket.Server({ noServer: true });

// Estado em memória (didático)
const chargers = new Map();
const transactions = new Map();
let transactionSeq = 1;

// === OCPP HANDLER ===
function handleOcppMessage(ws, raw) {
  let msg;

  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  const [type, uid, action, payload] = msg;

  if (type !== 2) return;

  switch (action) {
    case 'BootNotification':
      chargers.set(ws, { status: 'Available' });

      ws.send(JSON.stringify([
        3,
        uid,
        {
          status: 'Accepted',
          interval: 300,
          currentTime: new Date().toISOString()
        }
      ]));
      break;

    case 'Heartbeat':
      ws.send(JSON.stringify([
        3,
        uid,
        { currentTime: new Date().toISOString() }
      ]));
      break;

    case 'StartTransaction':
      const transactionId = transactionSeq++;

      transactions.set(transactionId, {
        meterStart: payload.meterStart,
        startedAt: payload.timestamp
      });

      ws.send(JSON.stringify([
        3,
        uid,
        {
          transactionId,
          idTagInfo: { status: 'Accepted' }
        }
      ]));
      break;

    case 'StopTransaction':
      transactions.delete(payload.transactionId);

      ws.send(JSON.stringify([
        3,
        uid,
        {
          idTagInfo: { status: 'Accepted' }
        }
      ]));
      break;

    default:
      console.log('Ação OCPP não tratada:', action);
  }
}

// === WEBSOCKET LIFECYCLE ===
wss.on('connection', (ws) => {
  console.log('🔌 Carregador conectado');

  ws.on('message', (msg) => {
    console.log('📨 OCPP:', msg.toString());
    handleOcppMessage(ws, msg.toString());
  });

  ws.on('close', () => {
    console.log('❌ Carregador desconectado');
    chargers.delete(ws);
  });
});

// HTTP → WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

// HTTP endpoint só pra sanity check
app.get('/', (req, res) => {
  res.send('OCPP 1.6 Server OK ⚡');
});

// Porta Cloud Run
const PORT = process.env.PORT;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor OCPP rodando na porta ${PORT}`);
});
