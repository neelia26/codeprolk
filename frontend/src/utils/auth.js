export function setToken(token) {
  localStorage.setItem("token", token);
}

export function getToken() {
  const token = localStorage.getItem("token");
  if (token && isTokenExpired(token)) {
    logout();
    return null;
  }
  return token;
}

export function logout() {
  localStorage.removeItem("token");
}

export function getTokenPayload(token) {
  if (!token) token = getToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(payload)));
  } catch (e) {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = getTokenPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
}
