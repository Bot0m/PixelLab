const API_URL = "http://127.0.0.1:8000";
const LOGIN_EMAIL = "perrocheautom@hotmail.fr";
const LOGIN_PASSWORD = "T$2y$13$rYzoJ8.vGTE631Do.w6Yl..TqPWX3IbdAkIs6L9X.u8oN39fiusOS";

// Connexion à l'API pour obtenir un jeton JWT
export async function tinylinkLogin() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD })
  });
  if (!res.ok) throw new Error("Connexion TinyLink impossible");
  const data = await res.json();
  return data.token;
}

// Création d’un lien court
export async function tinylinkCreateLink(token, urlCible) {
  const res = await fetch(`${API_URL}/api/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ targetUrl: urlCible })
  });
  if (!res.ok) throw new Error("Création du lien TinyLink échouée");
  return res.json(); // { id, slug, shortUrl, ... }
}
