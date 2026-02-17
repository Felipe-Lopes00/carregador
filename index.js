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
  } catch (err) {
    console.warn('Mensagem inválida (JSON):', raw);
    return;
  }

  // OCPP 1.6 sempre é array
  if (!Array.isArray(msg) || msg.length < 2) {
    console.warn('Formato OCPP inválido:', msg);
    return;
  }

  const [type, uid, action, payload] = msg;

  switch (type) {

    /* =========================
       CALL (charger → server)
       ========================= */
    case 2: {
      if (typeof action !== 'string' || typeof payload !== 'object') {
        sendCallError(ws, uid, 'FormationViolation', 'CALL inválido');
        return;
      }

      switch (action) {

        /* 🔌 BOOT */
        case 'BootNotification':
          chargers.set(ws, {
            status: 'Available',
            model: payload.chargePointModel,
            vendor: payload.chargePointVendor
          });

          sendCallResult(ws, uid, {
            status: 'Accepted',
            interval: 300,
            currentTime: new Date().toISOString()
          });
          break;

        /* ❤️ HEARTBEAT */
        case 'Heartbeat':
          sendCallResult(ws, uid, {
            currentTime: new Date().toISOString()
          });
          const remoteStartId = uuidv4(); // uniqueId novo
          const remoteStartId2 = uuidv4(); 
          ws.send(JSON.stringify([
            2,
            remoteStartId2,
            "RemoteStartTransaction",
            {
              connectorId: "2",
              idTag: "123456"
            }
          ]));
                    ws.send(JSON.stringify([
            2,
            remoteStartId,
            "RemoteStartTransaction",
            {
              connectorId: 1,
              idTag: "123456"
            }
          ]));
          break;

        /* 🔐 AUTORIZAÇÃO */
        case 'Authorize':
          sendCallResult(ws, uid, {
            idTagInfo: {
              status: 'Accepted'
            }
          });
          break;

        /* ⚡ INÍCIO DA TRANSAÇÃO */
        case 'StartTransaction': {
          const transactionId = transactionSeq++;

          transactions.set(transactionId, {
            connectorId: payload.connectorId,
            idTag: payload.idTag,
            meterStart: payload.meterStart,
            startedAt: payload.timestamp
          });

          sendCallResult(ws, uid, {
            transactionId,
            idTagInfo: { status: 'Accepted' }
          });
          break;
        }

        /* 📊 MEDIÇÕES */
        case 'MeterValues':
          // opcional: persistir valores
          sendCallResult(ws, uid, {});
          break;

        /* ⛔ FIM DA TRANSAÇÃO */
        case 'StopTransaction':
          transactions.delete(payload.transactionId);

          sendCallResult(ws, uid, {
            idTagInfo: { status: 'Accepted' }
          });
          break;

        /* 🔌 STATUS DO CONECTOR */
        case 'StatusNotification':
          chargers.set(ws, {
            ...chargers.get(ws),
            status: payload.status
          });

          sendCallResult(ws, uid, {});
          break;

        /* 🧩 DATA TRANSFER (vendor specific) */
        case 'DataTransfer':
          sendCallResult(ws, uid, {
            status: 'Accepted',
            data: payload.data || null
          });
          break;

        /* ❓ AÇÃO DESCONHECIDA */
        default:
          console.warn('Ação OCPP não suportada:', action);
          sendCallError(ws, uid, 'NotSupported', `Ação ${action} não suportada`);
      }
      break;
    }

    /* =========================
       CALLRESULT (server ← charger)
       ========================= */
    case 3:
      // Aqui você trata respostas a CALLs que VOCÊ enviou
      console.log('CALLRESULT recebido:', uid, payload);
      break;

    /* =========================
       CALLERROR
       ========================= */
    case 4: {
      const [ , , errorCode, errorDescription ] = msg;
      console.error('CALLERROR recebido:', errorCode, errorDescription);
      break;
    }

    default:
      console.warn('Tipo OCPP desconhecido:', type);
  }
}

/* =========================
   Helpers OCPP
   ========================= */

function sendCallResult(ws, uid, payload) {
  ws.send(JSON.stringify([3, uid, payload]));
}

function sendCallError(ws, uid, code, description) {
  ws.send(JSON.stringify([4, uid, code, description, {}]));
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
