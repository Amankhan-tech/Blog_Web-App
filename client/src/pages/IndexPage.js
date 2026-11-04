import { useEffect, useState } from "react";
import Post from "../Post";
import { apiFetch } from "../api";

export default function IndexPage() {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/post").then(({ ok, data, error }) => {
      if (ok) setPosts(data);
      else setError(error);
    });
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!posts) return <p className="status">Loading posts…</p>;
  if (posts.length === 0) return <p className="status">No posts yet. Be the first to write one!</p>;

  return (
    <>
      {posts.map((post) => (
        <Post key={post._id} {...post} />
      ))}
    </>
  );
}
