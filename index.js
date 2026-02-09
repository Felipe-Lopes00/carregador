const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('🚀 Cloud Run funcionando!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
