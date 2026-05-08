const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzkOPozx7s8whnG4SFJVEQx-MtveuzkKQVfb-E_7P-74dzCuW2ty0SlSG5HjyOtL3AF/exec";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_PHOTO_SIZE = 4 * 1024 * 1024;
const MAX_PHOTO_COUNT = 6;
const SUBMISSION_COOLDOWN_MS = 4000;

const state = {
  lastSubmissionAt: 0,
  entries: [],
};

const elements = {
  form: document.getElementById("livredorForm"),
  nameInput: document.getElementById("guestNameInput"),
  messageInput: document.getElementById("guestMessageInput"),
  messageCounter: document.getElementById("guestMessageCounter"),
  photoInput: document.getElementById("guestPhotoInput"),
  photoPreview: document.getElementById("guestPhotoPreview"),
  formMessage: document.getElementById("guestFormMessage"),
  submitButton: document.getElementById("guestSubmitButton"),
  submitButtonLabel: document.querySelector("#guestSubmitButton span"),
  feedEmpty: document.getElementById("livredorFeedEmpty"),
  feedList: document.getElementById("livredorFeedList"),
  feedStatus: document.getElementById("livredorFeedStatus"),
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatDate(isoString) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(isoString));
}

function setFormMessage(message = "", stateName = "") {
  elements.formMessage.textContent = message;
  if (stateName) {
    elements.formMessage.dataset.state = stateName;
  } else {
    delete elements.formMessage.dataset.state;
  }
}

function getFriendlySubmitError(error) {
  if ((error.message || "").includes("Idea is required")) {
    return "Le backend Google Apps Script deploye est encore l'ancienne version Idea Box. Redeployez le script avec le code LivreDor, puis reessayez.";
  }

  return `Impossible d'envoyer pour le moment. ${error.message || ""}`.trim();
}

function setFeedStatus(message = "") {
  elements.feedStatus.hidden = !message;
  elements.feedStatus.textContent = message;
}

function updateCounter() {
  elements.messageCounter.textContent = `${elements.messageInput.value.trim().length} / ${MAX_MESSAGE_LENGTH}`;
}

function renderEntries() {
  if (!state.entries.length) {
    elements.feedList.innerHTML = "";
    elements.feedEmpty.hidden = false;
    elements.feedEmpty.textContent = "Aucun message affiche pour le moment.";
    return;
  }

  elements.feedEmpty.hidden = true;
  elements.feedList.innerHTML = state.entries
    .map((entry) => {
      const author = escapeHtml(entry.name || "");
      const date = entry.date ? escapeHtml(formatDate(entry.date)) : "";
      const message = escapeHtml(entry.message || "");

      return `
        <article class="feed-card is-visible">
          <div class="idea-card-top">
            <span class="idea-card-author">${author}</span>
            <span class="idea-card-date">${date}</span>
          </div>
          <p class="idea-card-body">${message}</p>
        </article>
      `;
    })
    .join("");
}

async function sendJsonRequest(payload) {
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let result;

  try {
    result = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(responseText || "Reponse Apps Script invalide");
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Requete impossible");
  }

  return result;
}

async function loadEntries() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=livredor&limit=30`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Chargement impossible");
    }

    state.entries = Array.isArray(result.entries) ? result.entries : [];
    renderEntries();
    setFeedStatus("");
  } catch (error) {
    console.error(error);
    elements.feedEmpty.hidden = false;
    elements.feedEmpty.textContent = "Impossible de charger le livre d'or pour le moment.";
  }
}

function isCooldownActive() {
  return Date.now() - state.lastSubmissionAt < SUBMISSION_COOLDOWN_MS;
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Merci de choisir une image."));
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      reject(new Error("Merci de choisir une photo de moins de 4 Mo."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result || "";
      resolve({
        name: file.name,
        mimeType: file.type,
        data: String(dataUrl).split(",")[1] || "",
      });
    };
    reader.onerror = () => reject(new Error("Impossible de lire la photo."));
    reader.readAsDataURL(file);
  });
}

function readPhotos(files) {
  const selectedFiles = Array.from(files || []);

  if (selectedFiles.length > MAX_PHOTO_COUNT) {
    return Promise.reject(new Error(`Merci de choisir ${MAX_PHOTO_COUNT} photos maximum.`));
  }

  return Promise.all(selectedFiles.map(readPhoto));
}

function handlePhotoChange() {
  const files = Array.from(elements.photoInput.files || []);

  if (!files.length) {
    elements.photoPreview.hidden = true;
    elements.photoPreview.innerHTML = "";
    return;
  }

  if (files.length > MAX_PHOTO_COUNT) {
    setFormMessage(`Merci de choisir ${MAX_PHOTO_COUNT} photos maximum.`, "error");
    elements.photoInput.value = "";
    elements.photoPreview.hidden = true;
    elements.photoPreview.innerHTML = "";
    return;
  }

  const invalidFile = files.find((file) => !file.type.startsWith("image/") || file.size > MAX_PHOTO_SIZE);

  if (invalidFile) {
    setFormMessage(
      invalidFile.size > MAX_PHOTO_SIZE
        ? "Merci de choisir une photo de moins de 4 Mo."
        : "Merci de choisir une image.",
      "error"
    );
    elements.photoInput.value = "";
    elements.photoPreview.hidden = true;
    elements.photoPreview.innerHTML = "";
    return;
  }

  elements.photoPreview.innerHTML = files
    .map((file) => `<img class="photo-preview" src="${URL.createObjectURL(file)}" alt="" />`)
    .join("");
  elements.photoPreview.hidden = false;
  setFormMessage("", "");
}

async function submitEntry(event) {
  event.preventDefault();

  const name = elements.nameInput.value.trim();
  const message = elements.messageInput.value.trim();
  const date = new Date().toISOString();
  const files = elements.photoInput.files;

  if (!name) {
    setFormMessage("Merci d'indiquer votre nom avant d'envoyer.", "error");
    elements.nameInput.focus();
    return;
  }

  if (!message) {
    setFormMessage("Merci d'ecrire un message avant d'envoyer.", "error");
    elements.messageInput.focus();
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    setFormMessage(`Merci de limiter votre message a ${MAX_MESSAGE_LENGTH} caracteres.`, "error");
    return;
  }

  if (isCooldownActive()) {
    setFormMessage("Merci. Vous pourrez envoyer un autre message dans quelques secondes.", "warning");
    return;
  }

  elements.submitButton.disabled = true;
  elements.submitButtonLabel.textContent = "Envoi en cours...";
  setFormMessage("", "");

  try {
    const photos = await readPhotos(files);
    const result = await sendJsonRequest({
      action: "submitLivredor",
      name,
      message,
      date,
      photos,
    });

    state.lastSubmissionAt = Date.now();
    setFormMessage("Merci, votre message a ete ajoute au livre d'or.", "success");

    state.entries = [{
      id: result.entryId,
      name,
      message,
      date,
      photoUrls: result.photoUrls || [],
    }].concat(state.entries);
    renderEntries();

    elements.form.reset();
    elements.photoPreview.hidden = true;
    elements.photoPreview.innerHTML = "";
    updateCounter();
  } catch (error) {
    console.error(error);
    setFormMessage(getFriendlySubmitError(error), "error");
  } finally {
    elements.submitButton.disabled = false;
    elements.submitButtonLabel.textContent = "Envoyer le message";
  }
}

function init() {
  updateCounter();
  loadEntries();

  elements.messageInput.addEventListener("input", updateCounter);
  elements.photoInput.addEventListener("change", handlePhotoChange);
  elements.form.addEventListener("submit", submitEntry);
}

init();
