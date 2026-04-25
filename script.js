const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxXj8_b89Rkj6uiFnhtxqFXeKZbu_qlqLvFPA-6Txe1n-pB_FHR8ZK6Rh2xzjVYtUkL/exec";
const MAX_IDEA_LENGTH = 300;
const SUBMISSION_COOLDOWN_MS = 4000;

const translations = {
  fr: {
    brand: "Idea Box",
    eyebrow: "Boite a idees familiale",
    title: "Une petite boite magique pour vos envies",
    description:
      "Aidez-nous a imaginer notre future maison d'hotes. Une idee simple, folle, poetique ou pratique: tout est bienvenu.",
    cta: "Ajouter une idee",
    successLabel: "Derniere idee ajoutee",
    ideasFeedLabel: "Inspiration du moment",
    ideasFeedTitle: "Les dernieres idees partagees",
    ideasFeedLoading: "Chargement des idees...",
    ideasFeedEmpty: "Aucune idee enregistree pour le moment. Soyez le premier.",
    ideasFeedError: "Impossible de charger les idees pour le moment.",
    submitAnother: "Ajouter une autre idee",
    formKicker: "Partagez votre idee",
    formTitle: "Qu'aimeriez-vous voir dans ce lieu ?",
    nameLabel: "Votre nom (facultatif)",
    namePlaceholder: "Ex. Camille",
    ideaLabel: "Votre idee",
    ideaPlaceholder:
      "Ex. Une terrasse conviviale avec des plaids pour les soirs frais...",
    helperText:
      "Quelques mots suffisent. Votre idee peut etre simple ou ambitieuse.",
    cancel: "Annuler",
    submit: "Envoyer l'idee",
    submitting: "Envoi en cours...",
    anonymous: "Anonyme",
    dateLocale: "fr-FR",
    successSaved: "Merci, votre idee a ete ajoutee avec succes.",
    successLocal:
      "Votre idee apparait bien ici, mais l'enregistrement Google Sheets a echoue. Verifiez l'URL Apps Script.",
    backendErrorPrefix: "Erreur Google Sheets : ",
    errorIdeaRequired: "Merci d'ecrire une idee avant d'envoyer.",
    errorIdeaTooLong: "Merci de limiter votre idee a 300 caracteres.",
    errorGeneric:
      "Impossible d'envoyer pour le moment. Reessayez dans quelques instants.",
    cooldownMessage: "Merci. Vous pourrez envoyer une nouvelle idee dans quelques secondes.",
    closeLabel: "Fermer",
  },
  en: {
    brand: "Idea Box",
    eyebrow: "Family idea box",
    title: "A little magical box for your ideas",
    description:
      "Help us imagine our future guest house. A practical, poetic, playful, or ambitious idea: everything is welcome.",
    cta: "Add an idea",
    successLabel: "Latest idea added",
    ideasFeedLabel: "Current inspiration",
    ideasFeedTitle: "Recently shared ideas",
    ideasFeedLoading: "Loading ideas...",
    ideasFeedEmpty: "No saved ideas yet. Be the first to share one.",
    ideasFeedError: "Unable to load ideas right now.",
    submitAnother: "Submit another idea",
    formKicker: "Share your idea",
    formTitle: "What would you love to find in this place?",
    nameLabel: "Your name (optional)",
    namePlaceholder: "Ex. Camille",
    ideaLabel: "Your idea",
    ideaPlaceholder:
      "Ex. A cozy terrace with blankets for cool evenings...",
    helperText:
      "A few words are enough. Your idea can be simple or ambitious.",
    cancel: "Cancel",
    submit: "Send idea",
    submitting: "Sending...",
    anonymous: "Anonymous",
    dateLocale: "en-GB",
    successSaved: "Thank you, your idea was saved successfully.",
    successLocal:
      "Your idea is shown here, but saving to Google Sheets failed. Check the Apps Script URL.",
    backendErrorPrefix: "Google Sheets error: ",
    errorIdeaRequired: "Please write an idea before submitting.",
    errorIdeaTooLong: "Please keep your idea within 300 characters.",
    errorGeneric: "Unable to send right now. Please try again shortly.",
    cooldownMessage: "Thanks. You can send another idea in a few seconds.",
    closeLabel: "Close",
  },
};

const state = {
  language: "fr",
  lastSubmissionAt: 0,
  ideas: [],
};

const elements = {
  html: document.documentElement,
  body: document.body,
  languageToggle: document.getElementById("languageToggle"),
  openFormButton: document.getElementById("openFormButton"),
  submitAnotherButton: document.getElementById("submitAnotherButton"),
  closeFormButton: document.getElementById("closeFormButton"),
  cancelButton: document.getElementById("cancelButton"),
  modal: document.getElementById("ideaModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  form: document.getElementById("ideaForm"),
  nameInput: document.getElementById("nameInput"),
  ideaInput: document.getElementById("ideaInput"),
  submitButton: document.getElementById("submitButton"),
  formMessage: document.getElementById("formMessage"),
  ideaCounter: document.getElementById("ideaCounter"),
  confirmationPanel: document.getElementById("confirmationPanel"),
  ideaCard: document.getElementById("ideaCard"),
  ideaAuthor: document.getElementById("ideaAuthor"),
  ideaDate: document.getElementById("ideaDate"),
  ideaText: document.getElementById("ideaText"),
  ideaStatus: document.getElementById("ideaStatus"),
  ideasFeedEmpty: document.getElementById("ideasFeedEmpty"),
  ideasFeedList: document.getElementById("ideasFeedList"),
};

function detectLanguage() {
  const browserLanguage = (navigator.language || "").toLowerCase();
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

function getText(key) {
  return translations[state.language][key];
}

function applyTranslations() {
  elements.html.lang = state.language;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (translations[state.language][key]) {
      node.textContent = translations[state.language][key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (translations[state.language][key]) {
      node.placeholder = translations[state.language][key];
    }
  });

  elements.closeFormButton.setAttribute("aria-label", getText("closeLabel"));
  updateCounter();
  refreshConfirmationCardLabels();
  renderIdeasFeed();
}

function toggleLanguage() {
  state.language = state.language === "fr" ? "en" : "fr";
  applyTranslations();
}

function updateCounter() {
  const count = elements.ideaInput.value.trim().length;
  elements.ideaCounter.textContent = `${count} / ${MAX_IDEA_LENGTH}`;
}

function setFormMessage(message = "", stateName = "") {
  elements.formMessage.textContent = message;
  if (stateName) {
    elements.formMessage.dataset.state = stateName;
  } else {
    delete elements.formMessage.dataset.state;
  }
}

function formatIdeaDate(isoString) {
  return new Intl.DateTimeFormat(getText("dateLocale"), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(isoString));
}

function refreshConfirmationCardLabels() {
  if (!elements.confirmationPanel.hidden) {
    const author = elements.ideaAuthor.dataset.author || "";
    elements.ideaAuthor.textContent = author || getText("anonymous");
  }
}

function showConfirmationCard({ name, idea, date, warningMessage = "", successMessage = "" }) {
  elements.ideaAuthor.dataset.author = name.trim();
  elements.ideaAuthor.textContent = name.trim() || getText("anonymous");
  elements.ideaDate.textContent = formatIdeaDate(date);
  elements.ideaText.textContent = idea.trim();
  elements.ideaStatus.textContent = warningMessage || successMessage;
  elements.ideaStatus.style.color = warningMessage ? "var(--warning)" : "var(--success)";

  elements.confirmationPanel.hidden = false;
  elements.ideaCard.classList.remove("is-visible");
  void elements.ideaCard.offsetWidth;
  elements.ideaCard.classList.add("is-visible");
  elements.confirmationPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

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

function renderIdeasFeed() {
  if (!state.ideas.length) {
    elements.ideasFeedList.innerHTML = "";
    elements.ideasFeedEmpty.hidden = false;
    elements.ideasFeedEmpty.textContent = getText("ideasFeedEmpty");
    return;
  }

  elements.ideasFeedEmpty.hidden = true;
  elements.ideasFeedList.innerHTML = state.ideas
    .map((entry) => {
      const author = entry.name ? escapeHtml(entry.name) : escapeHtml(getText("anonymous"));
      const date = entry.date ? escapeHtml(formatIdeaDate(entry.date)) : "";
      const idea = escapeHtml(entry.idea || "");

      return `
        <article class="feed-card is-visible">
          <div class="idea-card-top">
            <span class="idea-card-author">${author}</span>
            <span class="idea-card-date">${date}</span>
          </div>
          <p class="idea-card-body">${idea}</p>
        </article>
      `;
    })
    .join("");
}

function prependIdeaToFeed({ name, idea, date }) {
  state.ideas = [{ name, idea, date }, ...state.ideas].slice(0, 8);
  renderIdeasFeed();
}

async function loadIdeas() {
  if (SCRIPT_URL.includes("PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
    elements.ideasFeedEmpty.textContent = getText("ideasFeedEmpty");
    return;
  }

  elements.ideasFeedEmpty.hidden = false;
  elements.ideasFeedEmpty.textContent = getText("ideasFeedLoading");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(responseText || "Invalid response from Apps Script");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to load ideas");
    }

    state.ideas = Array.isArray(result.ideas) ? result.ideas : [];
    renderIdeasFeed();
  } catch (error) {
    console.error(error);
    elements.ideasFeedList.innerHTML = "";
    elements.ideasFeedEmpty.hidden = false;
    elements.ideasFeedEmpty.textContent = `${getText("ideasFeedError")} ${error.message || ""}`.trim();
  }
}

function openModal() {
  elements.modal.hidden = false;
  elements.modalBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.body.classList.add("modal-open");
    elements.modal.classList.add("is-open");
    elements.modalBackdrop.classList.add("is-visible");
  });
  setTimeout(() => elements.ideaInput.focus(), 120);
}

function closeModal() {
  elements.modal.classList.remove("is-open");
  elements.modalBackdrop.classList.remove("is-visible");
  elements.body.classList.remove("modal-open");
  setTimeout(() => {
    elements.modal.hidden = true;
    elements.modalBackdrop.hidden = true;
  }, 260);
}

function isCooldownActive() {
  return Date.now() - state.lastSubmissionAt < SUBMISSION_COOLDOWN_MS;
}

async function submitIdea(event) {
  event.preventDefault();

  const name = elements.nameInput.value.trim();
  const idea = elements.ideaInput.value.trim();
  const date = new Date().toISOString();

  if (!idea) {
    setFormMessage(getText("errorIdeaRequired"), "error");
    elements.ideaInput.focus();
    return;
  }

  if (idea.length > MAX_IDEA_LENGTH) {
    setFormMessage(getText("errorIdeaTooLong"), "error");
    return;
  }

  if (isCooldownActive()) {
    setFormMessage(getText("cooldownMessage"), "warning");
    return;
  }

  const originalSubmitText = getText("submit");
  elements.submitButton.disabled = true;
  elements.submitButton.textContent = getText("submitting");
  setFormMessage("", "");

  let savedRemotely = false;
  let remoteErrorMessage = "";

  try {
    if (SCRIPT_URL.includes("PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
      throw new Error("Missing Apps Script URL");
    }

    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify({ name, idea, date }),
    });

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(responseText || "Invalid response from Apps Script");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Request failed");
    }

    savedRemotely = true;
  } catch (error) {
    console.error(error);
    remoteErrorMessage = error.message || getText("errorGeneric");
  } finally {
    state.lastSubmissionAt = Date.now();
    showConfirmationCard({
      name,
      idea,
      date,
      successMessage: savedRemotely ? getText("successSaved") : "",
      warningMessage: savedRemotely
        ? ""
        : `${getText("successLocal")} ${getText("backendErrorPrefix")}${remoteErrorMessage}`,
    });

    prependIdeaToFeed({ name, idea, date });

    elements.form.reset();
    updateCounter();
    closeModal();

    elements.submitButton.disabled = false;
    elements.submitButton.textContent = originalSubmitText;
    setFormMessage(
      savedRemotely
        ? getText("cooldownMessage")
        : `${getText("backendErrorPrefix")}${remoteErrorMessage}`,
      savedRemotely ? "success" : "warning"
    );
  }
}

function handleKeydown(event) {
  if (event.key === "Escape" && !elements.modal.hidden) {
    closeModal();
  }
}

function init() {
  state.language = detectLanguage();
  applyTranslations();
  updateCounter();
  loadIdeas();

  elements.languageToggle.addEventListener("click", toggleLanguage);
  elements.openFormButton.addEventListener("click", openModal);
  elements.submitAnotherButton.addEventListener("click", openModal);
  elements.closeFormButton.addEventListener("click", closeModal);
  elements.cancelButton.addEventListener("click", closeModal);
  elements.modalBackdrop.addEventListener("click", closeModal);
  elements.ideaInput.addEventListener("input", updateCounter);
  elements.form.addEventListener("submit", submitIdea);
  document.addEventListener("keydown", handleKeydown);
}

init();
