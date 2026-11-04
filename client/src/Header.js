import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "./UserContext";

export default function Header() {
  const { userInfo, logout } = useContext(UserContext);
  const navigate = useNavigate();
  const username = userInfo?.username;

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header>
      <Link to="/" className="logo">
        My Blog
      </Link>
      <nav>
        {username ? (
          <>
            <span className="greeting">Hi, {username}</span>
            <Link to="/create">Create new post</Link>
            <button type="button" className="link-button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
