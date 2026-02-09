const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

// ⚠️ IMPORTANTE noServer: true
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  console.log('🔌 WebSocket conectado');

  ws.send('WSS funcionando no Cloud Run 🚀');

  ws.on('message', (msg) => {
    ws.send(`Echo: ${msg}`);
  });
});

// 👇 aceitar o upgrade HTTP → WebSocket
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

app.get('/', (req, res) => {
  res.send('HTTPS OK');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
