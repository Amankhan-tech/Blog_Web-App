const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load .env before reading any config. Look next to this file first (api/.env),
// then in the folder the server was started from (e.g. the repo root).
require('dotenv').config({ path: [path.join(__dirname, '.env'), path.resolve('.env')] });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sanitizeHtml = require('sanitize-html');
const zxcvbn = require('zxcvbn');
const User = require('./models/User');
const Post = require('./models/Post');

// ---------------------------------------------------------------------------
// Config — fail fast instead of silently running with unsafe defaults
// ---------------------------------------------------------------------------
const { MONGODB_URI, JWT_SECRET } = process.env;
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  console.error('Create a .env file (see README) and try again.');
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.warn('Warning: JWT_SECRET is short. Use at least 32 random characters.');
}

// ---------------------------------------------------------------------------
// Auth settings
// ---------------------------------------------------------------------------
const BCRYPT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// httpOnly: JavaScript in the page can't read the token (limits XSS damage).
// sameSite 'lax': the browser won't send it on cross-site POSTs (CSRF).
// If the frontend and API are on different domains in production, set
// COOKIE_SAMESITE=none (requires HTTPS, which `secure` enforces).
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  path: '/',
};

// Express 4 does not catch errors thrown in async handlers; this forwards them
// to the error handler instead of crashing the process.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
// File uploads
// ---------------------------------------------------------------------------
// Always resolve relative to this file so uploads land in api/uploads no matter
// which folder the server is started from.
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };
// Magic bytes at the start of each allowed format. The MIME type comes from
// the browser and can be faked, so we also check the file's real contents.
const FILE_SIGNATURES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
};
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

const hasValidSignature = async (file) => {
  const signatures = FILE_SIGNATURES[file.mimetype] || [];
  const maxLength = Math.max(0, ...signatures.map((sig) => sig.length));
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(maxLength), 0, maxLength, 0);
    return signatures.some(
      (sig) => bytesRead >= sig.length && sig.every((byte, i) => buffer[i] === byte)
    );
  } finally {
    await handle.close();
  }
};

// Runs after multer: rejects (and deletes) files whose contents don't match
// their claimed image type.
const verifyUpload = asyncHandler(async (req, res, next) => {
  if (req.file && !(await hasValidSignature(req.file))) {
    removeUpload(coverPathFor(req.file));
    return res.status(400).json({ error: 'File is not a valid JPEG, PNG or GIF image' });
  }
  next();
});

// ---------------------------------------------------------------------------
// Input validation / sanitizing
// ---------------------------------------------------------------------------
// content can include images pasted into the editor (base64), so it's larger.
// multer also caps any single text field at 1 MB by default.
const LIMITS = { title: 200, summary: 500, content: 1000000 };

// Allow what the Quill editor produces; strip scripts, event handlers,
// javascript: links, and iframes from anywhere except known video sites.
const SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'iframe', 'h1', 'h2', 'span', 'u', 's', 'sub', 'sup',
  ]),
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
    iframe: ['src', 'frameborder', 'allowfullscreen'],
    span: ['class', 'style'],
    p: ['class', 'style'],
    ul: ['class', 'data-checked'],
    li: ['class', 'data-list'],
  },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
  // Drop iframes whose src was removed (i.e. not from an allowed video host).
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
};

// Returns { title, summary, content } or { error }.
const validatePostFields = (body) => {
  const fields = {};
  for (const name of ['title', 'summary', 'content']) {
    const value = typeof body[name] === 'string' ? body[name].trim() : '';
    if (!value) return { error: 'All fields are required' };
    if (value.length > LIMITS[name]) {
      return { error: `${name[0].toUpperCase() + name.slice(1)} is too long` };
    }
    fields[name] = value;
  }
  fields.content = sanitizeHtml(fields.content, SANITIZE_OPTIONS);
  if (!fields.content.trim()) return { error: 'All fields are required' };
  return fields;
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{4,30}$/;

// ---------------------------------------------------------------------------
// App + middleware
// ---------------------------------------------------------------------------
const app = express();

// Set TRUST_PROXY=1 when running behind a reverse proxy / load balancer
// (Render, Heroku, Nginx…) so rate limiting sees real client IPs.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use(
  helmet({
    // Cover images are loaded by the frontend from a different origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use('/uploads', express.static(UPLOAD_DIR));

// General limit for every route, plus a much stricter one for login/register
// to slow down password guessing.
const rateLimitOptions = { windowMs: 15 * 60 * 1000, standardHeaders: 'draft-7', legacyHeaders: false };
app.use(rateLimit({ ...rateLimitOptions, limit: 300 }));
const authLimiter = rateLimit({
  ...rateLimitOptions,
  limit: 10,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});

const verifyToken = (req, res, next) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token is required' });
  }
  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, info) => {
    if (err) {
      res.clearCookie('token', COOKIE_OPTIONS);
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = { id: info.id, username: info.username };
    next();
  });
};

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      error: 'Username must be 4-30 characters: letters, numbers, dot, dash or underscore',
    });
  }
  // bcrypt only uses the first 72 bytes of a password.
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Password must be 8-72 characters long' });
  }
  const strength = zxcvbn(password, [username]);
  if (strength.score < 2) {
    const hint = strength.feedback.warning || strength.feedback.suggestions[0] || '';
    return res.status(400).json({ error: `Password is too weak. ${hint}`.trim() });
  }

  try {
    const userDoc = await User.create({
      username,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });
    // Never send the password hash back.
    res.status(201).json({ id: userDoc._id, username: userDoc.username });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Username is already taken' });
    }
    throw err;
  }
}));

app.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const userDoc = await User.findOne({ username });
  // Same message whether the user exists or not, so attackers can't use this
  // endpoint to discover valid usernames.
  const passOk = userDoc && (await bcrypt.compare(password, userDoc.password));
  if (!passOk) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ username: userDoc.username, id: userDoc._id }, JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
  res
    .cookie('token', token, { ...COOKIE_OPTIONS, maxAge: TOKEN_TTL_SECONDS * 1000 })
    .json({ id: userDoc._id, username: userDoc.username });
}));

app.get('/profile', verifyToken, (req, res) => {
  res.json(req.user);
});

app.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS).json('ok');
});

// ---------------------------------------------------------------------------
// Post routes
// ---------------------------------------------------------------------------
// verifyToken runs BEFORE multer so anonymous requests never write to disk.
app.post('/post', verifyToken, upload.single('file'), verifyUpload, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fields = validatePostFields(req.body);
  if (fields.error) {
    removeUpload(coverPathFor(req.file));
    return res.status(400).json({ error: fields.error });
  }
  const { title, summary, content } = fields;

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

app.put('/post', verifyToken, upload.single('file'), verifyUpload, asyncHandler(async (req, res) => {
  const { id } = req.body;
  const newCover = req.file ? coverPathFor(req.file) : null;
  const reject = (status, error) => {
    removeUpload(newCover);
    return res.status(status).json({ error });
  };

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return reject(400, 'Invalid post ID');
  }
  const fields = validatePostFields(req.body);
  if (fields.error) {
    return reject(400, fields.error);
  }
  const { title, summary, content } = fields;

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
    const messages = {
      LIMIT_FILE_SIZE: 'File size exceeds 5 MB limit',
      LIMIT_FIELD_VALUE: 'Post content is too large (max 1 MB, including pasted images)',
    };
    const message = messages[err.code] || err.message;
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
