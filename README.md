# Blog_Web-App

Here’s an updated README reflecting your blog website, excluding the "delete post" feature and "Helmet":

Blog Website
Description
This project is a full-stack blog application that enables users to create, view, and edit blog posts. It features user authentication, secure image uploads, and a rich text editor for crafting engaging posts. The backend handles data storage and security, while the frontend ensures a user-friendly interface.

What It Does and How?
When you access the homepage of the blog website, you can either log in if you are an existing user or register yourself if you are new. Registration requires providing a unique username and a secure password (stored as a hashed value in the database). Once logged in, users are presented with a user-friendly interface featuring a navigation bar for seamless interaction with the application.

The navigation bar at the top includes sections such as Home, Create Post, and Your Posts. Each section serves a specific function to help users manage their blogging experience:

Home: Displays a feed of all blog posts, showing the title, author, and a brief summary. Posts are sorted with the most recent ones appearing first.
Create Post: Allows users to compose a new blog post with a rich text editor. Users can upload an image to use as the post’s cover, and provide a title, summary, and content.

Features
User Authentication:

Register and log in with secure password hashing.
Token-based authentication using JWT.
Blog Management:

Create, read, and update posts.
Rich text editor for creating and formatting content.
Image Upload:

File uploads with validation for MIME types and size limits.
Uploaded images are displayed alongside posts.
User-Specific Posts:

Posts are associated with their respective authors.
Only the original author can edit their posts.
Technologies Used
Frontend:
React.js
React Router for navigation
date-fns for date formatting
Backend:
Express.js
Multer for file uploads
MongoDB (via MongoDB Atlas)
Other Tools:
JWT for authentication
bcrypt for password hashing
dotenv for environment variable management
Installation and Setup
Prerequisites:
Node.js installed
MongoDB Atlas or a local MongoDB instance
Steps:
Clone this repository:

bash
Copy code
git clone https://github.com/your-username/blog-website.git
cd blog-website
Install backend dependencies:

bash
Copy code
npm install
Configure environment variables:

Create a .env file in the root directory.
Add the following variables:
env
Copy code
PORT=4000
FRONTEND_URL=http://localhost:3000
MONGODB_URI=your_mongo_db_connection_string
JWT_SECRET=your_secret_key
Start the backend server:

bash
Copy code
npm start
Navigate to the frontend folder (if hosted separately), install dependencies, and run the app:

bash
Copy code
cd frontend
npm install
npm start
Open your browser and visit http://localhost:3000.

Security Measures
CORS is configured to allow only the frontend URL.
Passwords are hashed using bcrypt before storing in the database.
Input validation and sanitization help prevent injection attacks.

Final Thoughts:
The blog website project was a rewarding journey that deepened my understanding of full-stack web development. It required significant effort and problem-solving to bring all the features together seamlessly.

Initially, I experimented with different approaches for user authentication and image handling to ensure a secure and user-friendly application. Using MongoDB Atlas for the database was a strategic choice for scalability and flexibility, especially when deploying the project.

Throughout the process, I faced challenges like implementing dynamic content rendering, managing secure file uploads, and establishing smooth client-server communication. However, overcoming these hurdles greatly enhanced my skills and confidence in working with React.js, Express.js, and MongoDB.

One of the most enjoyable parts was seeing the website come together as a functional and visually appealing platform. From reading documentation to debugging intricate issues, every step was a learning experience that improved my technical and problem-solving abilities.

I'm proud to have built this project independently and excited about the possibilities for expanding and refining it further. Thank you for taking the time to explore this project!
