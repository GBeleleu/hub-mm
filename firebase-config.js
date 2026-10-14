import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

// Credenciais do Projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDQ_bQKTnPryYQEfzzcu4H0gHopajv4RP4",
  authDomain: "meuguia-progresso.firebaseapp.com",
  projectId: "meuguia-progresso",
  storageBucket: "meuguia-progresso.firebasestorage.app",
  messagingSenderId: "391949244186",
  appId: "1:391949244186:web:02d5b1da5ffe4e1dadfea3"
};

// Inicializa o Firebase e o Firestore com suporte a múltiplas abas
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
const auth = getAuth(app);

// Estado global
window.currentUser = null;
window.userProgressCache = {};
let unsubscribeSnapshot = null;

// Observa mudanças na autenticação do usuário
onAuthStateChanged(auth, (user) => {
  window.currentUser = user;
  updateAuthUI(user);

  // Se houver um ouvinte ativo anterior, cancela ele antes de criar um novo ou deslogar
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  if (user) {
    console.log("Usuário autenticado:", user.email || user.uid);
    const progressRef = doc(db, "users", user.uid);
    
    // Armazena a função de cancelamento retornada pelo onSnapshot
    unsubscribeSnapshot = onSnapshot(progressRef, (docSnap) => {
      if (!window.currentUser) return; 
      
      if (docSnap.exists()) {
        window.userProgressCache = docSnap.data().progress || {};
      } else {
        window.userProgressCache = {};
      }
      if (typeof renderList === 'function') renderList();
    }, (error) => {
      // Trata silenciosamente erros de permissão se ocorrerem durante o encerramento da sessão
      if (error.code === 'permission-denied') return;
      console.error("Erro no listener do Firestore:", error);
    });
  } else {
    window.userProgressCache = {};
    console.log("Nenhum usuário autenticado.");
    if (typeof renderList === 'function') renderList();
  }
  
  if (typeof toggleCardStatusControls === 'function') {
    toggleCardStatusControls(!!user);
  }
});
  
  // Atualiza o estado dos seletores na tela
  if (typeof toggleCardStatusControls === 'function') {
    toggleCardStatusControls(!!user);
  }
});

// Função global para acionar o login via Google
window.loginWithGoogle = async function() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Login realizado com sucesso!", result.user);
  } catch (error) {
    // Silencia erros caso o usuário apenas feche o popup intencionalmente
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.log("Login cancelado pelo usuário.");
      return;
    }
    console.error("Erro ao fazer login:", error.code, error.message);
    alert("Erro ao autenticar: " + error.message);
  }
};

// Função global para salvar o progresso de um vídeo
window.updateVideoProgress = async function(videoId, selectedValue) {
  if (!window.currentUser) {
    alert("Usuário não autenticado no Firebase.");
    return;
  }

  const userId = window.currentUser.uid;
  const userProgressDoc = doc(db, "users", userId);

  if (selectedValue === "" || selectedValue === null) {
    delete window.userProgressCache[videoId];
  } else {
    window.userProgressCache[videoId] = Number(selectedValue);
  }

  try {
    await setDoc(userProgressDoc, {
      progress: window.userProgressCache
    }, { merge: true });
  } catch (err) {
    console.error("Erro ao sincronizar com Firestore:", err);
  }
};

// Atualiza os elementos visuais da barra superior (Botão Entrar/Sair e Email)
function updateAuthUI(user) {
  const loginBtn = document.getElementById('loginBtn');
  const userEmailSpan = document.getElementById('userEmailSpan');
  const logoutBtn = document.getElementById('logoutBtn');

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userEmailSpan) {
      userEmailSpan.textContent = user.email || user.displayName || 'Usuário Logado';
      userEmailSpan.style.display = 'inline';
    }
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (userEmailSpan) {
      userEmailSpan.textContent = '';
      userEmailSpan.style.display = 'none';
    }
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

// Função para Deslogar
window.logoutFromFirebase = async function() {
  try {
    // Para o listener explicitamente antes de invalidar a sessão
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    window.userProgressCache = {};
    
    await signOut(auth);
    console.log("Usuário deslogado com sucesso.");
  } catch (error) {
    console.error("Erro ao deslogar:", error);
  }
};

// Exportar progresso para arquivo JSON
window.exportProgressJSON = function() {
  if (!window.userProgressCache || Object.keys(window.userProgressCache).length === 0) {
    alert("Nenhum dado de progresso para exportar.");
    return;
  }

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.userProgressCache, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `progresso_videos_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

// Importar progresso de arquivo JSON
window.importProgressJSON = function(event) {
  if (!window.currentUser) {
    alert("Faça login antes de importar o progresso.");
    return;
  }

  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const importedData = JSON.parse(e.target.result);

      if (typeof importedData !== 'object' || Array.isArray(importedData)) {
        throw new Error("Formato JSON inválido. Esperado um objeto de mapa { videoId: status }.");
      }

      window.userProgressCache = { ...window.userProgressCache, ...importedData };

      const userId = window.currentUser.uid;
      const userProgressDoc = doc(db, "users", userId);
      await setDoc(userProgressDoc, { progress: window.userProgressCache }, { merge: true });

      alert("Progresso importado com sucesso!");
      if (typeof renderList === 'function') renderList();
    } catch (err) {
      alert("Erro ao importar o arquivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
};
