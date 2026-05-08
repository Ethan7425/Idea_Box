const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzkOPozx7s8whnG4SFJVEQx-MtveuzkKQVfb-E_7P-74dzCuW2ty0SlSG5HjyOtL3AF/exec";
const MAX_IDEA_LENGTH = 300;
const SUBMISSION_COOLDOWN_MS = 4000;
const IDEAS_PAGE_SIZE = 8;
const VOTE_STORAGE_KEY = "idea-box-votes";

const translations = {
  fr: {
    brand: "Idea Box",
    eyebrow: "Boite a idees familiale",
    title: "Une petite boite magique pour vos envies",
    description:
      "Aidez-nous a imaginer notre future maison d'hotes. Une idee simple, folle, poetique ou pratique: tout est bienvenu.",
    cta: "Ajouter une idee",
    guestbookLink: "Ouvrir le livre d'or",
    successLabel: "Derniere idee ajoutee",
    ideasFeedLabel: "Inspiration du moment",
    ideasFeedTitle: "Les dernieres idees partagees",
    ideasFeedLoading: "Chargement des idees...",
    ideasFeedLoadingMore: "Chargement d'autres idees...",
    ideasFeedEmpty: "Aucune idee enregistree pour le moment. Soyez le premier.",
    ideasFeedError: "Impossible de charger les idees pour le moment.",
    ideasFeedEnd: "Toutes les idees ont ete affichees.",
    upvote: "Super",
    downvote: "Mouai",
    voteError: "Impossible d'enregistrer ce vote.",
    voteSaved: "Votre vote a ete pris en compte.",
    voteRemoved: "Votre vote a ete retire.",
    submitAnother: "Ajouter une autre idee",
    formKicker: "Partagez votre idee",
    formTitle: "Qu'aimeriez-vous voir dans ce lieu ?",
    nameLabel: "Votre nom (facultatif)",
    namePlaceholder: "Ex. Ethan",
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
    guestbookLink: "Open the guestbook",
    successLabel: "Latest idea added",
    ideasFeedLabel: "Current inspiration",
    ideasFeedTitle: "Recently shared ideas",
    ideasFeedLoading: "Loading ideas...",
    ideasFeedLoadingMore: "Loading more ideas...",
    ideasFeedEmpty: "No saved ideas yet. Be the first to share one.",
    ideasFeedError: "Unable to load ideas right now.",
    ideasFeedEnd: "All ideas are now visible.",
    upvote: "Like",
    downvote: "Unlike",
    voteError: "Unable to save this vote.",
    voteSaved: "Your vote was saved.",
    voteRemoved: "Your vote was removed.",
    submitAnother: "Submit another idea",
    formKicker: "Share your idea",
    formTitle: "What would you love to find in this place?",
    nameLabel: "Your name (optional)",
    namePlaceholder: "Ex. Ethan",
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
  nextOffset: 0,
  hasMoreIdeas: true,
  isLoadingIdeas: false,
  observer: null,
  activeVoteId: null,
  userVotes: {},
  voteAnimation: null,
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
  submitButtonLabel: document.querySelector("#submitButton span"),
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
  ideasFeedStatus: document.getElementById("ideasFeedStatus"),
  feedSentinel: document.getElementById("feedSentinel"),
};

function detectLanguage() {
  const browserLanguage = (navigator.language || "").toLowerCase();
  return browserLanguage.startsWith("fr") ? "fr" : "en";
}

function loadStoredVotes() {
  try {
    const rawVotes = localStorage.getItem(VOTE_STORAGE_KEY);
    const parsedVotes = rawVotes ? JSON.parse(rawVotes) : {};
    return parsedVotes && typeof parsedVotes === "object" ? parsedVotes : {};
  } catch (error) {
    console.error(error);
    return {};
  }
}

function saveStoredVotes() {
  localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(state.userVotes));
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
  elements.confirmationPanel.classList.remove("is-celebrating");
  elements.ideaCard.classList.remove("is-visible");
  elements.ideaCard.classList.remove("is-celebrating");
  void elements.ideaCard.offsetWidth;
  elements.confirmationPanel.classList.add("is-celebrating");
  elements.ideaCard.classList.add("is-visible");
  elements.ideaCard.classList.add("is-celebrating");
  elements.confirmationPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  window.clearTimeout(showConfirmationCard.animationTimeout);
  showConfirmationCard.animationTimeout = window.setTimeout(() => {
    elements.confirmationPanel.classList.remove("is-celebrating");
    elements.ideaCard.classList.remove("is-celebrating");
  }, 760);
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
    elements.ideasFeedStatus.hidden = true;
    elements.ideasFeedStatus.textContent = "";
    return;
  }

  elements.ideasFeedEmpty.hidden = true;
  elements.ideasFeedList.innerHTML = state.ideas
    .map((entry) => {
      const author = entry.name ? escapeHtml(entry.name) : escapeHtml(getText("anonymous"));
      const date = entry.date ? escapeHtml(formatIdeaDate(entry.date)) : "";
      const idea = escapeHtml(entry.idea || "");
      const upvotes = Number(entry.upvotes || 0);
      const downvotes = Number(entry.downvotes || 0);
      const ideaId = escapeHtml(entry.id || "");
      const isVoting = state.activeVoteId === String(entry.id);
      const canVote = Number.isInteger(Number(entry.id)) && !String(entry.id).startsWith("local-");
      const userVote = state.userVotes[String(entry.id)] || "";
      const upSelected = userVote === "up";
      const downSelected = userVote === "down";
      const animatedVote = state.voteAnimation && state.voteAnimation.ideaId === String(entry.id)
        ? state.voteAnimation
        : null;
      const animateUp = animatedVote && animatedVote.voteType === "up";
      const animateDown = animatedVote && animatedVote.voteType === "down";
      const cardAnimationClass = animatedVote ? "is-vote-glow" : "";
      const upAnimationClass = animateUp
        ? animatedVote.mode === "remove"
          ? "is-removing"
          : "is-animating"
        : "";
      const downAnimationClass = animateDown
        ? animatedVote.mode === "remove"
          ? "is-removing"
          : "is-animating"
        : "";

      return `
        <article class="feed-card is-visible ${cardAnimationClass}" data-idea-id="${ideaId}">
          <div class="idea-card-top">
            <span class="idea-card-author">${author}</span>
            <span class="idea-card-date">${date}</span>
          </div>
          <p class="idea-card-body">${idea}</p>
          <div class="vote-row">
            <button class="vote-button ${upSelected ? "is-selected" : ""} ${upAnimationClass}" type="button" data-vote-type="up" aria-pressed="${upSelected ? "true" : "false"}" ${(isVoting || !canVote) ? "disabled" : ""}>
              <span class="vote-icon" aria-hidden="true">👍</span>
              <span>${escapeHtml(getText("upvote"))}</span>
              <span class="vote-count ${animateUp ? "is-animating" : ""}">${upvotes}</span>
            </button>
            <button class="vote-button ${downSelected ? "is-selected" : ""} ${downAnimationClass}" type="button" data-vote-type="down" aria-pressed="${downSelected ? "true" : "false"}" ${(isVoting || !canVote) ? "disabled" : ""}>
              <span class="vote-icon" aria-hidden="true">👎</span>
              <span>${escapeHtml(getText("downvote"))}</span>
              <span class="vote-count ${animateDown ? "is-animating" : ""}">${downvotes}</span>
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  if (state.hasMoreIdeas) {
    if (state.isLoadingIdeas) {
      elements.ideasFeedStatus.hidden = false;
      elements.ideasFeedStatus.textContent = getText("ideasFeedLoadingMore");
    } else {
      elements.ideasFeedStatus.hidden = true;
      elements.ideasFeedStatus.textContent = "";
    }
  } else {
    elements.ideasFeedStatus.hidden = false;
    elements.ideasFeedStatus.textContent = getText("ideasFeedEnd");
  }
}

function prependIdeaToFeed(entry) {
  state.ideas = [entry, ...state.ideas];
  state.nextOffset += 1;
  renderIdeasFeed();
}

function setFeedStatus(message = "") {
  if (!message) {
    elements.ideasFeedStatus.hidden = true;
    elements.ideasFeedStatus.textContent = "";
    return;
  }

  elements.ideasFeedStatus.hidden = false;
  elements.ideasFeedStatus.textContent = message;
}

async function loadIdeas() {
  if (SCRIPT_URL.includes("PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
    elements.ideasFeedEmpty.textContent = getText("ideasFeedEmpty");
    return;
  }

  if (state.isLoadingIdeas || !state.hasMoreIdeas) {
    return;
  }

  state.isLoadingIdeas = true;

  if (!state.ideas.length) {
    elements.ideasFeedEmpty.hidden = false;
    elements.ideasFeedEmpty.textContent = getText("ideasFeedLoading");
  } else {
    setFeedStatus(getText("ideasFeedLoadingMore"));
  }

  try {
    const response = await fetch(
      `${SCRIPT_URL}?offset=${state.nextOffset}&limit=${IDEAS_PAGE_SIZE}`,
      {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      }
    );
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

    const incomingIdeas = Array.isArray(result.ideas) ? result.ideas : [];
    state.ideas = state.ideas.concat(incomingIdeas);
    state.nextOffset += incomingIdeas.length;
    state.hasMoreIdeas = Boolean(result.hasMore);
    renderIdeasFeed();
  } catch (error) {
    console.error(error);
    if (!state.ideas.length) {
      elements.ideasFeedList.innerHTML = "";
      elements.ideasFeedEmpty.hidden = false;
      elements.ideasFeedEmpty.textContent = `${getText("ideasFeedError")} ${error.message || ""}`.trim();
    } else {
      setFeedStatus(`${getText("ideasFeedError")} ${error.message || ""}`.trim());
    }
  } finally {
    state.isLoadingIdeas = false;
    if (state.ideas.length) {
      renderIdeasFeed();
    }
  }
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
    throw new Error(responseText || "Invalid response from Apps Script");
  }

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Request failed");
  }

  return result;
}

function triggerVoteAnimation(ideaId, voteType, mode) {
  state.voteAnimation = {
    ideaId: String(ideaId),
    voteType,
    mode,
  };
  renderIdeasFeed();
  window.clearTimeout(triggerVoteAnimation.timeoutId);
  triggerVoteAnimation.timeoutId = window.setTimeout(() => {
    state.voteAnimation = null;
    renderIdeasFeed();
  }, 560);
}

async function handleVoteClick(event) {
  const button = event.target.closest(".vote-button");

  if (!button) {
    return;
  }

  const card = button.closest("[data-idea-id]");

  if (!card) {
    return;
  }

  const ideaId = card.dataset.ideaId;
  const clickedVote = button.dataset.voteType;
  const entry = state.ideas.find((ideaEntry) => String(ideaEntry.id) === ideaId);
  const previousVote = state.userVotes[ideaId] || "";
  const nextVote = previousVote === clickedVote ? "" : clickedVote;

  if (!entry || state.activeVoteId === ideaId) {
    return;
  }

  state.activeVoteId = ideaId;
  renderIdeasFeed();

  try {
    const result = await sendJsonRequest({
      action: "vote",
      ideaId,
      previousVote,
      nextVote,
    });

    entry.upvotes = Number(result.upvotes || 0);
    entry.downvotes = Number(result.downvotes || 0);

    if (nextVote) {
      state.userVotes[ideaId] = nextVote;
      setFeedStatus(getText("voteSaved"));
      triggerVoteAnimation(ideaId, nextVote, previousVote ? "switch" : "add");
    } else {
      delete state.userVotes[ideaId];
      setFeedStatus(getText("voteRemoved"));
      triggerVoteAnimation(ideaId, clickedVote, "remove");
    }

    saveStoredVotes();
  } catch (error) {
    console.error(error);
    setFeedStatus(`${getText("voteError")} ${error.message || ""}`.trim());
  } finally {
    state.activeVoteId = null;
    renderIdeasFeed();
  }
}

function setupInfiniteScroll() {
  if (!("IntersectionObserver" in window)) {
    return;
  }

  state.observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        loadIdeas();
      }
    });
  }, {
    rootMargin: "180px 0px",
  });

  state.observer.observe(elements.feedSentinel);
}

function openModal() {
  elements.modal.hidden = false;
  elements.modalBackdrop.hidden = false;
  requestAnimationFrame(() => {
    elements.body.classList.add("modal-open");
    elements.modal.classList.add("is-open");
    elements.modalBackdrop.classList.add("is-visible");
  });
  setTimeout(() => elements.nameInput.focus(), 120);
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
  elements.submitButtonLabel.textContent = getText("submitting");
  setFormMessage("", "");

  let savedRemotely = false;
  let remoteErrorMessage = "";

  try {
    if (SCRIPT_URL.includes("PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE")) {
      throw new Error("Missing Apps Script URL");
    }

    const result = await sendJsonRequest({
      action: "submitIdea",
      name,
      idea,
      date,
    });
    savedRemotely = true;
    prependIdeaToFeed({
      id: result.ideaId,
      name,
      idea,
      date,
      upvotes: 0,
      downvotes: 0,
    });
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

    if (!savedRemotely) {
      prependIdeaToFeed({
        id: `local-${Date.now()}`,
        name,
        idea,
        date,
        upvotes: 0,
        downvotes: 0,
      });
    }

    elements.form.reset();
    updateCounter();
    closeModal();

    elements.submitButton.disabled = false;
    elements.submitButtonLabel.textContent = originalSubmitText;
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
  state.userVotes = loadStoredVotes();
  applyTranslations();
  updateCounter();
  setupInfiniteScroll();
  loadIdeas();

  if (elements.languageToggle) {
    elements.languageToggle.addEventListener("click", toggleLanguage);
  }
  elements.openFormButton.addEventListener("click", openModal);
  elements.submitAnotherButton.addEventListener("click", openModal);
  elements.closeFormButton.addEventListener("click", closeModal);
  elements.cancelButton.addEventListener("click", closeModal);
  elements.modalBackdrop.addEventListener("click", closeModal);
  elements.ideaInput.addEventListener("input", updateCounter);
  elements.ideasFeedList.addEventListener("click", handleVoteClick);
  elements.form.addEventListener("submit", submitIdea);
  document.addEventListener("keydown", handleKeydown);
}

init();
