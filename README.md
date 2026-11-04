# **🌟 Blog Web Application**  

## **🖥️ Overview**  
Welcome to the **Blog Web Application** – a full-stack platform that lets users unleash their creativity by creating, viewing, and editing blog posts.  

✨ Key Highlights:  
- 🔒 **User Authentication** for secure access.  
- 🖋️ **Rich Content Creation** with a built-in editor.  
- 🖼️ **Image Uploads** for visually appealing posts.  
- 🗄️ **Scalable Backend** with MongoDB Atlas.  
- 🤩 **User-Friendly Interface** built using React.js.  

Whether you're a writer, an enthusiast, or a learner, this platform is your go-to solution for managing blog content!  

---

## **📋 Features**  

### 🔒 **User Authentication**  
- **Register/Login** securely with hashed passwords (via `bcrypt`).  
- Session management powered by **JWT-based authentication**.  

### 🖋️ **Content Management**  
- Create, view, update and delete blog posts with ease.  
- Built-in **rich text editor** for crafting and formatting posts.  
- Posts are displayed with **titles, summaries, and timestamps**.  

### 🖼️ **Image Uploads**  
- Add **cover images** while creating posts.  
- Validates file type and size to ensure smooth uploads.  

### ✍️ **Author-Specific Posts**  
- Posts are tied to their authors.  
- Only authors can edit or delete their own content.  

---

## **🛠️ Technologies Used**  

### **Frontend**  
- ⚛️ **React.js**: Interactive user interface.  
- 🔗 **React Router**: For smooth navigation.  
- 🖋️ **React Quill**: Rich text editor.  
- 🕒 **date-fns**: For elegant date formatting.  
- 🧼 **DOMPurify**: Cleans post HTML before it's shown.  

### **Backend**  
- 🚀 **Express.js**: Fast and modular backend framework.  
- 📦 **Multer**: Secure and efficient file uploads.  
- 🗄️ **MongoDB Atlas + Mongoose**: Scalable cloud database.  

### **Security and Tools**  
- 🔑 **JWT** in an `httpOnly` cookie: Token-based user authentication.  
- 🔒 **bcrypt** + **zxcvbn**: Hashed passwords and password-strength checks.  
- 🪖 **helmet**, **express-rate-limit**, **sanitize-html**: Security headers, brute-force protection and XSS protection.  
- 🌍 **dotenv**: For managing environment variables.  
- 🧪 **node:test**, **supertest**, **mongodb-memory-server**, **React Testing Library**: Automated tests.  

---

## **📁 Project Structure**  

```
├── api/                 Express backend
│   ├── index.js         Server, routes and security middleware
│   ├── models/          Mongoose models (User, Post)
│   ├── test/            API tests
│   └── uploads/         Uploaded cover images (created automatically, not in git)
├── client/              React frontend (Create React App)
│   └── src/
│       ├── api.js       API address + fetch helper
│       ├── pages/       Index, Login, Post, Create, Edit pages
│       └── App.test.js  Frontend tests
├── .env.example         Template for the backend's .env
└── package.json         Backend dependencies and scripts
```

---

## **🚀 Getting Started**  

### **⚙️ Prerequisites**  
1. 🛠️ **Node.js 20.19 or newer** (check with `node -v`).  
2. 🗄️ A **MongoDB Atlas** cluster or a local MongoDB instance.  

### **🔧 Installation and Setup**  

1. Clone the repository:  
   ```bash
   git clone https://github.com/Amankhan-tech/Blog_Web-App.git
   cd Blog_Web-App
   ```  

2. Install backend dependencies (from the repo root):  
   ```bash
   npm install
   ```  

3. Set up environment variables: copy `.env.example` to `.env` in the repo root (or in `api/`) and fill in at least:  
   ```env
   MONGODB_URI=<your-mongodb-connection-string>
   JWT_SECRET=<a-long-random-string>
   ```  
   Generate a good secret with:  
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```  
   Optional settings (`PORT`, `FRONTEND_URL`, production options) are explained in `.env.example`. The server refuses to start if a required value is missing.  

4. Start the backend server (from the repo root):  
   ```bash
   npm start        # or `npm run dev` to restart automatically on code changes
   ```  
   You should see `Server running on port 4000`.  

5. In a second terminal, install and start the React frontend:  
   ```bash
   cd client
   npm install
   npm start
   ```  
   To use an API that isn't on `http://localhost:4000`, copy `client/.env.example` to `client/.env` and set `REACT_APP_API_URL`.  

6. Open your browser and visit 👉 **[http://localhost:3000](http://localhost:3000)**.  

### **🧪 Running Tests**  

From the repo root:  
```bash
npm test               # API tests (uses a temporary in-memory MongoDB)
npm run test:client    # React tests
npm run test:all       # both
```  
The first `npm test` downloads a MongoDB binary (~100 MB) for the in-memory database. The tests never touch the database in your `.env`.  

---

## **🔒 Security Measures**  
- 🌐 **CORS Policy**: Only the configured frontend (`FRONTEND_URL`) can make logged-in requests.  
- 🔑 **Password Security**: Passwords are hashed with `bcrypt`, must be 8–72 characters and pass a strength check.  
- 🍪 **Secure Sessions**: Login tokens live in an `httpOnly`, `SameSite` cookie and expire after 7 days.  
- 🧼 **XSS Protection**: Post HTML is sanitized when saved and again before it's displayed.  
- 🚦 **Rate Limiting**: Repeated failed logins/registrations from one IP are blocked for 15 minutes.  
- 🖼️ **Safe Uploads**: Only real JPEG/PNG/GIF files up to 5 MB, uploaded by logged-in users, are accepted.  
- ✅ **Input Validation**: Usernames, post fields and IDs are validated; MongoDB operator injection is blocked.  
- ✍️ **Ownership Checks**: Only a post's author can edit or delete it.  

---

## **💡 Final Thoughts**  

This blog application was an exciting journey that honed my full-stack development skills. Every feature was carefully crafted to balance functionality, security, and usability.  

### **Key Highlights**  
- 🌍 Leveraged **MongoDB Atlas** for effortless scalability and deployment.  
- 💡 Tackled challenges like dynamic content rendering and secure file uploads.  
- 🚀 Strengthened expertise in **React.js**, **Express.js**, and **MongoDB**.  

Seeing the platform evolve from concept to completion was immensely rewarding. It reflects my commitment to independent learning and my passion for building impactful solutions.  

**Thank you for exploring this project! 🌟**  

Feel free to fork, clone, and experiment! 😊