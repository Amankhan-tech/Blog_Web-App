import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function Post({_id ,title, summary, cover, content, createdAt, author }) {
  return (
    <div className="post">
      <div className="image">
        <Link to={`/post/${_id}`}>
        <img
          src={'http://localhost:4000/' + cover}
          alt=""
        />
        </Link>
      </div>
      <div className="texts">
      <Link to={`/post/${_id}`}>
        <h2>{title}</h2>
        </Link>
        <p className="info">
          {/* Ensure `author` exists and has a `username` property before accessing it */}
          <a className="author">{author?.username || "Unknown Author"}</a>
          {/* Format the date only if `createdAt` exists */}
          <time>{createdAt ? format(new Date(createdAt), "MMM d, yyyy HH:mm") : "No date available"}</time>
        </p>
        <p className="summary">{summary}</p>
      </div>
    </div>
  );
}
