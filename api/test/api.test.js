// API tests: run with `npm test` from the repo root.
//
// By default this starts a throwaway in-memory MongoDB (mongodb-memory-server
// downloads the MongoDB binary the first time, ~100 MB). To use your own test
// database instead, set TEST_MONGODB_URI. Never point it at real data: the
// tests create and delete users and posts.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Config must be set before the app is loaded.
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-test-uploads-'));
process.env.UPLOAD_DIR = uploadDir;
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://set-by-tests';
process.env.AUTH_RATE_LIMIT = '1000'; // the tests make many failed attempts on purpose
process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../index');

// Smallest valid PNG / JPEG headers; the server checks the file's real bytes.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex');
const STRONG_PASSWORD = 'Tr1cky-Horse-42';

let mongoServer;
let counter = 0;
const uniqueName = (prefix = 'user') => `${prefix}${Date.now().toString(36)}${counter++}`;

before(async () => {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
  }
  await mongoose.connect(uri);
  // Build indexes (e.g. the unique username) before any test runs.
  await Promise.all([require('../models/User').init(), require('../models/Post').init()]);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

// Registers a fresh user and returns a supertest agent that keeps its cookie.
async function loggedInAgent() {
  const username = uniqueName();
  const agent = request.agent(app);
  await agent.post('/register').send({ username, password: STRONG_PASSWORD }).expect(201);
  const res = await agent.post('/login').send({ username, password: STRONG_PASSWORD }).expect(200);
  return { agent, username, id: res.body.id };
}

function createPost(agent, fields = {}, file = { buffer: PNG, name: 'cover.png', type: 'image/png' }) {
  const req = agent.post('/post');
  const values = { title: 'Title', summary: 'Summary', content: '<p>Hello</p>', ...fields };
  for (const [key, value] of Object.entries(values)) req.field(key, value);
  if (file) req.attach('file', file.buffer, { filename: file.name, contentType: file.type });
  return req;
}

const uploadCount = () => fs.readdirSync(uploadDir).length;

describe('registration', () => {
  test('creates a user and never returns the password hash', async () => {
    const username = uniqueName();
    const res = await request(app).post('/register').send({ username, password: STRONG_PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(res.body.username, username);
    assert.ok(res.body.id);
    assert.equal(res.body.password, undefined);
  });

  test('rejects a duplicate username', async () => {
    const username = uniqueName();
    await request(app).post('/register').send({ username, password: STRONG_PASSWORD }).expect(201);
    const res = await request(app).post('/register').send({ username, password: STRONG_PASSWORD });
    assert.equal(res.status, 409);
  });

  test('rejects short, weak or missing passwords', async () => {
    for (const password of ['abc', 'password1', undefined]) {
      const res = await request(app).post('/register').send({ username: uniqueName(), password });
      assert.equal(res.status, 400, `password ${password} should be rejected`);
    }
  });

  test('rejects invalid usernames, including injection objects', async () => {
    for (const username of ['ab', 'has space', '<script>', { $gt: '' }]) {
      const res = await request(app).post('/register').send({ username, password: STRONG_PASSWORD });
      assert.equal(res.status, 400);
    }
  });
});

describe('login / session', () => {
  test('sets an httpOnly cookie and /profile returns the user', async () => {
    const username = uniqueName();
    await request(app).post('/register').send({ username, password: STRONG_PASSWORD });
    const agent = request.agent(app);
    const res = await agent.post('/login').send({ username, password: STRONG_PASSWORD }).expect(200);
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const profile = await agent.get('/profile').expect(200);
    assert.equal(profile.body.username, username);
  });

  test('wrong password and unknown user get the same error', async () => {
    const username = uniqueName();
    await request(app).post('/register').send({ username, password: STRONG_PASSWORD });
    const wrong = await request(app).post('/login').send({ username, password: 'not-the-password' });
    const unknown = await request(app).post('/login').send({ username: uniqueName(), password: 'x' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  test('a malformed login request returns 400 instead of crashing', async () => {
    await request(app).post('/login').send({}).expect(400);
  });

  test('a forged token is rejected', async () => {
    await request(app).get('/profile').set('Cookie', 'token=not-a-real-token').expect(401);
  });

  test('logout clears the session', async () => {
    const { agent } = await loggedInAgent();
    await agent.post('/logout').expect(200);
    await agent.get('/profile').expect(401);
  });
});

describe('creating posts', () => {
  test('requires login, and writes nothing to disk without it', async () => {
    const before = uploadCount();
    await createPost(request(app)).expect(401);
    assert.equal(uploadCount(), before);
  });

  test('creates a post with a cover image that can be downloaded', async () => {
    const { agent, username } = await loggedInAgent();
    const res = await createPost(agent, { title: 'Hello world' }).expect(200);
    assert.match(res.body.cover, /^uploads\/[0-9a-f]{32}\.png$/);

    const post = await request(app).get(`/post/${res.body._id}`).expect(200);
    assert.equal(post.body.title, 'Hello world');
    assert.equal(post.body.author.username, username);

    await request(app).get(`/${res.body.cover}`).expect(200);
  });

  test('accepts JPEG covers', async () => {
    const { agent } = await loggedInAgent();
    const res = await createPost(agent, {}, { buffer: JPEG, name: 'a.jpg', type: 'image/jpeg' }).expect(200);
    assert.match(res.body.cover, /\.jpg$/);
  });

  test('rejects missing files, wrong types, fake images and missing fields — leaving no files behind', async () => {
    const { agent } = await loggedInAgent();
    const before = uploadCount();
    await createPost(agent, {}, null).expect(400);
    await createPost(agent, {}, { buffer: Buffer.from('hello'), name: 'a.txt', type: 'text/plain' }).expect(400);
    await createPost(agent, {}, { buffer: Buffer.from('<script>'), name: 'a.png', type: 'image/png' }).expect(400);
    await createPost(agent, { title: '' }).expect(400);
    assert.equal(uploadCount(), before);
  });

  test('rejects files over 5 MB', async () => {
    const { agent } = await loggedInAgent();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
    const res = await createPost(agent, {}, { buffer: big, name: 'big.png', type: 'image/png' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /5 MB/);
  });

  test('strips scripts and dangerous HTML from content', async () => {
    const { agent } = await loggedInAgent();
    const content =
      '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(2)">' +
      '<a href="javascript:alert(3)">x</a><iframe src="https://evil.example"></iframe>' +
      '<iframe src="https://www.youtube.com/embed/abc"></iframe>';
    const res = await createPost(agent, { content }).expect(200);
    const saved = res.body.content;
    assert.doesNotMatch(saved, /<script|onerror|javascript:|evil\.example/i);
    assert.match(saved, /<p>ok<\/p>/);
    assert.match(saved, /youtube\.com\/embed\/abc/);
  });
});

describe('editing and deleting posts', () => {
  test('the author can edit text and replace the cover (old file is removed)', async () => {
    const { agent } = await loggedInAgent();
    const created = (await createPost(agent).expect(200)).body;
    const oldFile = path.join(uploadDir, path.basename(created.cover));
    assert.ok(fs.existsSync(oldFile));

    const res = await agent
      .put('/post')
      .field('id', created._id)
      .field('title', 'New title')
      .field('summary', 'New summary')
      .field('content', '<p>New</p>')
      .attach('file', PNG, { filename: 'new.png', contentType: 'image/png' })
      .expect(200);
    assert.equal(res.body.title, 'New title');
    assert.notEqual(res.body.cover, created.cover);
    // removal is fire-and-forget; give it a moment
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(fs.existsSync(oldFile), false);
  });

  test('other users cannot edit or delete the post', async () => {
    const owner = await loggedInAgent();
    const other = await loggedInAgent();
    const created = (await createPost(owner.agent).expect(200)).body;

    await other.agent
      .put('/post')
      .field('id', created._id)
      .field('title', 'Hacked')
      .field('summary', 's')
      .field('content', 'c')
      .expect(403);
    await other.agent.delete(`/post/${created._id}`).expect(403);

    const post = await request(app).get(`/post/${created._id}`).expect(200);
    assert.equal(post.body.title, 'Title');
  });

  test('the author can delete the post and its cover file', async () => {
    const { agent } = await loggedInAgent();
    const created = (await createPost(agent).expect(200)).body;
    await agent.delete(`/post/${created._id}`).expect(200);
    await request(app).get(`/post/${created._id}`).expect(404);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(fs.existsSync(path.join(uploadDir, path.basename(created.cover))), false);
  });
});

describe('reading posts', () => {
  test('lists posts newest first with author names', async () => {
    const { agent, username } = await loggedInAgent();
    await createPost(agent, { title: 'Older' }).expect(200);
    await new Promise((r) => setTimeout(r, 20)); // distinct createdAt timestamps
    await createPost(agent, { title: 'Newer' }).expect(200);
    const res = await request(app).get('/post').expect(200);
    const mine = res.body.filter((p) => p.author?.username === username).map((p) => p.title);
    assert.deepEqual(mine.slice(0, 2), ['Newer', 'Older']);
  });

  test('invalid and unknown ids return 400 / 404', async () => {
    await request(app).get('/post/not-an-id').expect(400);
    await request(app).get(`/post/${new mongoose.Types.ObjectId()}`).expect(404);
  });
});
