import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { ROUTER_FUTURE } from "./api";

// Fake backend: maps "METHOD /path" to a { status, body } response.
function mockApi(routes) {
  global.fetch = jest.fn(async (url, options = {}) => {
    const path = new URL(url).pathname;
    const key = `${options.method || "GET"} ${path}`;
    const route = routes[key] || { status: 404, body: { error: "Not found" } };
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: async () => route.body,
    };
  });
}

const loggedOut = { "GET /profile": { status: 401, body: { error: "Unauthorized" } } };
const loggedIn = { "GET /profile": { status: 200, body: { id: "u1", username: "alice" } } };

const samplePost = {
  _id: "p1",
  title: "Hello world",
  summary: "A first post",
  content: '<p>Body text</p><img src="x" onerror="window.hacked=true"><script>window.hacked=true</script>',
  cover: "uploads/cover.png",
  createdAt: "2024-12-21T10:00:00.000Z",
  author: { _id: "u1", username: "alice" },
};

// Renders the app at `path` and lets the initial requests (profile, posts)
// finish inside act(), so React state updates are applied before asserting.
async function renderAt(path) {
  const result = render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <App />
    </MemoryRouter>
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return result;
}

const type = (element, value) => fireEvent.change(element, { target: { value } });

afterEach(() => {
  delete global.fetch;
  delete window.hacked;
});

test("home page lists posts with author and cover image", async () => {
  mockApi({ ...loggedOut, "GET /post": { status: 200, body: [samplePost] } });
  await renderAt("/");
  expect(await screen.findByText("Hello world")).toBeInTheDocument();
  expect(screen.getByText("alice")).toBeInTheDocument();
  expect(screen.getByAltText("Hello world")).toHaveAttribute("src", "http://localhost:4000/uploads/cover.png");
  expect(screen.getByText("Login")).toBeInTheDocument();
});

test("home page shows a friendly message when there are no posts", async () => {
  mockApi({ ...loggedOut, "GET /post": { status: 200, body: [] } });
  await renderAt("/");
  expect(await screen.findByText(/no posts yet/i)).toBeInTheDocument();
});

test("home page explains when the server can't be reached", async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  await renderAt("/");
  expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
});

test("logged-in users see their name, Create and Logout", async () => {
  mockApi({ ...loggedIn, "GET /post": { status: 200, body: [] } });
  await renderAt("/");
  expect(await screen.findByText("Hi, alice")).toBeInTheDocument();
  expect(screen.getByText("Create new post")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
});

test("creating a post while logged out redirects to the login page", async () => {
  mockApi(loggedOut);
  await renderAt("/create");
  expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
});

test("login shows the server's error message", async () => {
  mockApi({ ...loggedOut, "POST /login": { status: 401, body: { error: "Invalid username or password" } } });
  await renderAt("/login");
  type(screen.getByPlaceholderText("username"), "alice");
  type(screen.getByPlaceholderText("password"), "wrong-password");
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
});

test("successful login updates the header and leaves the login page", async () => {
  mockApi({
    ...loggedOut,
    "POST /login": { status: 200, body: { id: "u1", username: "alice" } },
    "GET /post": { status: 200, body: [] },
  });
  await renderAt("/login");
  type(screen.getByPlaceholderText("username"), "alice");
  type(screen.getByPlaceholderText("password"), "Tr1cky-Horse-42");
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  expect(await screen.findByText("Hi, alice")).toBeInTheDocument();
  // Redirected home, which then loads the (empty) post list.
  expect(await screen.findByText(/no posts yet/i)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument());
});

test("post page removes dangerous HTML before showing content", async () => {
  mockApi({ ...loggedOut, "GET /post/p1": { status: 200, body: samplePost } });
  const { container } = await renderAt("/post/p1");
  expect(await screen.findByText("Body text")).toBeInTheDocument();
  const content = container.querySelector(".content");
  expect(content.innerHTML).not.toMatch(/onerror|<script/i);
  expect(window.hacked).toBeUndefined();
});

test("post page shows Edit/Delete only to the author", async () => {
  mockApi({ ...loggedIn, "GET /post/p1": { status: 200, body: samplePost } });
  await renderAt("/post/p1");
  expect(await screen.findByText("Edit this post")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete this post" })).toBeInTheDocument();
});

test("post page hides Edit/Delete from other users and logged-out visitors", async () => {
  mockApi({ ...loggedOut, "GET /post/p1": { status: 200, body: samplePost } });
  await renderAt("/post/p1");
  expect(await screen.findByText("Body text")).toBeInTheDocument();
  expect(screen.queryByText("Edit this post")).not.toBeInTheDocument();
});

test("unknown posts and pages show a message", async () => {
  mockApi(loggedOut);
  await renderAt("/post/missing");
  expect(await screen.findByText("Not found")).toBeInTheDocument();
});
