var SPREADSHEET_ID = "";
var SHEET_NAME = "Ideas";
var LIVREDOR_SHEET_NAME = "LivreDor";
var LIVREDOR_PHOTO_FOLDER_NAME = "LivreDor Photos";
var DEFAULT_PAGE_SIZE = 8;
var DATE_COLUMN = 1;
var NAME_COLUMN = 2;
var IDEA_COLUMN = 3;
var UPVOTES_COLUMN = 4;
var DOWNVOTES_COLUMN = 5;
var LIVREDOR_MESSAGE_COLUMN = 3;
var LIVREDOR_PHOTO_URLS_COLUMN = 4;
var LIVREDOR_PHOTO_FILE_IDS_COLUMN = 5;
var LIVREDOR_DISPLAY_COLUMN = 6;
var API_VERSION = "livredor-2026-05-08-2";
var MAX_LIVREDOR_PHOTO_COUNT = 6;
var MAX_LIVREDOR_MESSAGE_LENGTH = 2000;

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action || "ideas").toString();
    if (action === "version") {
      return jsonResponse({
        success: true,
        version: API_VERSION,
        supportsLivredor: true
      });
    }

    if (action === "livredor") {
      var livredorLimit = getPositiveInteger_(e && e.parameter && e.parameter.limit, 30);
      return jsonResponse({
        success: true,
        entries: getLivredorEntries_(livredorLimit)
      });
    }

    var offset = getPositiveInteger_(e && e.parameter && e.parameter.offset, 0);
    var limit = getPositiveInteger_(e && e.parameter && e.parameter.limit, DEFAULT_PAGE_SIZE);
    var payload = getIdeasPage_(offset, limit);
    return jsonResponse({
      success: true,
      ideas: payload.ideas,
      hasMore: payload.hasMore,
      nextOffset: payload.nextOffset
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || "Unknown error"
    });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        success: false,
        message: "Missing request body"
      });
    }

    var data = parseRequestBody_(e.postData.contents);
    var action = (data.action || "submitIdea").toString();
    if (action === "vote") {
      return handleVote_(data);
    }
    if (action === "submitLivredor" || isLivredorPayload_(data)) {
      return handleLivredorSubmission_(data);
    }

    var name = (data.name || "").toString().trim();
    var idea = (data.idea || "").toString().trim();
    var date = (data.date || new Date().toISOString()).toString();

    if (!idea) {
      return jsonResponse({
        success: false,
        message: "Idea is required"
      });
    }

    if (idea.length > 300) {
      return jsonResponse({
        success: false,
        message: "Idea must be 300 characters or fewer"
      });
    }

    var sheet = getIdeasSheet_();
    sheet.appendRow([date, name || "Anonymous", idea, 0, 0]);
    var ideaId = sheet.getLastRow();

    return jsonResponse({
      success: true,
      message: "Idea saved",
      ideaId: ideaId
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || "Unknown error"
    });
  }
}

function parseRequestBody_(contents) {
  return JSON.parse(contents);
}

function isLivredorPayload_(data) {
  return Object.prototype.hasOwnProperty.call(data, "message") ||
    Object.prototype.hasOwnProperty.call(data, "photo");
}

function getIdeasSheet_() {
  var spreadsheet = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('Sheet "' + SHEET_NAME + '" not found');
  }

  return sheet;
}

function getLivredorSheet_() {
  var spreadsheet = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(LIVREDOR_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(LIVREDOR_SHEET_NAME);
  }

  ensureLivredorHeaders_(sheet);
  return sheet;
}

function ensureLivredorHeaders_(sheet) {
  var headers = ["Date", "Name", "Message", "PhotoUrls", "PhotoFileIds", "Display"];
  var currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];

  headers.forEach(function(header, index) {
    if (!currentHeaders[index]) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });

  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
}

function getIdeasPage_(offset, limit) {
  var sheet = getIdeasSheet_();
  var lastRow = sheet.getLastRow();
  var totalIdeas = Math.max(lastRow - 1, 0);

  if (!totalIdeas || offset >= totalIdeas) {
    return {
      ideas: [],
      hasMore: false,
      nextOffset: offset
    };
  }

  var safeLimit = Math.min(Math.max(limit, 1), 30);
  var remaining = totalIdeas - offset;
  var rowCount = Math.min(safeLimit, remaining);
  var endRow = lastRow - offset;
  var startRow = endRow - rowCount + 1;
  var values = sheet.getRange(startRow, 1, rowCount, DOWNVOTES_COLUMN).getValues();
  var ideas = values
    .map(function(row, index) {
      var sheetRow = startRow + index;
      return {
        id: sheetRow,
        date: row[DATE_COLUMN - 1],
        name: row[NAME_COLUMN - 1],
        idea: row[IDEA_COLUMN - 1],
        upvotes: normalizeVoteCount_(row[UPVOTES_COLUMN - 1]),
        downvotes: normalizeVoteCount_(row[DOWNVOTES_COLUMN - 1])
      };
    })
    .filter(function(entry) {
      return entry.idea;
    })
    .reverse();

  return {
    ideas: ideas,
    hasMore: offset + rowCount < totalIdeas,
    nextOffset: offset + rowCount
  };
}

function handleVote_(data) {
  var ideaId = getPositiveInteger_(data.ideaId, 0);
  var previousVote = normalizeVoteType_((data.previousVote || "").toString());
  var nextVote = normalizeVoteType_((data.nextVote || "").toString());

  if (!ideaId) {
    return jsonResponse({
      success: false,
      message: "Missing idea ID"
    });
  }

  if (previousVote === "invalid" || nextVote === "invalid") {
    return jsonResponse({
      success: false,
      message: "Invalid vote value"
    });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    var sheet = getIdeasSheet_();
    var lastRow = sheet.getLastRow();

    if (ideaId <= 1 || ideaId > lastRow) {
      return jsonResponse({
        success: false,
        message: "Idea not found"
      });
    }

    var values = sheet.getRange(ideaId, DATE_COLUMN, 1, DOWNVOTES_COLUMN).getValues()[0];
    var ideaText = values[IDEA_COLUMN - 1];

    if (!ideaText) {
      return jsonResponse({
        success: false,
        message: "Idea not found"
      });
    }

    var upvotes = normalizeVoteCount_(values[UPVOTES_COLUMN - 1]);
    var downvotes = normalizeVoteCount_(values[DOWNVOTES_COLUMN - 1]);

    if (previousVote === "up") {
      upvotes = Math.max(0, upvotes - 1);
    } else if (previousVote === "down") {
      downvotes = Math.max(0, downvotes - 1);
    }

    if (nextVote === "up") {
      upvotes += 1;
    } else if (nextVote === "down") {
      downvotes += 1;
    }

    sheet.getRange(ideaId, UPVOTES_COLUMN).setValue(upvotes);
    sheet.getRange(ideaId, DOWNVOTES_COLUMN).setValue(downvotes);

    return jsonResponse({
      success: true,
      message: "Vote saved",
      ideaId: ideaId,
      upvotes: upvotes,
      downvotes: downvotes
    });
  } finally {
    lock.releaseLock();
  }
}

function handleLivredorSubmission_(data) {
  var name = (data.name || "").toString().trim();
  var message = (data.message || "").toString().trim();
  var date = (data.date || new Date().toISOString()).toString();
  var photos = normalizeLivredorPhotos_(data);

  if (!name) {
    return jsonResponse({
      success: false,
      message: "Name is required"
    });
  }

  if (!message) {
    return jsonResponse({
      success: false,
      message: "Message is required"
    });
  }

  if (message.length > MAX_LIVREDOR_MESSAGE_LENGTH) {
    return jsonResponse({
      success: false,
      message: "Message must be " + MAX_LIVREDOR_MESSAGE_LENGTH + " characters or fewer"
    });
  }

  var photoFiles = saveLivredorPhotos_(photos);
  var photoUrls = photoFiles.map(function(file) {
    return getPublicDriveImageUrl_(file.getId());
  });
  var photoFileIds = photoFiles.map(function(file) {
    return file.getId();
  });
  var sheet = getLivredorSheet_();
  var entryRow = getNextLivredorRow_(sheet);

  sheet
    .getRange(entryRow, 1, 1, LIVREDOR_DISPLAY_COLUMN)
    .setValues([[date, name, message, JSON.stringify(photoUrls), JSON.stringify(photoFileIds), true]]);
  sheet.getRange(entryRow, LIVREDOR_DISPLAY_COLUMN).insertCheckboxes().setValue(true);

  return jsonResponse({
    success: true,
    message: "Livre d'or entry saved",
    entryId: entryRow,
    photoUrls: photoUrls
  });
}

function getLivredorEntries_(limit) {
  var sheet = getLivredorSheet_();
  var lastEntryRow = getLastLivredorEntryRow_(sheet);
  var totalEntries = Math.max(lastEntryRow - 1, 0);

  if (!totalEntries) {
    return [];
  }

  var safeLimit = Math.min(Math.max(limit, 1), 50);
  var values = sheet.getRange(2, 1, totalEntries, LIVREDOR_DISPLAY_COLUMN).getValues();
  return values
    .map(function(row, index) {
      return {
        id: index + 2,
        date: row[DATE_COLUMN - 1],
        name: row[NAME_COLUMN - 1],
        message: row[LIVREDOR_MESSAGE_COLUMN - 1],
        photoUrl: getFirstLivredorPhotoUrl_(row[LIVREDOR_PHOTO_URLS_COLUMN - 1]),
        photoUrls: parseLivredorPhotoUrls_(row[LIVREDOR_PHOTO_URLS_COLUMN - 1]),
        display: row[LIVREDOR_DISPLAY_COLUMN - 1]
      };
    })
    .filter(function(entry) {
      return entry.message && shouldDisplayLivredorEntry_(entry.display);
    })
    .reverse()
    .slice(0, safeLimit);
}

function shouldDisplayLivredorEntry_(value) {
  if (value === true) {
    return true;
  }

  return value.toString().toLowerCase() === "true";
}

function normalizeLivredorPhotos_(data) {
  if (Array.isArray(data.photos)) {
    return data.photos.filter(function(photo) {
      return photo && photo.data;
    });
  }

  if (data.photo && data.photo.data) {
    return [data.photo];
  }

  return [];
}

function saveLivredorPhotos_(photos) {
  if (photos.length > MAX_LIVREDOR_PHOTO_COUNT) {
    throw new Error("Too many photos");
  }

  return photos.map(function(photo) {
    return saveLivredorPhoto_(photo);
  });
}

function getNextLivredorRow_(sheet) {
  var maxRows = sheet.getMaxRows();
  if (maxRows <= 1) {
    return 2;
  }

  var messages = sheet.getRange(2, LIVREDOR_MESSAGE_COLUMN, maxRows - 1, 1).getValues();
  for (var index = 0; index < messages.length; index += 1) {
    if (!messages[index][0]) {
      return index + 2;
    }
  }

  return maxRows + 1;
}

function getLastLivredorEntryRow_(sheet) {
  var maxRows = sheet.getMaxRows();
  if (maxRows <= 1) {
    return 1;
  }

  var messages = sheet.getRange(2, LIVREDOR_MESSAGE_COLUMN, maxRows - 1, 1).getValues();
  for (var index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index][0]) {
      return index + 2;
    }
  }

  return 1;
}

function parseLivredorPhotoUrls_(value) {
  if (!value) {
    return [];
  }

  var stringValue = value.toString();
  if (stringValue.charAt(0) !== "[") {
    return [stringValue];
  }

  try {
    var parsed = JSON.parse(stringValue);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (error) {
    return [stringValue];
  }
}

function getFirstLivredorPhotoUrl_(value) {
  var urls = parseLivredorPhotoUrls_(value);
  return urls.length ? urls[0] : "";
}

function saveLivredorPhoto_(photo) {
  var mimeType = (photo.mimeType || "").toString();
  var fileName = (photo.name || "livre-dor-photo").toString();

  if (!mimeType.match(/^image\/(png|jpe?g|webp)$/)) {
    throw new Error("Photo must be a PNG, JPEG, or WebP image");
  }

  var bytes = Utilities.base64Decode(photo.data);
  if (bytes.length > 4 * 1024 * 1024) {
    throw new Error("Photo must be smaller than 4 MB");
  }

  var blob = Utilities.newBlob(bytes, mimeType, sanitizeFileName_(fileName));
  var folder = getLivredorPhotoFolder_();
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file;
}

function getLivredorPhotoFolder_() {
  var folders = DriveApp.getFoldersByName(LIVREDOR_PHOTO_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(LIVREDOR_PHOTO_FOLDER_NAME);
}

function getPublicDriveImageUrl_(fileId) {
  return "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(fileId);
}

function sanitizeFileName_(fileName) {
  return fileName.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120) || "livre-dor-photo";
}

function normalizeVoteType_(value) {
  if (!value) {
    return "";
  }

  if (value === "up" || value === "down") {
    return value;
  }

  return "invalid";
}

function normalizeVoteCount_(value) {
  var number = Number(value);
  return isNaN(number) ? 0 : number;
}

function getPositiveInteger_(value, fallbackValue) {
  var number = parseInt(value, 10);
  return isNaN(number) || number < 0 ? fallbackValue : number;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function authorizeDrive() {
  getLivredorPhotoFolder_();
}
