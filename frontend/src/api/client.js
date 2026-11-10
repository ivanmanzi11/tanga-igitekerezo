import axios from "axios";

// General2 GEN_07: the backend address is read from VITE_API_URL, but when the site is opened from
// another device (a phone or tablet using http://<computer-address>:5173) "localhost" would point
// at that device itself — so it is swapped for the address the page was opened from. Nothing to
// reconfigure when the computer's address changes.
function resolveApiUrl() {
  const configured = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
  try {
    const url = new URL(configured);
    const pageHost = window.location.hostname;
    const local = ["localhost", "127.0.0.1", "::1"];
    if (local.includes(url.hostname) && pageHost && !local.includes(pageHost)) {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, "");
    }
  } catch { /* fall through to the configured value */ }
  return configured;
}

const API_URL = resolveApiUrl();
// Where uploaded files (profile photos, attachments) are served from.
export const API_ROOT = API_URL.replace(/\/api\/?$/, "");

const client = axios.create({ baseURL: API_URL });

// General3 GEN_04: calls that must stay anonymous never carry the account token —
// the server then has nothing to link to the person, even if they are signed in.
const ANONYMOUS_PATHS = ["/track/", "/assistant/"];

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("tgk_access");
  const anonymous = config.skipAuth || ANONYMOUS_PATHS.some((p) => (config.url || "").startsWith(p));
  if (token && !anonymous) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (response && response.status === 401 && !config._retry && localStorage.getItem("tgk_refresh")) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject, config }));
      }
      config._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh: localStorage.getItem("tgk_refresh"),
        });
        localStorage.setItem("tgk_access", data.access);
        queue.forEach(({ resolve, config: cfg }) => {
          cfg.headers.Authorization = `Bearer ${data.access}`;
          resolve(client(cfg));
        });
        queue = [];
        config.headers.Authorization = `Bearer ${data.access}`;
        return client(config);
      } catch (refreshError) {
        localStorage.removeItem("tgk_access");
        localStorage.removeItem("tgk_refresh");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default client;
