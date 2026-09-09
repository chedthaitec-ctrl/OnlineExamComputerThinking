/**
 * ====================================================================
 * ระบบข้อสอบออนไลน์ พร้อมระบบตรวจจับการสลับหน้าจอ (Anti-Cheat Web App)
 * Google Apps Script (Backend)
 * ====================================================================
 */

// 1. ฟังก์ชัน Render หน้าเว็บ Web App
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('ระบบทำข้อสอบออนไลน์ - Anti-Cheat Exam')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 1.1 สร้างเมนูบนแถบ Google Sheet เมื่อเปิดชีต
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚨 ศูนย์คุมสอบ (Exam Monitor)')
    .addItem('🔊 เปิดเสียงไซเรนเตือน CheatLogs (Live Siren)', 'showLiveMonitorSidebar')
    .addSeparator()
    .addItem('🛠️ ติดตั้งฐานข้อมูล (setupDatabase)', 'setupDatabase')
    .addToUi();
}

// 1.2 เปิด Sidebar ส่งเสียงไซเรนและโฟกัสไปที่แท็บ CheatLogs ทันที
function showLiveMonitorSidebar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    var sheet = ss.getSheetByName('CheatLogs');
    if (sheet) {
      ss.setActiveSheet(sheet);
    }
  }

  var html = HtmlService.createHtmlOutputFromFile('MonitorSidebar')
    .setTitle('🚨 ระบบไซเรนตรวจจับสลับหน้าจอ')
    .setWidth(320);

  SpreadsheetApp.getUi().showSidebar(html);
}

// 2. ฟังก์ชันเตรียมฐานข้อมูลใน Google Sheet (รันครั้งแรกเพื่อสร้างตารางอัตโนมัติ)
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 2.1 ชีตข้อสอบ (Questions)
  var qSheet = ss.getSheetByName('Questions');
  if (!qSheet) {
    qSheet = ss.insertSheet('Questions');
    qSheet.appendRow(['ID', 'คำถาม', 'ตัวเลือก A', 'ตัวเลือก B', 'ตัวเลือก C', 'ตัวเลือก D', 'เฉลย', 'คะแนน']);
    // ตัวอย่างข้อสอบ
    qSheet.appendRow([1, 'ข้อใดเป็นฟังก์ชันตรวจจับการสลับแท็บบนหน้าเว็บ?', 'document.hidden / visibilitychange', 'window.location', 'console.log()', 'localStorage.getItem()', 'A', 1]);
    qSheet.appendRow([2, 'HTML Service ใน Google Apps Script ใช้คำสั่งใดในการแสดงหน้าเว็บ?', 'HtmlService.createHtmlOutputFromFile()', 'SpreadsheetApp.render()', 'Browser.msgBox()', 'DriveApp.createFile()', 'A', 1]);
    qSheet.appendRow([3, 'เหตุการณ์ (Event) ใดใช้ตรวจจับการหลุดโฟกัสของหน้าต่างเบราว์เซอร์?', 'window.onfocus', 'window.onblur', 'document.onload', 'window.onresize', 'B', 1]);
    qSheet.appendRow([4, 'ภาษาหลักที่ใช้เขียน Logic ฝั่งเซิร์ฟเวอร์บน Google Apps Script คือภาษาใด?', 'Python', 'PHP', 'JavaScript', 'C#', 'C', 1]);
    qSheet.appendRow([5, 'การส่งข้อมูลจาก Frontend กลับมายังฟังก์ชันบน Code.gs ใช้คำสั่งใด?', 'fetch("/api")', 'google.script.run', 'axios.post()', 'ajax.send()', 'B', 1]);
    
    // ตกแต่งหัวตาราง
    qSheet.getRange(1, 1, 1, 8).setBackground('#4F46E5').setFontColor('#FFFFFF').setFontWeight('bold');
    qSheet.setFrozenRows(1);
  }

  // 2.2 ชีตผลคะแนน (Submissions)
  var subSheet = ss.getSheetByName('Submissions');
  if (!subSheet) {
    subSheet = ss.insertSheet('Submissions');
    subSheet.appendRow(['วัน-เวลาส่ง', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'คะแนนที่ได้', 'คะแนนเต็ม', 'ร้อยละ (%)', 'จำนวนครั้งที่สลับจอ', 'สถานะการส่ง', 'เวลาที่ใช้ (วินาที)']);
    subSheet.getRange(1, 1, 1, 9).setBackground('#059669').setFontColor('#FFFFFF').setFontWeight('bold');
    subSheet.setFrozenRows(1);
  }

  // 2.3 ชีตบันทึกการกระทำผิด (CheatLogs)
  var logSheet = ss.getSheetByName('CheatLogs');
  if (!logSheet) {
    logSheet = ss.insertSheet('CheatLogs');
    logSheet.appendRow(['วัน-เวลาเกิดเหตุ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'การเตือนครั้งที่', 'ประเภทเหตุการณ์', 'รายละเอียด']);
    logSheet.getRange(1, 1, 1, 6).setBackground('#DC2626').setFontColor('#FFFFFF').setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }

  return 'สร้างฐานข้อมูลเรียบร้อยแล้ว!';
}

// 3. ฟังก์ชันดึงข้อสอบส่งไปหน้าบ้าน (ไม่ส่งเฉลย เพื่อป้องกันการดู Source Code)
function getExamQuestions() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss ? ss.getSheetByName('Questions') : null;

    if (!sheet || sheet.getLastRow() <= 1) {
      // หากยังไม่ได้ผูกชีตหรือไม่มีข้อมูล ส่งข้อสอบตั้งต้นให้ทดสอบได้ทันที
      return {
        success: true,
        durationMinutes: 15, // กำหนดเวลาสอบ (นาที)
        maxAllowedSwitches: 2, // สลับได้ไม่เกินกี่ครั้ง (ครั้งที่ 3 จะตัดสิทธิ์)
        questions: [
          {
            id: 1,
            question: "1. ข้อใดเป็นฟังก์ชันตรวจจับการสลับแท็บบนหน้าเว็บใน JavaScript?",
            options: {
              A: "document.hidden / visibilitychange",
              B: "window.location",
              C: "console.log()",
              D: "localStorage.getItem()"
            },
            score: 1
          },
          {
            id: 2,
            question: "2. HTML Service ใน Google Apps Script ใช้คำสั่งใดในการแสดงหน้าเว็บ?",
            options: {
              A: "HtmlService.createHtmlOutputFromFile()",
              B: "SpreadsheetApp.render()",
              C: "Browser.msgBox()",
              D: "DriveApp.createFile()"
            },
            score: 1
          },
          {
            id: 3,
            question: "3. เหตุการณ์ (Event) ใดใช้ตรวจจับการหลุดโฟกัสของหน้าต่างเบราว์เซอร์?",
            options: {
              A: "window.onfocus",
              B: "window.onblur",
              C: "document.onload",
              D: "window.onresize()"
            },
            score: 1
          },
          {
            id: 4,
            question: "4. ภาษาหลักที่ใช้เขียน Logic ฝั่งเซิร์ฟเวอร์บน Google Apps Script คือภาษาใด?",
            options: {
              A: "Python",
              B: "PHP",
              C: "JavaScript",
              D: "C#"
            },
            score: 1
          },
          {
            id: 5,
            question: "5. การส่งข้อมูลจาก Frontend กลับมายังฟังก์ชันบน Code.gs ใช้คำสั่งใด?",
            options: {
              A: "fetch('/api')",
              B: "google.script.run",
              C: "axios.post()",
              D: "ajax.send()"
            },
            score: 1
          }
        ]
      };
    }

    var data = sheet.getDataRange().getValues();
    var questions = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0] && row[1]) {
        questions.push({
          id: row[0],
          question: row[0] + '. ' + row[1],
          options: {
            A: row[2],
            B: row[3],
            C: row[4],
            D: row[5]
          },
          score: Number(row[7]) || 1
        });
      }
    }

    return {
      success: true,
      durationMinutes: 15,
      maxAllowedSwitches: 2,
      questions: questions
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 4. ฟังก์ชันตรวจข้อสอบ บันทึกคะแนน และบันทึกประวัติการสลับหน้าจอ (Cheat Logs)
function submitExamResult(payload) {
  try {
    var studentId = payload.studentId || '-';
    var studentName = payload.studentName || '-';
    var answers = payload.answers || {};
    var switchCount = Number(payload.switchCount) || 0;
    var cheatLogs = payload.cheatLogs || [];
    var isAutoSubmitted = payload.isAutoSubmitted || false;
    var timeSpent = Number(payload.timeSpent) || 0;
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');

    // 4.1 ตรวจคำตอบกับเฉลยในชีต (หรือเฉลย Default)
    var correctAnswersMap = getCorrectAnswersMap();
    var userScore = 0;
    var totalScore = 0;

    for (var qId in correctAnswersMap) {
      var item = correctAnswersMap[qId];
      totalScore += item.score;
      if (answers[qId] && answers[qId].toUpperCase() === item.answer.toUpperCase()) {
        userScore += item.score;
      }
    }

    var percentage = totalScore > 0 ? ((userScore / totalScore) * 100).toFixed(2) : 0;
    var status = isAutoSubmitted 
      ? 'ส่งอัตโนมัติ (สลับหน้าจอเกินกำหนด)' 
      : (switchCount > 0 ? 'ส่งปกติ (มีประวัติสลับหน้าจอ ' + switchCount + ' ครั้ง)' : 'ส่งปกติ (ไม่มีการสลับหน้าจอ)');

    // 4.2 บันทึกลง Google Sheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      // บันทึกลง Submissions
      var subSheet = ss.getSheetByName('Submissions');
      if (!subSheet) {
        setupDatabase();
        subSheet = ss.getSheetByName('Submissions');
      }
      subSheet.appendRow([
        nowStr,
        studentId,
        studentName,
        userScore,
        totalScore,
        percentage + '%',
        switchCount,
        status,
        timeSpent
      ]);

      // บันทึกลง CheatLogs (บันทึกเฉพาะเมื่อยังไม่ได้ถูกบันทึกแบบ Real-time)
      var logSheet = ss.getSheetByName('CheatLogs');
      if (logSheet && cheatLogs.length > 0 && !payload.alreadyRecordedLive) {
        for (var k = 0; k < cheatLogs.length; k++) {
          var log = cheatLogs[k];
          logSheet.appendRow([
            log.timestamp || nowStr,
            studentId,
            studentName,
            log.warningLevel || '-',
            log.eventType || 'สลับหน้าจอ',
            log.details || '-'
          ]);
        }
      }
    }

    return {
      success: true,
      studentName: studentName,
      studentId: studentId,
      score: userScore,
      totalScore: totalScore,
      percentage: percentage,
      switchCount: switchCount,
      status: status
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ฟังก์ชันภายในสำหรับดึงเฉลยจากชีต
function getCorrectAnswersMap() {
  var map = {
    1: { answer: 'A', score: 1 },
    2: { answer: 'A', score: 1 },
    3: { answer: 'B', score: 1 },
    4: { answer: 'C', score: 1 },
    5: { answer: 'B', score: 1 }
  };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var sheet = ss.getSheetByName('Questions');
      if (sheet && sheet.getLastRow() > 1) {
        var data = sheet.getDataRange().getValues();
        map = {};
        for (var i = 1; i < data.length; i++) {
          var id = data[i][0];
          var ans = data[i][6];
          var score = Number(data[i][7]) || 1;
          if (id && ans) {
            map[id] = { answer: String(ans).trim(), score: score };
          }
        }
      }
    }
  } catch (e) {
    // ใช้ map เริ่มต้น
  }
  return map;
}

// 5. ฟังก์ชันบันทึกการทุจริตแบบ Real-Time ทันทีที่สลับหน้าจอ (ส่งเสียงเตือนที่ชีต CheatLogs ทันที)
function recordLiveViolation(payload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { success: false, error: 'ไม่พบสเปรดชีต' };

    var logSheet = ss.getSheetByName('CheatLogs');
    if (!logSheet) {
      setupDatabase();
      logSheet = ss.getSheetByName('CheatLogs');
    }

    var nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');
    var studentId = payload.studentId || '-';
    var studentName = payload.studentName || '-';
    var warningLevel = payload.warningLevel || 1;
    var eventType = payload.eventType || 'สลับหน้าจอ';
    var details = payload.details || '-';

    logSheet.appendRow([
      nowStr,
      studentId,
      studentName,
      warningLevel,
      eventType,
      details
    ]);

    return { success: true, timestamp: nowStr };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 6. ฟังก์ชันสำหรับ Sidebar ตรวจหาแถวใหม่ใน CheatLogs เพื่อส่งเสียงไซเรนบน Google Sheet
function getLatestCheatLogs(lastKnownRowCount) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return { success: false, currentCount: 0, newLogs: [] };

    var logSheet = ss.getSheetByName('CheatLogs');
    if (!logSheet) return { success: false, currentCount: 0, newLogs: [] };

    var lastRow = logSheet.getLastRow();
    var lastKnown = Number(lastKnownRowCount) || 1;

    if (lastRow <= 1) {
      return { success: true, currentCount: 1, newLogs: [] };
    }

    // หากมีแถวใหม่เพิ่มขึ้นมา
    if (lastRow > lastKnown) {
      var numNew = lastRow - lastKnown;
      var range = logSheet.getRange(lastKnown + 1, 1, numNew, 6);
      var values = range.getValues();
      var newLogs = [];

      for (var i = 0; i < values.length; i++) {
        newLogs.push({
          timestamp: values[i][0] ? String(values[i][0]) : '',
          studentId: values[i][1] ? String(values[i][1]) : '',
          studentName: values[i][2] ? String(values[i][2]) : '',
          warningLevel: values[i][3] ? Number(values[i][3]) : 1,
          eventType: values[i][4] ? String(values[i][4]) : 'สลับหน้าจอ',
          details: values[i][5] ? String(values[i][5]) : ''
        });
      }

      return {
        success: true,
        currentCount: lastRow,
        newLogs: newLogs
      };
    }

    return {
      success: true,
      currentCount: lastRow,
      newLogs: []
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
