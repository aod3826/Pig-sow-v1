/**
 * Smart Sow Productivity System - Backend (Google Apps Script)
 * Standard: PigCHAMP
 */

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  return handleResponse({ status: "ok", message: "API is running" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case "login":
        return login(data.payload);
      case "getDashboard":
        return getDashboardData();
      case "getSows":
        return getSows();
      case "addSow":
        return addSow(data.payload);
      case "recordBreeding":
        return recordBreeding(data.payload);
      case "recordFarrowing":
        return recordFarrowing(data.payload);
      case "getTasks":
        return getTasksToday();
      case "recordMonitoring":
        return recordMonitoring(data.payload);
      case "recordFarrowing":
        return recordFarrowing(data.payload);
      case "recordWeaning":
        return recordWeaning(data.payload);
      case "getSowHistory":
        return getSowHistory(data.payload.sow_id);
      case "deleteSow":
        return deleteSow(data.payload.sow_id);
      case "completeTask":
        return completeTask(data.payload.task_id);
      default:
        return handleResponse({ status: "error", message: "Invalid action" });
    }
  } catch (err) {
    return handleResponse({ status: "error", message: err.toString() });
  }
}

// --- New Logic Functions ---

function deleteSow(sowId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Sows");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == sowId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return handleResponse({ status: "success", message: "Sow deleted" });
}

function completeTask(taskId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Tasks");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == taskId) {
      // In a real app, you might move it to a 'CompletedTasks' sheet
      // or just delete it if it's a temporary notification
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return handleResponse({ status: "success", message: "Task completed" });
}

// --- New Logic Functions ---

function recordMonitoring(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Monitoring");
  sheet.appendRow([
    Utilities.getUuid(),
    payload.cycle_id,
    payload.date,
    payload.result
  ]);

  // Update Sow Status based on result
  let status = "Pregnant";
  if (payload.result === "Not Pregnant" || payload.result === "Aborted") {
    status = "Open";
  }
  updateSowStatus(payload.sow_id, status);

  return handleResponse({ status: "success", message: "Monitoring recorded" });
}

function recordFarrowing(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Farrowing");
  sheet.appendRow([
    Utilities.getUuid(),
    payload.cycle_id,
    payload.date,
    payload.live_born,
    payload.stillborn,
    payload.mummy,
    payload.birth_weight
  ]);

  updateSowStatus(payload.sow_id, "Lactating");
  return handleResponse({ status: "success", message: "Farrowing recorded" });
}

function recordWeaning(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Weaning");
  
  // Calculate Lactation Length (Simplified)
  const lacLength = 21; // In real app, calculate from Farrowing date

  sheet.appendRow([
    Utilities.getUuid(),
    payload.cycle_id,
    payload.date,
    payload.count,
    payload.total_weight,
    lacLength
  ]);

  updateSowStatus(payload.sow_id, "Open");
  // Increment Parity
  incrementSowParity(payload.sow_id);

  return handleResponse({ status: "success", message: "Weaning recorded" });
}

function incrementSowParity(sowId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Sows");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == sowId) {
      const currentParity = parseInt(data[i][5]) || 0;
      sheet.getRange(i + 1, 6).setValue(currentParity + 1);
      break;
    }
  }
}

function getSowHistory(sowId) {
  // Logic to join Cycles, Breeding, Farrowing for a specific sow
  return handleResponse({ status: "success", data: [] });
}

function handleResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Logic Functions ---

function getDashboardData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sowSheet = ss.getSheetByName("Sows");
  const sows = sowSheet.getDataRange().getValues();
  sows.shift(); // Remove header

  const stats = {
    total: sows.length,
    statusCount: {
      "Open": 0,
      "Bred": 0,
      "Pregnant": 0,
      "Lactating": 0
    }
  };

  sows.forEach(row => {
    const status = row[4];
    if (stats.statusCount[status] !== undefined) stats.statusCount[status]++;
  });

  return handleResponse({ status: "success", data: stats });
}

function recordBreeding(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const breedingSheet = ss.getSheetByName("Breeding");
  const sowSheet = ss.getSheetByName("Sows");

  const breedDate = new Date(payload.date);
  const due21 = new Date(breedDate); due21.setDate(breedDate.getDate() + 21);
  const due42 = new Date(breedDate); due42.setDate(breedDate.getDate() + 42);
  const dueFarrow = new Date(breedDate); dueFarrow.setDate(breedDate.getDate() + 114);

  breedingSheet.appendRow([
    Utilities.getUuid(),
    payload.cycle_id,
    payload.date,
    payload.boar_id,
    payload.technician,
    due21,
    due42,
    dueFarrow
  ]);

  // Update Sow Status
  updateSowStatus(payload.sow_id, "Bred");

  return handleResponse({ status: "success", message: "Breeding recorded" });
}

function updateSowStatus(sowId, newStatus) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Sows");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == sowId) {
      sheet.getRange(i + 1, 5).setValue(newStatus);
      break;
    }
  }
}

function getTasksToday() {
  // Logic to find tasks due today from Breeding/Monitoring sheets
  return handleResponse({ status: "success", data: [] });
}
