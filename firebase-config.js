import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  updateDoc, 
  deleteField, 
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
  apiKey: "AIzaSyAn9MNfRLSGJ2hHMZSkTRLrn0W8Q46b0T4",
  authDomain: "hubmarins.firebaseapp.com",
  projectId: "hubmarins",
  storageBucket: "hubmarins.firebasestorage.app",
  messagingSenderId: "136722182300",
  appId: "1:136722182300:web:5794d763ec2d86dd247d59"
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
      
      // Re-renderiza a lista com os status atualizados do Firebase
      if (typeof window.renderList === 'function') {
        window.renderList();
      }
    }, (error) => {
      if (error.code === 'permission-denied') return;
      console.error("Erro no listener do Firestore:", error);
    });
  } else {
    window.userProgressCache = {};
    console.log("Nenhum usuário autenticado.");
    if (typeof window.renderList === 'function') {
      window.renderList();
    }
  }
});

// Função global para acionar o login via Google
window.loginWithGoogle = async function() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("Login realizado com sucesso!", result.user);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.log("Login cancelado pelo usuário.");
      return;
    }
    console.error("Erro ao fazer login:", error.code, error.message);
    alert("Erro ao autenticar: " + error.message);
  }
};

// Função global para salvar/remover o progresso de um vídeo
window.updateVideoProgress = async function(videoId, selectedValue) {
  if (!window.currentUser) {
    alert("Usuário não autenticado no Firebase.");
    return;
  }

  const userId = window.currentUser.uid;
  const userProgressDoc = doc(db, "users", userId);

  try {
    if (selectedValue === "" || selectedValue === null) {
      delete window.userProgressCache[videoId];
      
      await updateDoc(userProgressDoc, {
        [`progress.${videoId}`]: deleteField()
      });
    } else {
      window.userProgressCache[videoId] = Number(selectedValue);

      await setDoc(userProgressDoc, {
        progress: window.userProgressCache
      }, { merge: true });
    }
  } catch (err) {
    console.error("Erro ao sincronizar com Firestore:", err);
  }
};

// Atualiza os elementos visuais da barra superior (Botão Entrar e Perfil com Foto/Dropdown)
function updateAuthUI(user) {
  const loginBtn = document.getElementById('loginBtn');
  const userProfileDropdown = document.getElementById('userProfileDropdown');
  const userAvatarImg = document.getElementById('userAvatarImg');
  const userNameSpan = document.getElementById('userNameSpan');
  const userEmailSpan = document.getElementById('userEmailSpan');
  const userMenu = document.getElementById('userMenu');

  if (user) {
    // Estado Logado
    if (loginBtn) loginBtn.style.display = 'none';
    if (userProfileDropdown) userProfileDropdown.style.display = 'block';

    // Preenche as informações do usuário logado
    if (userAvatarImg) userAvatarImg.src = user.photoURL || 'https://via.placeholder.com/36';
    if (userNameSpan) userNameSpan.textContent = user.displayName || 'Usuário';
    if (userEmailSpan) userEmailSpan.textContent = user.email || '';
  } else {
    // Estado Deslogado
    if (loginBtn) loginBtn.style.display = 'block';
    if (userProfileDropdown) userProfileDropdown.style.display = 'none';
    if (userMenu) userMenu.style.display = 'none'; // Fecha o menu se estiver aberto
  }
}

// Função para Deslogar
window.logoutFromFirebase = async function() {
  try {
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
      if (typeof window.renderList === 'function') window.renderList();
    } catch (err) {
      alert("Erro ao importar o arquivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
};
