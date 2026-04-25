const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwORES8KNeXumxvw3D6MBGYYeEogyzKTS-rr8qFVYASAFgZUgYRHN_BMzJYV9lCWJP2/exec";
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

  try {
    if (SCRIPT_URL.includes("PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
      throw new Error("Missing Apps Script URL");
    }

    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, idea, date }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Request failed");
    }

    savedRemotely = true;
  } catch (error) {
    console.error(error);
  } finally {
    state.lastSubmissionAt = Date.now();
    showConfirmationCard({
      name,
      idea,
      date,
      successMessage: savedRemotely ? getText("successSaved") : "",
      warningMessage: savedRemotely ? "" : getText("successLocal"),
    });

    elements.form.reset();
    updateCounter();
    closeModal();

    elements.submitButton.disabled = false;
    elements.submitButton.textContent = originalSubmitText;
    setFormMessage(savedRemotely ? getText("cooldownMessage") : getText("errorGeneric"), savedRemotely ? "success" : "warning");
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
