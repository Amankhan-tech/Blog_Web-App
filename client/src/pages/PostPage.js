import { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatISO9075 } from "date-fns";
import DOMPurify from "dompurify";
import { UserContext } from "../UserContext";

// Only allow embedded videos from these sites; drop any other iframe.
const ALLOWED_IFRAME_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"];
DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName !== "iframe") return;
  let host = "";
  try {
    host = new URL(node.getAttribute("src") || "").hostname;
  } catch {}
  if (!ALLOWED_IFRAME_HOSTS.includes(host)) node.parentNode?.removeChild(node);
});

// Posts are also cleaned by the server when saved; this protects against
// anything stored before that (or any future server bug).
const cleanHtml = (html) =>
  DOMPurify.sanitize(html || "", {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allowfullscreen", "frameborder", "target"],
  });

export default function PostPage() {
  const [postInfo, setPostInfo] = useState(null);
  const { userInfo } = useContext(UserContext);
  const [error, setError] = useState("");
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`http://localhost:4000/post/${id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load post");
        setPostInfo(data);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function deletePost() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    const response = await fetch(`http://localhost:4000/post/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      navigate("/");
    } else {
      const data = await response.json().catch(() => ({}));
      alert(data.error || "Failed to delete post");
    }
  }

  if (error) return <div className="post-page">{error}</div>;
  if (!postInfo) return "";

  const isAuthor = userInfo?.id && userInfo.id === postInfo.author?._id;

  return (
    <div className="post-page">
      <h1>{postInfo.title}</h1>
      <time> {formatISO9075(new Date(postInfo.createdAt))} </time>
      <div className="author">by {postInfo.author?.username || "Unknown Author"}</div>
      {isAuthor && (
        <div className="edit-row">
          <Link className="edit-btn" to={`/edit/${postInfo._id}`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
            Edit this post
          </Link>
          <button type="button" className="delete-btn" onClick={deletePost}>
            Delete this post
          </button>
        </div>
      )}
      <div className="image">
        <img src={`http://localhost:4000/${postInfo.cover}`} alt="" />
      </div>
      <div
        className="content"
        dangerouslySetInnerHTML={{ __html: cleanHtml(postInfo.content) }}
      />
    </div>
  );
}
