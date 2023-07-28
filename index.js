const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const port = 3001;

app.use(cors());

// Configuração dos diretórios
const videosDir = path.join(__dirname, 'videos');
const thumbnailsDir = path.join(__dirname, 'thumbnails');

// Verifica se a pasta "videos" existe, senão cria
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir);
}

// Verifica se a pasta "thumbnails" existe, senão cria
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir);
}

// Lista de vídeos disponíveis (adicione mais vídeos conforme necessário)
const videos = [
  {
    id: 1,
    title: 'Vídeo 5s',
    filename: 'sample-5s.mp4',
    thumb: 'sample-5s.png',
  },
  {
    id: 2,
    title: 'Vídeo 10s',
    filename: 'sample-10s.mp4',
    thumb: 'sample-10s.png',
  },
];

app.get('/', (req, res) => {
  res.send('Selecione um vídeo para assistir:');
});

app.get('/videos', (req, res) => {
  res.json(videos);
});

// Adicione a rota para servir as imagens
const imagesDir = path.join(__dirname, 'images');
app.use('/images', express.static(imagesDir));

// Rota para obter a miniatura de um vídeo
app.get('/api/thumbnails/:video_id', (req, res) => {
  const videoId = parseInt(req.params.video_id);
  const video = videos.find((v) => v.id === videoId);

  if (!video) {
    return res.status(404).send('Vídeo não encontrado');
  }

  const videoPath = path.join(videosDir, video.filename);
  const thumbnailPath = path.join(thumbnailsDir, `${videoId}.jpg`);

  if (fs.existsSync(thumbnailPath)) {
    // Se a miniatura já existe, envie-a como resposta
    return res.sendFile(thumbnailPath);
  }

  // Se a miniatura não existe, crie-a usando a biblioteca 'fluent-ffmpeg'
  const ffmpegProcess = spawn('ffmpeg', [
    '-ss',
    '00:00:01', // Captura a miniatura aos 1 segundo do vídeo
    '-i',
    videoPath,
    '-vf',
    'thumbnail,scale=320:180',
    '-qscale:v',
    '2',
    '-frames:v',
    '1',
    thumbnailPath,
  ]);

  ffmpegProcess.on('close', () => {
    // Após criar a miniatura, envie-a como resposta
    res.sendFile(thumbnailPath);
  });
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