var SPREADSHEET_ID = "";
var SHEET_NAME = "Ideas";
var MAX_FEED_ITEMS = 8;

function doGet() {
  try {
    var ideas = getRecentIdeas_();
    return jsonResponse({
      success: true,
      ideas: ideas
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
    sheet.appendRow([date, name || "Anonymous", idea]);

    return jsonResponse({
      success: true,
      message: "Idea saved"
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

function getRecentIdeas_() {
  var sheet = getIdeasSheet_();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  var rowCount = Math.min(MAX_FEED_ITEMS, lastRow - 1);
  var startRow = lastRow - rowCount + 1;
  var values = sheet.getRange(startRow, 1, rowCount, 3).getValues();

  return values
    .reverse()
    .map(function(row) {
      return {
        date: row[0],
        name: row[1],
        idea: row[2]
      };
    })
    .filter(function(entry) {
      return entry.idea;
    });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
