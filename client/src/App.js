import "./App.css";
import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import IndexPage from "./pages/IndexPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./RegisterPage";
import { UserContextProvider } from "./UserContext";
import CreatePost from "./pages/CreatePost";
import PostPage from "./pages/PostPage";
import EditPost from "./pages/EditPost";
import RequireAuth from "./RequireAuth";

function App() {
  return (
    <UserContextProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<IndexPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/create" element={<RequireAuth><CreatePost /></RequireAuth>} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/edit/:id" element={<RequireAuth><EditPost /></RequireAuth>} />
          <Route path="*" element={<p className="status">Page not found.</p>} />
        </Route>
      </Routes>
    </UserContextProvider>
  );
}

export default App;
