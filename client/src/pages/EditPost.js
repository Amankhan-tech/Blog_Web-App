import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PostForm from "../PostForm";
import { UserContext } from "../UserContext";
import { apiFetch } from "../api";

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useContext(UserContext);
  const [post, setPost] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    apiFetch(`/post/${id}`).then(({ ok, data, error }) => {
      if (ok) setPost(data);
      else setLoadError(error);
    });
  }, [id]);

  async function updatePost(data) {
    data.set("id", id);
    const { ok, error } = await apiFetch("/post", { method: "PUT", body: data });
    if (!ok) return error;
    navigate(`/post/${id}`);
    return "";
  }

  if (loadError) return <p className="error">{loadError}</p>;
  if (!post) return <p className="status">Loading…</p>;
  if (post.author?._id !== userInfo?.id) {
    return <p className="error">You can only edit your own posts.</p>;
  }

  return <PostForm initial={post} submitLabel="Update Post" onSubmit={updatePost} />;
}
