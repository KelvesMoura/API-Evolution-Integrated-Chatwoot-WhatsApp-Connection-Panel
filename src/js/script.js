let timerInterval;
let timeLeft = 25;
let qrAttempts = 1;
let hideTimeoutId;

function getById(selector) {
  return document.getElementById(selector);
}

function getByClass(selector) {
  return document.querySelector(selector);
}

const notes = getById("notes");
const instanceName = getById("instanceName");
const statusConnection = getById("statusConnection");
const buttonConnection = getById("buttonConnection");
const loader = getByClass(".loader");
const qrcodeElement = getById("qrcode");
const timerElement = getById("timer");
const registerIcon = getById("register");
const logoutIcon = getByClass(".logout");

const loginRoutes = "https://n8n.m2k.app.br/webhook/login";
const dashboardRoutes = "https://n8n.m2k.app.br/webhook/dashboard";
const connectRoutes = "https://n8n.m2k.app.br/webhook/connect";
const disconnectRoutes = "https://n8n.m2k.app.br/webhook/disconnect";
const registerRoutes = "https://n8n.m2k.app.br/webhook/register";

const urlDashboard = "./pages/dashboard.html";
const urlHome = "https://evo.m2k.app.br";

window.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("dashboard.html")) loadingUser();
});

document.querySelectorAll("#email, #password").forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      login();
    }
  });
});

async function login() {
  const inputEmail = getById("email");
  const inputPassword = getById("password");

  const email = inputEmail.value;
  const password = inputPassword.value;

  if (!email) {
    notes.removeAttribute("hidden");
    notes.innerText = "Por favor, insira o seu email de acesso!";

    hiddenNotes(inputEmail);
    return;
  }

  if (!password) {
    notes.removeAttribute("hidden");
    notes.innerText = "Por favor, insira o sua senha de acesso!";

    hiddenNotes(inputPassword);
    return;
  }

  try {
    const response = await fetch(loginRoutes, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      notes.removeAttribute("hidden");
      notes.innerText = data.message || "Erro ao realizar o login";
      hiddenNotes();
      return;
    }

    const token = data.token;

    if (!token) {
      throw new Error("Falha ao gerar o token!");
    }

    window.localStorage.setItem("token", token);

    return (window.location.href = `${urlDashboard}`);
  } catch (err) {
    console.log(err);
  }
}

async function loadingUser() {
  try {
    const token = localStorage.getItem("token");
    if (loader) loader.style.display = "block";

    const response = await fetch(dashboardRoutes, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    updateDashboard(response);

    return;
  } catch (err) {
    notes.removeAttribute("hidden");
    notes.innerText = "Token expirado expirado!. Realize o login novamente!";
    hiddenNotes();

    setTimeout(() => {
      window.location.href = urlHome;
    }, 2000);
  } finally {
    loader.style.display = "none";
  }
}

if (logoutIcon) {
  logoutIcon.addEventListener("click", () => {
    stopQrProcess();
    localStorage.removeItem("token");
    localStorage.removeItem("connection");
  });
}

async function register() {
  const token = localStorage.getItem("token");
  const inputEmail = getById("email");
  const inputPassword = getById("password");

  const email = inputEmail.value;
  const password = inputPassword.value;

  if (!email) {
    notes.removeAttribute("hidden");
    notes.innerText = "Por favor, insira o seu email de acesso!";

    hiddenNotes(inputEmail);
    return;
  }

  if (!password) {
    notes.removeAttribute("hidden");
    notes.innerText = "Por favor, insira o sua senha de acesso!";

    hiddenNotes(inputPassword);
    return;
  }

  try {
    if (loader) loader.style.display = "block";
    const response = await fetch(registerRoutes, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: email, password: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      notes.removeAttribute("hidden");
      notes.innerText = data.message;
      password.value = "";
      hiddenNotes();
      return;
    }

    notes.removeAttribute("hidden");
    notes.innerText = data.message;
    hiddenNotes();

    inputEmail.value = "";
    inputPassword.value = "";

    return;
  } catch (err) {
    notes.removeAttribute("hidden");
    notes.innerText = "Erro ao registrar o usuário. Tente novamente!";
    hiddenNotes();
  } finally {
    loader.style.display = "none";
  }
}

async function toggleConnection() {
  const token = localStorage.getItem("token");
  const connection = localStorage.getItem("connection");

  if (connection === "open") {
    try {
      loader.style.display = "block";
      buttonConnection.disabled = true;

      const response = await fetch(disconnectRoutes, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      await updateDashboard(response);
    } catch (err) {
      notes.removeAttribute("hidden");
      notes.innerText = "Erro ao desconectar. Tente novamente.";
      hiddenNotes();
    } finally {
      loader.style.display = "none";
      buttonConnection.disabled = false;
    }
  } else {
    qrAttempts = 1;
    const success = await fetchAndDisplayQRCode();

    if (success) {
      startQrTimer();
    }
  }
}

async function fetchAndDisplayQRCode() {
  const token = localStorage.getItem("token");

  loader.style.display = "block";
  buttonConnection.disabled = true;
  qrcodeElement.innerHTML = "";

  try {
    const response = await fetch(connectRoutes, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 || response.status === 403) {
      await updateDashboard(response);
      return false;
    }

    const contentType = response.headers.get("content-type");
    let imgSrc;

    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();

      if (!response.ok) {
        notes.removeAttribute("hidden");
        notes.innerText = data.message || "Erro ao gerar QR Code.";
        hiddenNotes();
        return false;
      }

      if (data.connection === "open") {
        stopQrProcess();
        statusConnection.innerText = "Conectado";
        statusConnection.classList.remove("disconnected");
        statusConnection.classList.add("connected");
        localStorage.setItem("connection", "open");
        buttonConnection.innerText = "Desconectar";
        return false;
      }

      const base64 = data.qrCodeBase64 || data.base64 || data.qrcode;
      imgSrc = base64.startsWith("data:image")
        ? base64
        : `data:image/png;base64,${base64}`;
    } else {
      if (!response.ok) {
        notes.removeAttribute("hidden");
        notes.innerText = "Erro no servidor ao obter imagem do QR Code.";
        hiddenNotes();
        return false;
      }

      const blob = await response.blob();
      imgSrc = URL.createObjectURL(blob);
    }

    qrcodeElement.removeAttribute("hidden");
    qrcodeElement.innerHTML = `<img src="${imgSrc}" alt="QR Code">`;

    return true;
  } catch (error) {
    notes.removeAttribute("hidden");
    notes.innerText = "Erro ao gerar QR Code. Por favor, tente novamente.";
    hiddenNotes();
    return false;
  } finally {
    loader.style.display = "none";
    buttonConnection.disabled = false;
  }
}

function startQrTimer() {
  clearInterval(timerInterval);
  timeLeft = 25;
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
  timerElement.removeAttribute("hidden");
  timerElement.textContent = `Novo QR Code em: ${timeLeft}s`;

  if (timeLeft === 0) {
    clearInterval(timerInterval);
    handleTimerExpired();
  } else {
    timeLeft--;
  }
}

async function handleTimerExpired() {
  const token = localStorage.getItem("token");

  notes.removeAttribute("hidden");
  notes.innerText = "Verificando status da conexão...";

  try {
    const response = await fetch(dashboardRoutes, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    await updateDashboard(response);

    if (localStorage.getItem("connection") === "open") {
      notes.innerText = "Conexão realizada com sucesso!";
      hiddenNotes();
      return;
    }

    if (qrAttempts >= 3) {
      stopQrProcess();
      notes.removeAttribute("hidden");
      notes.innerText =
        "Tempo de conexão excedido. Clique em Conectar novamente.";
      hiddenNotes();
      return;
    }

    qrAttempts++;
    notes.innerText = "Gerando novo QR Code...";
    timerElement.setAttribute("hidden", "");

    const success = await fetchAndDisplayQRCode();
    if (success) {
      notes.setAttribute("hidden", "");
      startQrTimer();
    }
  } catch (err) {
    stopQrProcess();
    notes.removeAttribute("hidden");
    notes.innerText = "Erro ao verificar conexão.";
    hiddenNotes();
  }
}

function stopQrProcess() {
  clearInterval(timerInterval);
  qrAttempts = 1;
  if (qrcodeElement) {
    qrcodeElement.innerHTML = "";
    qrcodeElement.setAttribute("hidden", "");
  }
  if (timerElement) {
    timerElement.setAttribute("hidden", "");
  }
}

async function updateDashboard(response) {
  const data = await response.json();

  if (!response.ok) {
    stopQrProcess();

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");

      notes.removeAttribute("hidden");
      notes.innerText = data.message;

      hiddenNotes();

      setTimeout(() => {
        window.location.href = `${urlHome}`;
      }, 2000);

      return;
    }
    notes.removeAttribute("hidden");
    notes.innerText = data.message;

    hiddenNotes();
    return;
  }

  instanceName.innerText = data.instanceName;

  if (data.instanceName.includes("M2K")) registerIcon.removeAttribute("hidden");

  if (data.connection === "open") {
    stopQrProcess();
    statusConnection.innerText = "Conectado";
    statusConnection.classList.remove("disconnected");
    statusConnection.classList.add("connected");
    localStorage.setItem("connection", data.connection);
  } else {
    statusConnection.innerText = "Desconectado";
    statusConnection.classList.remove("connected");
    statusConnection.classList.add("disconnected");
    localStorage.setItem("connection", data.connection);
  }

  buttonConnection.removeAttribute("hidden");

  buttonConnection.innerText =
    data.connection === "open" ? "Desconectar" : "Conectar";

  if (logoutIcon) logoutIcon.removeAttribute("hidden");
}

function hiddenNotes(input) {
  clearTimeout(hideTimeoutId);

  hideTimeoutId = setTimeout(() => {
    notes.setAttribute("hidden", "");
    if (input) input.focus();
  }, 4000);
}
