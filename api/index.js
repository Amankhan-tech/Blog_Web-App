const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load .env before reading any config. Look next to this file first (api/.env),
// then in the folder the server was started from (e.g. the repo root).
require('dotenv').config({ path: [path.join(__dirname, '.env'), path.resolve('.env')] });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Post = require('./models/Post');

// ---------------------------------------------------------------------------
// Config — fail fast instead of silently running with unsafe defaults
// ---------------------------------------------------------------------------
const { MONGODB_URI, JWT_SECRET } = process.env;
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  console.error('Create a .env file (see README) and try again.');
  process.exit(1);
}

const salt = bcrypt.genSaltSync(10);

// ---------------------------------------------------------------------------
// File uploads
// ---------------------------------------------------------------------------
// Always resolve relative to this file so uploads land in api/uploads no matter
// which folder the server is started from.
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };
const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomBytes(16).toString('hex')}.${MIME_EXTENSIONS[file.mimetype]}`);
    },
  }),
  limits: { fileSize: FILE_SIZE_LIMIT, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      const err = new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Stored in the DB as "uploads/<name>" — the same format older posts use.
const coverPathFor = (file) => `uploads/${file.filename}`;

const removeUpload = (coverPath) => {
  if (!coverPath) return;
  // basename() keeps deletes inside UPLOAD_DIR even if a stored path is odd.
  fs.unlink(path.join(UPLOAD_DIR, path.basename(coverPath)), () => {});
};

// ---------------------------------------------------------------------------
// App + middleware
// ---------------------------------------------------------------------------
const app = express();

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use('/uploads', express.static(UPLOAD_DIR));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

// Express 4 does not catch errors thrown in async handlers; this forwards them
// to the error handler instead of crashing the process.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const verifyToken = (req, res, next) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token is required' });
  }
  jwt.verify(token, JWT_SECRET, {}, (err, info) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = info;
    next();
  });
};

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.error(e);
    res.status(400).json(e);
  }
});

app.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    return res.status(404).json({ error: 'User not found' });
  }
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (!passOk) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username, id: userDoc._id }, JWT_SECRET);
  res.cookie('token', token).json({
    id: userDoc._id,
    username,
  });
}));

app.get('/profile', verifyToken, (req, res) => {
  res.json(req.user);
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});

// ---------------------------------------------------------------------------
// Post routes
// ---------------------------------------------------------------------------
// verifyToken runs BEFORE multer so anonymous requests never write to disk.
app.post('/post', verifyToken, upload.single('file'), asyncHandler(async (req, res) => {
  const { title, summary, content } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (!title || !summary || !content) {
    removeUpload(coverPathFor(req.file));
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: coverPathFor(req.file),
      author: req.user.id,
    });
    res.json(postDoc);
  } catch (err) {
    removeUpload(coverPathFor(req.file));
    throw err;
  }
}));

app.put('/post', verifyToken, upload.single('file'), asyncHandler(async (req, res) => {
  const { id, title, summary, content } = req.body;
  const newCover = req.file ? coverPathFor(req.file) : null;
  const reject = (status, error) => {
    removeUpload(newCover);
    return res.status(status).json({ error });
  };

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reject(400, 'Invalid post ID');
  }
  if (!title || !summary || !content) {
    return reject(400, 'All fields are required');
  }

  const postDoc = await Post.findById(id);
  if (!postDoc) {
    return reject(404, 'Post not found');
  }
  if (String(postDoc.author) !== String(req.user.id)) {
    return reject(403, 'You can only edit your own posts');
  }

  const oldCover = postDoc.cover;
  postDoc.title = title;
  postDoc.summary = summary;
  postDoc.content = content;
  if (newCover) postDoc.cover = newCover;

  try {
    await postDoc.save();
  } catch (err) {
    removeUpload(newCover);
    throw err;
  }
  if (newCover) removeUpload(oldCover);

  res.json(postDoc);
}));

app.delete('/post/:id', verifyToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  const postDoc = await Post.findById(id);
  if (!postDoc) {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (String(postDoc.author) !== String(req.user.id)) {
    return res.status(403).json({ error: 'You can only delete your own posts' });
  }
  await postDoc.deleteOne();
  removeUpload(postDoc.cover);
  res.json({ ok: true });
}));

app.get('/post', asyncHandler(async (req, res) => {
  const posts = await Post.find().populate('author', ['username']).sort({ createdAt: -1 }).limit(20);
  res.json(posts);
}));

app.get('/post/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }
  const postDoc = await Post.findById(id).populate('author', ['username']);
  if (!postDoc) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(postDoc);
}));

// ---------------------------------------------------------------------------
// Error handler — must be registered AFTER all routes
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File size exceeds 5 MB limit' : err.message;
    return res.status(400).json({ error: message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('Error:', err);
  res.status(status).json({ error: status >= 500 ? 'Internal Server Error' : err.message });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
