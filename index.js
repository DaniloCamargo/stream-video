const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());

// Configuração dos diretórios
const videosDir = path.join(__dirname, 'videos');

// Verifica se a pasta "videos" existe, senão cria
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir);
}

// Lista de vídeos disponíveis (adicione mais vídeos conforme necessário)
const videos = [
  {
    id: 1,
    title: 'Vídeo 1',
    filename: 'video1.mkv',
  },
  {
    id: 2,
    title: 'Vídeo 2',
    filename: 'video2.mkv',
  },
];

app.get('/', (req, res) => {
  res.send('Selecione um vídeo para assistir:');
});

app.get('/videos', (req, res) => {
  res.json(videos);
});

app.get('/video/:video_id', (req, res) => {
  const videoId = parseInt(req.params.video_id);
  const video = videos.find((v) => v.id === videoId);

  if (!video) {
    return res.status(404).send('Vídeo não encontrado');
  }

  const videoPath = path.join(videosDir, video.filename);

  // Verifica se o arquivo de vídeo existe antes de prosseguir
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Arquivo de vídeo não encontrado');
  }

  // Define o tamanho do buffer de leitura (opcional)
  const chunkSize = 10 ** 6; // 1 MB

  // Obtem as informações do arquivo de vídeo
  const videoStat = fs.statSync(videoPath);
  const fileSize = videoStat.size;

  // Define os cabeçalhos para streaming
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkLength = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });

    const headers = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkLength,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, headers);
    file.pipe(res);
  } else {
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(200, headers);
    fs.createReadStream(videoPath).pipe(res);
  }
});

app.listen(port, () => {
  console.log(`Servidor de streaming de vídeo rodando em http://localhost:${port}`);
});