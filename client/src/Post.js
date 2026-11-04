import { format } from "date-fns";
import { Link } from "react-router-dom";
import { imageUrl } from "./api";

export default function Post({ _id, title, summary, cover, createdAt, author }) {
  return (
    <div className="post">
      <div className="image">
        <Link to={`/post/${_id}`}>
          <img src={imageUrl(cover)} alt={title} />
        </Link>
      </div>
      <div className="texts">
        <Link to={`/post/${_id}`}>
          <h2>{title}</h2>
        </Link>
        <p className="info">
          <span className="author">{author?.username || "Unknown Author"}</span>
          <time>{createdAt ? format(new Date(createdAt), "MMM d, yyyy HH:mm") : ""}</time>
        </p>
        <p className="summary">{summary}</p>
      </div>
    </div>
  );
}
