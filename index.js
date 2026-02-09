const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
  ws.send('WSS OK 🚀');
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

app.get('/', (req, res) => {
  res.send('HTTPS OK');
});

// ⚠️ ESSENCIAL
const PORT = process.env.PORT;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
