/**
 * API Service for connecting to Google Apps Script
 */

// Replace with your Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

export interface ApiResponse<T = any> {
  status: "success" | "error";
  data?: T;
  message?: string;
}

export async function callApi<T = any>(action: string, payload: any = {}): Promise<ApiResponse<T>> {
  try {
    // For local development or if URL is not set, use mock data
    if (API_URL.includes("YOUR_SCRIPT_ID")) {
      return getMockData(action) as ApiResponse<T>;
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify({ action, payload }),
    });

    const result = await response.json();
    return result as ApiResponse<T>;
  } catch (error) {
    console.error("API Error:", error);
    return { status: "error", message: "Connection failed" };
  }
}

function getMockData(action: string) {
  switch (action) {
    case "getDashboard":
      return {
        status: "success",
        data: {
          total: 150,
          statusCount: { "ว่าง": 20, "ผสมแล้ว": 45, "ท้อง": 65, "เลี้ยงลูก": 20 }
        }
      };
    case "getSows":
      return {
        status: "success",
        data: [
          { sow_id: "S001", breed: "Landrace", status: "ท้อง", current_parity: 3, entry_date: "10-01-2025" },
          { sow_id: "S002", breed: "Yorkshire", status: "เลี้ยงลูก", current_parity: 1, entry_date: "20-05-2025" },
          { sow_id: "S003", breed: "Duroc", status: "ว่าง", current_parity: 0, entry_date: "15-02-2026" },
          { sow_id: "S004", breed: "Landrace", status: "ผสมแล้ว", current_parity: 2, entry_date: "05-11-2025" },
          { sow_id: "S005", breed: "Yorkshire", status: "ท้อง", current_parity: 4, entry_date: "12-03-2025" },
        ]
      };
    case "getSowHistory":
      return {
        status: "success",
        data: [
          { type: "การผสม", date: "10-03-2026", details: "ผสมกับพ่อพันธุ์ B123 โดย นายสมชาย" },
          { type: "ตรวจท้องรอบ 21 วัน", date: "31-03-2026", details: "กำหนดตรวจท้องรอบแรก (21 วัน)" },
          { type: "ตรวจท้องรอบ 42 วัน", date: "21-04-2026", details: "กำหนดตรวจท้องรอบสอง (42 วัน)" },
          { type: "กำหนดวันคลอด", date: "02-07-2026", details: "กำหนดวันคลอด (114 วัน)" },
        ]
      };
    case "getTasks":
      return {
        status: "success",
        data: [
          { 
            id: "t1", 
            sow_id: "S004", 
            type: "ตรวจสัด (21 วัน)", 
            days_passed: 21,
            description: "🔔 ครบ 21 วันแล้ว! อย่าลืมตรวจดูว่าแม่หมูกลับสัดหรือไม่",
            actions: [
              { label: "✅ ไม่พบการกลับสัด", type: "success" },
              { label: "❌ กลับสัด/ไม่ติด", next_status: "ว่าง", type: "danger" }
            ]
          },
          { 
            id: "t2", 
            sow_id: "S001", 
            type: "ตรวจท้อง (30 วัน)", 
            days_passed: 30,
            description: "🔔 ครบ 30 วันแล้ว! ได้เวลาทำ Ultrasound ตรวจท้อง",
            actions: [
              { label: "✅ ยืนยันการตั้งท้อง", next_status: "ท้อง", type: "success" },
              { label: "❌ ไม่ท้อง/แท้ง", next_status: "ว่าง", type: "danger", isAbortion: true }
            ]
          },
          { 
            id: "t_vax", 
            sow_id: "S009", 
            type: "วัคซีนบำรุง (14-21 วันหลังผสม)", 
            days_passed: 18,
            description: "💉 ครบกำหนดฉีดวัคซีนบำรุง และตรวจสุขภาพพื้นฐาน",
            actions: [
              { label: "🆗 ดำเนินการแล้ว", type: "success" }
            ]
          },
          { 
            id: "t3", 
            sow_id: "S005", 
            type: "บำรุงอาหาร (85 วัน)", 
            days_passed: 85,
            description: "🔔 ครบ 85 วัน! เริ่มปรับเพิ่มปริมาณอาหารระยะท้าย",
            actions: [
              { label: "🆗 รับทราบ/ดำเนินการแล้ว", type: "success" },
              { label: "⚠️ บันทึกการแท้ง", next_status: "ว่าง", type: "danger", isAbortion: true }
            ]
          },
          { 
            id: "t_deworm", 
            sow_id: "S006", 
            type: "เตรียมตัวก่อนคลอด (100 วัน)", 
            days_passed: 100,
            description: "🧼 ถ่ายพยาธิและอาบน้ำแม่หมู ก่อนย้ายเข้าคอกคลอด",
            actions: [
              { label: "🆗 ดำเนินการแล้ว", type: "success" }
            ]
          },
          { 
            id: "t5", 
            sow_id: "S007", 
            type: "วันคลอด (110-114 วัน)", 
            days_passed: 112,
            description: "👶 แม่หมูพร้อมคลอดแล้ว! (สามารถบันทึกได้ตั้งแต่วันที่ 110)",
            actions: [
              { label: "👶 บันทึกการคลอดจริง", next_status: "เลี้ยงลูก", type: "success", isFarrowing: true }
            ]
          },
          { 
            id: "t_delayed", 
            sow_id: "S010", 
            type: "กลับสัดช้า (หลังหย่านม 8 วัน)", 
            days_passed: 8,
            description: "⚠️ แม่หมูยังไม่กลับสัดหลังหย่านมเกิน 7 วัน กรุณาตรวจเช็กสุขภาพ",
            actions: [
              { label: "➕ บันทึกการผสมพันธุ์", next_status: "ผสมแล้ว", type: "success" },
              { label: "🏥 ตรวจสุขภาพแล้ว", type: "info" }
            ]
          }
        ]
      };
    case "deleteSow":
      return { status: "success", message: "Sow deleted" };
    case "addSow":
      return { status: "success", message: "Sow added" };
    case "completeTask":
      return { status: "success", message: "Task completed" };
    default:
      return { status: "success", data: [] };
  }
}
