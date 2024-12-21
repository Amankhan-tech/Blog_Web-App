const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');
const { mongoose } = require('mongoose');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require("./models/User");
const Post = require("./models/Post");

dotenv.config();

const app = express();
const salt = bcrypt.genSaltSync(10);
const secret = process.env.JWT_SECRET || 'fallback_secret';

const uploadMiddleware = multer({ dest: 'uploads/' });

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use('/uploads', express.static(__dirname + '/uploads'));

// Rate limiting for API endpoints
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api', limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "your-default-mongodb-uri");

// Token Verification Middleware
const verifyToken = (req, res, next) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token is required" });
  }
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = info;
    next();
  });
};

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

// Routes
app.post("/register", async (req, res) => {
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

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  if (!userDoc) {
    return res.status(404).json({ error: "User not found" });
  }
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (!passOk) {
    return res.status(400).json({ error: "Invalid credentials" });
  }
  jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
    if (err) throw err;
    res.cookie("token", token).json({
      id: userDoc._id,
      username,
    });
  });
});

app.get("/profile", verifyToken, (req, res) => {
  res.json(req.user);
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
const fileSizeLimit = 5 * 1024 * 1024; // 5 MB

app.post("/post", uploadMiddleware.single("file"), verifyToken, async (req, res) => {
  const { originalname, path, mimetype, size } = req.file;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (!allowedMimeTypes.includes(mimetype)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  if (size > fileSizeLimit) {
    return res.status(400).json({ error: 'File size exceeds limit' });
  }

  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;

  fs.renameSync(path, newPath);

  const { title, summary, content } = req.body;
  if (!title || !summary || !content) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: req.user.id,
    });
    res.json(postDoc);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create the post" });
  }
});

app.get("/post", async (req, res) => {
  const posts = await Post.find().populate("author", ["username"]).sort({ createdAt: -1 }).limit(20);
  res.json(posts);
});

app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
    const postDoc = await Post.findById(id).populate('author', ['username']);
    if (!postDoc) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(postDoc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(4000, () => console.log('Server running on port 4000'));
