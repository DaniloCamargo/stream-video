const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const app = express();
const port = 3001;

app.use(cors());

const videosDir = path.join(__dirname, 'videos');
const thumbnailsDir = path.join(__dirname, 'thumbnails');
const dataFilePath = path.join(__dirname, 'data', 'videos.json');

if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir);
}

if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir);
}

if (!fs.existsSync(dataFilePath)) {
  fs.writeFileSync(dataFilePath, '[]');
}

function readVideoData() {
  const rawData = fs.readFileSync(dataFilePath);
  const videoData = JSON.parse(rawData);
  return videoData;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = uuidv4() + ext;
    cb(null, filename);
  },
});

const upload = multer({ storage }).single('video');

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Selecione um vídeo para assistir:');
});

app.post('/api/videos', (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({ error: 'Erro no upload do vídeo' });
    } else if (err) {
      return res.status(500).json({ error: 'Erro interno no servidor' });
    }

    const videos = readVideoData();
    const { title } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ error: 'Título, nome do arquivo e vídeo são obrigatórios' });
    }

    const newVideo = {
      id: uuidv4(),
      title,
      filename: req.file.filename,
    };

    videos.push(newVideo);

    fs.writeFileSync(dataFilePath, JSON.stringify(videos, null, 2));

    res.status(201).json(newVideo);
  });
});

app.get('/videos', (req, res) => {
  const videos = readVideoData();
  res.json(videos);
});

app.get('/cadastro', (req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  res.sendFile(filePath);
});

const imagesDir = path.join(__dirname, 'images');
app.use('/images', express.static(imagesDir));

app.get('/api/thumbnails/:video_id', (req, res) => {
  const videoId = parseInt(req.params.video_id);
  const video = videos.find((v) => v.id === videoId);

  if (!video) {
    return res.status(404).send('Vídeo não encontrado');
  }

  const videoPath = path.join(videosDir, video.filename);
  const thumbnailPath = path.join(thumbnailsDir, `${videoId}.jpg`);

  if (fs.existsSync(thumbnailPath)) {
    return res.sendFile(thumbnailPath);
  }

  const ffmpegProcess = spawn('ffmpeg', [
    '-ss',
    '00:00:01',
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
    res.sendFile(thumbnailPath);
  });
});

app.get('/video/:video_id', (req, res) => {
  const videoId = req.params.video_id;
  const videos = readVideoData();
  const video = videos.find((v) => v.id === videoId);

  if (!video) {
    return res.status(404).send('Vídeo não encontrado');
  }

  const videoPath = path.join(videosDir, video.filename);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Arquivo de vídeo não encontrado');
  }

  const chunkSize = 10 ** 6; // 1 MB

  const videoStat = fs.statSync(videoPath);
  const fileSize = videoStat.size;

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