var SPREADSHEET_ID = "";
var SHEET_NAME = "Ideas";
var DEFAULT_PAGE_SIZE = 8;
var DATE_COLUMN = 1;
var NAME_COLUMN = 2;
var IDEA_COLUMN = 3;
var UPVOTES_COLUMN = 4;
var DOWNVOTES_COLUMN = 5;

function doGet(e) {
  try {
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
