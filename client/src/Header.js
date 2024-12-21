import { useContext, useEffect } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "./UserContext";

export default function Header() {
  const {setUserInfo, userInfo} = useContext(UserContext);
  useEffect(() => {
    fetch('http://localhost:4000/profile', {
      credentials: 'include',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(userInfo => {
        setUserInfo(userInfo)
      })
      .catch(error => {
        console.error("Error fetching user profile:", error);
      });
  }, []);

  function Logout() {
    fetch('http://localhost:4000/logout', {
      credentials: 'include',
      method: 'POST',
    });
    setUserInfo(null);
  }

  const username = userInfo?.username; 

    return(
        <header>
        <Link to="/" className="logo">
          My Blog
        </Link>
        <nav>
          {username && (
            <>
              <Link to="/create">Create new post</Link>
              <a onClick={Logout}>LogOut</a>
            </>
          )}
          {!username && (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
    )
}