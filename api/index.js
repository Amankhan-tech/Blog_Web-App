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

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "your-default-mongodb-uri");

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// CORS headers middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
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
    console.log(e);
    res.status(400).json(e);
  }
});



app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    //logged in
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie("token", token).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json("Wrong Credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});


const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
const fileSizeLimit = 5 * 1024 * 1024; // 5 MB

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  if (req.file.size > fileSizeLimit) {
    return res.status(400).json({ error: 'File size exceeds limit' });
  }

  try {
    // Check if the file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;

    // Rename the uploaded file
    fs.renameSync(path, newPath);

    const { token } = req.cookies;

    // Verify the JWT token
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
      }

      // Extract form data
      const { title, summary, content } = req.body;

      // Validate the input fields
      if (!title || !summary || !content) {
        return res.status(400).json({ error: "All fields are required" });
      }

      try {
        // Create the post
        const postDoc = await Post.create({
          title,
          summary,
          content,
          cover: newPath,
          author: info.id,
        });

        // Respond with the created post
        return res.json(postDoc);
      } catch (postError) {
        console.error("Error creating post:", postError);
        return res.status(500).json({ error: "Failed to create the post" });
      }
    });
  } catch (error) {
    console.error("Error handling the request:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});



app.put('/post', uploadMiddleware.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    newPath = path + "." + ext;

    // Rename the uploaded file
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;

  // Verify the JWT token
  jwt.verify(token, secret, {}, async (err, info) => {
    if(err) throw err;
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if(!isAuthor) {
      return res.status(400).json('You are not author');
    }

    await postDoc.set({
      title,
      summary,
      content,
      cover: newPath?newPath : postDoc.cover,
    });
    await postDoc.save();
    res.json(postDoc);
  });

});



app.get("/post", async (req, res) => {
  const posts = await Post.find().populate("author", ["username"]).sort({createdAt: -1}).limit(20);
  res.json(posts);
});



app.get('/post/:id', async (req, res) => {
  const { id } = req.params;

  // Check if `id` is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
  }

  try {
      // Fetch the post document if the ID is valid
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

// Start Server
app.listen(4000, () => console.log('Server running on port 4000'));