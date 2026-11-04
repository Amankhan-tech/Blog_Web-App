import { useNavigate } from "react-router-dom";
import PostForm from "../PostForm";
import { apiFetch } from "../api";

export default function CreatePost() {
  const navigate = useNavigate();

  async function createPost(data) {
    const { ok, data: post, error } = await apiFetch("/post", { method: "POST", body: data });
    if (!ok) return error;
    navigate(`/post/${post._id}`);
    return "";
  }

  return <PostForm requireFile submitLabel="Create Post" onSubmit={createPost} />;
}
