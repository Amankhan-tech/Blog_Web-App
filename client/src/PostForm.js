import { useState } from "react";
import Editor from "./Editor";

// Shared form for creating and editing a post. `onSubmit` receives FormData
// and should resolve to an error message ("" on success).
export default function PostForm({ initial = {}, requireFile, submitLabel, onSubmit }) {
  const [title, setTitle] = useState(initial.title || "");
  const [summary, setSummary] = useState(initial.summary || "");
  const [content, setContent] = useState(initial.content || "");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(ev) {
    ev.preventDefault();
    // Quill leaves "<p><br></p>" behind when the editor is emptied.
    if (!content.replace(/<[^>]*>/g, "").trim() && !/<(img|iframe)/i.test(content)) {
      setError("Please write some content.");
      return;
    }
    const data = new FormData();
    data.set("title", title);
    data.set("summary", summary);
    data.set("content", content);
    if (file) data.set("file", file);

    setError("");
    setSubmitting(true);
    const message = await onSubmit(data);
    // On success the parent navigates away, so only update state on failure.
    if (message) {
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="Title"
        required
        maxLength={200}
        value={title}
        onChange={(ev) => setTitle(ev.target.value)}
      />
      <input
        type="text"
        placeholder="Summary"
        required
        maxLength={500}
        value={summary}
        onChange={(ev) => setSummary(ev.target.value)}
      />
      <label className="file-label">
        {requireFile ? "Cover image (JPEG, PNG or GIF, max 5 MB)" : "Replace cover image (optional)"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif"
          required={requireFile}
          onChange={(ev) => setFile(ev.target.files?.[0] || null)}
        />
      </label>
      <Editor value={content} onChange={setContent} />
      <button style={{ marginTop: "5px" }} disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
